package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	stripego "github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/checkout/session"
	"github.com/stripe/stripe-go/v76/webhook"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
	"github.com/digital-store/backend/pkg/logger"
)

// Payment service errors. Handlers match against these sentinels to map to
// HTTP status codes.
var (
	// ErrPaymentNotImplemented is returned by stub methods that will be
	// implemented in later tasks. It lets the interface stay complete so
	// handlers can be wired up today while specific flows land later.
	ErrPaymentNotImplemented = errors.New("payment operation not implemented")

	// ErrPaymentConfigMissing is returned when a required Stripe secret or
	// webhook configuration value is empty.
	ErrPaymentConfigMissing = errors.New("payment gateway configuration missing")

	// ErrOrderNotPayable is returned when a payment session is requested
	// for an order that is not in a state that accepts online payment
	// (e.g. already paid, cancelled, shipped).
	ErrOrderNotPayable = errors.New("order is not in a payable state")

	// ErrInvalidPaymentMethodForOnline is returned when a payment session
	// is requested for an order whose payment_method is not "online".
	ErrInvalidPaymentMethodForOnline = errors.New("order payment method is not online")

	// ErrInvalidWebhookSignature is returned when a webhook payload fails
	// HMAC-SHA256 signature verification (Requirement 9.5).
	ErrInvalidWebhookSignature = errors.New("invalid webhook signature")

	// ErrInvalidWebhookPayload is returned when a webhook payload is
	// structurally invalid or references an unknown order / payment.
	ErrInvalidWebhookPayload = errors.New("invalid webhook payload")

	// ErrTransferProofTooLarge is returned when an uploaded transfer
	// proof exceeds the configured size limit (Requirement 10.3).
	ErrTransferProofTooLarge = errors.New("transfer proof exceeds size limit")

	// ErrTransferProofFormat is returned when an uploaded transfer proof
	// is not one of the accepted formats (Requirement 10.2: JPEG, PNG,
	// PDF).
	ErrTransferProofFormat = errors.New("transfer proof format not supported")

	// ErrInvalidPaymentMethodForTransfer is returned when a transfer
	// operation is requested for an order whose payment_method is not
	// "transfer".
	ErrInvalidPaymentMethodForTransfer = errors.New("order payment method is not transfer")

	// ErrTransferNotReviewable is returned when an admin tries to
	// confirm or reject a payment that is not in a state awaiting
	// review (Requirement 12.1 / 12.7 / 12.8).
	ErrTransferNotReviewable = errors.New("transfer payment is not awaiting review")

	// ErrOrderNotAwaitingTransfer is returned when UploadTransferProof
	// is called against an order that is not in a status that accepts
	// a new transfer proof upload.
	ErrOrderNotAwaitingTransfer = errors.New("order is not awaiting transfer upload")
)

// MaxTransferProofSize is the maximum accepted size (in bytes) for a
// customer-uploaded transfer proof. Requirement 10.3 caps uploads at 10 MB.
const MaxTransferProofSize = 10 * 1024 * 1024

// TransferConfirmationDeadline is the window, measured from the order
// creation time, during which a transfer payment must be confirmed by an
// administrator (Requirement 10.7 / 11.x).
const TransferConfirmationDeadline = 7 * 24 * time.Hour

// allowedTransferProofContentTypes enumerates the MIME types accepted for
// a transfer proof upload. Keys are lower-cased content types; values are
// the canonical file extension written to disk.
var allowedTransferProofContentTypes = map[string]string{
	"image/jpeg":      "jpg",
	"image/jpg":       "jpg",
	"image/pjpeg":     "jpg",
	"image/png":       "png",
	"application/pdf": "pdf",
}

// allowedTransferProofExtensions mirrors allowedTransferProofContentTypes
// for file-extension based validation. We accept either a known content
// type or a known extension so that browsers that mis-label uploads do not
// reject legitimate files.
var allowedTransferProofExtensions = map[string]string{
	".jpg":  "jpg",
	".jpeg": "jpg",
	".png":  "png",
	".pdf":  "pdf",
}

// PaymentSession describes the result of creating an online payment session
// with the payment gateway. The frontend redirects the customer to
// PaymentURL (Requirement 9.2) and uses SessionID later to correlate the
// webhook event back to the order.
type PaymentSession struct {
	SessionID  string    `json:"session_id"`
	PaymentURL string    `json:"payment_url"`
	ExpiresAt  time.Time `json:"expires_at"`
}

// PaymentConfirmRequest carries the verified webhook payload into
// ConfirmPayment. The handler reads the raw body and Stripe-Signature header
// from the HTTP request and hands them to the service; all signature
// verification happens inside ConfirmPayment so the handler stays thin.
type PaymentConfirmRequest struct {
	// Payload is the raw webhook body (bytes) as delivered by Stripe. It
	// must be preserved byte-for-byte for signature verification to
	// succeed.
	Payload []byte
	// Signature is the value of the Stripe-Signature HTTP header.
	Signature string
}

// TransferConfirmRequest is the admin-facing request to confirm a transfer
// payment. It is referenced by the interface so handlers can depend on the
// final shape; the implementation lives in task 11.3.
type TransferConfirmRequest struct {
	PaymentID      uint            `json:"payment_id"`
	ReceivedAmount decimal.Decimal `json:"received_amount"`
	AdminID        uint            `json:"admin_id"`
	Notes          string          `json:"notes"`
}

// TransferRejectRequest is the admin-facing request to reject a transfer
// payment.
type TransferRejectRequest struct {
	PaymentID uint   `json:"payment_id"`
	AdminID   uint   `json:"admin_id"`
	Reason    string `json:"reason"`
}

// BatchTransferConfirmRequest carries multiple confirmations in a single
// admin action. Implementation lives in task 11.4.
type BatchTransferConfirmRequest struct {
	Items   []TransferConfirmRequest `json:"items"`
	AdminID uint                     `json:"admin_id"`
}

