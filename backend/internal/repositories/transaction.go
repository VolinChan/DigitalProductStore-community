package repositories

import (
	"context"

	"gorm.io/gorm"
)

// transactionKey is the unexported context key used to propagate a GORM
// transaction handle through the repository layer. Services that need to
// coordinate writes across multiple repositories (for example creating an
// order while decrementing inventory) can start a transaction and call
// WithTx to attach it to the context.
type transactionKey struct{}

// WithTx returns a child context carrying the given GORM transaction. When
// repository methods receive a context produced by WithTx they will run
// their SQL against the attached transaction instead of the underlying
// connection, allowing multiple operations to succeed or fail atomically.
//
// Passing a nil tx leaves the context unchanged.
func WithTx(ctx context.Context, tx *gorm.DB) context.Context {
	if tx == nil {
		return ctx
	}
	return context.WithValue(ctx, transactionKey{}, tx)
}

// TxFromContext returns the transaction stored in ctx, if any. The second
// return value is false when no transaction is attached.
func TxFromContext(ctx context.Context) (*gorm.DB, bool) {
	tx, ok := ctx.Value(transactionKey{}).(*gorm.DB)
	if !ok || tx == nil {
		return nil, false
	}
	return tx, true
}

// TxManager coordinates a transaction that spans multiple repositories. The
// caller's function runs with a context that carries the active transaction,
// and the repositories that are transaction-aware will automatically use it.
type TxManager interface {
	// RunInTransaction executes fn inside a database transaction. If fn
	// returns a non-nil error the transaction is rolled back; otherwise it
	// is committed. The context passed to fn carries the transaction and
	// should be threaded through into repository calls.
	RunInTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

// gormTxManager implements TxManager using a GORM DB.
type gormTxManager struct {
	db *gorm.DB
}

// NewTxManager creates a TxManager backed by the provided GORM DB.
func NewTxManager(db *gorm.DB) TxManager {
	return &gormTxManager{db: db}
}

// RunInTransaction starts a transaction and invokes fn with a context
// carrying the transaction handle.
func (m *gormTxManager) RunInTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(WithTx(ctx, tx))
	})
}
