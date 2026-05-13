package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
)

// DefaultShippingFee is the flat shipping fee applied to all orders until a
// richer shipping policy is introduced. Expressed as decimal.Decimal so the
// value can be substituted without re-implementing the service.
var DefaultShippingFee = decimal.NewFromInt(10)

// Order service errors. They are wrapped with additional context at the
// boundary, but tests and handlers can match against the sentinel values.
var (
	// ErrEmptyCart is returned when CreateOrder is called with no items.
	ErrEmptyCart = errors.New("order must contain at least one item")
	// ErrInvalidShippingInfo is returned when required shipping fields are missing.
	ErrInvalidShippingInfo = errors.New("invalid shipping information")
	// ErrInvalidPaymentMethod is returned when an unsupported payment method is provided.
	ErrInvalidPaymentMethod = errors.New("invalid payment method")
	// ErrSKUUnavailable is returned when a SKU is missing, inactive, or has insufficient stock.
	ErrSKUUnavailable = errors.New("sku unavailable")
	// ErrInvalidQuantity is returned when a requested quantity is non-positive.
	ErrInvalidQuantity = errors.New("quantity must be greater than zero")
	// ErrInvalidStatusTransition is returned when UpdateOrderStatus is called
	// with a target status that is not reachable from the current status.
	ErrInvalidStatusTransition = errors.New("invalid order status transition")
	// ErrInvalidOrderStatus is returned when a status value outside the known
	// set is supplied.
	ErrInvalidOrderStatus = errors.New("invalid order status")
	// ErrOrderNotCancellable is returned when CancelOrder is called on an
	// order whose current status does not permit cancellation by the
	// customer (per Requirement 24.4).
	ErrOrderNotCancellable = errors.New("order cannot be cancelled in its current status")
)

// validStatusTransitions maps each OrderStatus to the set of statuses it may
// legally transition to. "Completed" and "cancelled" are terminal and are
// omitted from the map so any attempt to transition away from them fails.
// Admin shipping carrier / tracking number capture on the pending_shipment
// -> shipped transition is handled by the order admin flow in task 16; this
// map only enforces that the movement itself is legal.
var validStatusTransitions = map[models.OrderStatus]map[models.OrderStatus]bool{
	models.OrderStatusPendingPayment: {
		models.OrderStatusPendingTransfer: true,
		models.OrderStatusPaid:            true,
		models.OrderStatusCancelled:       true,
		models.OrderStatusPaymentFailed:   true,
	},
	models.OrderStatusPendingTransfer: {
		models.OrderStatusPaid:          true,
		models.OrderStatusCancelled:     true,
		models.OrderStatusPaymentFailed: true,
	},
	models.OrderStatusPaid: {
		models.OrderStatusPendingShipment: true,
		models.OrderStatusCancelled:       true,
	},
	models.OrderStatusPendingShipment: {
		models.OrderStatusShipped:   true,
		models.OrderStatusCancelled: true,
	},
	models.OrderStatusShipped: {
		models.OrderStatusCompleted: true,
	},
	models.OrderStatusPaymentFailed: {
		models.OrderStatusPendingPayment: true,
		models.OrderStatusCancelled:      true,
	},
}

// cancellableStatuses lists the statuses from which a customer-initiated
// cancellation is permitted without administrator action (Requirements
// 24.1, 24.2 & 24.4). Admin-driven cancellation of a "paid" order with
// refund flagging (Requirement 24.5) is handled by the admin order flow in
// task 18.
var cancellableStatuses = map[models.OrderStatus]bool{
	models.OrderStatusPendingPayment:  true,
	models.OrderStatusPendingTransfer: true,
}

// knownOrderStatuses enumerates every valid OrderStatus value. It is used
// by UpdateOrderStatus to reject unknown values with a descriptive error
// rather than writing arbitrary strings to the database.
var knownOrderStatuses = map[models.OrderStatus]bool{
	models.OrderStatusPendingPayment:  true,
	models.OrderStatusPendingTransfer: true,
	models.OrderStatusPaid:            true,
	models.OrderStatusPendingShipment: true,
	models.OrderStatusShipped:         true,
	models.OrderStatusCompleted:       true,
	models.OrderStatusCancelled:       true,
	models.OrderStatusPaymentFailed:   true,
}