// PaymentService defines the interface for all payment operations. Only the
// online payment flow (CreatePaymentSession + ConfirmPayment) is implemented
// in this iteration (task 11.2); other methods return
// ErrPaymentNotImplemented and are filled in by tasks 11.3 / 11.4.
type PaymentService interface {
	// CreatePaymentSession creates an online checkout session with the
	// configured payment gateway for the given order and returns the URL
	// the customer should be redirected to.
	//
	// Requirements:
	//   - 9.1: session created within 500ms
	//   - 9.2: session URL returned for redirect
	CreatePaymentSession(ctx context.Context, orderID uint) (*PaymentSession, error)

	// ConfirmPayment processes a verified webhook callback from the
	// payment gateway. It validates the HMAC-SHA256 signature, looks up
	// the related order/payment, updates their statuses and records the
	// gateway transaction ID.
	//
	// Requirements:
	//   - 9.3: successful payment -> order status "paid"
	//   - 9.4: failed payment -> order status remains "pending_payment"
	//   - 9.5: HMAC-SHA256 signature verification
	//   - 9.7: store gateway transaction ID
	ConfirmPayment(ctx context.Context, req *PaymentConfirmRequest) error

	// UploadTransferProof records a customer-uploaded transfer proof for
	// an order using transfer payment. Implemented in task 11.3.
	UploadTransferProof(ctx context.Context, orderID uint, file multipart.File, header *multipart.FileHeader) error

	// ConfirmTransferPayment confirms a transfer payment after admin
	// review. Implemented in task 11.3.
	ConfirmTransferPayment(ctx context.Context, req *TransferConfirmRequest) error

	// RejectTransferPayment rejects a transfer payment. Implemented in
	// task 11.3.
	RejectTransferPayment(ctx context.Context, req *TransferRejectRequest) error

	// BatchConfirmTransfer confirms multiple transfer payments in one
	// admin action inside a single transaction so the batch is applied
	// atomically.
	//
	// Requirements:
	//   - 13.4: validate all entered amounts before applying any update
	//   - 13.5: transition every selected order to "paid" when validations pass
	//   - 13.7: record admin id and timestamp for each confirmed order
	BatchConfirmTransfer(ctx context.Context, req *BatchTransferConfirmRequest) error

	// GetPaymentByOrder returns the payment record for an order.
	GetPaymentByOrder(ctx context.Context, orderID uint) (*models.Payment, error)
}

// StripeConfig bundles the Stripe-specific configuration needed by the
// service. Pulling the values into a dedicated struct keeps the service
// decoupled from the global config package and makes it trivial to swap
// implementations in tests.
type StripeConfig struct {
	SecretKey     string
	WebhookSecret string
	SuccessURL    string
	CancelURL     string
	Currency      string // ISO code, default "USD"
}

// paymentService implements PaymentService for the Stripe gateway. The
// service is intentionally constructed via dependency injection so that
// tests can provide fake repositories and an alternative transaction
// manager.
type paymentService struct {
	paymentRepo   repositories.PaymentRepository
	orderRepo     repositories.OrderRepository
	txManager     repositories.TxManager
	fileStorage   FileStorage
	cfg           StripeConfig
	log           *logger.Logger
	notifications NotificationService
}

// NewPaymentService constructs a PaymentService. cfg.SecretKey is applied to
// the global stripe-go client on first use via ensureStripeKey so callers do
// not need to call stripe.SetApiKey themselves.
//
// fileStorage is used by UploadTransferProof to persist customer-uploaded
// receipts. Pass nil to disable transfer proof uploads (in that case the
// method returns ErrFileStorageNotConfigured).
//
// notifications may be nil. When non-nil the service dispatches payment
// emails (confirmation on success, rejection with reason on admin
// rejection, per-order confirmation during batch confirmation). Email
// sends run in a detached goroutine so the webhook or admin request never
// waits on SMTP; failures are logged by the NotificationService but do
// not fail the business operation (Requirements 9.6, 12.8, 12.10, 13.6,
// 21.2, 21.4).
func NewPaymentService(
	paymentRepo repositories.PaymentRepository,
	orderRepo repositories.OrderRepository,
	txManager repositories.TxManager,
	fileStorage FileStorage,
	cfg StripeConfig,
	log *logger.Logger,
	notifications NotificationService,
) PaymentService {
	if cfg.Currency == "" {
		cfg.Currency = "USD"
	}
	return &paymentService{
		paymentRepo:   paymentRepo,
		orderRepo:     orderRepo,
		txManager:     txManager,
		fileStorage:   fileStorage,
		cfg:           cfg,
		log:           log,
		notifications: notifications,
	}
}

// ensureStripeKey sets the global Stripe API key on first use. stripe-go
// operations read from the package-global stripe.Key; pushing the
// configured secret into place lazily keeps construction cheap.
func (s *paymentService) ensureStripeKey() error {
	if s.cfg.SecretKey == "" {
		return fmt.Errorf("%w: stripe secret key", ErrPaymentConfigMissing)
	}
	stripego.Key = s.cfg.SecretKey
	return nil
}

