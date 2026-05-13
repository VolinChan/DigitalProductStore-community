package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// Base contains common columns for all tables
type Base struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `gorm:"not null;default:now()" json:"created_at"`
}

// BaseWithUpdate contains common columns including updated_at
type BaseWithUpdate struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null;default:now()" json:"updated_at"`
}

// ==================== User Related Models ====================

// Role represents user roles
type Role string

const (
	RoleGuest         Role = "guest"
	RoleUser          Role = "user"
	RoleProductManager Role = "product_manager"
	RoleOrderManager  Role = "order_manager"
	RoleSuperAdmin    Role = "super_admin"
)

// User represents a user account
type User struct {
	BaseWithUpdate
	Email        string `gorm:"size:100;not null;uniqueIndex" json:"email"`
	PasswordHash string `gorm:"size:255;not null" json:"-"`
	FullName     string `gorm:"size:100;not null" json:"full_name"`
	Phone        string `gorm:"size:20" json:"phone"`
	Role         Role   `gorm:"size:20;not null;default:'user'" json:"role"`
	IsActive     bool   `gorm:"not null;default:true" json:"is_active"`
}

// TableName returns the table name for User
func (User) TableName() string {
	return "users"
}

// ==================== Category Model ====================

// Category represents a product category
type Category struct {
	Base
	Name      string    `gorm:"size:100;not null" json:"name"`
	Slug      string    `gorm:"size:100;not null;uniqueIndex" json:"slug"`
	ParentID  *uint     `gorm:"index" json:"parent_id"`
	Parent    *Category `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	SortOrder int       `gorm:"not null;default:0" json:"sort_order"`
}

// TableName returns the table name for Category
func (Category) TableName() string {
	return "categories"
}

// ==================== Product Related Models ====================

// Product represents a product
type Product struct {
	BaseWithUpdate
	Name          string           `gorm:"size:200;not null" json:"name"`
	Description   string           `gorm:"type:text" json:"description"`
	CategoryID    *uint            `gorm:"index" json:"category_id"`
	Category      *Category        `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Specifications string          `gorm:"type:jsonb;default:'{}'" json:"specifications"`
	IsActive      bool             `gorm:"not null;default:true" json:"is_active"`
	SKUs          []*SKU           `gorm:"foreignKey:ProductID" json:"skus,omitempty"`
	Images        []*ProductImage  `gorm:"foreignKey:ProductID" json:"images,omitempty"`
}

// TableName returns the table name for Product
func (Product) TableName() string {
	return "products"
}

// ProductImage represents a product image
type ProductImage struct {
	Base
	ProductID uint   `gorm:"not null;index" json:"product_id"`
	Product   *Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	ImageURL  string `gorm:"size:500;not null" json:"image_url"`
	SortOrder int    `gorm:"not null;default:0" json:"sort_order"`
	IsPrimary bool   `gorm:"not null;default:false" json:"is_primary"`
}

// TableName returns the table name for ProductImage
func (ProductImage) TableName() string {
	return "product_images"
}

// ==================== SKU Related Models ====================

