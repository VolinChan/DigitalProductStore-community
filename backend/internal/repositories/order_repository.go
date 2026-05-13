package repositories

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/digital-store/backend/internal/models"
)

var (
	// ErrOrderNotFound is returned when an order is not found
	ErrOrderNotFound = errors.New("order not found")
	// ErrOrderNumberExists is returned when an order number collision occurs
	ErrOrderNumberExists = errors.New("order number already exists")
)

// maxOrderNumberGenerationAttempts is the maximum number of retries when
// generating a unique order number to avoid infinite loops on collision.
const maxOrderNumberGenerationAttempts = 5

// ListOrderParams defines parameters for listing orders.
// Used by both user-scoped listings (with UserID set) and admin listings
// (with additional filters like status / payment method / date range / search).
type ListOrderParams struct {
	Limit         int
	Offset        int
	UserID        *uint
	GuestEmail    string
	Status        *models.OrderStatus
	PaymentMethod *models.PaymentMethod
	Search        string // matches order_number or guest_email
	StartDate     *time.Time
	EndDate       *time.Time
	SortBy        string // "created_at", "total_amount", "order_number"
	SortOrder     string // "asc", "desc"
}

// OrderRepository defines the interface for order data operations
type OrderRepository interface {
	// Create creates a new order (without items). If OrderNumber is empty,
	// a unique order number will be generated and assigned.
	Create(ctx context.Context, order *models.Order) error

	// CreateWithItems creates a new order together with its items in a single
	// transaction. If OrderNumber is empty, a unique order number will be
	// generated and assigned before insertion.
	CreateWithItems(ctx context.Context, order *models.Order) error

	// GetByID retrieves an order by ID with items and payment preloaded.
	GetByID(ctx context.Context, id uint) (*models.Order, error)

	// GetByOrderNumber retrieves an order by its order number with items and
	// payment preloaded.
	GetByOrderNumber(ctx context.Context, orderNumber string) (*models.Order, error)

	// GetByOrderNumberAndEmail retrieves an order by its order number and the
	// associated user email or guest email. Used for guest order tracking
	// (requirement 7.7).
	GetByOrderNumberAndEmail(ctx context.Context, orderNumber, email string) (*models.Order, error)

	// ListByUserID lists orders belonging to a user with pagination.
	ListByUserID(ctx context.Context, userID uint, params *ListOrderParams) ([]*models.Order, int64, error)

	// List lists orders with the given filters (admin use).
	List(ctx context.Context, params *ListOrderParams) ([]*models.Order, int64, error)

	// Update updates an existing order.
	Update(ctx context.Context, order *models.Order) error

	// UpdateStatus updates only the status of an order.
	UpdateStatus(ctx context.Context, id uint, status models.OrderStatus) error

	// Delete deletes an order and its items.
	Delete(ctx context.Context, id uint) error

	// CreateOrderItem creates a single order item.
	CreateOrderItem(ctx context.Context, item *models.OrderItem) error

	// GenerateOrderNumber generates a unique order number by checking the
	// database for collisions and retrying if necessary.
	GenerateOrderNumber(ctx context.Context) (string, error)
}

// orderRepository implements OrderRepository using GORM
type orderRepository struct {
	db *gorm.DB
}

// NewOrderRepository creates a new order repository
func NewOrderRepository(db *gorm.DB) OrderRepository {
	return &orderRepository{db: db}
}

// dbOrTx returns either the transaction carried by ctx or the repository's
// underlying DB bound to ctx. This mirrors the pattern used by
// paymentRepository so order operations can be coordinated with other
// repositories inside a TxManager-driven transaction. Services that drive
// multi-repository writes (for example, confirming a transfer payment)
// rely on this to have their updates committed atomically.
func (r *orderRepository) dbOrTx(ctx context.Context) *gorm.DB {
	if tx, ok := TxFromContext(ctx); ok {
		return tx.WithContext(ctx)
	}
	return r.db.WithContext(ctx)
}

// Create creates a new order
func (r *orderRepository) Create(ctx context.Context, order *models.Order) error {
	if order.OrderNumber == "" {
		orderNumber, err := r.GenerateOrderNumber(ctx)
		if err != nil {
			return fmt.Errorf("failed to generate order number: %w", err)
		}
		order.OrderNumber = orderNumber
	}

	if err := r.db.WithContext(ctx).Create(order).Error; err != nil {
		return fmt.Errorf("failed to create order: %w", err)
	}
	return nil
}