// CreatePaymentSession creates a Stripe Checkout Session for the given
// order. The order must be in a payable state (pending_payment) with
// payment method = "online". A Payment record is created (or updated) with
// status=Processing and the Stripe session id so the eventual webhook can
// look up the order via either payment id or transaction id.
func (s *paymentService) CreatePaymentSession(ctx context.Context, orderID uint) (*PaymentSession, error) {
	if orderID == 0 {
		return nil, fmt.Errorf("order id is required")
	}
	if err := s.ensureStripeKey(); err != nil {
		return nil, err
	}
	if s.cfg.SuccessURL == "" || s.cfg.CancelURL == "" {
		return nil, fmt.Errorf("%w: stripe success/cancel url", ErrPaymentConfigMissing)
	}

	order, err := s.orderRepo.GetByID(ctx, orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to load order: %w", err)
	}

	// Only pending_payment orders can receive a new checkout session.
	// payment_failed is re-payable and transitions back to pending_payment
	// via the existing order flow; we keep this method strict and ask
	// callers to reset the order first if needed.
	if order.Status != models.OrderStatusPendingPayment {
		return nil, fmt.Errorf("%w: status=%s", ErrOrderNotPayable, order.Status)
	}
	if order.PaymentMethod != models.PaymentMethodOnline {
		return nil, fmt.Errorf("%w: method=%s", ErrInvalidPaymentMethodForOnline, order.PaymentMethod)
	}

	// Build a single line item for the order total. Stripe requires the
	// amount in the currency's smallest unit (cents for USD).
	amountMinor := toMinorUnits(order.TotalAmount)
	if amountMinor <= 0 {
		return nil, fmt.Errorf("order total must be positive: %s", order.TotalAmount.String())
	}

	productName := fmt.Sprintf("Order %s", order.OrderNumber)

	successURL := appendQueryParam(s.cfg.SuccessURL, "order_number", order.OrderNumber)
	cancelURL := appendQueryParam(s.cfg.CancelURL, "order_number", order.OrderNumber)

	params := &stripego.CheckoutSessionParams{
		Mode:       stripego.String(string(stripego.CheckoutSessionModePayment)),
		SuccessURL: stripego.String(successURL),
		CancelURL:  stripego.String(cancelURL),
		PaymentMethodTypes: stripego.StringSlice([]string{
			"card",
		}),
		ClientReferenceID: stripego.String(order.OrderNumber),
		LineItems: []*stripego.CheckoutSessionLineItemParams{
			{
				Quantity: stripego.Int64(1),
				PriceData: &stripego.CheckoutSessionLineItemPriceDataParams{
					Currency:   stripego.String(strings.ToLower(s.cfg.Currency)),
					UnitAmount: stripego.Int64(amountMinor),
					ProductData: &stripego.CheckoutSessionLineItemPriceDataProductDataParams{
						Name: stripego.String(productName),
					},
				},
			},
		},
		Metadata: map[string]string{
			"order_id":     strconv.FormatUint(uint64(order.ID), 10),
			"order_number": order.OrderNumber,
		},
	}
	// Pre-fill the customer email when we have one. The guest email path
	// is covered by GuestEmail; for authenticated users we fall back to
	// the user relation when available.
	if email := resolveCustomerEmail(order); email != "" {
		params.CustomerEmail = stripego.String(email)
	}

	sess, err := session.New(params)
	if err != nil {
		return nil, fmt.Errorf("failed to create stripe checkout session: %w", err)
	}

	// Persist or update the payment record. The payment row is keyed on
	// order_id (uniqueIndex) so we upsert by looking it up first.
	if err := s.upsertOnlinePayment(ctx, order, sess); err != nil {
		// Log but do not fail the request: the session is already
		// created upstream. A subsequent webhook with the transaction
		// id can still reconcile by falling back to ClientReferenceID.
		s.logWarn("payment record upsert failed",
			"order_id", order.ID,
			"session_id", sess.ID,
			"err", err,
		)
	}

	result := &PaymentSession{
		SessionID:  sess.ID,
		PaymentURL: sess.URL,
		ExpiresAt:  time.Unix(sess.ExpiresAt, 0).UTC(),
	}
	return result, nil
}

// upsertOnlinePayment creates or updates the Payment row associated with
// the order so that the webhook handler can find it later. The session id
// is stored in transaction_id as an interim value; it will be replaced
// with the PaymentIntent id when the webhook is processed.
func (s *paymentService) upsertOnlinePayment(
	ctx context.Context,
	order *models.Order,
	sess *stripego.CheckoutSession,
) error {
	existing, err := s.paymentRepo.GetByOrderID(ctx, order.ID)
	if err != nil && !errors.Is(err, repositories.ErrPaymentNotFound) {
		return err
	}

	if existing != nil {
		existing.Method = models.PaymentMethodOnline
		existing.Status = models.PaymentStatusProcessing
		existing.Amount = order.TotalAmount
		existing.Currency = strings.ToUpper(s.cfg.Currency)
		existing.TransactionID = sess.ID
		return s.paymentRepo.Update(ctx, existing)
	}

	payment := &models.Payment{
		OrderID:       order.ID,
		Method:        models.PaymentMethodOnline,
		Status:        models.PaymentStatusProcessing,
		Amount:        order.TotalAmount,
		Currency:      strings.ToUpper(s.cfg.Currency),
		TransactionID: sess.ID,
	}
	return s.paymentRepo.Create(ctx, payment)
}

// ConfirmPayment verifies the incoming webhook signature using Stripe's
// HMAC-SHA256 construction (Requirement 9.5) and then acts on the event.
// We handle the subset of events relevant to checkout completion:
//   - checkout.session.completed   -> mark paid (Requirement 9.3)
//   - checkout.session.async_payment_succeeded -> mark paid (async methods)
//   - checkout.session.async_payment_failed    -> mark failed (9.4)
//   - payment_intent.payment_failed            -> mark failed (9.4)
//
// Any other event is logged and silently ignored so Stripe considers the
// webhook delivered and stops retrying.
func (s *paymentService) ConfirmPayment(ctx context.Context, req *PaymentConfirmRequest) error {
	if req == nil || len(req.Payload) == 0 {
		return fmt.Errorf("%w: empty payload", ErrInvalidWebhookPayload)
	}
	if s.cfg.WebhookSecret == "" {
		return fmt.Errorf("%w: stripe webhook secret", ErrPaymentConfigMissing)
	}

	// HMAC-SHA256 signature verification. stripe-go's webhook.ConstructEvent
	// parses the Stripe-Signature header, recomputes the signature over
	// the raw payload with the webhook secret, and returns an error if it
	// doesn't match or the timestamp is outside the default 5 minute
	// tolerance.
	event, err := webhook.ConstructEvent(req.Payload, req.Signature, s.cfg.WebhookSecret)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidWebhookSignature, err)
	}

	switch event.Type {
	case "checkout.session.completed",
		"checkout.session.async_payment_succeeded":
		return s.handleCheckoutSuccess(ctx, &event)
	case "checkout.session.async_payment_failed":
		return s.handleCheckoutFailure(ctx, &event, "async_payment_failed")
	case "payment_intent.payment_failed":
		return s.handlePaymentIntentFailure(ctx, &event)
	default:
		s.logInfo("unhandled stripe event", "type", string(event.Type), "id", event.ID)
		return nil
	}
}

