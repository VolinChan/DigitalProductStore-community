package repositories

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/digital-store/backend/internal/models"
)

var (
	// ErrPaymentNotFound is returned when a payment is not found.
	ErrPaymentNotFound = errors.New("payment not found")
)

// ListPaymentParams defines parameters for listing payments. It is primarily
// used by admin views (for example the pending-transfer queue in the backend
// administration UI described in requirement 12.1).
type ListPaymentParams struct {
	Limit     int
	Offset    int
	Status    *models.PaymentStatus
	Method    *models.PaymentMethod
	StartDate *time.Time
	EndDate   *time.Time
	SortBy    string // "created_at", "amount"
	SortOrder string // "asc", "desc"
}

// PaymentRepository defines the interface for payment data operations.
type PaymentRepository interface {
	// Create creates a new payment record.
	Create(ctx context.Context, payment *models.Payment) error

	// GetByID retrieves a payment by ID with the associated order preloaded.
	GetByID(ctx context.Context, id uint) (*models.Payment, error)

	// GetByOrderID retrieves a payment by its order ID. The payments table
	// has a unique index on order_id so at most one record is returned.
	GetByOrderID(ctx context.Context, orderID uint) (*models.Payment, error)

	// GetByTransactionID retrieves a payment by the payment gateway's
	// transaction id (for reconciliation and webhook handling, requirement
	// 9.7).
	GetByTransactionID(ctx context.Context, txID string) (*models.Payment, error)

	// Update updates an existing payment. Only non-zero fields on the passed
	// payment are updated to allow partial updates.
	Update(ctx context.Context, payment *models.Payment) error

	// UpdateStatus updates only the status of a payment.
	UpdateStatus(ctx context.Context, id uint, status models.PaymentStatus) error

	// ListPendingTransfers lists payments with method = transfer and status
	// in ("pending", "processing") for the admin pending-transfer queue. The
	// total count is returned alongside the page for pagination purposes.
	ListPendingTransfers(ctx context.Context, params *ListPaymentParams) ([]*models.Payment, int64, error)
}

// paymentRepository implements PaymentRepository using GORM.
type paymentRepository struct {
	db *gorm.DB
}

// NewPaymentRepository creates a new payment repository.
func NewPaymentRepository(db *gorm.DB) PaymentRepository {
	return &paymentRepository{db: db}
}

// dbOrTx returns either the transaction carried by ctx or the repository's
// underlying DB bound to ctx. This mirrors the pattern used by
// orderRepository so that payment operations can be coordinated with other
// repositories inside a TxManager-driven transaction.
func (r *paymentRepository) dbOrTx(ctx context.Context) *gorm.DB {
	if tx, ok := TxFromContext(ctx); ok {
		return tx.WithContext(ctx)
	}
	return r.db.WithContext(ctx)
}

// Create creates a new payment record.
func (r *paymentRepository) Create(ctx context.Context, payment *models.Payment) error {
	if err := r.dbOrTx(ctx).Create(payment).Error; err != nil {
		return fmt.Errorf("failed to create payment: %w", err)
	}
	return nil
}

// GetByID retrieves a payment by ID.
func (r *paymentRepository) GetByID(ctx context.Context, id uint) (*models.Payment, error) {
	var payment models.Payment
	err := r.dbOrTx(ctx).
		Preload("Order").
		First(&payment, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPaymentNotFound
		}
		return nil, fmt.Errorf("failed to get payment: %w", err)
	}
	return &payment, nil
}

// GetByOrderID retrieves a payment by its order ID.
func (r *paymentRepository) GetByOrderID(ctx context.Context, orderID uint) (*models.Payment, error) {
	var payment models.Payment
	err := r.dbOrTx(ctx).
		Where("order_id = ?", orderID).
		First(&payment).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPaymentNotFound
		}
		return nil, fmt.Errorf("failed to get payment by order id: %w", err)
	}
	return &payment, nil
}

// GetByTransactionID retrieves a payment by the gateway transaction id.
func (r *paymentRepository) GetByTransactionID(ctx context.Context, txID string) (*models.Payment, error) {
	if txID == "" {
		return nil, ErrPaymentNotFound
	}
	var payment models.Payment
	err := r.dbOrTx(ctx).
		Where("transaction_id = ?", txID).
		First(&payment).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPaymentNotFound
		}
		return nil, fmt.Errorf("failed to get payment by transaction id: %w", err)
	}
	return &payment, nil
}

// Update updates an existing payment. GORM's Updates skips zero-value fields
// on structs so callers should use a map if they need to set fields to their
// zero value explicitly.
func (r *paymentRepository) Update(ctx context.Context, payment *models.Payment) error {
	if payment == nil || payment.ID == 0 {
		return fmt.Errorf("payment id is required for update")
	}
	result := r.dbOrTx(ctx).
		Model(&models.Payment{}).
		Where("id = ?", payment.ID).
		Updates(payment)
	if result.Error != nil {
		return fmt.Errorf("failed to update payment: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrPaymentNotFound
	}
	return nil
}

// UpdateStatus updates only the status of a payment.
func (r *paymentRepository) UpdateStatus(ctx context.Context, id uint, status models.PaymentStatus) error {
	result := r.dbOrTx(ctx).
		Model(&models.Payment{}).
		Where("id = ?", id).
		Update("status", status)
	if result.Error != nil {
		return fmt.Errorf("failed to update payment status: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrPaymentNotFound
	}
	return nil
}

// ListPendingTransfers lists transfer payments awaiting admin confirmation.
// The query targets method = 'transfer' with status in ('pending',
// 'processing'); additional filters on params are applied on top.
func (r *paymentRepository) ListPendingTransfers(ctx context.Context, params *ListPaymentParams) ([]*models.Payment, int64, error) {
	if params == nil {
		params = &ListPaymentParams{}
	}

	var payments []*models.Payment
	var total int64

	query := r.dbOrTx(ctx).Model(&models.Payment{}).
		Where("method = ?", models.PaymentMethodTransfer)

	// Status filter: explicit override wins, otherwise default to the
	// "awaiting confirmation" statuses used by the admin queue.
	if params.Status != nil {
		query = query.Where("status = ?", *params.Status)
	} else {
		query = query.Where("status IN ?", []models.PaymentStatus{
			models.PaymentStatusPending,
			models.PaymentStatusProcessing,
		})
	}

	if params.Method != nil {
		// Allow callers to narrow further if needed; Transfer is already
		// enforced above but this keeps the filter symmetric with other
		// list methods.
		query = query.Where("method = ?", *params.Method)
	}
	if params.StartDate != nil {
		query = query.Where("created_at >= ?", *params.StartDate)
	}
	if params.EndDate != nil {
		query = query.Where("created_at <= ?", *params.EndDate)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count pending transfers: %w", err)
	}

	// Sort by creation time ascending by default so the oldest pending
	// transfers appear first, matching requirement 12.1 ("sorted by
	// creation time").
	sortBy := "created_at"
	switch params.SortBy {
	case "created_at", "amount", "updated_at":
		sortBy = params.SortBy
	}
	sortOrder := "ASC"
	if params.SortOrder == "desc" {
		sortOrder = "DESC"
	}
	query = query.Order(fmt.Sprintf("%s %s", sortBy, sortOrder))

	if params.Limit > 0 {
		query = query.Limit(params.Limit)
	}
	if params.Offset > 0 {
		query = query.Offset(params.Offset)
	}

	query = query.Preload("Order")

	if err := query.Find(&payments).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list pending transfers: %w", err)
	}
	return payments, total, nil
}
