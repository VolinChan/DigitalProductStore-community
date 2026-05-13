package services

import (
	"context"

	"github.com/digital-store/backend/pkg/logger"
)

// NoopEmailSender is an EmailSender that logs but never actually
// dispatches mail. It's used in local development and tests when SMTP
// is not configured, so the rest of the system can still exercise the
// notification code paths.
type NoopEmailSender struct {
	log *logger.Logger
}

// NewNoopEmailSender returns a sender that only logs. A nil logger is
// tolerated and will make the sender completely silent.
func NewNoopEmailSender(log *logger.Logger) *NoopEmailSender {
	return &NoopEmailSender{log: log}
}

func (n *NoopEmailSender) logSkip(kind, to string, extras ...any) {
	if n.log == nil {
		return
	}
	args := []any{"kind", kind, "recipient", to}
	args = append(args, extras...)
	n.log.Infow("email send skipped (noop sender)", args...)
}

// SendPasswordReset implements EmailSender.
func (n *NoopEmailSender) SendPasswordReset(ctx context.Context, email, token string) error {
	n.logSkip("password_reset", email)
	return nil
}

// SendOrderConfirmation implements EmailSender.
func (n *NoopEmailSender) SendOrderConfirmation(ctx context.Context, email, orderNumber string) error {
	n.logSkip("order_confirmation", email, "order_number", orderNumber)
	return nil
}

// SendPaymentConfirmation implements EmailSender.
func (n *NoopEmailSender) SendPaymentConfirmation(ctx context.Context, email, orderNumber string) error {
	n.logSkip("payment_confirmation", email, "order_number", orderNumber)
	return nil
}

// SendShippingNotification implements EmailSender.
func (n *NoopEmailSender) SendShippingNotification(ctx context.Context, email, orderNumber, trackingNumber string) error {
	n.logSkip("shipping_notification", email, "order_number", orderNumber, "tracking", trackingNumber)
	return nil
}

// SendPaymentRejection implements EmailSender.
func (n *NoopEmailSender) SendPaymentRejection(ctx context.Context, email, orderNumber, reason string) error {
	n.logSkip("payment_rejection", email, "order_number", orderNumber, "reason", reason)
	return nil
}

// SendOrderCancellation implements EmailSender.
func (n *NoopEmailSender) SendOrderCancellation(ctx context.Context, email, orderNumber string) error {
	n.logSkip("order_cancellation", email, "order_number", orderNumber)
	return nil
}

// SendTransferDeadlineReminder implements EmailSender.
func (n *NoopEmailSender) SendTransferDeadlineReminder(ctx context.Context, email, orderNumber string) error {
	n.logSkip("transfer_deadline_reminder", email, "order_number", orderNumber)
	return nil
}