// handleCheckoutSuccess processes a checkout.session.completed event. It
// looks up the associated payment/order and marks them paid inside a single
// transaction so a partial failure rolls back both writes.
func (s *paymentService) handleCheckoutSuccess(ctx context.Context, event *stripego.Event) error {
	sess, err := parseCheckoutSession(event)
	if err != nil {
		return err
	}

	// Stripe sends payment_status=paid on immediate card payments and
	// "no_payment_required" for $0 sessions. Async methods send "paid"
	// on the async_payment_succeeded event. Any other value means the
	// checkout completed but payment is still outstanding (e.g.
	// "unpaid" with pending bank transfer), which we do not treat as a
	// success.
	if sess.PaymentStatus != stripego.CheckoutSessionPaymentStatusPaid &&
		sess.PaymentStatus != stripego.CheckoutSessionPaymentStatusNoPaymentRequired {
		s.logInfo("checkout session completed but not paid",
			"session_id", sess.ID,
			"payment_status", string(sess.PaymentStatus),
		)
		return nil
	}

	payment, order, err := s.loadPaymentAndOrderFromSession(ctx, sess)
	if err != nil {
		return err
	}

	// Idempotency: if the payment is already succeeded, don't re-apply.
	// Stripe may retry the webhook multiple times.
	if payment.Status == models.PaymentStatusSucceeded {
		return nil
	}

	// Prefer the PaymentIntent id for reconciliation (Requirement 9.7)
	// when available; fall back to the session id otherwise.
	txID := sess.ID
	if sess.PaymentIntent != nil && sess.PaymentIntent.ID != "" {
		txID = sess.PaymentIntent.ID
	}

	if err := s.runInTransaction(ctx, func(txCtx context.Context) error {
		payment.Status = models.PaymentStatusSucceeded
		payment.TransactionID = txID
		payment.ReceivedAmount = fromMinorUnits(sess.AmountTotal)
		now := time.Now().UTC()
		payment.ConfirmedAt = &now
		if err := s.paymentRepo.Update(txCtx, payment); err != nil {
			return fmt.Errorf("failed to update payment: %w", err)
		}
		// Requirement 9.3: update order status to "paid" on success.
		if err := s.orderRepo.UpdateStatus(txCtx, order.ID, models.OrderStatusPaid); err != nil {
			return fmt.Errorf("failed to update order status: %w", err)
		}
		return nil
	}); err != nil {
		return err
	}

	// Requirements 9.6 / 21.2: send a payment confirmation email
	// within 1 minute of the payment landing. The webhook handler has
	// already responded 200 to Stripe at this point; the email is a
	// best-effort side effect.
	s.dispatchNotification("payment_confirmation", order.ID, func(ctx context.Context, o *models.Order) error {
		return s.notifications.SendPaymentConfirmation(ctx, o)
	})
	return nil
}

// handleCheckoutFailure marks the payment as failed while leaving the
// order status as "pending_payment" per Requirement 9.4 so the customer
// can retry.
func (s *paymentService) handleCheckoutFailure(ctx context.Context, event *stripego.Event, reason string) error {
	sess, err := parseCheckoutSession(event)
	if err != nil {
		return err
	}
	payment, _, err := s.loadPaymentAndOrderFromSession(ctx, sess)
	if err != nil {
		return err
	}

	if payment.Status == models.PaymentStatusFailed {
		return nil
	}
	payment.Status = models.PaymentStatusFailed
	if reason != "" {
		payment.Notes = reason
	}
	if err := s.paymentRepo.Update(ctx, payment); err != nil {
		return fmt.Errorf("failed to update payment: %w", err)
	}
	// Order status intentionally stays at pending_payment (Requirement 9.4).
	return nil
}

// handlePaymentIntentFailure handles payment_intent.payment_failed events.
// These arrive without a checkout session in scope, so we look up the
// payment via the intent's metadata (populated from the session).
func (s *paymentService) handlePaymentIntentFailure(ctx context.Context, event *stripego.Event) error {
	var intent stripego.PaymentIntent
	if err := json.Unmarshal(event.Data.Raw, &intent); err != nil {
		return fmt.Errorf("%w: cannot parse payment intent: %v", ErrInvalidWebhookPayload, err)
	}
	// Try to find the payment either by the intent id (if we already
	// stored it) or via the order id in metadata.
	payment, err := s.paymentRepo.GetByTransactionID(ctx, intent.ID)
	if err != nil && !errors.Is(err, repositories.ErrPaymentNotFound) {
		return err
	}
	if payment == nil {
		orderID := parseOrderIDFromMetadata(intent.Metadata)
		if orderID == 0 {
			s.logInfo("payment_intent.payment_failed without correlatable order", "intent_id", intent.ID)
			return nil
		}
		payment, err = s.paymentRepo.GetByOrderID(ctx, orderID)
		if err != nil {
			if errors.Is(err, repositories.ErrPaymentNotFound) {
				return nil
			}
			return err
		}
	}

	if payment.Status == models.PaymentStatusFailed {
		return nil
	}
	payment.Status = models.PaymentStatusFailed
	if intent.LastPaymentError != nil && intent.LastPaymentError.Msg != "" {
		payment.Notes = intent.LastPaymentError.Msg
	}
	if err := s.paymentRepo.Update(ctx, payment); err != nil {
		return fmt.Errorf("failed to update payment: %w", err)
	}
	return nil
}

