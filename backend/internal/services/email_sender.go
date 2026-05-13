package services

import "context"

// EmailSender defines the interface for sending emails
type EmailSender interface {
	// SendPasswordReset sends a password reset email
	SendPasswordReset(ctx context.Context, email, token string) error
	
	// SendOrderConfirmation sends an order confirmation email
	SendOrderConfirmation(ctx context.Context, email, orderNumber string) error
	
	// SendPaymentConfirmation sends a payment confirmation email
	SendPaymentConfirmation(ctx context.Context, email, orderNumber string) error
	
	// SendShippingNotification sends a shipping notification email
	SendShippingNotification(ctx context.Context, email, orderNumber, trackingNumber string) error
	
	// SendPaymentRejection sends a payment rejection email
	SendPaymentRejection(ctx context.Context, email, orderNumber, reason string) error
	
	// SendOrderCancellation sends an order cancellation email
	SendOrderCancellation(ctx context.Context, email, orderNumber string) error
	
	// SendTransferDeadlineReminder sends a transfer deadline reminder email
	SendTransferDeadlineReminder(ctx context.Context, email, orderNumber string) error
}