// OrderService defines the interface for order business logic.
//
// Only CreateOrder is implemented in this iteration (task 10.2). Other
// methods are part of the overall design and will be implemented by later
// tasks (10.3, 10.4). They are defined here so that handlers can depend on
// the final interface and so the service can grow without breaking callers.
type OrderService interface {
	// CreateOrder creates a new order, snapshots SKU details into order
	// items, decrements SKU inventory, and optionally clears the cart it
	// was built from. The operation is atomic: any failure after inventory
	// is adjusted will roll back all changes.
	CreateOrder(ctx context.Context, req *CreateOrderRequest) (*models.Order, error)

	// GetOrder retrieves an order by its primary key. Implemented in task 10.3.
	GetOrder(ctx context.Context, orderID uint) (*models.Order, error)

	// GetOrderByNumber retrieves an order by its order number. Implemented in task 10.3.
	GetOrderByNumber(ctx context.Context, orderNumber string) (*models.Order, error)

	// ListOrders lists orders for a specific user. Implemented in task 10.3.
	ListOrders(ctx context.Context, userID uint, params *ListOrdersRequest) (*OrderListResponse, error)

	// ListAllOrders lists all orders with admin-level filtering (task 18.1).
	ListAllOrders(ctx context.Context, params *AdminListOrdersRequest) (*OrderListResponse, error)

	// UpdateOrderStatus updates the status of an order. Implemented in task 10.3.
	UpdateOrderStatus(ctx context.Context, orderID uint, status models.OrderStatus) error

	// AdminUpdateOrderStatus updates the status of an order with optional
	// shipping carrier and tracking number (task 18.1, Requirement 16.3-16.4).
	AdminUpdateOrderStatus(ctx context.Context, orderID uint, req *AdminUpdateStatusRequest) error

	// AdminCancelOrder cancels an order from the admin panel. Supports
	// cancellation of orders in pending_payment or pending_transfer status
	// (Requirement 16.5).
	AdminCancelOrder(ctx context.Context, orderID uint, reason string) error

	// CancelOrder cancels an order and restores inventory. Implemented in task 10.3.
	CancelOrder(ctx context.Context, orderID uint, reason string) error

	// TrackOrder retrieves an order by order number and email (guest tracking). Implemented in task 10.3.
	TrackOrder(ctx context.Context, orderNumber, email string) (*models.Order, error)
}

// CreateOrderItemRequest describes a single item to include in the order.
// Callers provide the SKU and desired quantity; the service resolves the
// SKU's current price and attributes and snapshots them into the order.
type CreateOrderItemRequest struct {
	SKUID    uint `json:"sku_id" validate:"required,gt=0"`
	Quantity int  `json:"quantity" validate:"required,gt=0"`
}

// CreateOrderRequest contains everything needed to create an order. Either
// Items must be provided directly, or CartID may be used to source items
// from an existing cart. When UserID is nil the order is treated as a guest
// order and GuestEmail / GuestName / GuestPhone are required.
type CreateOrderRequest struct {
	// Items lists the SKUs and quantities to purchase. When empty, CartID
	// is used to load items from a cart.
	Items []CreateOrderItemRequest `json:"items"`

	// CartID optionally identifies a cart whose items will populate the
	// order. If Items is non-empty, CartID is ignored.
	CartID *uint `json:"cart_id"`

	// ClearCart, when true together with a resolvable CartID, clears the
	// source cart after the order is successfully created.
	ClearCart bool `json:"clear_cart"`

	// UserID is the authenticated user placing the order. Nil for guests.
	UserID *uint `json:"user_id"`

	// Guest contact information. Required when UserID is nil.
	GuestName  string `json:"guest_name"`
	GuestEmail string `json:"guest_email"`
	GuestPhone string `json:"guest_phone"`

	// ShippingAddress is the full shipping address as a single string.
	ShippingAddress string `json:"shipping_address"`

	// PaymentMethod selects between online and transfer payment.
	PaymentMethod models.PaymentMethod `json:"payment_method"`
}

// ListOrdersRequest is a placeholder for task 10.3 list operations. It lives
// here so the interface signature stays stable.
type ListOrdersRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
	Status   string `json:"status"`
	SortBy   string `json:"sort_by"`
	SortOrder string `json:"sort_order"`
}

// OrderListResponse is the paginated list response. Populated by task 10.3.
type OrderListResponse struct {
	Orders   []*models.Order `json:"orders"`
	Total    int64           `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"page_size"`
}

// AdminListOrdersRequest contains filters for the admin order listing
// endpoint (Requirement 16.1). It supports filtering by status, date range,
// payment method, and a free-text search across order number and customer
// email.
type AdminListOrdersRequest struct {
	Page          int    `json:"page"`
	PageSize      int    `json:"page_size"`
	Status        string `json:"status"`
	PaymentMethod string `json:"payment_method"`
	Search        string `json:"search"`
	StartDate     string `json:"start_date"` // RFC3339 or YYYY-MM-DD
	EndDate       string `json:"end_date"`   // RFC3339 or YYYY-MM-DD
	SortBy        string `json:"sort_by"`
	SortOrder     string `json:"sort_order"`
}

// AdminUpdateStatusRequest carries the target status and optional shipping
// details for the admin status update endpoint (Requirements 16.3, 16.4).
type AdminUpdateStatusRequest struct {
	Status          models.OrderStatus `json:"status"`
	ShippingCarrier string             `json:"shipping_carrier"`
	TrackingNumber  string             `json:"tracking_number"`
}

// orderService implements OrderService.
type orderService struct {
	orderRepo        repositories.OrderRepository
	skuRepo          repositories.SKURepository
	cartRepo         repositories.CartRepository
	inventoryLogRepo repositories.InventoryLogRepository
	txManager        repositories.TxManager
	notifications    NotificationService
}