// loadPaymentAndOrderFromSession resolves the Payment and Order rows for a
// Stripe checkout session. It prefers metadata.order_id for correlation,
// falls back to ClientReferenceID (the order number), and finally to the
// session id stored as transaction_id when the session was created.
func (s *paymentService) loadPaymentAndOrderFromSession(
	ctx context.Context,
	sess *stripego.CheckoutSession,
) (*models.Payment, *models.Order, error) {
	var order *models.Order
	var payment *models.Payment

	// Strategy 1: order_id in metadata.
	if id := parseOrderIDFromMetadata(sess.Metadata); id != 0 {
		o, err := s.orderRepo.GetByID(ctx, id)
		if err == nil {
			order = o
		} else if !errors.Is(err, repositories.ErrOrderNotFound) {
			return nil, nil, fmt.Errorf("failed to load order: %w", err)
		}
	}

	// Strategy 2: order_number in ClientReferenceID.
	if order == nil && sess.ClientReferenceID != "" {
		o, err := s.orderRepo.GetByOrderNumber(ctx, sess.ClientReferenceID)
		if err == nil {
			order = o
		} else if !errors.Is(err, repositories.ErrOrderNotFound) {
			return nil, nil, fmt.Errorf("failed to load order by number: %w", err)
		}
	}

	// Strategy 3: look up payment by the session id we stored when the
	// checkout session was created.
	if order == nil {
		p, err := s.paymentRepo.GetByTransactionID(ctx, sess.ID)
		if err != nil {
			if errors.Is(err, repositories.ErrPaymentNotFound) {
				return nil, nil, fmt.Errorf("%w: cannot find order/payment for session %s", ErrInvalidWebhookPayload, sess.ID)
			}
			return nil, nil, fmt.Errorf("failed to load payment: %w", err)
		}
		payment = p
		o, err := s.orderRepo.GetByID(ctx, p.OrderID)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to load order for payment: %w", err)
		}
		order = o
	}

	if payment == nil {
		p, err := s.paymentRepo.GetByOrderID(ctx, order.ID)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to load payment for order: %w", err)
		}
		payment = p
	}

	return payment, order, nil
}

// GetPaymentByOrder returns the payment record for the given order.
func (s *paymentService) GetPaymentByOrder(ctx context.Context, orderID uint) (*models.Payment, error) {
	if orderID == 0 {
		return nil, fmt.Errorf("order id is required")
	}
	return s.paymentRepo.GetByOrderID(ctx, orderID)
}

// UploadTransferProof records a customer-uploaded transfer proof for an
// order paying by transfer (Requirements 10.1-10.8). The method validates
// the file size and format, persists the bytes via the configured
// FileStorage, and then updates the Payment and Order rows inside a single
// transaction so a partial failure rolls back both writes.
//
// Accepted formats: JPEG, PNG, PDF. Maximum size: 10 MB. Successful
// uploads transition the order to "pending_transfer" and set the
// ConfirmationDeadline 7 days from order creation (Requirement 10.7).
func (s *paymentService) UploadTransferProof(
	ctx context.Context,
	orderID uint,
	file multipart.File,
	header *multipart.FileHeader,
) error {
	if orderID == 0 {
		return fmt.Errorf("order id is required")
	}
	if file == nil || header == nil {
		return fmt.Errorf("file and header are required")
	}
	if s.fileStorage == nil {
		return ErrFileStorageNotConfigured
	}

	// Requirement 10.3: reject files larger than 10 MB. We rely on the
	// header's Size for the initial check (it is cheap and lets us fail
	// fast before reading anything) and then enforce the same limit on
	// the actual bytes read via io.LimitReader as a defence against
	// malicious clients reporting a lower size than they send.
	if header.Size > MaxTransferProofSize {
		return fmt.Errorf("%w: %d bytes", ErrTransferProofTooLarge, header.Size)
	}

	// Requirement 10.2: accept only JPEG, PNG, or PDF. We accept the
	// upload if either the declared content type or the filename
	// extension matches the allow-list, and canonicalise the extension
	// we write to disk based on whichever source we trusted.
	ext, err := resolveTransferProofExtension(header)
	if err != nil {
		return err
	}

	// Load the order and validate it is actually awaiting a transfer
	// proof before we touch the filesystem.
	order, err := s.orderRepo.GetByID(ctx, orderID)
	if err != nil {
		return fmt.Errorf("failed to load order: %w", err)
	}
	if order.PaymentMethod != models.PaymentMethodTransfer {
		return fmt.Errorf("%w: method=%s", ErrInvalidPaymentMethodForTransfer, order.PaymentMethod)
	}
	// Requirement 10.4 / 10.6: accept uploads while the order is still
	// pending_payment, and allow re-uploads while it is pending_transfer
	// (for example to replace a blurry proof before admin review).
	if order.Status != models.OrderStatusPendingPayment &&
		order.Status != models.OrderStatusPendingTransfer {
		return fmt.Errorf("%w: status=%s", ErrOrderNotAwaitingTransfer, order.Status)
	}

	// Build a stable, collision-resistant filename. Using the order
	// number plus a unix-nanosecond timestamp avoids file overwrites on
	// re-upload and keeps filenames readable in support tooling.
	filename := fmt.Sprintf("%s-%d.%s", order.OrderNumber, time.Now().UTC().UnixNano(), ext)

	// Guard against clients lying about the size: io.LimitReader stops
	// at MaxTransferProofSize+1 so we can detect oversize payloads even
	// when header.Size is understated.
	limited := io.LimitReader(file, MaxTransferProofSize+1)
	countingReader := &byteCounter{r: limited}

	storageKey, err := s.fileStorage.Save(ctx, "transfer-proofs", filename, countingReader)
	if err != nil {
		return fmt.Errorf("failed to save transfer proof: %w", err)
	}
	if countingReader.n > MaxTransferProofSize {
		// Best-effort: we have already written the file, but we cannot
		// accept it. Report the failure clearly; cleanup is handled by
		// whichever storage backend the installer chose (local storage
		// writes are cheap and can be swept by an operator).
		return fmt.Errorf("%w: %d bytes", ErrTransferProofTooLarge, countingReader.n)
	}

	proofURL := s.fileStorage.URL(storageKey)

	// Upsert the payment and transition the order inside one transaction.
	return s.runInTransaction(ctx, func(txCtx context.Context) error {
		payment, err := s.paymentRepo.GetByOrderID(txCtx, order.ID)
		switch {
		case err == nil:
			payment.Method = models.PaymentMethodTransfer
			payment.Status = models.PaymentStatusPending
			payment.Amount = order.TotalAmount
			payment.TransferProofURL = proofURL
			if err := s.paymentRepo.Update(txCtx, payment); err != nil {
				return fmt.Errorf("failed to update payment: %w", err)
			}
		case errors.Is(err, repositories.ErrPaymentNotFound):
			newPayment := &models.Payment{
				OrderID:          order.ID,
				Method:           models.PaymentMethodTransfer,
				Status:           models.PaymentStatusPending,
				Amount:           order.TotalAmount,
				Currency:         strings.ToUpper(s.cfg.Currency),
				TransferProofURL: proofURL,
			}
			if err := s.paymentRepo.Create(txCtx, newPayment); err != nil {
				return fmt.Errorf("failed to create payment: %w", err)
			}
		default:
			return fmt.Errorf("failed to load payment: %w", err)
		}

		// Requirement 10.7: set the confirmation deadline relative to
		// order creation so repeated uploads don't keep moving the
		// deadline forward.
		deadline := order.CreatedAt.Add(TransferConfirmationDeadline)
		if err := s.updateOrderForTransferUpload(txCtx, order, deadline); err != nil {
			return err
		}
		return nil
	})
}

