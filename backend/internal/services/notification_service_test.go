package services

import (
	"context"
	"errors"
	"net/smtp"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/digital-store/backend/internal/models"
)

// fakeEmailSender is a simple in-memory EmailSender used to verify the
// higher-level NotificationService correctly extracts order fields and
// forwards them to the sender. It records every call so tests can
// assert the arguments.
type fakeEmailSender struct {
	calls   []fakeCall
	errFn   func(kind string) error
	failAll error
}

type fakeCall struct {
	Kind        string
	Email       string
	OrderNumber string
	Extra       string // used for tracking / reason / token
}

func (f *fakeEmailSender) record(kind, email, orderNumber, extra string) error {
	f.calls = append(f.calls, fakeCall{Kind: kind, Email: email, OrderNumber: orderNumber, Extra: extra})
	if f.failAll != nil {
		return f.failAll
	}
	if f.errFn != nil {
		return f.errFn(kind)
	}
	return nil
}

func (f *fakeEmailSender) SendPasswordReset(_ context.Context, email, token string) error {
	return f.record("password_reset", email, "", token)
}
func (f *fakeEmailSender) SendOrderConfirmation(_ context.Context, email, orderNumber string) error {
	return f.record("order_confirmation", email, orderNumber, "")
}
func (f *fakeEmailSender) SendPaymentConfirmation(_ context.Context, email, orderNumber string) error {
	return f.record("payment_confirmation", email, orderNumber, "")
}
func (f *fakeEmailSender) SendShippingNotification(_ context.Context, email, orderNumber, tracking string) error {
	return f.record("shipping_notification", email, orderNumber, tracking)
}
func (f *fakeEmailSender) SendPaymentRejection(_ context.Context, email, orderNumber, reason string) error {
	return f.record("payment_rejection", email, orderNumber, reason)
}
func (f *fakeEmailSender) SendOrderCancellation(_ context.Context, email, orderNumber string) error {
	return f.record("order_cancellation", email, orderNumber, "")
}
func (f *fakeEmailSender) SendTransferDeadlineReminder(_ context.Context, email, orderNumber string) error {
	return f.record("transfer_deadline_reminder", email, orderNumber, "")
}

func guestOrder() *models.Order {
	o := &models.Order{
		OrderNumber:    "ORD-001",
		GuestEmail:     "guest@example.com",
		GuestName:      "Guest User",
		TrackingNumber: "TRK-9",
	}
	o.ID = 42
	return o
}

func userOrder() *models.Order {
	o := &models.Order{
		OrderNumber:    "ORD-002",
		TrackingNumber: "TRK-10",
		User: &models.User{
			Email:    "user@example.com",
			FullName: "Logged In User",
		},
	}
	o.ID = 43
	return o
}

func TestNotificationService_PrefersUserEmail(t *testing.T) {
	sender := &fakeEmailSender{}
	svc := NewNotificationService(sender, nil)

	order := userOrder()
	order.GuestEmail = "someone-else@example.com"

	require.NoError(t, svc.SendOrderConfirmation(context.Background(), order))
	require.Len(t, sender.calls, 1)
	assert.Equal(t, "user@example.com", sender.calls[0].Email)
}

func TestNotificationService_FallsBackToGuestEmail(t *testing.T) {
	sender := &fakeEmailSender{}
	svc := NewNotificationService(sender, nil)

	order := guestOrder()

	require.NoError(t, svc.SendOrderConfirmation(context.Background(), order))
	require.Len(t, sender.calls, 1)
	assert.Equal(t, "guest@example.com", sender.calls[0].Email)
	assert.Equal(t, "ORD-001", sender.calls[0].OrderNumber)
}

func TestNotificationService_MissingEmailReturnsError(t *testing.T) {
	sender := &fakeEmailSender{}
	svc := NewNotificationService(sender, nil)

	order := &models.Order{OrderNumber: "ORD-003"}

	err := svc.SendOrderConfirmation(context.Background(), order)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrOrderMissingRecipient)
	assert.Empty(t, sender.calls)
}

func TestNotificationService_ShippingIncludesTrackingNumber(t *testing.T) {
	sender := &fakeEmailSender{}
	svc := NewNotificationService(sender, nil)

	order := guestOrder()

	require.NoError(t, svc.SendShippingNotification(context.Background(), order))
	require.Len(t, sender.calls, 1)
	assert.Equal(t, "shipping_notification", sender.calls[0].Kind)
	assert.Equal(t, "TRK-9", sender.calls[0].Extra)
}