// NewOrderService creates a new OrderService wired to the given repositories.
// txManager may be nil, in which case each repository falls back to its own
// transaction semantics. Production code should provide a non-nil manager so
// inventory decrement and order insertion run atomically.
//
// inventoryLogRepo may be nil. When non-nil the order service records an
// inventory log entry for every order-driven SKU inventory change (reserve
// on create, release on cancel), satisfying Requirement 15.5. When nil the
// service skips log writes, which keeps test setups that do not need
// auditing concise.
//
// notifications may be nil. When non-nil the service dispatches
// transactional order emails (confirmation, shipping, cancellation) via
// the NotificationService (Requirements 21.1, 21.3, 24.6). Email sends
// happen in a goroutine so callers never wait on SMTP; failures are
// logged but do not fail the business operation.
func NewOrderService(
	orderRepo repositories.OrderRepository,
	skuRepo repositories.SKURepository,
	cartRepo repositories.CartRepository,
	inventoryLogRepo repositories.InventoryLogRepository,
	txManager repositories.TxManager,
	notifications NotificationService,
) OrderService {
	return &orderService{
		orderRepo:        orderRepo,
		skuRepo:          skuRepo,
		cartRepo:         cartRepo,
		inventoryLogRepo: inventoryLogRepo,
		txManager:        txManager,
		notifications:    notifications,
	}
}