// updateOrderForTransferUpload writes the post-upload state onto the order:
// Status = pending_transfer and ConfirmationDeadline = 7 days after
// creation. We use a dedicated Updates call with a map so the zero-value
// skipping behaviour of GORM's struct-based Updates does not drop the
// deadline when the field is already set to nil in memory.
func (s *paymentService) updateOrderForTransferUpload(
	ctx context.Context,
	order *models.Order,
	deadline time.Time,
) error {
	if err := s.orderRepo.UpdateStatus(ctx, order.ID, models.OrderStatusPendingTransfer); err != nil {
		return fmt.Errorf("failed to update order status: %w", err)
	}
	// Attach deadline via Update so we capture ConfirmationDeadline as a
	// non-zero pointer. orderRepo.Update relies on gorm's Updates which
	// skips zero values; ConfirmationDeadline is a *time.Time so a real
	// pointer is non-zero from gorm's perspective.
	order.Status = models.OrderStatusPendingTransfer
	order.ConfirmationDeadline = &deadline
	if err := s.orderRepo.Update(ctx, order); err != nil {
		return fmt.Errorf("failed to update order deadline: %w", err)
	}
	return nil
}

// ConfirmTransferPayment marks a pending transfer payment as succeeded and
// transitions the owning order to "paid" (Requirements 12.4 / 12.7 / 12.9).
// The method records the confirming administrator, the actual amount
// received, and any free-form notes so downstream reporting has the full
// audit trail.
func (s *paymentService) ConfirmTransferPayment(ctx context.Context, req *TransferConfirmRequest) error {
	if req == nil {
		return fmt.Errorf("confirm request is required")
	}
	if req.PaymentID == 0 {
		return fmt.Errorf("payment id is required")
	}
	if req.AdminID == 0 {
		return fmt.Errorf("admin id is required")
	}

	var confirmedOrderID uint
	if err := s.runInTransaction(ctx, func(txCtx context.Context) error {
		payment, err := s.paymentRepo.GetByID(txCtx, req.PaymentID)
		if err != nil {
			return fmt.Errorf("failed to load payment: %w", err)
		}
		if payment.Method != models.PaymentMethodTransfer {
			return fmt.Errorf("%w: method=%s", ErrInvalidPaymentMethodForTransfer, payment.Method)
		}
		if payment.Status != models.PaymentStatusPending &&
			payment.Status != models.PaymentStatusProcessing {
			return fmt.Errorf("%w: status=%s", ErrTransferNotReviewable, payment.Status)
		}

		now := time.Now().UTC()
		adminID := req.AdminID

		payment.Status = models.PaymentStatusSucceeded
		payment.ReceivedAmount = req.ReceivedAmount
		payment.ConfirmedBy = &adminID
		payment.ConfirmedAt = &now
		if req.Notes != "" {
			payment.Notes = req.Notes
		}
		if err := s.paymentRepo.Update(txCtx, payment); err != nil {
			return fmt.Errorf("failed to update payment: %w", err)
		}

		if err := s.orderRepo.UpdateStatus(txCtx, payment.OrderID, models.OrderStatusPaid); err != nil {
			return fmt.Errorf("failed to update order status: %w", err)
		}
		confirmedOrderID = payment.OrderID
		return nil
	}); err != nil {
		return err
	}

	// Requirements 12.10 / 21.2: send a confirmation email within 1
	// minute of admin confirmation. Best-effort and asynchronous so
	// the admin request returns immediately.
	s.dispatchNotification("payment_confirmation", confirmedOrderID, func(ctx context.Context, o *models.Order) error {
		return s.notifications.SendPaymentConfirmation(ctx, o)
	})
	return nil
}

// RejectTransferPayment marks a pending transfer payment as failed and
// transitions the owning order to "payment_failed" so the customer can be
// notified and optionally retry (Requirement 12.8).
func (s *paymentService) RejectTransferPayment(ctx context.Context, req *TransferRejectRequest) error {
	if req == nil {
		return fmt.Errorf("reject request is required")
	}
	if req.PaymentID == 0 {
		return fmt.Errorf("payment id is required")
	}
	if req.AdminID == 0 {
		return fmt.Errorf("admin id is required")
	}

	var rejectedOrderID uint
	if err := s.runInTransaction(ctx, func(txCtx context.Context) error {
		payment, err := s.paymentRepo.GetByID(txCtx, req.PaymentID)
		if err != nil {
			return fmt.Errorf("failed to load payment: %w", err)
		}
		if payment.Method != models.PaymentMethodTransfer {
			return fmt.Errorf("%w: method=%s", ErrInvalidPaymentMethodForTransfer, payment.Method)
		}
		if payment.Status != models.PaymentStatusPending &&
			payment.Status != models.PaymentStatusProcessing {
			return fmt.Errorf("%w: status=%s", ErrTransferNotReviewable, payment.Status)
		}

		now := time.Now().UTC()
		adminID := req.AdminID

		payment.Status = models.PaymentStatusFailed
		payment.ConfirmedBy = &adminID
		payment.ConfirmedAt = &now
		if req.Reason != "" {
			payment.Notes = req.Reason
		}
		if err := s.paymentRepo.Update(txCtx, payment); err != nil {
			return fmt.Errorf("failed to update payment: %w", err)
		}

		if err := s.orderRepo.UpdateStatus(txCtx, payment.OrderID, models.OrderStatusPaymentFailed); err != nil {
			return fmt.Errorf("failed to update order status: %w", err)
		}
		rejectedOrderID = payment.OrderID
		return nil
	}); err != nil {
		return err
	}

	// Requirements 12.8 / 21.4: send a rejection email with the
	// admin-provided reason so the customer knows how to proceed.
	reason := req.Reason
	s.dispatchNotification("payment_rejection", rejectedOrderID, func(ctx context.Context, o *models.Order) error {
		return s.notifications.SendPaymentRejection(ctx, o, reason)
	})
	return nil
}