// SKU represents a stock keeping unit
type SKU struct {
	BaseWithUpdate
	ProductID  uint            `gorm:"not null;index" json:"product_id"`
	Product    *Product        `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	SKUCode    string          `gorm:"column:sku_code;size:100;not null;uniqueIndex" json:"sku_code"`
	Price      decimal.Decimal `gorm:"type:decimal(10,2);not null" json:"price"`
	Inventory  int             `gorm:"not null;default:0" json:"inventory"`
	ImageURL   string          `gorm:"column:image_url;size:500" json:"image_url"`
	IsActive   bool            `gorm:"not null;default:true" json:"is_active"`
	Attributes []*SKUAttribute `gorm:"foreignKey:SKUID" json:"attributes,omitempty"`
}

// TableName returns the table name for SKU
func (SKU) TableName() string {
	return "skus"
}

// SKUAttribute represents a SKU attribute (color, size, etc.)
type SKUAttribute struct {
	Base
	SKUID   uint  `gorm:"column:sku_id;not null;index" json:"sku_id"`
	SKU     *SKU  `gorm:"foreignKey:SKUID" json:"sku,omitempty"`
	Name    string `gorm:"size:50;not null" json:"name"`
	Value   string `gorm:"size:100;not null" json:"value"`
}

// TableName returns the table name for SKUAttribute
func (SKUAttribute) TableName() string {
	return "sku_attributes"
}

// ==================== Cart Related Models ====================

// Cart represents a shopping cart
type Cart struct {
	BaseWithUpdate
	UserID    *uint       `gorm:"index" json:"user_id"`
	User      *User       `gorm:"foreignKey:UserID" json:"user,omitempty"`
	SessionID string      `gorm:"size:100;index" json:"session_id"`
	Items     []*CartItem `gorm:"foreignKey:CartID" json:"items,omitempty"`
}

// TableName returns the table name for Cart
func (Cart) TableName() string {
	return "carts"
}

// CartItem represents an item in a shopping cart
type CartItem struct {
	Base
	CartID    uint            `gorm:"not null;index" json:"cart_id"`
	Cart      *Cart           `gorm:"foreignKey:CartID" json:"cart,omitempty"`
	SKUID     uint            `gorm:"column:sku_id;not null;index" json:"sku_id"`
	SKU       *SKU            `gorm:"foreignKey:SKUID" json:"sku,omitempty"`
	Quantity  int             `gorm:"not null;default:1" json:"quantity"`
	UnitPrice decimal.Decimal `gorm:"type:decimal(10,2);not null" json:"unit_price"`
}

// TableName returns the table name for CartItem
func (CartItem) TableName() string {
	return "cart_items"
}

// ==================== Order Related Models ====================

// OrderStatus represents the status of an order
type OrderStatus string

const (
	OrderStatusPendingPayment  OrderStatus = "pending_payment"
	OrderStatusPendingTransfer OrderStatus = "pending_transfer"
	OrderStatusPaid            OrderStatus = "paid"
	OrderStatusPendingShipment OrderStatus = "pending_shipment"
	OrderStatusShipped         OrderStatus = "shipped"
	OrderStatusCompleted       OrderStatus = "completed"
	OrderStatusCancelled       OrderStatus = "cancelled"
	OrderStatusPaymentFailed   OrderStatus = "payment_failed"
)

// PaymentMethod represents the payment method
type PaymentMethod string

const (
	PaymentMethodOnline   PaymentMethod = "online"
	PaymentMethodTransfer PaymentMethod = "transfer"
)

// Order represents an order
type Order struct {
	BaseWithUpdate
	OrderNumber          string        `gorm:"size:50;not null;uniqueIndex" json:"order_number"`
	UserID               *uint         `gorm:"index" json:"user_id"`
	User                 *User         `gorm:"foreignKey:UserID" json:"user,omitempty"`
	GuestEmail           string        `gorm:"size:100;index" json:"guest_email"`
	GuestName            string        `gorm:"size:100" json:"guest_name"`
	GuestPhone           string        `gorm:"size:20" json:"guest_phone"`
	ShippingAddress      string        `gorm:"type:text;not null" json:"shipping_address"`
	Status               OrderStatus   `gorm:"size:20;not null;default:'pending_payment';index" json:"status"`
	PaymentMethod        PaymentMethod `gorm:"size:20" json:"payment_method"`
	Subtotal             decimal.Decimal `gorm:"type:decimal(12,2);not null" json:"subtotal"`
	ShippingFee          decimal.Decimal `gorm:"type:decimal(10,2);not null;default:0" json:"shipping_fee"`
	TotalAmount          decimal.Decimal `gorm:"type:decimal(12,2);not null" json:"total_amount"`
	PaymentID            *uint         `json:"payment_id"`
	Payment              *Payment      `gorm:"foreignKey:PaymentID" json:"payment,omitempty"`
	ConfirmationDeadline *time.Time    `json:"confirmation_deadline"`
	ShippingCarrier      string        `gorm:"size:50" json:"shipping_carrier"`
	TrackingNumber       string        `gorm:"size:100" json:"tracking_number"`
	Items                []*OrderItem  `gorm:"foreignKey:OrderID" json:"items,omitempty"`
}

// TableName returns the table name for Order
func (Order) TableName() string {
	return "orders"
}

// OrderItem represents an item in an order
type OrderItem struct {
	Base
	OrderID   uint            `gorm:"not null;index" json:"order_id"`
	Order     *Order          `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	SKUID     uint            `gorm:"column:sku_id;not null" json:"sku_id"`
	SKU       *SKU            `gorm:"foreignKey:SKUID" json:"sku,omitempty"`
	SKUName   string          `gorm:"column:sku_name;size:200;not null" json:"sku_name"`
	SKUCode   string          `gorm:"column:sku_code;size:100;not null" json:"sku_code"`
	Attributes string         `gorm:"type:text" json:"attributes"`
	Quantity  int             `gorm:"not null" json:"quantity"`
	UnitPrice decimal.Decimal `gorm:"type:decimal(10,2);not null" json:"unit_price"`
	Subtotal  decimal.Decimal `gorm:"type:decimal(12,2);not null" json:"subtotal"`
}