// CreateOrder validates the request, snapshots SKUs into order items,
// decrements inventory, and persists the order. All database writes run in
// a single transaction so the SKU inventory and the order row stay
// consistent even under failure.
//
// Requirements addressed:
//   - 7.1: Order created with status "pending_payment".
//   - 7.2: OrderItem records capture quantity and price at purchase time.
//   - 7.3: SKU inventory is reduced by ordered quantity.
//   - 7.4: Order totals (subtotal + shipping fee) are computed.
func (s *orderService) CreateOrder(ctx context.Context, req *CreateOrderRequest) (*models.Order, error) {
	if req == nil {
		return nil, fmt.Errorf("%w: request is nil", ErrInvalidShippingInfo)
	}

	if err := validateCreateOrderRequest(req); err != nil {
		return nil, err
	}

	// Resolve the items to charge for. If explicit items are provided they
	// take priority; otherwise we fall back to a linked cart.
	items := req.Items
	var sourceCartID *uint
	if len(items) == 0 {
		if req.CartID == nil {
			return nil, ErrEmptyCart
		}
		cartItems, err := s.loadCartItems(ctx, *req.CartID)
		if err != nil {
			return nil, err
		}
		if len(cartItems) == 0 {
			return nil, ErrEmptyCart
		}
		items = cartItems
		cartID := *req.CartID
		sourceCartID = &cartID
	}

	// Resolve all SKUs up-front so we can fail fast on invalid input and
	// build the item snapshots before touching any state. previousInv
	// records the inventory level seen during the pre-check so the
	// inventory log entries written below can carry accurate previous /
	// new quantities without re-reading the SKUs.
	snapshots, subtotal, previousInv, err := s.buildItemSnapshots(ctx, items)
	if err != nil {
		return nil, err
	}

	shippingFee := DefaultShippingFee
	total := subtotal.Add(shippingFee)

	order := &models.Order{
		UserID:          req.UserID,
		GuestEmail:      req.GuestEmail,
		GuestName:       req.GuestName,
		GuestPhone:      req.GuestPhone,
		ShippingAddress: req.ShippingAddress,
		Status:          models.OrderStatusPendingPayment,
		PaymentMethod:   req.PaymentMethod,
		Subtotal:        subtotal,
		ShippingFee:     shippingFee,
		TotalAmount:     total,
		Items:           snapshots,
	}

	// Transactional write: decrement inventory for each SKU, then create
	// the order and its items. If any step fails the transaction is rolled
	// back leaving the database untouched. Inventory log entries
	// (Requirement 15.5) are written in the same transaction after the
	// order has been persisted so they carry the order id.
	if err := s.runInTransaction(ctx, func(txCtx context.Context) error {
		for _, item := range snapshots {
			if err := s.skuRepo.DecrementInventory(txCtx, item.SKUID, item.Quantity); err != nil {
				if errors.Is(err, repositories.ErrInsufficientInventory) {
					return fmt.Errorf("%w: sku %d", ErrSKUUnavailable, item.SKUID)
				}
				return fmt.Errorf("failed to decrement inventory for sku %d: %w", item.SKUID, err)
			}
		}
		if err := s.orderRepo.CreateWithItems(txCtx, order); err != nil {
			return fmt.Errorf("failed to create order: %w", err)
		}
		// Record an inventory log entry per ordered item. The log repo
		// is optional so test setups that do not need audit wiring are
		// unaffected. We use the inventory snapshot captured in
		// buildItemSnapshots to track running totals; repeated SKUs in
		// the same order produce distinct entries with correctly
		// advancing previous / new quantities.
		if s.inventoryLogRepo != nil {
			running := make(map[uint]int, len(previousInv))
			for skuID, qty := range previousInv {
				running[skuID] = qty
			}
			orderID := order.ID
			orderPtr := &orderID
			for _, item := range snapshots {
				previous := running[item.SKUID]
				newQty := previous - item.Quantity
				running[item.SKUID] = newQty
				entry := &models.InventoryLog{
					SKUID:       item.SKUID,
					PreviousQty: previous,
					NewQty:      newQty,
					Change:      -item.Quantity,
					Reason:      "order reservation",
					OrderID:     orderPtr,
				}
				if err := s.inventoryLogRepo.Create(txCtx, entry); err != nil {
					return fmt.Errorf("failed to record inventory log for sku %d: %w", item.SKUID, err)
				}
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}

	// Clear the source cart outside the transaction. Clearing is a
	// best-effort operation: if it fails the order is already persisted
	// and the cart can be cleared later.
	if req.ClearCart && sourceCartID != nil {
		_ = s.cartRepo.ClearItems(ctx, *sourceCartID)
	}

	// Requirement 21.1: send an order confirmation email within 1
	// minute. The email send is best-effort and runs in a detached
	// goroutine so the caller (typically an HTTP request) never waits
	// on SMTP. A background context is used because the request ctx may
	// be cancelled shortly after the response is written.
	s.dispatchNotification("order_confirmation", order, func(ctx context.Context, o *models.Order) error {
		return s.notifications.SendOrderConfirmation(ctx, o)
	})

	return order, nil
}

// loadCartItems reads the cart and converts its items into the request
// shape used by CreateOrder. The cart must contain at least one item or an
// error is returned by the caller.
func (s *orderService) loadCartItems(ctx context.Context, cartID uint) ([]CreateOrderItemRequest, error) {
	cart, err := s.cartRepo.GetCartWithItems(ctx, cartID)
	if err != nil {
		return nil, fmt.Errorf("failed to load cart: %w", err)
	}
	items := make([]CreateOrderItemRequest, 0, len(cart.Items))
	for _, it := range cart.Items {
		if it == nil {
			continue
		}
		items = append(items, CreateOrderItemRequest{SKUID: it.SKUID, Quantity: it.Quantity})
	}
	return items, nil
}

// buildItemSnapshots looks up each SKU, validates it can be ordered, and
// produces the *models.OrderItem snapshots plus the running subtotal. The
// snapshots capture name, code, attributes, price and quantity at order
// time so subsequent SKU changes do not rewrite history. The returned
// previousInv map records each SKU's inventory level at resolution time
// so the caller can emit inventory log entries with accurate previous /
// new quantities without re-reading the SKUs inside the transaction.
func (s *orderService) buildItemSnapshots(
	ctx context.Context,
	items []CreateOrderItemRequest,
) ([]*models.OrderItem, decimal.Decimal, map[uint]int, error) {
	if len(items) == 0 {
		return nil, decimal.Zero, nil, ErrEmptyCart
	}

	snapshots := make([]*models.OrderItem, 0, len(items))
	previousInv := make(map[uint]int, len(items))
	subtotal := decimal.Zero

	for _, req := range items {
		if req.Quantity <= 0 {
			return nil, decimal.Zero, nil, fmt.Errorf("%w: sku %d", ErrInvalidQuantity, req.SKUID)
		}

		sku, err := s.skuRepo.GetWithAttributes(ctx, req.SKUID)
		if err != nil {
			return nil, decimal.Zero, nil, fmt.Errorf("%w: sku %d: %v", ErrSKUUnavailable, req.SKUID, err)
		}
		if !sku.IsActive {
			return nil, decimal.Zero, nil, fmt.Errorf("%w: sku %d is inactive", ErrSKUUnavailable, req.SKUID)
		}
		if sku.Inventory < req.Quantity {
			return nil, decimal.Zero, nil, fmt.Errorf(
				"%w: sku %d has %d in stock, requested %d",
				ErrSKUUnavailable, req.SKUID, sku.Inventory, req.Quantity,
			)
		}

		attrJSON, err := encodeAttributes(sku.Attributes)
		if err != nil {
			return nil, decimal.Zero, nil, fmt.Errorf("failed to encode attributes for sku %d: %w", req.SKUID, err)
		}

		lineSubtotal := sku.Price.Mul(decimal.NewFromInt(int64(req.Quantity)))
		snapshots = append(snapshots, &models.OrderItem{
			SKUID:      sku.ID,
			SKUName:    skuDisplayName(sku),
			SKUCode:    sku.SKUCode,
			Attributes: attrJSON,
			Quantity:   req.Quantity,
			UnitPrice:  sku.Price,
			Subtotal:   lineSubtotal,
		})
		subtotal = subtotal.Add(lineSubtotal)
		// Record the first-seen inventory level for this SKU. Repeated
		// references in the same order reuse the initial snapshot so the
		// log-writing code downstream can compute running totals.
		if _, ok := previousInv[sku.ID]; !ok {
			previousInv[sku.ID] = sku.Inventory
		}
	}

	return snapshots, subtotal, previousInv, nil
}

// runInTransaction executes fn inside the injected transaction manager. If
// no manager was provided (e.g. in tests) fn is run against the original
// context, relying on each repository's own transaction handling.
func (s *orderService) runInTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	if s.txManager == nil {
		return fn(ctx)
	}
	return s.txManager.RunInTransaction(ctx, fn)
}

// dispatchNotification fires an email notification in a detached
// goroutine. Email delivery must never block the business operation that
// triggered it (Requirement 21.1 targets "within 1 minute", and the
// request response path is measured in milliseconds), and must never
// cause that operation to fail if delivery errors. The function is a
// no-op when no NotificationService was injected, which keeps test setups
// that don't care about email wiring concise.
//
// The emit callback receives a background context because the caller's
// context may be cancelled shortly after its HTTP response is written;
// carrying the trace metadata forward is worthwhile but cancellation is
// not.
func (s *orderService) dispatchNotification(
	kind string,
	order *models.Order,
	emit func(ctx context.Context, order *models.Order) error,
) {
	if s.notifications == nil || order == nil || emit == nil {
		return
	}
	// Clone the pointer locally so the goroutine doesn't observe
	// further mutations made by the caller after dispatch.
	o := order
	go func() {
		defer func() {
			// Swallow panics so a bad template / nil pointer can
			// never crash the process. The panic is surfaced via
			// recover but otherwise ignored; the failing
			// notification is already logged by the sender.
			_ = recover()
		}()
		ctx := context.Background()
		if err := emit(ctx, o); err != nil {
			// The NotificationService already logs through its
			// injected logger; no additional action is required.
			_ = err
		}
		_ = kind
	}()
}

// validateCreateOrderRequest enforces the invariants that do not require
// database access. Keeping these checks in one place makes the main flow
// read top-down.
func validateCreateOrderRequest(req *CreateOrderRequest) error {
	switch req.PaymentMethod {
	case models.PaymentMethodOnline, models.PaymentMethodTransfer:
		// ok
	default:
		return fmt.Errorf("%w: %q", ErrInvalidPaymentMethod, req.PaymentMethod)
	}

	if strings.TrimSpace(req.ShippingAddress) == "" {
		return fmt.Errorf("%w: shipping_address is required", ErrInvalidShippingInfo)
	}

	// Guest orders require contact details (requirement 2.2). Authenticated
	// orders can rely on the user's profile so only the address is
	// mandatory here.
	if req.UserID == nil {
		if strings.TrimSpace(req.GuestName) == "" {
			return fmt.Errorf("%w: guest_name is required", ErrInvalidShippingInfo)
		}
		if strings.TrimSpace(req.GuestEmail) == "" {
			return fmt.Errorf("%w: guest_email is required", ErrInvalidShippingInfo)
		}
		if strings.TrimSpace(req.GuestPhone) == "" {
			return fmt.Errorf("%w: guest_phone is required", ErrInvalidShippingInfo)
		}
	}

	return nil
}

// encodeAttributes serialises a SKU's attributes into a deterministic JSON
// object ({"Color":"Red","Size":"L"}) that gets snapshotted on the order
// item. A map keeps the stored form compact and easy to read.
func encodeAttributes(attrs []*models.SKUAttribute) (string, error) {
	if len(attrs) == 0 {
		return "{}", nil
	}
	out := make(map[string]string, len(attrs))
	for _, attr := range attrs {
		if attr == nil {
			continue
		}
		out[attr.Name] = attr.Value
	}
	b, err := json.Marshal(out)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// skuDisplayName builds a human-readable name combining the product name
// (when loaded) with the SKU code. The product preload is optional so the
// function falls back gracefully.
func skuDisplayName(sku *models.SKU) string {
	if sku == nil {
		return ""
	}
	if sku.Product != nil && strings.TrimSpace(sku.Product.Name) != "" {
		return sku.Product.Name
	}
	return sku.SKUCode
}

// The following methods implement the query and lifecycle operations on
// OrderService in addition to CreateOrder. They cover Requirements 7.5
// through 7.8 and the cancellation flow in Requirement 24.

// GetOrder retrieves an order by its primary key. The returned order has
// Items and Payment preloaded so handlers can render the full order detail
// without additional round trips.
func (s *orderService) GetOrder(ctx context.Context, orderID uint) (*models.Order, error) {
	if orderID == 0 {
		return nil, fmt.Errorf("order id is required")
	}
	return s.orderRepo.GetByID(ctx, orderID)
}

// GetOrderByNumber retrieves an order by its unique order number. The
// order number is issued at creation time (Requirement 7.5) and is what
// customers see in their confirmation email, so this is the identifier
// used by tracking and lookup flows.
func (s *orderService) GetOrderByNumber(ctx context.Context, orderNumber string) (*models.Order, error) {
	orderNumber = strings.TrimSpace(orderNumber)
	if orderNumber == "" {
		return nil, fmt.Errorf("order number is required")
	}
	return s.orderRepo.GetByOrderNumber(ctx, orderNumber)
}

// ListOrders returns the paginated order history for a user (Requirement
// 7.6). The request uses page/page_size semantics at the API boundary;
// this method translates them into the limit/offset shape expected by the
// repository. An invalid status string causes ErrInvalidOrderStatus so
// handlers can surface a 400 rather than silently returning everything.
func (s *orderService) ListOrders(
	ctx context.Context,
	userID uint,
	params *ListOrdersRequest,
) (*OrderListResponse, error) {
	if userID == 0 {
		return nil, fmt.Errorf("user id is required")
	}

	req := normalizeListOrdersRequest(params)

	var statusFilter *models.OrderStatus
	if req.Status != "" {
		status := models.OrderStatus(req.Status)
		if !knownOrderStatuses[status] {
			return nil, fmt.Errorf("%w: %q", ErrInvalidOrderStatus, req.Status)
		}
		statusFilter = &status
	}

	repoParams := &repositories.ListOrderParams{
		Limit:     req.PageSize,
		Offset:    (req.Page - 1) * req.PageSize,
		Status:    statusFilter,
		SortBy:    req.SortBy,
		SortOrder: req.SortOrder,
	}

	orders, total, err := s.orderRepo.ListByUserID(ctx, userID, repoParams)
	if err != nil {
		return nil, fmt.Errorf("failed to list orders: %w", err)
	}

	return &OrderListResponse{
		Orders:   orders,
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

// UpdateOrderStatus validates the transition from the current status to the
// target status and persists the change. Terminal statuses ("completed",
// "cancelled") cannot transition anywhere; every other move is guarded by
// validStatusTransitions. Shipping carrier / tracking capture on the
// pending_shipment -> shipped hop is handled separately by the admin order
// flow in task 16.
func (s *orderService) UpdateOrderStatus(
	ctx context.Context,
	orderID uint,
	status models.OrderStatus,
) error {
	if orderID == 0 {
		return fmt.Errorf("order id is required")
	}
	if !knownOrderStatuses[status] {
		return fmt.Errorf("%w: %q", ErrInvalidOrderStatus, status)
	}

	order, err := s.orderRepo.GetByID(ctx, orderID)
	if err != nil {
		return err
	}

	if order.Status == status {
		return nil
	}

	allowed, ok := validStatusTransitions[order.Status]
	if !ok || !allowed[status] {
		return fmt.Errorf("%w: %s -> %s", ErrInvalidStatusTransition, order.Status, status)
	}

	if err := s.orderRepo.UpdateStatus(ctx, orderID, status); err != nil {
		return fmt.Errorf("failed to update order status: %w", err)
	}

	// Fire notifications for the status transitions that warrant a
	// customer-facing email (Requirements 21.3, 24.6). We reuse the
	// order loaded at the top of the method so the notification has
	// the full context (items, user, guest email) without an extra
	// round trip. Shipping transitions should update the in-memory
	// order with the new status so email templates can reflect it.
	order.Status = status
	switch status {
	case models.OrderStatusShipped:
		s.dispatchNotification("shipping_notification", order, func(ctx context.Context, o *models.Order) error {
			return s.notifications.SendShippingNotification(ctx, o)
		})
	case models.OrderStatusCancelled:
		s.dispatchNotification("order_cancellation", order, func(ctx context.Context, o *models.Order) error {
			return s.notifications.SendOrderCancellation(ctx, o)
		})
	}
	return nil
}

// CancelOrder cancels an order that is still in a cancellable state and
// restores the inventory reserved for it (Requirements 24.1, 24.2 & 24.3).
// Orders that have been shipped or completed cannot be cancelled here
// (Requirement 24.4); cancellation of paid orders belongs to the admin
// refund flow in task 18 (Requirement 24.5) and is intentionally rejected.
// Inventory restoration and the status update run inside a single
// transaction so a failure after one SKU has been restored rolls back the
// whole operation.
func (s *orderService) CancelOrder(ctx context.Context, orderID uint, reason string) error {
	_ = reason // reason is captured by callers via audit logs; unused here
	if orderID == 0 {
		return fmt.Errorf("order id is required")
	}

	order, err := s.orderRepo.GetByID(ctx, orderID)
	if err != nil {
		return err
	}

	if order.Status == models.OrderStatusCancelled {
		return nil
	}

	if !cancellableStatuses[order.Status] {
		return fmt.Errorf("%w: current status %s", ErrOrderNotCancellable, order.Status)
	}

	if err := s.runInTransaction(ctx, func(txCtx context.Context) error {
		// Requirement 24.3: restore inventory for every order item. Using
		// the atomic IncrementInventory keeps concurrent cancellations
		// safe and surfaces missing SKUs loudly. When an inventory log
		// repo is configured we also read the SKU's current inventory
		// before restoring it so the audit entry (Requirement 15.5)
		// carries accurate previous / new quantities.
		for _, item := range order.Items {
			if item == nil || item.Quantity <= 0 {
				continue
			}
			var previousQty int
			recordLog := s.inventoryLogRepo != nil
			if recordLog {
				sku, err := s.skuRepo.GetByID(txCtx, item.SKUID)
				if err != nil {
					return fmt.Errorf("failed to read sku %d: %w", item.SKUID, err)
				}
				previousQty = sku.Inventory
			}
			if err := s.skuRepo.IncrementInventory(txCtx, item.SKUID, item.Quantity); err != nil {
				return fmt.Errorf("failed to restore inventory for sku %d: %w", item.SKUID, err)
			}
			if recordLog {
				orderID := order.ID
				orderPtr := &orderID
				entry := &models.InventoryLog{
					SKUID:       item.SKUID,
					PreviousQty: previousQty,
					NewQty:      previousQty + item.Quantity,
					Change:      item.Quantity,
					Reason:      "order cancellation",
					OrderID:     orderPtr,
				}
				if err := s.inventoryLogRepo.Create(txCtx, entry); err != nil {
					return fmt.Errorf("failed to record inventory log for sku %d: %w", item.SKUID, err)
				}
			}
		}
		if err := s.orderRepo.UpdateStatus(txCtx, order.ID, models.OrderStatusCancelled); err != nil {
			return fmt.Errorf("failed to update order status: %w", err)
		}
		return nil
	}); err != nil {
		return err
	}

	// Requirement 24.6: send a cancellation confirmation email. The
	// send is best-effort: a notification failure must not fail the
	// cancellation, which has already been committed above.
	order.Status = models.OrderStatusCancelled
	s.dispatchNotification("order_cancellation", order, func(ctx context.Context, o *models.Order) error {
		return s.notifications.SendOrderCancellation(ctx, o)
	})

	return nil
}

// TrackOrder looks up an order by its order number plus the customer's
// email. The email must match either the authenticated user's address or
// the guest_email captured at checkout, which is what lets guests track
// their orders (Requirement 7.7) while still preventing enumeration.
func (s *orderService) TrackOrder(
	ctx context.Context,
	orderNumber, email string,
) (*models.Order, error) {
	orderNumber = strings.TrimSpace(orderNumber)
	email = strings.TrimSpace(email)
	if orderNumber == "" || email == "" {
		return nil, fmt.Errorf("order number and email are required")
	}
	return s.orderRepo.GetByOrderNumberAndEmail(ctx, orderNumber, email)
}

// normalizeListOrdersRequest returns a request with defaulted pagination
// and sort values. It never mutates the caller's request and always
// produces a non-nil result.
func normalizeListOrdersRequest(req *ListOrdersRequest) *ListOrdersRequest {
	out := ListOrdersRequest{}
	if req != nil {
		out = *req
	}
	if out.Page < 1 {
		out.Page = 1
	}
	if out.PageSize < 1 {
		out.PageSize = 20
	}
	if out.PageSize > 100 {
		out.PageSize = 100
	}
	if out.SortOrder != "asc" && out.SortOrder != "desc" {
		out.SortOrder = "desc"
	}
	switch out.SortBy {
	case "created_at", "updated_at", "total_amount", "order_number":
		// ok
	default:
		out.SortBy = "created_at"
	}
	return &out
}

// adminCancellableStatuses lists the statuses from which an admin-initiated
// cancellation is permitted (Requirement 16.5).
var adminCancellableStatuses = map[models.OrderStatus]bool{
	models.OrderStatusPendingPayment:  true,
	models.OrderStatusPendingTransfer: true,
}

// ListAllOrders returns a paginated list of all orders with admin-level
// filtering (Requirement 16.1). Unlike ListOrders which is scoped to a
// single user, this method exposes the full order set with filters for
// status, payment method, date range, and free-text search.
func (s *orderService) ListAllOrders(
	ctx context.Context,
	params *AdminListOrdersRequest,
) (*OrderListResponse, error) {
	req := normalizeAdminListRequest(params)

	repoParams := &repositories.ListOrderParams{
		Limit:     req.PageSize,
		Offset:    (req.Page - 1) * req.PageSize,
		SortBy:    req.SortBy,
		SortOrder: req.SortOrder,
	}

	if req.Status != "" {
		status := models.OrderStatus(req.Status)
		if !knownOrderStatuses[status] {
			return nil, fmt.Errorf("%w: %q", ErrInvalidOrderStatus, req.Status)
		}
		repoParams.Status = &status
	}

	if req.PaymentMethod != "" {
		pm := models.PaymentMethod(req.PaymentMethod)
		if pm != models.PaymentMethodOnline && pm != models.PaymentMethodTransfer {
			return nil, fmt.Errorf("%w: %q", ErrInvalidPaymentMethod, req.PaymentMethod)
		}
		repoParams.PaymentMethod = &pm
	}

	if req.Search != "" {
		repoParams.Search = req.Search
	}

	if req.StartDate != "" {
		t, err := parseDate(req.StartDate)
		if err == nil {
			repoParams.StartDate = &t
		}
	}
	if req.EndDate != "" {
		t, err := parseDate(req.EndDate)
		if err == nil {
			repoParams.EndDate = &t
		}
	}

	orders, total, err := s.orderRepo.List(ctx, repoParams)
	if err != nil {
		return nil, fmt.Errorf("failed to list orders: %w", err)
	}

	return &OrderListResponse{
		Orders:   orders,
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

// AdminUpdateOrderStatus validates and applies a status transition initiated
// by an administrator. It enforces the allowed admin transitions
// (Requirement 16.3): paid → pending_shipment, pending_shipment → shipped.
// When transitioning to "shipped", shipping carrier and tracking number are
// required (Requirement 16.4). A notification email is dispatched on
// success (Requirement 16.6).
func (s *orderService) AdminUpdateOrderStatus(
	ctx context.Context,
	orderID uint,
	req *AdminUpdateStatusRequest,
) error {
	if orderID == 0 {
		return fmt.Errorf("order id is required")
	}
	if req == nil {
		return fmt.Errorf("update status request is required")
	}
	if !knownOrderStatuses[req.Status] {
		return fmt.Errorf("%w: %q", ErrInvalidOrderStatus, req.Status)
	}

	order, err := s.orderRepo.GetByID(ctx, orderID)
	if err != nil {
		return err
	}

	if order.Status == req.Status {
		return nil
	}

	// Validate the transition is allowed.
	allowed, ok := validStatusTransitions[order.Status]
	if !ok || !allowed[req.Status] {
		return fmt.Errorf("%w: %s -> %s", ErrInvalidStatusTransition, order.Status, req.Status)
	}

	// Requirement 16.4: shipping details required for shipped transition.
	if req.Status == models.OrderStatusShipped {
		if strings.TrimSpace(req.ShippingCarrier) == "" || strings.TrimSpace(req.TrackingNumber) == "" {
			return fmt.Errorf("%w: shipping_carrier and tracking_number are required when updating to shipped", ErrInvalidStatusTransition)
		}
	}

	// Persist the status change and optional shipping details.
	if err := s.runInTransaction(ctx, func(txCtx context.Context) error {
		if err := s.orderRepo.UpdateStatus(txCtx, orderID, req.Status); err != nil {
			return fmt.Errorf("failed to update order status: %w", err)
		}
		// Persist shipping details when transitioning to shipped.
		if req.Status == models.OrderStatusShipped {
			order.ShippingCarrier = strings.TrimSpace(req.ShippingCarrier)
			order.TrackingNumber = strings.TrimSpace(req.TrackingNumber)
			if err := s.orderRepo.Update(txCtx, order); err != nil {
				return fmt.Errorf("failed to update shipping details: %w", err)
			}
		}
		return nil
	}); err != nil {
		return err
	}

	// Dispatch notification email (Requirement 16.6).
	order.Status = req.Status
	switch req.Status {
	case models.OrderStatusShipped:
		s.dispatchNotification("shipping_notification", order, func(ctx context.Context, o *models.Order) error {
			return s.notifications.SendShippingNotification(ctx, o)
		})
	}

	return nil
}

// AdminCancelOrder cancels an order from the admin panel. Only orders in
// pending_payment or pending_transfer status can be cancelled by admin
// (Requirement 16.5). Inventory is restored and a cancellation email is
// sent (Requirement 16.6).
func (s *orderService) AdminCancelOrder(ctx context.Context, orderID uint, reason string) error {
	if orderID == 0 {
		return fmt.Errorf("order id is required")
	}

	order, err := s.orderRepo.GetByID(ctx, orderID)
	if err != nil {
		return err
	}

	if order.Status == models.OrderStatusCancelled {
		return nil
	}

	if !adminCancellableStatuses[order.Status] {
		return fmt.Errorf("%w: current status %s", ErrOrderNotCancellable, order.Status)
	}

	if err := s.runInTransaction(ctx, func(txCtx context.Context) error {
		for _, item := range order.Items {
			if item == nil || item.Quantity <= 0 {
				continue
			}
			var previousQty int
			recordLog := s.inventoryLogRepo != nil
			if recordLog {
				sku, err := s.skuRepo.GetByID(txCtx, item.SKUID)
				if err != nil {
					return fmt.Errorf("failed to read sku %d: %w", item.SKUID, err)
				}
				previousQty = sku.Inventory
			}
			if err := s.skuRepo.IncrementInventory(txCtx, item.SKUID, item.Quantity); err != nil {
				return fmt.Errorf("failed to restore inventory for sku %d: %w", item.SKUID, err)
			}
			if recordLog {
				orderID := order.ID
				orderPtr := &orderID
				entry := &models.InventoryLog{
					SKUID:       item.SKUID,
					PreviousQty: previousQty,
					NewQty:      previousQty + item.Quantity,
					Change:      item.Quantity,
					Reason:      "admin order cancellation: " + reason,
					OrderID:     orderPtr,
				}
				if err := s.inventoryLogRepo.Create(txCtx, entry); err != nil {
					return fmt.Errorf("failed to record inventory log for sku %d: %w", item.SKUID, err)
				}
			}
		}
		if err := s.orderRepo.UpdateStatus(txCtx, order.ID, models.OrderStatusCancelled); err != nil {
			return fmt.Errorf("failed to update order status: %w", err)
		}
		return nil
	}); err != nil {
		return err
	}

	order.Status = models.OrderStatusCancelled
	s.dispatchNotification("order_cancellation", order, func(ctx context.Context, o *models.Order) error {
		return s.notifications.SendOrderCancellation(ctx, o)
	})

	return nil
}

// normalizeAdminListRequest returns a request with defaulted pagination
// and sort values for admin order listing.
func normalizeAdminListRequest(req *AdminListOrdersRequest) *AdminListOrdersRequest {
	out := AdminListOrdersRequest{}
	if req != nil {
		out = *req
	}
	if out.Page < 1 {
		out.Page = 1
	}
	if out.PageSize < 1 {
		out.PageSize = 20
	}
	if out.PageSize > 100 {
		out.PageSize = 100
	}
	if out.SortOrder != "asc" && out.SortOrder != "desc" {
		out.SortOrder = "desc"
	}
	switch out.SortBy {
	case "created_at", "updated_at", "total_amount", "order_number":
		// ok
	default:
		out.SortBy = "created_at"
	}
	return &out
}

// parseDate attempts to parse a date string in RFC3339 or YYYY-MM-DD format.
func parseDate(s string) (time.Time, error) {
	t, err := time.Parse(time.RFC3339, s)
	if err == nil {
		return t, nil
	}
	t, err = time.Parse("2006-01-02", s)
	if err == nil {
		return t, nil
	}
	return time.Time{}, fmt.Errorf("invalid date format: %s", s)
}
