package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/pkg/logger"
)

// ErrOrderMissingRecipient is returned when NotificationService is
// asked to send an email for an order that has no customer email on
// file. This can happen if a guest order was created without a valid
// email; we refuse to silently drop notifications.
var ErrOrderMissingRecipient = errors.New("order has no customer email")

// NotificationService is the higher-level email notification API used
// by OrderService and PaymentService. It takes full *models.Order
// objects and extracts the data each template needs, delegating the
// actual rendering and delivery to an EmailSender (SMTP or noop).
//
// This is the type callers should inject; NotificationService handles
// the "do I have a user email or a guest email?" logic so the calling
// services don't need to.
type NotificationService interface {
	// SendOrderConfirmation notifies the customer that their order was
	// created (Requirement 21.1).
	SendOrderConfirmation(ctx context.Context, order *models.Order) error

	// SendPaymentConfirmation notifies the customer that payment was
	// received (Requirement 21.2).
	SendPaymentConfirmation(ctx context.Context, order *models.Order) error

	// SendShippingNotification notifies the customer that the order
	// has shipped, including tracking information (Requirement 21.3).
	SendShippingNotification(ctx context.Context, order *models.Order) error

	// SendPaymentRejection notifies the customer that transfer payment
	// was rejected (Requirement 21.4).
	SendPaymentRejection(ctx context.Context, order *models.Order, reason string) error

	// SendOrderCancellation notifies the customer that the order was
	// cancelled.
	SendOrderCancellation(ctx context.Context, order *models.Order) error

	// SendPasswordReset sends a password reset link. This passes
	// through to the underlying EmailSender since it is user- (not
	// order-) scoped.
	SendPasswordReset(ctx context.Context, email, token string) error

	// SendTransferDeadlineReminder warns the customer that their
	// transfer payment window is about to close (Requirement 11.1).
	SendTransferDeadlineReminder(ctx context.Context, order *models.Order) error
}

// notificationService is the default NotificationService implementation.
type notificationService struct {
	sender EmailSender
	log    *logger.Logger
}

// NewNotificationService creates a notification service backed by the
// given EmailSender. A nil logger is tolerated.
func NewNotificationService(sender EmailSender, log *logger.Logger) NotificationService {
	return &notificationService{
		sender: sender,
		log:    log,
	}
}

// resolveRecipient returns the email address to send order
// notifications to. For logged-in users the user's account email
// takes precedence; otherwise the guest email captured at checkout is
// used.
func resolveRecipient(order *models.Order) (string, error) {
	if order == nil {
		return "", errors.New("order is nil")
	}
	if order.User != nil && order.User.Email != "" {
		return order.User.Email, nil
	}
	if order.GuestEmail != "" {
		return order.GuestEmail, nil
	}
	return "", ErrOrderMissingRecipient
}

// SendOrderConfirmation implements NotificationService.
func (s *notificationService) SendOrderConfirmation(ctx context.Context, order *models.Order) error {
	email, err := resolveRecipient(order)
	if err != nil {
		return err
	}
	if err := s.sender.SendOrderConfirmation(ctx, email, order.OrderNumber); err != nil {
		s.logSendFailure("order_confirmation", email, order.OrderNumber, err)
		return fmt.Errorf("send order confirmation: %w", err)
	}
	return nil
}

// SendPaymentConfirmation implements NotificationService.
func (s *notificationService) SendPaymentConfirmation(ctx context.Context, order *models.Order) error {
	email, err := resolveRecipient(order)
	if err != nil {
		return err
	}
	if err := s.sender.SendPaymentConfirmation(ctx, email, order.OrderNumber); err != nil {
		s.logSendFailure("payment_confirmation", email, order.OrderNumber, err)
		return fmt.Errorf("send payment confirmation: %w", err)
	}
	return nil
}

// SendShippingNotification implements NotificationService.
func (s *notificationService) SendShippingNotification(ctx context.Context, order *models.Order) error {
	email, err := resolveRecipient(order)
	if err != nil {
		return err
	}
	if err := s.sender.SendShippingNotification(ctx, email, order.OrderNumber, order.TrackingNumber); err != nil {
		s.logSendFailure("shipping_notification", email, order.OrderNumber, err)
		return fmt.Errorf("send shipping notification: %w", err)
	}
	return nil
}

// SendPaymentRejection implements NotificationService.
func (s *notificationService) SendPaymentRejection(ctx context.Context, order *models.Order, reason string) error {
	email, err := resolveRecipient(order)
	if err != nil {
		return err
	}
	if err := s.sender.SendPaymentRejection(ctx, email, order.OrderNumber, reason); err != nil {
		s.logSendFailure("payment_rejection", email, order.OrderNumber, err)
		return fmt.Errorf("send payment rejection: %w", err)
	}
	return nil
}

// SendOrderCancellation implements NotificationService.
func (s *notificationService) SendOrderCancellation(ctx context.Context, order *models.Order) error {
	email, err := resolveRecipient(order)
	if err != nil {
		return err
	}
	if err := s.sender.SendOrderCancellation(ctx, email, order.OrderNumber); err != nil {
		s.logSendFailure("order_cancellation", email, order.OrderNumber, err)
		return fmt.Errorf("send order cancellation: %w", err)
	}
	return nil
}

// SendPasswordReset implements NotificationService.
func (s *notificationService) SendPasswordReset(ctx context.Context, email, token string) error {
	if email == "" {
		return errors.New("email is required")
	}
	if err := s.sender.SendPasswordReset(ctx, email, token); err != nil {
		s.logSendFailure("password_reset", email, "", err)
		return fmt.Errorf("send password reset: %w", err)
	}
	return nil
}

// SendTransferDeadlineReminder implements NotificationService.
func (s *notificationService) SendTransferDeadlineReminder(ctx context.Context, order *models.Order) error {
	email, err := resolveRecipient(order)
	if err != nil {
		return err
	}
	if err := s.sender.SendTransferDeadlineReminder(ctx, email, order.OrderNumber); err != nil {
		s.logSendFailure("transfer_deadline_reminder", email, order.OrderNumber, err)
		return fmt.Errorf("send transfer deadline reminder: %w", err)
	}
	return nil
}

// logSendFailure emits a structured log entry when the underlying
// sender exhausts its retries. The caller still gets the error, so
// this is purely observability.
func (s *notificationService) logSendFailure(kind, email, orderNumber string, err error) {
	if s.log == nil {
		return
	}
	s.log.Errorw("notification send failed",
		"kind", kind,
		"recipient", email,
		"order_number", orderNumber,
		"error", err.Error(),
	)
}