func TestNotificationService_PaymentRejectionIncludesReason(t *testing.T) {
	sender := &fakeEmailSender{}
	svc := NewNotificationService(sender, nil)

	order := guestOrder()

	require.NoError(t, svc.SendPaymentRejection(context.Background(), order, "amount mismatch"))
	require.Len(t, sender.calls, 1)
	assert.Equal(t, "amount mismatch", sender.calls[0].Extra)
}

func TestNotificationService_PasswordResetPassesThroughToken(t *testing.T) {
	sender := &fakeEmailSender{}
	svc := NewNotificationService(sender, nil)

	require.NoError(t, svc.SendPasswordReset(context.Background(), "a@example.com", "token-xyz"))
	require.Len(t, sender.calls, 1)
	assert.Equal(t, "password_reset", sender.calls[0].Kind)
	assert.Equal(t, "a@example.com", sender.calls[0].Email)
	assert.Equal(t, "token-xyz", sender.calls[0].Extra)
}

func TestNotificationService_WrapsSenderError(t *testing.T) {
	boom := errors.New("smtp down")
	sender := &fakeEmailSender{failAll: boom}
	svc := NewNotificationService(sender, nil)

	err := svc.SendOrderConfirmation(context.Background(), guestOrder())
	require.Error(t, err)
	assert.ErrorIs(t, err, boom)
}

// --- SMTPEmailSender tests ---

// newTestSMTPSender builds an SMTPEmailSender with a near-zero retry
// backoff so tests exercising retry behavior don't have to sleep.
func newTestSMTPSender(t *testing.T) *SMTPEmailSender {
	t.Helper()
	sender, err := NewSMTPEmailSender(SMTPConfig{
		Host:                 "smtp.example.com",
		Port:                 587,
		Username:             "user",
		Password:             "pass",
		FromAddress:          "noreply@example.com",
		FromName:             "Test Store",
		BrandName:            "Test Store",
		PasswordResetBaseURL: "https://store.example.com/reset",
	}, nil)
	require.NoError(t, err)
	sender.retryDelays = []time.Duration{time.Millisecond, time.Millisecond}
	return sender
}

func TestSMTPEmailSender_RendersHTMLAndSendsOnFirstAttempt(t *testing.T) {
	sender := newTestSMTPSender(t)

	var (
		capturedAddr string
		capturedFrom string
		capturedTo   []string
		capturedMsg  []byte
	)
	sender.sendFunc = func(addr string, _ smtp.Auth, from string, to []string, msg []byte) error {
		capturedAddr = addr
		capturedFrom = from
		capturedTo = to
		capturedMsg = msg
		return nil
	}

	err := sender.SendOrderConfirmation(context.Background(), "customer@example.com", "ORD-123")
	require.NoError(t, err)

	assert.Equal(t, "smtp.example.com:587", capturedAddr)
	assert.Equal(t, "noreply@example.com", capturedFrom)
	assert.Equal(t, []string{"customer@example.com"}, capturedTo)

	body := string(capturedMsg)
	assert.Contains(t, body, "Subject: [Test Store] 订单确认通知 - ORD-123")
	assert.Contains(t, body, "Content-Type: text/html")
	assert.Contains(t, body, "ORD-123")
	assert.Contains(t, body, "Test Store")
	assert.Contains(t, body, "From: Test Store <noreply@example.com>")
	assert.Contains(t, body, "To: customer@example.com")
}

func TestSMTPEmailSender_RetriesOnTransientFailure(t *testing.T) {
	sender := newTestSMTPSender(t)

	var attempts int32
	sender.sendFunc = func(addr string, _ smtp.Auth, from string, to []string, msg []byte) error {
		n := atomic.AddInt32(&attempts, 1)
		if n < 3 {
			return errors.New("temporary failure")
		}
		return nil
	}

	err := sender.SendPaymentConfirmation(context.Background(), "customer@example.com", "ORD-77")
	require.NoError(t, err)
	assert.EqualValues(t, 3, atomic.LoadInt32(&attempts), "should have retried twice before success")
}