// CreateWithItems creates an order and its items in a single transaction.
// If the context carries a transaction (via WithTx), the create happens on
// that transaction and no nested transaction is started. Otherwise, a new
// transaction is opened to keep the order and its items consistent.
func (r *orderRepository) CreateWithItems(ctx context.Context, order *models.Order) error {
	if tx, ok := TxFromContext(ctx); ok {
		return r.createWithItemsInTx(tx.WithContext(ctx), order)
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return r.createWithItemsInTx(tx, order)
	})
}

// createWithItemsInTx performs the order creation against the provided
// transaction handle. Items are associated via the order.Items slice; GORM
// will insert them together with the parent order when using Create.
func (r *orderRepository) createWithItemsInTx(tx *gorm.DB, order *models.Order) error {
	if order.OrderNumber == "" {
		orderNumber, err := r.generateOrderNumberTx(tx)
		if err != nil {
			return fmt.Errorf("failed to generate order number: %w", err)
		}
		order.OrderNumber = orderNumber
	}

	if err := tx.Create(order).Error; err != nil {
		return fmt.Errorf("failed to create order with items: %w", err)
	}
	return nil
}

// GetByID retrieves an order by ID
func (r *orderRepository) GetByID(ctx context.Context, id uint) (*models.Order, error) {
	var order models.Order
	err := r.dbOrTx(ctx).
		Preload("Items").
		Preload("Payment").
		Preload("User").
		First(&order, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOrderNotFound
		}
		return nil, fmt.Errorf("failed to get order: %w", err)
	}
	return &order, nil
}

// GetByOrderNumber retrieves an order by its order number
func (r *orderRepository) GetByOrderNumber(ctx context.Context, orderNumber string) (*models.Order, error) {
	var order models.Order
	err := r.db.WithContext(ctx).
		Preload("Items").
		Preload("Payment").
		Preload("User").
		Where("order_number = ?", orderNumber).
		First(&order).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOrderNotFound
		}
		return nil, fmt.Errorf("failed to get order by number: %w", err)
	}
	return &order, nil
}

// GetByOrderNumberAndEmail retrieves an order by order number and email
// (either the user's email or the guest_email).
func (r *orderRepository) GetByOrderNumberAndEmail(ctx context.Context, orderNumber, email string) (*models.Order, error) {
	var order models.Order
	err := r.db.WithContext(ctx).
		Preload("Items").
		Preload("Payment").
		Preload("User").
		Joins("LEFT JOIN users ON users.id = orders.user_id").
		Where("orders.order_number = ? AND (orders.guest_email = ? OR users.email = ?)", orderNumber, email, email).
		First(&order).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOrderNotFound
		}
		return nil, fmt.Errorf("failed to get order by number and email: %w", err)
	}
	return &order, nil
}

// ListByUserID lists orders belonging to a user with pagination.
func (r *orderRepository) ListByUserID(ctx context.Context, userID uint, params *ListOrderParams) ([]*models.Order, int64, error) {
	if params == nil {
		params = &ListOrderParams{}
	}
	p := *params
	uid := userID
	p.UserID = &uid
	return r.List(ctx, &p)
}

// List lists orders with filters.
func (r *orderRepository) List(ctx context.Context, params *ListOrderParams) ([]*models.Order, int64, error) {
	if params == nil {
		params = &ListOrderParams{}
	}

	var orders []*models.Order
	var total int64

	query := r.db.WithContext(ctx).Model(&models.Order{})
	query = r.applyListFilters(query, params)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count orders: %w", err)
	}

	// Sorting
	sortBy := "created_at"
	switch params.SortBy {
	case "total_amount", "order_number", "created_at", "updated_at":
		sortBy = params.SortBy
	}
	sortOrder := "DESC"
	if params.SortOrder == "asc" {
		sortOrder = "ASC"
	}
	query = query.Order(fmt.Sprintf("%s %s", sortBy, sortOrder))

	// Pagination
	if params.Limit > 0 {
		query = query.Limit(params.Limit)
	}
	if params.Offset > 0 {
		query = query.Offset(params.Offset)
	}

	query = query.Preload("Items").Preload("Payment")

	if err := query.Find(&orders).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list orders: %w", err)
	}
	return orders, total, nil
}

