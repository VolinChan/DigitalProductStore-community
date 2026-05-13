package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/textproto"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	stripego "github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/webhook"

	"github.com/digital-store/backend/internal/models"
	"github.com/digital-store/backend/internal/repositories"
)

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// MockPaymentRepository implements repositories.PaymentRepository for unit
// tests. It mirrors the style used by the other service tests in this
// package (see order_service_test.go, cart_service_test.go).
type MockPaymentRepository struct {
	mock.Mock
}

func (m *MockPaymentRepository) Create(ctx context.Context, payment *models.Payment) error {
	args := m.Called(ctx, payment)
	// Simulate DB assigning an id if not set so callers can continue to
	// reference the inserted row.
	if payment.ID == 0 {
		payment.ID = 1
	}
	return args.Error(0)
}

func (m *MockPaymentRepository) GetByID(ctx context.Context, id uint) (*models.Payment, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Payment), args.Error(1)
}

func (m *MockPaymentRepository) GetByOrderID(ctx context.Context, orderID uint) (*models.Payment, error) {
	args := m.Called(ctx, orderID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Payment), args.Error(1)
}

func (m *MockPaymentRepository) GetByTransactionID(ctx context.Context, txID string) (*models.Payment, error) {
	args := m.Called(ctx, txID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Payment), args.Error(1)
}

func (m *MockPaymentRepository) Update(ctx context.Context, payment *models.Payment) error {
	args := m.Called(ctx, payment)
	return args.Error(0)
}

func (m *MockPaymentRepository) UpdateStatus(ctx context.Context, id uint, status models.PaymentStatus) error {
	args := m.Called(ctx, id, status)
	return args.Error(0)
}

func (m *MockPaymentRepository) ListPendingTransfers(ctx context.Context, params *repositories.ListPaymentParams) ([]*models.Payment, int64, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Get(1).(int64), args.Error(2)
	}
	return args.Get(0).([]*models.Payment), args.Get(1).(int64), args.Error(2)
}

// fakeFileStorage is a minimal in-memory FileStorage used to verify
// UploadTransferProof without touching the real filesystem. It captures
// the saved content so tests can assert on size handling.
type fakeFileStorage struct {
	saveCalls int
	lastKey   string
	lastBytes []byte
	// forceErr, when non-nil, is returned from Save to simulate a
	// storage failure.
	forceErr error
}

func (f *fakeFileStorage) Save(ctx context.Context, subdir, filename string, r io.Reader) (string, error) {
	f.saveCalls++
	if f.forceErr != nil {
		return "", f.forceErr
	}
	b, err := io.ReadAll(r)
	if err != nil {
		return "", err
	}
	f.lastBytes = b
	key := subdir + "/" + filename
	f.lastKey = key
	return key, nil
}

func (f *fakeFileStorage) URL(key string) string {
	if key == "" {
		return ""
	}
	return "/uploads/" + key
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// newPaymentService builds a paymentService with freshly minted mocks and
// a passthrough transaction manager (defined in order_service_test.go).
// The returned mocks allow tests to configure repository expectations.
func newPaymentService(t *testing.T, cfg StripeConfig, fs FileStorage) (
	PaymentService,
	*MockPaymentRepository,
	*MockOrderRepository,
) {
	t.Helper()
	paymentRepo := new(MockPaymentRepository)
	orderRepo := new(MockOrderRepository)
	svc := NewPaymentService(paymentRepo, orderRepo, passthroughTxManager{}, fs, cfg, nil, nil)
	return svc, paymentRepo, orderRepo
}

// newOnlineOrder builds an Order ready for an online payment session.
func newOnlineOrder(id uint, total float64) *models.Order {
	return &models.Order{
		BaseWithUpdate: models.BaseWithUpdate{
			ID:        id,
			CreatedAt: time.Now().UTC(),
		},
		OrderNumber:     fmt.Sprintf("ORD-%d", id),
		Status:          models.OrderStatusPendingPayment,
		PaymentMethod:   models.PaymentMethodOnline,
		TotalAmount:     decimal.NewFromFloat(total),
		GuestEmail:      "guest@example.com",
		ShippingAddress: "123 Main St",
	}
}

// newTransferOrder builds an Order ready for a transfer payment upload.
// createdAt is used to derive the Confirmation_Deadline in upload tests.
func newTransferOrder(id uint, total float64, createdAt time.Time) *models.Order {
	return &models.Order{
		BaseWithUpdate: models.BaseWithUpdate{
			ID:        id,
			CreatedAt: createdAt,
		},
		OrderNumber:     fmt.Sprintf("ORD-T-%d", id),
		Status:          models.OrderStatusPendingPayment,
		PaymentMethod:   models.PaymentMethodTransfer,
		TotalAmount:     decimal.NewFromFloat(total),
		GuestEmail:      "guest@example.com",
		ShippingAddress: "123 Main St",
	}
}

// makeFileHeader returns a multipart FileHeader with the given size and
// content type, opening a reader over payload when the handler opens the
// file. Because multipart.FileHeader.Open reads from the wrapped buffer,
// we construct a real multipart form for realism.
func makeFileHeader(t *testing.T, filename, contentType string, payload []byte) (multipart.File, *multipart.FileHeader) {
	t.Helper()
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)

	// Write a part with the configured Content-Type so the handler's
	// header inspection sees it. We use CreatePart directly so we can
	// control the Content-Type header (CreateFormFile hard-codes
	// application/octet-stream).
	hdr := make(textproto.MIMEHeader)
	hdr.Set("Content-Disposition", fmt.Sprintf(`form-data; name="proof"; filename="%s"`, filename))
	if contentType != "" {
		hdr.Set("Content-Type", contentType)
	}
	part, err := w.CreatePart(hdr)
	require.NoError(t, err)
	_, err = part.Write(payload)
	require.NoError(t, err)
	require.NoError(t, w.Close())

	reader := multipart.NewReader(body, w.Boundary())
	form, err := reader.ReadForm(int64(len(payload)) + 4096)
	require.NoError(t, err)

	files := form.File["proof"]
	require.Len(t, files, 1)
	header := files[0]
	file, err := header.Open()
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = file.Close()
		_ = form.RemoveAll()
	})
	return file, header
}

// signWebhook produces a Stripe-compatible signed webhook payload for the
// given event using GenerateTestSignedPayload. It returns the exact bytes
// and signature header that ConfirmPayment expects.
//
// The stripe-go library rejects events whose APIVersion does not match
// the SDK's expected version, so we default any unset APIVersion to the
// SDK-expected value before signing.
func signWebhook(t *testing.T, secret string, event *stripego.Event) ([]byte, string) {
	t.Helper()
	if event.APIVersion == "" {
		event.APIVersion = stripeSDKAPIVersion
	}
	payload, err := json.Marshal(event)
	require.NoError(t, err)
	signed := webhook.GenerateTestSignedPayload(&webhook.UnsignedPayload{
		Payload:   payload,
		Secret:    secret,
		Timestamp: time.Now(),
	})
	return signed.Payload, signed.Header
}