// BatchConfirmTransfer confirms multiple transfer payments in a single
// administrative action (Requirements 13.1-13.7). The entire batch is
// applied inside one transaction so either every order transitions to
// "paid" or none do: requirement 13.4 calls for all entered amounts to be
// validated before any order is updated, and requirement 13.5 transitions
// every selected order only when those validations pass.
//
// Per-item admin id falls back to the batch-level AdminID so callers can
// either carry one admin id at the batch root (common case) or override
// per item. Requirement 13.7 requires the admin id and timestamp to be
// recorded with each confirmed payment; the shared `now` timestamp keeps
// the batch coherent.
func (s *paymentService) BatchConfirmTransfer(ctx context.Context, req *BatchTransferConfirmRequest) error {
	if req == nil {
		return fmt.Errorf("batch request is required")
	}
	// Requirement 13.4 (part 1): a batch must contain at least one item.
	if len(req.Items) == 0 {
		return fmt.Errorf("batch must contain at least one item")
	}

	// Pre-validate every item up front so a malformed entry never
	// partially applies. We also derive the effective admin id per item
	// here (item-level override, else batch-level) so the transaction
	// body below sees a fully-resolved request.
	items := make([]TransferConfirmRequest, len(req.Items))
	for i, item := range req.Items {
		if item.PaymentID == 0 {
			return fmt.Errorf("item %d: payment id is required", i)
		}
		if item.AdminID == 0 {
			item.AdminID = req.AdminID
		}
		if item.AdminID == 0 {
			return fmt.Errorf("item %d: admin id is required", i)
		}
		// Requirements 13.3 / 13.4: the administrator enters the
		// actual received amount for each selected order. Reject
		// zero or negative amounts before touching the database.
		if !item.ReceivedAmount.IsPositive() {
			return fmt.Errorf("item %d: received amount must be positive", i)
		}
		items[i] = item
	}

	// Requirements 13.5 / 13.7: apply all confirmations inside a single
	// transaction so either every order updates to "paid" or none do,
	// and the admin id + timestamp land atomically with the payment
	// update.
	confirmedOrderIDs := make([]uint, 0, len(items))
	if err := s.runInTransaction(ctx, func(txCtx context.Context) error {
		// Reset on retry: if the transaction manager re-runs fn (most
		// managers don't, but some do on deadlock), we must not double
		// count the order ids.
		confirmedOrderIDs = confirmedOrderIDs[:0]
		now := time.Now().UTC()
		for i, item := range items {
			payment, err := s.paymentRepo.GetByID(txCtx, item.PaymentID)
			if err != nil {
				return fmt.Errorf("item %d: failed to load payment: %w", i, err)
			}
			if payment.Method != models.PaymentMethodTransfer {
				return fmt.Errorf("item %d: %w: method=%s",
					i, ErrInvalidPaymentMethodForTransfer, payment.Method)
			}
			if payment.Status != models.PaymentStatusPending &&
				payment.Status != models.PaymentStatusProcessing {
				return fmt.Errorf("item %d: %w: status=%s",
					i, ErrTransferNotReviewable, payment.Status)
			}

			adminID := item.AdminID
			payment.Status = models.PaymentStatusSucceeded
			payment.ReceivedAmount = item.ReceivedAmount
			payment.ConfirmedBy = &adminID
			payment.ConfirmedAt = &now
			if item.Notes != "" {
				payment.Notes = item.Notes
			}
			if err := s.paymentRepo.Update(txCtx, payment); err != nil {
				return fmt.Errorf("item %d: failed to update payment: %w", i, err)
			}

			if err := s.orderRepo.UpdateStatus(txCtx, payment.OrderID, models.OrderStatusPaid); err != nil {
				return fmt.Errorf("item %d: failed to update order status: %w", i, err)
			}
			confirmedOrderIDs = append(confirmedOrderIDs, payment.OrderID)
		}
		return nil
	}); err != nil {
		return err
	}

	// Requirement 13.6: after the batch commits, send a confirmation
	// email to the customer of every confirmed order. Dispatch is
	// async and best-effort so a stuck SMTP server never fails an
	// already-committed batch.
	for _, orderID := range confirmedOrderIDs {
		s.dispatchNotification("payment_confirmation", orderID, func(ctx context.Context, o *models.Order) error {
			return s.notifications.SendPaymentConfirmation(ctx, o)
		})
	}
	return nil
}

// runInTransaction mirrors the helper in orderService: when a TxManager is
// injected we use it, otherwise fn runs against the caller's context.
func (s *paymentService) runInTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	if s.txManager == nil {
		return fn(ctx)
	}
	return s.txManager.RunInTransaction(ctx, fn)
}