// TableName returns the table name for OrderItem
func (OrderItem) TableName() string {
	return "order_items"
}

// ==================== Payment Related Models ====================

// PaymentStatus represents the status of a payment
type PaymentStatus string

const (
	PaymentStatusPending    PaymentStatus = "pending"
	PaymentStatusProcessing PaymentStatus = "processing"
	PaymentStatusSucceeded  PaymentStatus = "succeeded"
	PaymentStatusFailed     PaymentStatus = "failed"
	PaymentStatusCancelled  PaymentStatus = "cancelled"
)

// Payment represents a payment record
type Payment struct {
	BaseWithUpdate
	OrderID          uint            `gorm:"not null;uniqueIndex" json:"order_id"`
	Order            *Order          `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	Method           PaymentMethod   `gorm:"size:20;not null" json:"method"`
	Status           PaymentStatus   `gorm:"size:20;not null;default:'pending'" json:"status"`
	Amount           decimal.Decimal `gorm:"type:decimal(12,2);not null" json:"amount"`
	Currency         string          `gorm:"size:3;not null;default:'USD'" json:"currency"`
	TransactionID    string          `gorm:"size:100" json:"transaction_id"`
	TransferProofURL string          `gorm:"size:500" json:"transfer_proof_url"`
	ConfirmedBy      *uint           `json:"confirmed_by"`
	ConfirmedAt      *time.Time      `json:"confirmed_at"`
	ReceivedAmount   decimal.Decimal `gorm:"type:decimal(12,2)" json:"received_amount"`
	Notes            string          `gorm:"type:text" json:"notes"`
}

// TableName returns the table name for Payment
func (Payment) TableName() string {
	return "payments"
}

// ==================== Inventory Log Model ====================

// InventoryLog represents an inventory change log
type InventoryLog struct {
	Base
	SKUID       uint   `gorm:"column:sku_id;not null;index" json:"sku_id"`
	SKU         *SKU   `gorm:"foreignKey:SKUID" json:"sku,omitempty"`
	PreviousQty int    `gorm:"not null" json:"previous_qty"`
	NewQty      int    `gorm:"not null" json:"new_qty"`
	Change      int    `gorm:"not null" json:"change"`
	Reason      string `gorm:"size:200" json:"reason"`
	OrderID     *uint  `gorm:"index" json:"order_id"`
	Order       *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	AdminID     *uint  `gorm:"index" json:"admin_id"`
	Admin       *User  `gorm:"foreignKey:AdminID" json:"admin,omitempty"`
}

// TableName returns the table name for InventoryLog
func (InventoryLog) TableName() string {
	return "inventory_logs"
}

// ==================== Content Management Models ====================

// Banner represents a homepage banner
type Banner struct {
	BaseWithUpdate
	Title       string     `gorm:"size:100" json:"title"`
	Description string     `gorm:"size:500" json:"description"`
	ImageURL    string     `gorm:"size:500;not null" json:"image_url"`
	LinkURL     string     `gorm:"size:500" json:"link_url"`
	Priority    int        `gorm:"not null;default:0" json:"priority"`
	IsActive    bool       `gorm:"not null;default:true" json:"is_active"`
	StartDate   *time.Time `json:"start_date"`
	EndDate     *time.Time `json:"end_date"`
}

// TableName returns the table name for Banner
func (Banner) TableName() string {
	return "banners"
}

// AnnouncementType represents the type of announcement
type AnnouncementType string

const (
	AnnouncementTypeInfo      AnnouncementType = "info"
	AnnouncementTypeWarning   AnnouncementType = "warning"
	AnnouncementTypePromotion AnnouncementType = "promotion"
)

// Priority represents the priority level
type Priority string

const (
	PriorityHigh   Priority = "high"
	PriorityMedium Priority = "medium"
	PriorityLow    Priority = "low"
)

// Announcement represents a system announcement
type Announcement struct {
	BaseWithUpdate
	Title     string           `gorm:"size:200;not null" json:"title"`
	Content   string           `gorm:"type:text;not null" json:"content"`
	Type      AnnouncementType `gorm:"size:20;not null;default:'info'" json:"type"`
	Priority  Priority         `gorm:"size:10;not null;default:'medium'" json:"priority"`
	IsActive  bool             `gorm:"not null;default:true" json:"is_active"`
	StartDate *time.Time       `json:"start_date"`
	EndDate   *time.Time       `json:"end_date"`
}

// TableName returns the table name for Announcement
func (Announcement) TableName() string {
	return "announcements"
}

// ==================== Analytics Model ====================

// AnalyticsEventType represents the type of analytics event
type AnalyticsEventType string

const (
	AnalyticsEventTypeHomepageView AnalyticsEventType = "homepage_view"
	AnalyticsEventTypeProductView  AnalyticsEventType = "product_view"
	AnalyticsEventTypeAddToCart    AnalyticsEventType = "add_to_cart"
	AnalyticsEventTypeRemoveFromCart AnalyticsEventType = "remove_from_cart"
	AnalyticsEventTypeCheckoutStart AnalyticsEventType = "checkout_start"
	AnalyticsEventTypeOrderComplete AnalyticsEventType = "order_complete"
	AnalyticsEventTypePaymentSuccess AnalyticsEventType = "payment_success"
	AnalyticsEventTypePaymentFailure AnalyticsEventType = "payment_failure"
)

// AnalyticsEvent represents an analytics tracking event
type AnalyticsEvent struct {
	ID        uint               `gorm:"primaryKey" json:"id"`
	EventType AnalyticsEventType `gorm:"size:20;not null;index" json:"event_type"`
	UserID    *uint              `gorm:"index" json:"user_id"`
	User      *User              `gorm:"foreignKey:UserID" json:"user,omitempty"`
	SessionID string             `gorm:"size:100;not null;index" json:"session_id"`
	ProductID *uint              `gorm:"index" json:"product_id"`
	Product   *Product           `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	SKUID     *uint              `gorm:"column:sku_id;index" json:"sku_id"`
	SKU       *SKU               `gorm:"foreignKey:SKUID" json:"sku,omitempty"`
	Metadata  string             `gorm:"type:jsonb;default:'{}'" json:"metadata"`
	Timestamp time.Time          `gorm:"not null;default:now();index" json:"timestamp"`
}

// TableName returns the table name for AnalyticsEvent
func (AnalyticsEvent) TableName() string {
	return "analytics_events"
}