// stripeSDKAPIVersion mirrors the api_version constant baked into the
// stripe-go v76 release we depend on. webhook.ConstructEvent rejects
// events whose api_version does not equal this value.
const stripeSDKAPIVersion = "2023-10-16"

// wrapSession produces a raw message body for an event with the given
// checkout session shape so parseCheckoutSession succeeds.
func wrapSession(t *testing.T, session stripego.CheckoutSession) json.RawMessage {
	t.Helper()
	data, err := json.Marshal(session)
	require.NoError(t, err)
	return data
}

// stripeTestConfig returns a StripeConfig suitable for tests. The keys
// are not real; they merely need to be non-empty so the service's config
// checks pass. Only CreatePaymentSession hits stripe-go's SDK; webhook
// tests exercise webhook.ConstructEvent directly.
func stripeTestConfig() StripeConfig {
	return StripeConfig{
		SecretKey:     "sk_test_dummy",
		WebhookSecret: "whsec_test_dummy",
		SuccessURL:    "https://example.com/success",
		CancelURL:     "https://example.com/cancel",
		Currency:      "USD",
	}
}

// ---------------------------------------------------------------------------
// CreatePaymentSession - validation
// ---------------------------------------------------------------------------

// TestPaymentService_CreatePaymentSession_RejectsZeroOrderID verifies the
// service validates the order id before doing anything else.
func TestPaymentService_CreatePaymentSession_RejectsZeroOrderID(t *testing.T) {
	svc, _, _ := newPaymentService(t, stripeTestConfig(), nil)

	_, err := svc.CreatePaymentSession(context.Background(), 0)
	assert.Error(t, err)
}

// TestPaymentService_CreatePaymentSession_MissingSecretKey verifies that
// an empty Stripe secret surfaces ErrPaymentConfigMissing.
func TestPaymentService_CreatePaymentSession_MissingSecretKey(t *testing.T) {
	cfg := stripeTestConfig()
	cfg.SecretKey = ""
	svc, _, _ := newPaymentService(t, cfg, nil)

	_, err := svc.CreatePaymentSession(context.Background(), 1)
	assert.ErrorIs(t, err, ErrPaymentConfigMissing)
}

// TestPaymentService_CreatePaymentSession_MissingSuccessOrCancelURL
// verifies SuccessURL and CancelURL must both be set.
func TestPaymentService_CreatePaymentSession_MissingSuccessOrCancelURL(t *testing.T) {
	cfg := stripeTestConfig()
	cfg.SuccessURL = ""
	svc, _, _ := newPaymentService(t, cfg, nil)

	_, err := svc.CreatePaymentSession(context.Background(), 1)
	assert.ErrorIs(t, err, ErrPaymentConfigMissing)
}

// TestPaymentService_CreatePaymentSession_OrderNotPayable verifies that
// only orders in pending_payment can receive a new checkout session
// (Requirement 9.1).
func TestPaymentService_CreatePaymentSession_OrderNotPayable(t *testing.T) {
	svc, _, orderRepo := newPaymentService(t, stripeTestConfig(), nil)
	ctx := context.Background()

	order := newOnlineOrder(1, 50)
	order.Status = models.OrderStatusPaid
	orderRepo.On("GetByID", ctx, uint(1)).Return(order, nil).Once()

	_, err := svc.CreatePaymentSession(ctx, 1)
	assert.ErrorIs(t, err, ErrOrderNotPayable)
	orderRepo.AssertExpectations(t)
}

// TestPaymentService_CreatePaymentSession_WrongPaymentMethod verifies the
// order's payment_method must be "online" before a session is created.
func TestPaymentService_CreatePaymentSession_WrongPaymentMethod(t *testing.T) {
	svc, _, orderRepo := newPaymentService(t, stripeTestConfig(), nil)
	ctx := context.Background()

	order := newOnlineOrder(2, 50)
	order.PaymentMethod = models.PaymentMethodTransfer
	orderRepo.On("GetByID", ctx, uint(2)).Return(order, nil).Once()

	_, err := svc.CreatePaymentSession(ctx, 2)
	assert.ErrorIs(t, err, ErrInvalidPaymentMethodForOnline)
}

// TestPaymentService_CreatePaymentSession_NonPositiveTotalRejected verifies
// that an order with a zero or negative total fails before any Stripe call
// is attempted. This also confirms the decimal-to-minor-units conversion
// rejects invalid amounts.
func TestPaymentService_CreatePaymentSession_NonPositiveTotalRejected(t *testing.T) {
	svc, _, orderRepo := newPaymentService(t, stripeTestConfig(), nil)
	ctx := context.Background()

	order := newOnlineOrder(3, 0)
	orderRepo.On("GetByID", ctx, uint(3)).Return(order, nil).Once()

	_, err := svc.CreatePaymentSession(ctx, 3)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "positive")
}

// TestPaymentService_CreatePaymentSession_OrderRepoErrorBubblesUp verifies
// that repository errors from the order lookup are surfaced.
func TestPaymentService_CreatePaymentSession_OrderRepoErrorBubblesUp(t *testing.T) {
	svc, _, orderRepo := newPaymentService(t, stripeTestConfig(), nil)
	ctx := context.Background()

	boom := errors.New("db gone")
	orderRepo.On("GetByID", ctx, uint(4)).Return(nil, boom).Once()

	_, err := svc.CreatePaymentSession(ctx, 4)
	assert.ErrorContains(t, err, "db gone")
}

// ---------------------------------------------------------------------------
// ConfirmPayment - webhook handling
// ---------------------------------------------------------------------------