func TestSMTPEmailSender_GivesUpAfterMaxAttempts(t *testing.T) {
	sender := newTestSMTPSender(t)

	var attempts int32
	sender.sendFunc = func(addr string, _ smtp.Auth, from string, to []string, msg []byte) error {
		atomic.AddInt32(&attempts, 1)
		return errors.New("persistent failure")
	}

	err := sender.SendOrderCancellation(context.Background(), "customer@example.com", "ORD-88")
	require.Error(t, err)
	assert.EqualValues(t, 3, atomic.LoadInt32(&attempts), "should stop after 3 total attempts")
	assert.Contains(t, err.Error(), "persistent failure")
}

func TestSMTPEmailSender_PasswordResetBuildsURLWithToken(t *testing.T) {
	sender := newTestSMTPSender(t)

	var captured []byte
	sender.sendFunc = func(addr string, _ smtp.Auth, from string, to []string, msg []byte) error {
		captured = msg
		return nil
	}

	err := sender.SendPasswordReset(context.Background(), "user@example.com", "my-token-123")
	require.NoError(t, err)

	body := string(captured)
	assert.Contains(t, body, "https://store.example.com/reset?token=my-token-123")
}

func TestSMTPEmailSender_PasswordResetAppendsTokenWithExistingQuery(t *testing.T) {
	sender, err := NewSMTPEmailSender(SMTPConfig{
		Host:                 "smtp.example.com",
		Port:                 587,
		FromAddress:          "noreply@example.com",
		FromName:             "Test Store",
		PasswordResetBaseURL: "https://store.example.com/reset?source=email",
	}, nil)
	require.NoError(t, err)
	sender.retryDelays = []time.Duration{time.Millisecond}

	var captured []byte
	sender.sendFunc = func(addr string, _ smtp.Auth, from string, to []string, msg []byte) error {
		captured = msg
		return nil
	}

	err = sender.SendPasswordReset(context.Background(), "user@example.com", "abc")
	require.NoError(t, err)

	body := string(captured)
	// html/template correctly escapes & → &amp; in href contexts.
	assert.Contains(t, body, "https://store.example.com/reset?source=email&amp;token=abc")
	assert.NotContains(t, body, "?source=email?token=")
}

func TestSMTPEmailSender_ShippingEmailIncludesTracking(t *testing.T) {
	sender := newTestSMTPSender(t)

	var captured []byte
	sender.sendFunc = func(addr string, _ smtp.Auth, from string, to []string, msg []byte) error {
		captured = msg
		return nil
	}

	err := sender.SendShippingNotification(context.Background(), "customer@example.com", "ORD-55", "TRACK-XYZ")
	require.NoError(t, err)

	body := string(captured)
	assert.Contains(t, body, "TRACK-XYZ")
	assert.Contains(t, body, "ORD-55")
}

func TestSMTPEmailSender_RejectsEmptyRecipient(t *testing.T) {
	sender := newTestSMTPSender(t)
	called := false
	sender.sendFunc = func(addr string, _ smtp.Auth, from string, to []string, msg []byte) error {
		called = true
		return nil
	}

	err := sender.SendOrderConfirmation(context.Background(), "", "ORD-1")
	require.Error(t, err)
	assert.False(t, called)
}

func TestSMTPConfig_ValidateRequiresFields(t *testing.T) {
	cases := []struct {
		name string
		cfg  SMTPConfig
	}{
		{"missing host", SMTPConfig{Port: 25, FromAddress: "a@b.com"}},
		{"missing port", SMTPConfig{Host: "smtp", FromAddress: "a@b.com"}},
		{"missing from address", SMTPConfig{Host: "smtp", Port: 25}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.cfg.Validate()
			require.Error(t, err)
		})
	}

	ok := SMTPConfig{Host: "smtp", Port: 25, FromAddress: "a@b.com"}
	require.NoError(t, ok.Validate())
}

func TestNoopEmailSender_SucceedsAllCalls(t *testing.T) {
	s := NewNoopEmailSender(nil)
	ctx := context.Background()

	assert.NoError(t, s.SendOrderConfirmation(ctx, "a@b.com", "O1"))
	assert.NoError(t, s.SendPaymentConfirmation(ctx, "a@b.com", "O1"))
	assert.NoError(t, s.SendShippingNotification(ctx, "a@b.com", "O1", "T1"))
	assert.NoError(t, s.SendPaymentRejection(ctx, "a@b.com", "O1", "reason"))
	assert.NoError(t, s.SendOrderCancellation(ctx, "a@b.com", "O1"))
	assert.NoError(t, s.SendPasswordReset(ctx, "a@b.com", "tok"))
	assert.NoError(t, s.SendTransferDeadlineReminder(ctx, "a@b.com", "O1"))
}