// dispatchNotification fires a payment-related email in a detached
// goroutine. The design mirrors orderService.dispatchNotification: email
// delivery must never block the webhook or admin request that triggers
// it, and must never cause the business operation to fail. A nil
// NotificationService makes this a no-op so tests without email wiring
// stay concise.
func (s *paymentService) dispatchNotification(
	kind string,
	orderID uint,
	emit func(ctx context.Context, order *models.Order) error,
) {
	if s.notifications == nil || orderID == 0 || emit == nil {
		return
	}
	go func() {
		defer func() {
			// Swallow panics so a template bug cannot crash the
			// process; the underlying failure is already logged by
			// the sender.
			_ = recover()
		}()
		ctx := context.Background()
		order, err := s.orderRepo.GetByID(ctx, orderID)
		if err != nil {
			s.logWarn("notification order lookup failed",
				"kind", kind,
				"order_id", orderID,
				"err", err,
			)
			return
		}
		if err := emit(ctx, order); err != nil {
			// The NotificationService logs send failures with its
			// own logger; nothing further to do here.
			_ = err
		}
	}()
}

// logInfo / logWarn are small guards around the optional logger so tests
// can inject a nil logger without crashing. Production code always wires
// in a real logger.
func (s *paymentService) logInfo(msg string, kv ...interface{}) {
	if s.log == nil {
		return
	}
	s.log.Infow(msg, kv...)
}

func (s *paymentService) logWarn(msg string, kv ...interface{}) {
	if s.log == nil {
		return
	}
	s.log.Warnw(msg, kv...)
}

// parseCheckoutSession unmarshals a Stripe checkout.session event payload
// into a typed CheckoutSession. The raw data lives in event.Data.Raw which
// is the JSON body of the event.
func parseCheckoutSession(event *stripego.Event) (*stripego.CheckoutSession, error) {
	if event == nil || event.Data == nil {
		return nil, fmt.Errorf("%w: event data missing", ErrInvalidWebhookPayload)
	}
	var sess stripego.CheckoutSession
	if err := json.Unmarshal(event.Data.Raw, &sess); err != nil {
		return nil, fmt.Errorf("%w: cannot parse checkout session: %v", ErrInvalidWebhookPayload, err)
	}
	return &sess, nil
}

// parseOrderIDFromMetadata extracts the integer order id that
// CreatePaymentSession wrote into the Stripe metadata map. Missing or
// invalid values return 0 so the caller can fall back to other strategies.
func parseOrderIDFromMetadata(md map[string]string) uint {
	if md == nil {
		return 0
	}
	raw, ok := md["order_id"]
	if !ok || raw == "" {
		return 0
	}
	id, err := strconv.ParseUint(strings.TrimSpace(raw), 10, 64)
	if err != nil {
		return 0
	}
	return uint(id)
}

// toMinorUnits converts a decimal amount to Stripe's smallest currency unit
// (cents for USD). We use a multiplier of 100 for the currencies we
// currently support; a richer implementation would look up the currency's
// exponent from Stripe's currency table.
func toMinorUnits(amount decimal.Decimal) int64 {
	return amount.Mul(decimal.NewFromInt(100)).Round(0).IntPart()
}

// fromMinorUnits is the inverse of toMinorUnits. The session's AmountTotal
// is already rounded; we divide by 100 to return to the decimal form we
// store in the database.
func fromMinorUnits(minor int64) decimal.Decimal {
	return decimal.NewFromInt(minor).Div(decimal.NewFromInt(100))
}

// resolveCustomerEmail returns the best email to prefill on the checkout
// session. Authenticated users' emails live on the User relation; guest
// orders capture GuestEmail directly on the order.
func resolveCustomerEmail(order *models.Order) string {
	if order == nil {
		return ""
	}
	if strings.TrimSpace(order.GuestEmail) != "" {
		return order.GuestEmail
	}
	if order.User != nil && strings.TrimSpace(order.User.Email) != "" {
		return order.User.Email
	}
	return ""
}

// appendQueryParam appends ?key=value (or &key=value) to the given URL.
// This is lightweight by design and does not attempt to normalise the URL
// or URL-encode characters beyond those produced by strconv, which is
// acceptable for the short alphanumeric order numbers we emit.
func appendQueryParam(base, key, value string) string {
	if base == "" {
		return base
	}
	sep := "?"
	if strings.Contains(base, "?") {
		sep = "&"
	}
	return base + sep + key + "=" + value
}

// resolveTransferProofExtension validates an uploaded transfer proof
// against the accepted set of content types and filename extensions
// (Requirement 10.2) and returns the canonical extension to use when
// persisting the file.
//
// The function accepts the upload when either the declared Content-Type
// is in the allow-list, the filename extension is in the allow-list, or
// the sniffed content (via http.DetectContentType on the first 512 bytes
// of the file header) matches. Because multipart.FileHeader does not
// expose the raw bytes without opening the file, we rely on the first
// two signals here; stronger sniffing can be layered on later without
// changing the public API.
func resolveTransferProofExtension(header *multipart.FileHeader) (string, error) {
	if header == nil {
		return "", fmt.Errorf("%w: missing header", ErrTransferProofFormat)
	}

	declared := ""
	if header.Header != nil {
		declared = strings.ToLower(strings.TrimSpace(header.Header.Get("Content-Type")))
	}
	if ext, ok := allowedTransferProofContentTypes[declared]; ok {
		return ext, nil
	}

	filename := strings.ToLower(filepath.Ext(header.Filename))
	if ext, ok := allowedTransferProofExtensions[filename]; ok {
		return ext, nil
	}

	// Fallback: try to infer from just the extension part of any mime
	// string that slips through (e.g. "image/jpeg; charset=binary").
	if idx := strings.IndexByte(declared, ';'); idx >= 0 {
		head := strings.TrimSpace(declared[:idx])
		if ext, ok := allowedTransferProofContentTypes[head]; ok {
			return ext, nil
		}
	}

	return "", fmt.Errorf("%w: content_type=%q filename=%q",
		ErrTransferProofFormat, declared, header.Filename)
}

// byteCounter wraps an io.Reader and counts the total number of bytes read
// through it. It is used in UploadTransferProof to detect clients that
// understate the file size in the multipart header.
type byteCounter struct {
	r io.Reader
	n int64
}

// Read satisfies io.Reader.
func (c *byteCounter) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.n += int64(n)
	return n, err
}