// TestPaymentService_ConfirmPayment_RejectsEmptyPayload verifies that an
// empty payload is rejected with ErrInvalidWebhookPayload without touching
// any repository.
func TestPaymentService_ConfirmPayment_RejectsEmptyPayload(t *testing.T) {
	svc, paymentRepo, orderRepo := newPaymentService(t, stripeTestConfig(), nil)

	err := svc.ConfirmPayment(context.Background(), &PaymentConfirmRequest{Payload: nil, Signature: "sig"})
	assert.ErrorIs(t, err, ErrInvalidWebhookPayload)

	paymentRepo.AssertNotCalled(t, "GetByOrderID", mock.Anything, mock.Anything)
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// TestPaymentService_ConfirmPayment_MissingWebhookSecret verifies that
// ConfirmPayment refuses to run if the webhook secret is not configured
// (Requirement 9.5: HMAC-SHA256 signature verification).
func TestPaymentService_ConfirmPayment_MissingWebhookSecret(t *testing.T) {
	cfg := stripeTestConfig()
	cfg.WebhookSecret = ""
	svc, _, _ := newPaymentService(t, cfg, nil)

	err := svc.ConfirmPayment(context.Background(), &PaymentConfirmRequest{
		Payload:   []byte(`{"type":"checkout.session.completed"}`),
		Signature: "sig",
	})
	assert.ErrorIs(t, err, ErrPaymentConfigMissing)
}

// TestPaymentService_ConfirmPayment_InvalidSignatureRejected verifies that
// a payload signed with the wrong secret fails HMAC-SHA256 verification
// (Requirement 9.5). No repository calls should happen.
func TestPaymentService_ConfirmPayment_InvalidSignatureRejected(t *testing.T) {
	cfg := stripeTestConfig()
	svc, paymentRepo, orderRepo := newPaymentService(t, cfg, nil)

	event := &stripego.Event{Type: "checkout.session.completed"}
	// Sign with a different secret so the verification fails.
	payload, header := signWebhook(t, "whsec_other_secret", event)

	err := svc.ConfirmPayment(context.Background(), &PaymentConfirmRequest{
		Payload:   payload,
		Signature: header,
	})
	assert.ErrorIs(t, err, ErrInvalidWebhookSignature)
	paymentRepo.AssertNotCalled(t, "GetByOrderID", mock.Anything, mock.Anything)
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// TestPaymentService_ConfirmPayment_CheckoutCompleted_MarksPaid verifies
// that a validly-signed checkout.session.completed event with
// payment_status=paid transitions the order to "paid" and records the
// PaymentIntent id on the payment row (Requirements 9.3, 9.7).
func TestPaymentService_ConfirmPayment_CheckoutCompleted_MarksPaid(t *testing.T) {
	cfg := stripeTestConfig()
	svc, paymentRepo, orderRepo := newPaymentService(t, cfg, nil)
	ctx := context.Background()

	order := newOnlineOrder(10, 25.00)
	payment := &models.Payment{
		BaseWithUpdate: models.BaseWithUpdate{ID: 99},
		OrderID:        order.ID,
		Method:         models.PaymentMethodOnline,
		Status:         models.PaymentStatusProcessing,
		Amount:         order.TotalAmount,
		Currency:       "USD",
		TransactionID:  "cs_test_123",
	}

	session := stripego.CheckoutSession{
		ID:                "cs_test_123",
		PaymentStatus:     stripego.CheckoutSessionPaymentStatusPaid,
		ClientReferenceID: order.OrderNumber,
		Metadata:          map[string]string{"order_id": "10"},
		AmountTotal:       2500,
		PaymentIntent:     &stripego.PaymentIntent{ID: "pi_test_abc"},
	}
	event := &stripego.Event{
		ID:   "evt_1",
		Type: "checkout.session.completed",
		Data: &stripego.EventData{Raw: wrapSession(t, session)},
	}
	payload, header := signWebhook(t, cfg.WebhookSecret, event)

	orderRepo.On("GetByID", ctx, uint(10)).Return(order, nil).Once()
	paymentRepo.On("GetByOrderID", ctx, uint(10)).Return(payment, nil).Once()

	paymentRepo.On("Update", ctx, mock.MatchedBy(func(p *models.Payment) bool {
		return p.Status == models.PaymentStatusSucceeded &&
			p.TransactionID == "pi_test_abc" &&
			p.ConfirmedAt != nil &&
			p.ReceivedAmount.Equal(decimal.NewFromFloat(25.00))
	})).Return(nil).Once()
	orderRepo.On("UpdateStatus", ctx, uint(10), models.OrderStatusPaid).Return(nil).Once()

	err := svc.ConfirmPayment(ctx, &PaymentConfirmRequest{Payload: payload, Signature: header})
	require.NoError(t, err)
	paymentRepo.AssertExpectations(t)
	orderRepo.AssertExpectations(t)
}

// TestPaymentService_ConfirmPayment_CheckoutCompleted_IdempotentOnRepeat
// verifies that receiving the same "succeeded" webhook twice does not
// re-update the order or payment: Stripe retries on its own and we must
// tolerate the duplicate delivery.
func TestPaymentService_ConfirmPayment_CheckoutCompleted_IdempotentOnRepeat(t *testing.T) {
	cfg := stripeTestConfig()
	svc, paymentRepo, orderRepo := newPaymentService(t, cfg, nil)
	ctx := context.Background()

	order := newOnlineOrder(11, 10.00)
	payment := &models.Payment{
		BaseWithUpdate: models.BaseWithUpdate{ID: 2},
		OrderID:        order.ID,
		Method:         models.PaymentMethodOnline,
		Status:         models.PaymentStatusSucceeded, // already paid
		Amount:         order.TotalAmount,
		TransactionID:  "pi_test_abc",
	}

	session := stripego.CheckoutSession{
		ID:                "cs_test_999",
		PaymentStatus:     stripego.CheckoutSessionPaymentStatusPaid,
		ClientReferenceID: order.OrderNumber,
		Metadata:          map[string]string{"order_id": "11"},
		AmountTotal:       1000,
	}
	event := &stripego.Event{
		ID:   "evt_dup",
		Type: "checkout.session.completed",
		Data: &stripego.EventData{Raw: wrapSession(t, session)},
	}
	payload, header := signWebhook(t, cfg.WebhookSecret, event)

	orderRepo.On("GetByID", ctx, uint(11)).Return(order, nil).Once()
	paymentRepo.On("GetByOrderID", ctx, uint(11)).Return(payment, nil).Once()

	err := svc.ConfirmPayment(ctx, &PaymentConfirmRequest{Payload: payload, Signature: header})
	require.NoError(t, err)
	// No Update / UpdateStatus calls should have happened.
	paymentRepo.AssertNotCalled(t, "Update", mock.Anything, mock.Anything)
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// TestPaymentService_ConfirmPayment_AsyncPaymentFailed_MarksPaymentFailed
// verifies that a checkout.session.async_payment_failed event marks the
// payment as failed while leaving the order as pending_payment so the
// customer can retry (Requirement 9.4).
func TestPaymentService_ConfirmPayment_AsyncPaymentFailed_MarksPaymentFailed(t *testing.T) {
	cfg := stripeTestConfig()
	svc, paymentRepo, orderRepo := newPaymentService(t, cfg, nil)
	ctx := context.Background()

	order := newOnlineOrder(12, 40)
	payment := &models.Payment{
		BaseWithUpdate: models.BaseWithUpdate{ID: 3},
		OrderID:        order.ID,
		Method:         models.PaymentMethodOnline,
		Status:         models.PaymentStatusProcessing,
	}
	session := stripego.CheckoutSession{
		ID:                "cs_fail_1",
		PaymentStatus:     stripego.CheckoutSessionPaymentStatusUnpaid,
		ClientReferenceID: order.OrderNumber,
		Metadata:          map[string]string{"order_id": "12"},
	}
	event := &stripego.Event{
		ID:   "evt_fail",
		Type: "checkout.session.async_payment_failed",
		Data: &stripego.EventData{Raw: wrapSession(t, session)},
	}
	payload, header := signWebhook(t, cfg.WebhookSecret, event)

	orderRepo.On("GetByID", ctx, uint(12)).Return(order, nil).Once()
	paymentRepo.On("GetByOrderID", ctx, uint(12)).Return(payment, nil).Once()
	paymentRepo.On("Update", ctx, mock.MatchedBy(func(p *models.Payment) bool {
		return p.Status == models.PaymentStatusFailed
	})).Return(nil).Once()

	err := svc.ConfirmPayment(ctx, &PaymentConfirmRequest{Payload: payload, Signature: header})
	require.NoError(t, err)
	// Requirement 9.4: order status stays at pending_payment.
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// TestPaymentService_ConfirmPayment_UnpaidCheckoutIgnored verifies that a
// checkout.session.completed event whose payment_status is not "paid" or
// "no_payment_required" is ignored: no order / payment updates occur.
func TestPaymentService_ConfirmPayment_UnpaidCheckoutIgnored(t *testing.T) {
	cfg := stripeTestConfig()
	svc, paymentRepo, orderRepo := newPaymentService(t, cfg, nil)
	ctx := context.Background()

	session := stripego.CheckoutSession{
		ID:                "cs_unpaid",
		PaymentStatus:     stripego.CheckoutSessionPaymentStatusUnpaid,
		ClientReferenceID: "ORD-X",
		Metadata:          map[string]string{"order_id": "55"},
	}
	event := &stripego.Event{
		ID:   "evt_unpaid",
		Type: "checkout.session.completed",
		Data: &stripego.EventData{Raw: wrapSession(t, session)},
	}
	payload, header := signWebhook(t, cfg.WebhookSecret, event)

	err := svc.ConfirmPayment(ctx, &PaymentConfirmRequest{Payload: payload, Signature: header})
	require.NoError(t, err)
	paymentRepo.AssertNotCalled(t, "GetByOrderID", mock.Anything, mock.Anything)
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// TestPaymentService_ConfirmPayment_UnhandledEventIgnored verifies that
// events of types we don't handle (for example "customer.created") are
// silently accepted. Stripe would otherwise retry them forever.
func TestPaymentService_ConfirmPayment_UnhandledEventIgnored(t *testing.T) {
	cfg := stripeTestConfig()
	svc, paymentRepo, orderRepo := newPaymentService(t, cfg, nil)

	event := &stripego.Event{
		ID:   "evt_unrelated",
		Type: "customer.created",
		Data: &stripego.EventData{Raw: json.RawMessage(`{}`)},
	}
	payload, header := signWebhook(t, cfg.WebhookSecret, event)

	err := svc.ConfirmPayment(context.Background(), &PaymentConfirmRequest{Payload: payload, Signature: header})
	require.NoError(t, err)
	paymentRepo.AssertNotCalled(t, "GetByOrderID", mock.Anything, mock.Anything)
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// TestPaymentService_ConfirmPayment_PaymentIntentFailed verifies that
// payment_intent.payment_failed updates the payment to failed by looking
// up the payment via the order id embedded in metadata.
func TestPaymentService_ConfirmPayment_PaymentIntentFailed(t *testing.T) {
	cfg := stripeTestConfig()
	svc, paymentRepo, orderRepo := newPaymentService(t, cfg, nil)
	ctx := context.Background()

	payment := &models.Payment{
		BaseWithUpdate: models.BaseWithUpdate{ID: 4},
		OrderID:        20,
		Status:         models.PaymentStatusProcessing,
		Method:         models.PaymentMethodOnline,
	}
	intent := stripego.PaymentIntent{
		ID:       "pi_failed_1",
		Metadata: map[string]string{"order_id": "20"},
		LastPaymentError: &stripego.Error{
			Msg: "card_declined",
		},
	}
	raw, err := json.Marshal(intent)
	require.NoError(t, err)

	event := &stripego.Event{
		ID:   "evt_pi_failed",
		Type: "payment_intent.payment_failed",
		Data: &stripego.EventData{Raw: raw},
	}
	payloadBytes, header := signWebhook(t, cfg.WebhookSecret, event)

	paymentRepo.On("GetByTransactionID", ctx, "pi_failed_1").
		Return(nil, repositories.ErrPaymentNotFound).Once()
	paymentRepo.On("GetByOrderID", ctx, uint(20)).Return(payment, nil).Once()
	paymentRepo.On("Update", ctx, mock.MatchedBy(func(p *models.Payment) bool {
		return p.Status == models.PaymentStatusFailed && p.Notes == "card_declined"
	})).Return(nil).Once()

	err = svc.ConfirmPayment(ctx, &PaymentConfirmRequest{Payload: payloadBytes, Signature: header})
	require.NoError(t, err)
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// ---------------------------------------------------------------------------
// UploadTransferProof - validation & happy path (Requirements 10.1-10.8)
// ---------------------------------------------------------------------------

// TestPaymentService_UploadTransferProof_RequiresFileStorage verifies that
// the method refuses to run when no FileStorage is configured.
func TestPaymentService_UploadTransferProof_RequiresFileStorage(t *testing.T) {
	svc, _, _ := newPaymentService(t, stripeTestConfig(), nil)
	file, header := makeFileHeader(t, "proof.png", "image/png", []byte("data"))

	err := svc.UploadTransferProof(context.Background(), 1, file, header)
	assert.ErrorIs(t, err, ErrFileStorageNotConfigured)
}

// TestPaymentService_UploadTransferProof_RejectsZeroOrderID verifies the
// method validates the order id up-front.
func TestPaymentService_UploadTransferProof_RejectsZeroOrderID(t *testing.T) {
	fs := &fakeFileStorage{}
	svc, _, _ := newPaymentService(t, stripeTestConfig(), fs)
	file, header := makeFileHeader(t, "proof.png", "image/png", []byte("data"))

	err := svc.UploadTransferProof(context.Background(), 0, file, header)
	assert.Error(t, err)
}

// TestPaymentService_UploadTransferProof_RejectsOversizeFile verifies that
// files larger than the 10 MB cap are rejected before any storage or DB
// call happens (Requirement 10.3).
func TestPaymentService_UploadTransferProof_RejectsOversizeFile(t *testing.T) {
	fs := &fakeFileStorage{}
	svc, paymentRepo, orderRepo := newPaymentService(t, stripeTestConfig(), fs)

	// The makeFileHeader helper keeps the payload entirely in memory so
	// a 1-byte payload plus an inflated Size field suffices for the
	// declared-size check. Write just over the cap.
	file, header := makeFileHeader(t, "proof.png", "image/png", []byte("x"))
	header.Size = MaxTransferProofSize + 1

	err := svc.UploadTransferProof(context.Background(), 1, file, header)
	assert.ErrorIs(t, err, ErrTransferProofTooLarge)
	assert.Equal(t, 0, fs.saveCalls, "Save should not have been called")
	paymentRepo.AssertNotCalled(t, "GetByOrderID", mock.Anything, mock.Anything)
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// TestPaymentService_UploadTransferProof_RejectsUnsupportedFormat verifies
// that only JPEG, PNG, and PDF uploads are accepted (Requirement 10.2).
func TestPaymentService_UploadTransferProof_RejectsUnsupportedFormat(t *testing.T) {
	fs := &fakeFileStorage{}
	svc, _, _ := newPaymentService(t, stripeTestConfig(), fs)

	// Both the content type and extension are outside the allow list.
	file, header := makeFileHeader(t, "proof.gif", "image/gif", []byte("data"))

	err := svc.UploadTransferProof(context.Background(), 1, file, header)
	assert.ErrorIs(t, err, ErrTransferProofFormat)
	assert.Equal(t, 0, fs.saveCalls)
}

// TestPaymentService_UploadTransferProof_OrderMethodMismatch verifies that
// orders not marked for transfer payment reject the upload even after
// content-type validation.
func TestPaymentService_UploadTransferProof_OrderMethodMismatch(t *testing.T) {
	fs := &fakeFileStorage{}
	svc, _, orderRepo := newPaymentService(t, stripeTestConfig(), fs)
	ctx := context.Background()

	order := newTransferOrder(5, 100, time.Now().UTC())
	order.PaymentMethod = models.PaymentMethodOnline
	orderRepo.On("GetByID", ctx, uint(5)).Return(order, nil).Once()

	file, header := makeFileHeader(t, "proof.pdf", "application/pdf", []byte("%PDF-1.4"))

	err := svc.UploadTransferProof(ctx, 5, file, header)
	assert.ErrorIs(t, err, ErrInvalidPaymentMethodForTransfer)
}

// TestPaymentService_UploadTransferProof_OrderNotAwaitingTransfer verifies
// that orders already shipped / paid reject further transfer uploads.
func TestPaymentService_UploadTransferProof_OrderNotAwaitingTransfer(t *testing.T) {
	fs := &fakeFileStorage{}
	svc, _, orderRepo := newPaymentService(t, stripeTestConfig(), fs)
	ctx := context.Background()

	order := newTransferOrder(6, 100, time.Now().UTC())
	order.Status = models.OrderStatusPaid
	orderRepo.On("GetByID", ctx, uint(6)).Return(order, nil).Once()

	file, header := makeFileHeader(t, "proof.jpg", "image/jpeg", []byte("jpeg-bytes"))

	err := svc.UploadTransferProof(ctx, 6, file, header)
	assert.ErrorIs(t, err, ErrOrderNotAwaitingTransfer)
}

// TestPaymentService_UploadTransferProof_HappyPath_NewPayment verifies the
// full happy path when no payment row exists yet: the file is saved, a
// Payment is created with method=transfer/status=pending, and the order is
// transitioned to pending_transfer with the deadline 7 days after creation
// (Requirements 10.2, 10.4, 10.5, 10.7).
func TestPaymentService_UploadTransferProof_HappyPath_NewPayment(t *testing.T) {
	fs := &fakeFileStorage{}
	svc, paymentRepo, orderRepo := newPaymentService(t, stripeTestConfig(), fs)
	ctx := context.Background()

	createdAt := time.Date(2024, 5, 1, 12, 0, 0, 0, time.UTC)
	order := newTransferOrder(7, 150, createdAt)
	orderRepo.On("GetByID", ctx, uint(7)).Return(order, nil).Once()
	paymentRepo.On("GetByOrderID", ctx, uint(7)).
		Return(nil, repositories.ErrPaymentNotFound).Once()
	paymentRepo.On("Create", ctx, mock.MatchedBy(func(p *models.Payment) bool {
		return p.OrderID == 7 &&
			p.Method == models.PaymentMethodTransfer &&
			p.Status == models.PaymentStatusPending &&
			p.Amount.Equal(order.TotalAmount) &&
			strings.HasPrefix(p.TransferProofURL, "/uploads/transfer-proofs/") &&
			p.Currency == "USD"
	})).Return(nil).Once()
	orderRepo.On("UpdateStatus", ctx, uint(7), models.OrderStatusPendingTransfer).
		Return(nil).Once()
	orderRepo.On("Update", ctx, mock.MatchedBy(func(o *models.Order) bool {
		if o.Status != models.OrderStatusPendingTransfer {
			return false
		}
		if o.ConfirmationDeadline == nil {
			return false
		}
		// Requirement 10.7: deadline is 7 days from order creation.
		return o.ConfirmationDeadline.Equal(createdAt.Add(7 * 24 * time.Hour))
	})).Return(nil).Once()

	file, header := makeFileHeader(t, "proof.pdf", "application/pdf", []byte("%PDF-1.4 test"))

	err := svc.UploadTransferProof(ctx, 7, file, header)
	require.NoError(t, err)
	assert.Equal(t, 1, fs.saveCalls)
	assert.True(t, strings.HasSuffix(fs.lastKey, ".pdf"))
	paymentRepo.AssertExpectations(t)
	orderRepo.AssertExpectations(t)
}

// TestPaymentService_UploadTransferProof_HappyPath_ExistingPayment verifies
// that re-uploading a proof for an existing payment row updates (rather
// than creates) the payment and still refreshes the order deadline.
func TestPaymentService_UploadTransferProof_HappyPath_ExistingPayment(t *testing.T) {
	fs := &fakeFileStorage{}
	svc, paymentRepo, orderRepo := newPaymentService(t, stripeTestConfig(), fs)
	ctx := context.Background()

	createdAt := time.Date(2024, 6, 2, 10, 0, 0, 0, time.UTC)
	order := newTransferOrder(8, 75.50, createdAt)
	order.Status = models.OrderStatusPendingTransfer // re-upload path
	existing := &models.Payment{
		BaseWithUpdate:   models.BaseWithUpdate{ID: 33},
		OrderID:          8,
		Method:           models.PaymentMethodTransfer,
		Status:           models.PaymentStatusPending,
		Amount:           order.TotalAmount,
		TransferProofURL: "/uploads/transfer-proofs/old.jpg",
	}

	orderRepo.On("GetByID", ctx, uint(8)).Return(order, nil).Once()
	paymentRepo.On("GetByOrderID", ctx, uint(8)).Return(existing, nil).Once()
	paymentRepo.On("Update", ctx, mock.MatchedBy(func(p *models.Payment) bool {
		return p.ID == 33 &&
			p.Status == models.PaymentStatusPending &&
			strings.HasPrefix(p.TransferProofURL, "/uploads/transfer-proofs/") &&
			p.TransferProofURL != "/uploads/transfer-proofs/old.jpg"
	})).Return(nil).Once()
	orderRepo.On("UpdateStatus", ctx, uint(8), models.OrderStatusPendingTransfer).
		Return(nil).Once()
	orderRepo.On("Update", ctx, mock.AnythingOfType("*models.Order")).
		Return(nil).Once()

	file, header := makeFileHeader(t, "proof.jpg", "image/jpeg", []byte("\xFF\xD8\xFF\xE0 jpeg"))

	err := svc.UploadTransferProof(ctx, 8, file, header)
	require.NoError(t, err)
	paymentRepo.AssertNotCalled(t, "Create", mock.Anything, mock.Anything)
}

// TestPaymentService_UploadTransferProof_StorageFailureBubblesUp verifies
// that an error from the FileStorage is surfaced and no DB mutation
// occurs (Requirement 10.6).
func TestPaymentService_UploadTransferProof_StorageFailureBubblesUp(t *testing.T) {
	fs := &fakeFileStorage{forceErr: errors.New("disk full")}
	svc, paymentRepo, orderRepo := newPaymentService(t, stripeTestConfig(), fs)
	ctx := context.Background()

	order := newTransferOrder(9, 50, time.Now().UTC())
	orderRepo.On("GetByID", ctx, uint(9)).Return(order, nil).Once()

	file, header := makeFileHeader(t, "proof.png", "image/png", []byte("\x89PNG"))

	err := svc.UploadTransferProof(ctx, 9, file, header)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "disk full")
	paymentRepo.AssertNotCalled(t, "Create", mock.Anything, mock.Anything)
	paymentRepo.AssertNotCalled(t, "Update", mock.Anything, mock.Anything)
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// TestPaymentService_UploadTransferProof_AcceptsByFilenameExtension
// verifies that when the declared Content-Type is generic (or missing)
// but the filename has a known extension, the upload is accepted
// (Requirement 10.2). Browsers frequently mislabel JPEG uploads.
func TestPaymentService_UploadTransferProof_AcceptsByFilenameExtension(t *testing.T) {
	fs := &fakeFileStorage{}
	svc, paymentRepo, orderRepo := newPaymentService(t, stripeTestConfig(), fs)
	ctx := context.Background()

	order := newTransferOrder(14, 30, time.Now().UTC())
	orderRepo.On("GetByID", ctx, uint(14)).Return(order, nil).Once()
	paymentRepo.On("GetByOrderID", ctx, uint(14)).
		Return(nil, repositories.ErrPaymentNotFound).Once()
	paymentRepo.On("Create", ctx, mock.AnythingOfType("*models.Payment")).Return(nil).Once()
	orderRepo.On("UpdateStatus", ctx, uint(14), models.OrderStatusPendingTransfer).Return(nil).Once()
	orderRepo.On("Update", ctx, mock.AnythingOfType("*models.Order")).Return(nil).Once()

	// Generic content type; extension provides the signal.
	file, header := makeFileHeader(t, "bank-transfer.jpeg", "application/octet-stream", []byte("data"))

	err := svc.UploadTransferProof(ctx, 14, file, header)
	require.NoError(t, err)
	assert.True(t, strings.HasSuffix(fs.lastKey, ".jpg"))
}

// ---------------------------------------------------------------------------
// ConfirmTransferPayment (Requirement 12.x)
// ---------------------------------------------------------------------------

// TestPaymentService_ConfirmTransferPayment_ValidatesRequest verifies the
// service rejects missing / zero ids before touching the repositories.
func TestPaymentService_ConfirmTransferPayment_ValidatesRequest(t *testing.T) {
	svc, paymentRepo, orderRepo := newPaymentService(t, stripeTestConfig(), nil)

	err := svc.ConfirmTransferPayment(context.Background(), nil)
	assert.Error(t, err)

	err = svc.ConfirmTransferPayment(context.Background(), &TransferConfirmRequest{AdminID: 1})
	assert.Error(t, err)

	err = svc.ConfirmTransferPayment(context.Background(), &TransferConfirmRequest{PaymentID: 1})
	assert.Error(t, err)

	paymentRepo.AssertNotCalled(t, "GetByID", mock.Anything, mock.Anything)
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// TestPaymentService_ConfirmTransferPayment_RejectsOnlinePayment verifies
// that an online payment cannot be confirmed through the transfer path.
func TestPaymentService_ConfirmTransferPayment_RejectsOnlinePayment(t *testing.T) {
	svc, paymentRepo, _ := newPaymentService(t, stripeTestConfig(), nil)
	ctx := context.Background()

	payment := &models.Payment{
		BaseWithUpdate: models.BaseWithUpdate{ID: 1},
		OrderID:        100,
		Method:         models.PaymentMethodOnline,
		Status:         models.PaymentStatusPending,
	}
	paymentRepo.On("GetByID", ctx, uint(1)).Return(payment, nil).Once()

	err := svc.ConfirmTransferPayment(ctx, &TransferConfirmRequest{
		PaymentID:      1,
		AdminID:        99,
		ReceivedAmount: decimal.NewFromInt(100),
	})
	assert.ErrorIs(t, err, ErrInvalidPaymentMethodForTransfer)
}

// TestPaymentService_ConfirmTransferPayment_RejectsNonReviewableStatus
// verifies transfers already succeeded or failed cannot be re-confirmed.
func TestPaymentService_ConfirmTransferPayment_RejectsNonReviewableStatus(t *testing.T) {
	svc, paymentRepo, orderRepo := newPaymentService(t, stripeTestConfig(), nil)
	ctx := context.Background()

	payment := &models.Payment{
		BaseWithUpdate: models.BaseWithUpdate{ID: 1},
		OrderID:        100,
		Method:         models.PaymentMethodTransfer,
		Status:         models.PaymentStatusSucceeded,
	}
	paymentRepo.On("GetByID", ctx, uint(1)).Return(payment, nil).Once()

	err := svc.ConfirmTransferPayment(ctx, &TransferConfirmRequest{
		PaymentID:      1,
		AdminID:        99,
		ReceivedAmount: decimal.NewFromInt(100),
	})
	assert.ErrorIs(t, err, ErrTransferNotReviewable)
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// TestPaymentService_ConfirmTransferPayment_HappyPath verifies the full
// successful path: the payment is marked succeeded with the admin id,
// received amount, notes, and timestamp, and the owning order is
// transitioned to paid (Requirements 12.7, 12.9, 12.11).
func TestPaymentService_ConfirmTransferPayment_HappyPath(t *testing.T) {
	svc, paymentRepo, orderRepo := newPaymentService(t, stripeTestConfig(), nil)
	ctx := context.Background()

	payment := &models.Payment{
		BaseWithUpdate: models.BaseWithUpdate{ID: 50},
		OrderID:        200,
		Method:         models.PaymentMethodTransfer,
		Status:         models.PaymentStatusPending,
		Amount:         decimal.NewFromInt(100),
	}
	paymentRepo.On("GetByID", ctx, uint(50)).Return(payment, nil).Once()

	received := decimal.NewFromInt(100)
	paymentRepo.On("Update", ctx, mock.MatchedBy(func(p *models.Payment) bool {
		return p.Status == models.PaymentStatusSucceeded &&
			p.ConfirmedBy != nil && *p.ConfirmedBy == 7 &&
			p.ConfirmedAt != nil &&
			p.ReceivedAmount.Equal(received) &&
			p.Notes == "looks good"
	})).Return(nil).Once()
	orderRepo.On("UpdateStatus", ctx, uint(200), models.OrderStatusPaid).Return(nil).Once()

	err := svc.ConfirmTransferPayment(ctx, &TransferConfirmRequest{
		PaymentID:      50,
		AdminID:        7,
		ReceivedAmount: received,
		Notes:          "looks good",
	})
	require.NoError(t, err)
	paymentRepo.AssertExpectations(t)
	orderRepo.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// RejectTransferPayment (Requirement 12.8)
// ---------------------------------------------------------------------------

// TestPaymentService_RejectTransferPayment_ValidatesRequest verifies the
// service rejects missing / zero ids before touching the repositories.
func TestPaymentService_RejectTransferPayment_ValidatesRequest(t *testing.T) {
	svc, paymentRepo, _ := newPaymentService(t, stripeTestConfig(), nil)

	err := svc.RejectTransferPayment(context.Background(), nil)
	assert.Error(t, err)
	err = svc.RejectTransferPayment(context.Background(), &TransferRejectRequest{AdminID: 1})
	assert.Error(t, err)
	err = svc.RejectTransferPayment(context.Background(), &TransferRejectRequest{PaymentID: 1})
	assert.Error(t, err)

	paymentRepo.AssertNotCalled(t, "GetByID", mock.Anything, mock.Anything)
}

// TestPaymentService_RejectTransferPayment_HappyPath verifies that a
// reviewable transfer is marked failed with the rejection reason and the
// owning order transitions to payment_failed (Requirement 12.8).
func TestPaymentService_RejectTransferPayment_HappyPath(t *testing.T) {
	svc, paymentRepo, orderRepo := newPaymentService(t, stripeTestConfig(), nil)
	ctx := context.Background()

	payment := &models.Payment{
		BaseWithUpdate: models.BaseWithUpdate{ID: 51},
		OrderID:        300,
		Method:         models.PaymentMethodTransfer,
		Status:         models.PaymentStatusPending,
	}
	paymentRepo.On("GetByID", ctx, uint(51)).Return(payment, nil).Once()
	paymentRepo.On("Update", ctx, mock.MatchedBy(func(p *models.Payment) bool {
		return p.Status == models.PaymentStatusFailed &&
			p.ConfirmedBy != nil && *p.ConfirmedBy == 8 &&
			p.Notes == "amount mismatch"
	})).Return(nil).Once()
	orderRepo.On("UpdateStatus", ctx, uint(300), models.OrderStatusPaymentFailed).Return(nil).Once()

	err := svc.RejectTransferPayment(ctx, &TransferRejectRequest{
		PaymentID: 51,
		AdminID:   8,
		Reason:    "amount mismatch",
	})
	require.NoError(t, err)
	paymentRepo.AssertExpectations(t)
	orderRepo.AssertExpectations(t)
}

// ---------------------------------------------------------------------------
// BatchConfirmTransfer (Requirements 13.1-13.7)
// ---------------------------------------------------------------------------

// TestPaymentService_BatchConfirmTransfer_RejectsEmptyBatch verifies that
// an empty batch is rejected before any DB access (Requirement 13.4).
func TestPaymentService_BatchConfirmTransfer_RejectsEmptyBatch(t *testing.T) {
	svc, paymentRepo, _ := newPaymentService(t, stripeTestConfig(), nil)

	err := svc.BatchConfirmTransfer(context.Background(), &BatchTransferConfirmRequest{
		AdminID: 1,
		Items:   nil,
	})
	assert.Error(t, err)
	paymentRepo.AssertNotCalled(t, "GetByID", mock.Anything, mock.Anything)
}

// TestPaymentService_BatchConfirmTransfer_RejectsNonPositiveAmount verifies
// that pre-validation blocks zero / negative received amounts (Requirement
// 13.4) before any orders are touched.
func TestPaymentService_BatchConfirmTransfer_RejectsNonPositiveAmount(t *testing.T) {
	svc, paymentRepo, orderRepo := newPaymentService(t, stripeTestConfig(), nil)

	err := svc.BatchConfirmTransfer(context.Background(), &BatchTransferConfirmRequest{
		AdminID: 1,
		Items: []TransferConfirmRequest{
			{PaymentID: 1, ReceivedAmount: decimal.NewFromInt(100)},
			{PaymentID: 2, ReceivedAmount: decimal.Zero},
		},
	})
	assert.Error(t, err)
	paymentRepo.AssertNotCalled(t, "GetByID", mock.Anything, mock.Anything)
	orderRepo.AssertNotCalled(t, "UpdateStatus", mock.Anything, mock.Anything, mock.Anything)
}

// TestPaymentService_BatchConfirmTransfer_HappyPath verifies that every
// item in a validated batch is confirmed: each payment becomes succeeded,
// each order becomes paid, and all updates carry the administrator id
// (Requirements 13.5, 13.7).
func TestPaymentService_BatchConfirmTransfer_HappyPath(t *testing.T) {
	svc, paymentRepo, orderRepo := newPaymentService(t, stripeTestConfig(), nil)
	ctx := context.Background()

	payment1 := &models.Payment{
		BaseWithUpdate: models.BaseWithUpdate{ID: 101},
		OrderID:        401,
		Method:         models.PaymentMethodTransfer,
		Status:         models.PaymentStatusPending,
	}
	payment2 := &models.Payment{
		BaseWithUpdate: models.BaseWithUpdate{ID: 102},
		OrderID:        402,
		Method:         models.PaymentMethodTransfer,
		Status:         models.PaymentStatusPending,
	}

	paymentRepo.On("GetByID", ctx, uint(101)).Return(payment1, nil).Once()
	paymentRepo.On("GetByID", ctx, uint(102)).Return(payment2, nil).Once()

	paymentRepo.On("Update", ctx, mock.MatchedBy(func(p *models.Payment) bool {
		return p.ID == 101 &&
			p.Status == models.PaymentStatusSucceeded &&
			p.ConfirmedBy != nil && *p.ConfirmedBy == 5 &&
			p.ReceivedAmount.Equal(decimal.NewFromInt(100))
	})).Return(nil).Once()
	paymentRepo.On("Update", ctx, mock.MatchedBy(func(p *models.Payment) bool {
		return p.ID == 102 &&
			p.Status == models.PaymentStatusSucceeded &&
			p.ConfirmedBy != nil && *p.ConfirmedBy == 5 &&
			p.ReceivedAmount.Equal(decimal.NewFromInt(200))
	})).Return(nil).Once()

	orderRepo.On("UpdateStatus", ctx, uint(401), models.OrderStatusPaid).Return(nil).Once()
	orderRepo.On("UpdateStatus", ctx, uint(402), models.OrderStatusPaid).Return(nil).Once()

	err := svc.BatchConfirmTransfer(ctx, &BatchTransferConfirmRequest{
		AdminID: 5,
		Items: []TransferConfirmRequest{
			{PaymentID: 101, ReceivedAmount: decimal.NewFromInt(100)},
			{PaymentID: 102, ReceivedAmount: decimal.NewFromInt(200)},
		},
	})
	require.NoError(t, err)
	paymentRepo.AssertExpectations(t)
	orderRepo.AssertExpectations(t)
}

// TestPaymentService_BatchConfirmTransfer_ItemLevelAdminIDOverride verifies
// that a per-item admin id overrides the batch-level one (Requirement 13.7).
func TestPaymentService_BatchConfirmTransfer_ItemLevelAdminIDOverride(t *testing.T) {
	svc, paymentRepo, orderRepo := newPaymentService(t, stripeTestConfig(), nil)
	ctx := context.Background()

	payment := &models.Payment{
		BaseWithUpdate: models.BaseWithUpdate{ID: 200},
		OrderID:        500,
		Method:         models.PaymentMethodTransfer,
		Status:         models.PaymentStatusPending,
	}
	paymentRepo.On("GetByID", ctx, uint(200)).Return(payment, nil).Once()
	paymentRepo.On("Update", ctx, mock.MatchedBy(func(p *models.Payment) bool {
		return p.ConfirmedBy != nil && *p.ConfirmedBy == 42
	})).Return(nil).Once()
	orderRepo.On("UpdateStatus", ctx, uint(500), models.OrderStatusPaid).Return(nil).Once()

	err := svc.BatchConfirmTransfer(ctx, &BatchTransferConfirmRequest{
		AdminID: 5, // batch default
		Items: []TransferConfirmRequest{
			{PaymentID: 200, AdminID: 42, ReceivedAmount: decimal.NewFromInt(50)},
		},
	})
	require.NoError(t, err)
}

// TestPaymentService_BatchConfirmTransfer_StopsOnFirstFailure verifies that
// once an item fails mid-batch the iteration stops and the error is
// returned to the caller. The transaction manager (not exercised here,
// passthrough) is what actually rolls back prior items in production.
func TestPaymentService_BatchConfirmTransfer_StopsOnFirstFailure(t *testing.T) {
	svc, paymentRepo, orderRepo := newPaymentService(t, stripeTestConfig(), nil)
	ctx := context.Background()

	payment1 := &models.Payment{
		BaseWithUpdate: models.BaseWithUpdate{ID: 1},
		OrderID:        10,
		Method:         models.PaymentMethodTransfer,
		Status:         models.PaymentStatusPending,
	}
	// Item 2 lookup fails. The batch should never call GetByID on item 3.
	boom := errors.New("db gone")

	paymentRepo.On("GetByID", ctx, uint(1)).Return(payment1, nil).Once()
	paymentRepo.On("Update", ctx, mock.MatchedBy(func(p *models.Payment) bool {
		return p.ID == 1
	})).Return(nil).Once()
	orderRepo.On("UpdateStatus", ctx, uint(10), models.OrderStatusPaid).Return(nil).Once()

	paymentRepo.On("GetByID", ctx, uint(2)).Return(nil, boom).Once()

	err := svc.BatchConfirmTransfer(ctx, &BatchTransferConfirmRequest{
		AdminID: 1,
		Items: []TransferConfirmRequest{
			{PaymentID: 1, ReceivedAmount: decimal.NewFromInt(10)},
			{PaymentID: 2, ReceivedAmount: decimal.NewFromInt(20)},
			{PaymentID: 3, ReceivedAmount: decimal.NewFromInt(30)},
		},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "db gone")

	paymentRepo.AssertExpectations(t)
	orderRepo.AssertExpectations(t)
	// Ensure the third item was never touched.
	paymentRepo.AssertNotCalled(t, "GetByID", ctx, uint(3))
}

// ---------------------------------------------------------------------------
// GetPaymentByOrder
// ---------------------------------------------------------------------------

// TestPaymentService_GetPaymentByOrder_RejectsZeroID ensures the service
// short-circuits the call before hitting the repo.
func TestPaymentService_GetPaymentByOrder_RejectsZeroID(t *testing.T) {
	svc, paymentRepo, _ := newPaymentService(t, stripeTestConfig(), nil)

	_, err := svc.GetPaymentByOrder(context.Background(), 0)
	assert.Error(t, err)
	paymentRepo.AssertNotCalled(t, "GetByOrderID", mock.Anything, mock.Anything)
}

// TestPaymentService_GetPaymentByOrder_Delegates verifies that the service
// forwards the lookup to the repository.
func TestPaymentService_GetPaymentByOrder_Delegates(t *testing.T) {
	svc, paymentRepo, _ := newPaymentService(t, stripeTestConfig(), nil)
	ctx := context.Background()

	expected := &models.Payment{BaseWithUpdate: models.BaseWithUpdate{ID: 1}, OrderID: 2}
	paymentRepo.On("GetByOrderID", ctx, uint(2)).Return(expected, nil).Once()

	got, err := svc.GetPaymentByOrder(ctx, 2)
	require.NoError(t, err)
	assert.Same(t, expected, got)
}

// ---------------------------------------------------------------------------
// Sanity check: URL helpers embed the order number so post-redirect flows
// land on the right order. This guards the internal helper used by
// CreatePaymentSession and keeps the code covered even without hitting the
// real Stripe SDK.
// ---------------------------------------------------------------------------

// TestPaymentService_AppendQueryParam covers both the "no existing query"
// and "existing query" branches of appendQueryParam.
func TestPaymentService_AppendQueryParam(t *testing.T) {
	t.Run("no existing query", func(t *testing.T) {
		got := appendQueryParam("https://example.com/success", "order_number", "ORD-1")
		u, err := url.Parse(got)
		require.NoError(t, err)
		assert.Equal(t, "ORD-1", u.Query().Get("order_number"))
	})
	t.Run("existing query", func(t *testing.T) {
		got := appendQueryParam("https://example.com/success?foo=bar", "order_number", "ORD-2")
		u, err := url.Parse(got)
		require.NoError(t, err)
		assert.Equal(t, "bar", u.Query().Get("foo"))
		assert.Equal(t, "ORD-2", u.Query().Get("order_number"))
	})
	t.Run("empty base", func(t *testing.T) {
		assert.Equal(t, "", appendQueryParam("", "k", "v"))
	})
}

// TestPaymentService_ToFromMinorUnitsRoundTrip verifies the minor-unit
// conversion round-trips exact cents cleanly.
func TestPaymentService_ToFromMinorUnitsRoundTrip(t *testing.T) {
	cases := []float64{0.01, 1.00, 9.99, 25.50, 9999.99}
	for _, v := range cases {
		d := decimal.NewFromFloat(v)
		minor := toMinorUnits(d)
		back := fromMinorUnits(minor)
		assert.Truef(t, d.Equal(back),
			"%s -> %d -> %s should round-trip", d.String(), minor, back.String())
	}
}
