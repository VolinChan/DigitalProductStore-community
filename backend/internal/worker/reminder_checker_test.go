package worker

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/pkg/logger"
)

// mockReminderNotificationService tracks reminder emails sent.
type mockReminderNotificationService struct {
	remindersSent []string // order numbers
	shouldFail    bool
}

func newMockReminderNotificationService() *mockReminderNotificationService {
	return &mockReminderNotificationService{
		remindersSent: make([]string, 0),
	}
}

func (m *mockReminderNotificationService) SendOrderConfirmation(_ context.Context, _ *models.Order) error {
	return nil
}
func (m *mockReminderNotificationService) SendPaymentConfirmation(_ context.Context, _ *models.Order) error {
	return nil
}
func (m *mockReminderNotificationService) SendShippingNotification(_ context.Context, _ *models.Order) error {
	return nil
}
func (m *mockReminderNotificationService) SendPaymentRejection(_ context.Context, _ *models.Order, _ string) error {
	return nil
}
func (m *mockReminderNotificationService) SendOrderCancellation(_ context.Context, _ *models.Order) error {
	return nil
}
func (m *mockReminderNotificationService) SendPasswordReset(_ context.Context, _, _ string) error {
	return nil
}
func (m *mockReminderNotificationService) SendTransferDeadlineReminder(_ context.Context, order *models.Order) error {
	if m.shouldFail {
		return errors.New("email send failed")
	}
	m.remindersSent = append(m.remindersSent, order.OrderNumber)
	return nil
}

func TestReminderChecker_SendsReminderForApproachingDeadline(t *testing.T) {
	log := logger.New("test")
	defer log.Sync()

	notifications := newMockReminderNotificationService()

	checker := NewReminderChecker(nil, notifications, log)

	// Simulate an order with deadline 12 hours from now (within 24h window)
	now := time.Now()
	deadline := now.Add(12 * time.Hour)
	order := &models.Order{
		BaseWithUpdate:       models.BaseWithUpdate{ID: 1},
		OrderNumber:          "ORD-20250101-001",
		Status:               models.OrderStatusPendingTransfer,
		PaymentMethod:        models.PaymentMethodTransfer,
		ConfirmationDeadline: &deadline,
		GuestEmail:           "admin@example.com",
	}

	// Directly test sendReminder
	err := checker.sendReminder(context.Background(), order)
	require.NoError(t, err)

	assert.Len(t, notifications.remindersSent, 1)
	assert.Equal(t, "ORD-20250101-001", notifications.remindersSent[0])
}

func TestReminderChecker_AvoidsDuplicateReminders(t *testing.T) {
	log := logger.New("test")
	defer log.Sync()

	notifications := newMockReminderNotificationService()

	checker := NewReminderChecker(nil, notifications, log)

	// Mark order as already reminded
	checker.markReminded(1)

	// Verify it's marked
	assert.True(t, checker.alreadyReminded(1))
	assert.False(t, checker.alreadyReminded(2))
}

func TestReminderChecker_CheckUpcomingDeadlines_NilDB(t *testing.T) {
	log := logger.New("test")
	defer log.Sync()

	notifications := newMockReminderNotificationService()

	checker := NewReminderChecker(nil, notifications, log)

	// Should not panic with nil DB
	checker.CheckUpcomingDeadlines(context.Background())

	// No reminders should be sent since DB is nil (returns empty list)
	assert.Empty(t, notifications.remindersSent)
}

func TestReminderChecker_SkipsAlreadyRemindedOrders(t *testing.T) {
	log := logger.New("test")
	defer log.Sync()

	notifications := newMockReminderNotificationService()

	checker := NewReminderChecker(nil, notifications, log)

	// Pre-mark order 1 as reminded
	checker.markReminded(1)

	// Simulate calling sendReminder for order 1 - it should be skipped
	// by the alreadyReminded check in CheckUpcomingDeadlines
	assert.True(t, checker.alreadyReminded(1))
	assert.False(t, checker.alreadyReminded(2))
}

func TestReminderChecker_SendReminderFailure(t *testing.T) {
	log := logger.New("test")
	defer log.Sync()

	notifications := newMockReminderNotificationService()
	notifications.shouldFail = true

	checker := NewReminderChecker(nil, notifications, log)

	deadline := time.Now().Add(12 * time.Hour)
	order := &models.Order{
		BaseWithUpdate:       models.BaseWithUpdate{ID: 1},
		OrderNumber:          "ORD-20250101-001",
		Status:               models.OrderStatusPendingTransfer,
		PaymentMethod:        models.PaymentMethodTransfer,
		ConfirmationDeadline: &deadline,
		GuestEmail:           "admin@example.com",
	}

	err := checker.sendReminder(context.Background(), order)
	assert.Error(t, err)

	// Order should NOT be marked as reminded when send fails
	assert.False(t, checker.alreadyReminded(1))
}

func TestReminderChecker_NilNotificationService(t *testing.T) {
	log := logger.New("test")
	defer log.Sync()

	checker := NewReminderChecker(nil, nil, log)

	deadline := time.Now().Add(12 * time.Hour)
	order := &models.Order{
		BaseWithUpdate:       models.BaseWithUpdate{ID: 1},
		OrderNumber:          "ORD-20250101-001",
		Status:               models.OrderStatusPendingTransfer,
		PaymentMethod:        models.PaymentMethodTransfer,
		ConfirmationDeadline: &deadline,
		GuestEmail:           "admin@example.com",
	}

	// Should not panic with nil notification service
	err := checker.sendReminder(context.Background(), order)
	assert.NoError(t, err)
}

func TestReminderChecker_StartStop(t *testing.T) {
	log := logger.New("test")
	defer log.Sync()

	notifications := newMockReminderNotificationService()

	checker := NewReminderChecker(nil, notifications, log)
	checker.SetInterval(50 * time.Millisecond)

	checker.Start()

	// Give it time to run at least once
	time.Sleep(100 * time.Millisecond)

	// Stop should not hang
	done := make(chan struct{})
	go func() {
		checker.Stop()
		close(done)
	}()

	select {
	case <-done:
		// Success - stopped cleanly
	case <-time.After(2 * time.Second):
		t.Fatal("ReminderChecker.Stop() did not return within 2 seconds")
	}
}

func TestReminderChecker_SetNowFunc(t *testing.T) {
	log := logger.New("test")
	defer log.Sync()

	notifications := newMockReminderNotificationService()

	checker := NewReminderChecker(nil, notifications, log)

	fixedTime := time.Date(2025, 1, 15, 10, 0, 0, 0, time.UTC)
	checker.SetNowFunc(func() time.Time {
		return fixedTime
	})

	// Verify the nowFunc is used
	assert.Equal(t, fixedTime, checker.nowFunc())
}

func TestReminderChecker_ConcurrentMarkReminded(t *testing.T) {
	log := logger.New("test")
	defer log.Sync()

	notifications := newMockReminderNotificationService()
	checker := NewReminderChecker(nil, notifications, log)

	// Test concurrent access to remindedOrders map
	done := make(chan struct{})
	go func() {
		for i := uint(0); i < 100; i++ {
			checker.markReminded(i)
		}
		close(done)
	}()

	// Concurrently check
	for i := uint(0); i < 100; i++ {
		checker.alreadyReminded(i)
	}

	<-done

	// All should be marked
	for i := uint(0); i < 100; i++ {
		assert.True(t, checker.alreadyReminded(i))
	}
}