// applyListFilters applies the filter conditions from params to the query.
func (r *orderRepository) applyListFilters(query *gorm.DB, params *ListOrderParams) *gorm.DB {
	if params.UserID != nil {
		query = query.Where("user_id = ?", *params.UserID)
	}
	if params.GuestEmail != "" {
		query = query.Where("guest_email = ?", params.GuestEmail)
	}
	if params.Status != nil {
		query = query.Where("status = ?", *params.Status)
	}
	if params.PaymentMethod != nil {
		query = query.Where("payment_method = ?", *params.PaymentMethod)
	}
	if params.StartDate != nil {
		query = query.Where("created_at >= ?", *params.StartDate)
	}
	if params.EndDate != nil {
		query = query.Where("created_at <= ?", *params.EndDate)
	}
	if params.Search != "" {
		pattern := "%" + params.Search + "%"
		query = query.Where("order_number ILIKE ? OR guest_email ILIKE ?", pattern, pattern)
	}
	return query
}

// Update updates an existing order.
func (r *orderRepository) Update(ctx context.Context, order *models.Order) error {
	result := r.dbOrTx(ctx).
		Model(&models.Order{}).
		Where("id = ?", order.ID).
		Updates(order)
	if result.Error != nil {
		return fmt.Errorf("failed to update order: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrOrderNotFound
	}
	return nil
}

// UpdateStatus updates only the status of an order.
func (r *orderRepository) UpdateStatus(ctx context.Context, id uint, status models.OrderStatus) error {
	result := r.dbOrTx(ctx).
		Model(&models.Order{}).
		Where("id = ?", id).
		Update("status", status)
	if result.Error != nil {
		return fmt.Errorf("failed to update order status: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrOrderNotFound
	}
	return nil
}

// Delete deletes an order. The foreign key on order_items has ON DELETE
// CASCADE, so items are removed automatically.
func (r *orderRepository) Delete(ctx context.Context, id uint) error {
	result := r.db.WithContext(ctx).Delete(&models.Order{}, id)
	if result.Error != nil {
		return fmt.Errorf("failed to delete order: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrOrderNotFound
	}
	return nil
}

// CreateOrderItem creates a single order item.
func (r *orderRepository) CreateOrderItem(ctx context.Context, item *models.OrderItem) error {
	if err := r.db.WithContext(ctx).Create(item).Error; err != nil {
		return fmt.Errorf("failed to create order item: %w", err)
	}
	return nil
}

// GenerateOrderNumber generates a unique order number using the underlying
// database to detect collisions.
func (r *orderRepository) GenerateOrderNumber(ctx context.Context) (string, error) {
	return r.generateOrderNumberTx(r.db.WithContext(ctx))
}

// generateOrderNumberTx uses the provided GORM handle (which may be a
// transaction) so the uniqueness check and subsequent insert happen against
// the same view of the data.
func (r *orderRepository) generateOrderNumberTx(db *gorm.DB) (string, error) {
	for attempt := 0; attempt < maxOrderNumberGenerationAttempts; attempt++ {
		candidate, err := buildOrderNumber(time.Now().UTC())
		if err != nil {
			return "", err
		}

		var count int64
		if err := db.Model(&models.Order{}).
			Where("order_number = ?", candidate).
			Count(&count).Error; err != nil {
			return "", fmt.Errorf("failed to check order number uniqueness: %w", err)
		}
		if count == 0 {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("failed to generate unique order number after %d attempts", maxOrderNumberGenerationAttempts)
}

// GenerateOrderNumber is the package-level helper for generating an order
// number. Callers that need database-backed uniqueness should use
// OrderRepository.GenerateOrderNumber instead.
//
// Format: ORD<yyyyMMddHHmmss><8 hex chars>, e.g. "ORD20240115143020A1B2C3D4".
// The timestamp (to the second) combined with 32 bits of cryptographic
// randomness makes collisions extremely unlikely in practice.
func GenerateOrderNumber() (string, error) {
	return buildOrderNumber(time.Now().UTC())
}

// buildOrderNumber constructs an order number using the given time so that
// it can be unit-tested deterministically.
func buildOrderNumber(t time.Time) (string, error) {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to read random bytes: %w", err)
	}
	suffix := hex.EncodeToString(b) // 8 hex chars
	return fmt.Sprintf("ORD%s%s", t.Format("20060102150405"), suffix), nil
}
