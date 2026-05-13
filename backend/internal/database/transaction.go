package database

import (
	"context"

	"gorm.io/gorm"
)

// TransactionKey is the context key for transaction
type TransactionKey struct{}

// WithTransaction returns a new context with the given transaction
func WithTransaction(ctx context.Context, tx *gorm.DB) context.Context {
	return context.WithValue(ctx, TransactionKey{}, tx)
}

// FromContext returns the transaction from context if exists, otherwise returns the db
func (db *DB) FromContext(ctx context.Context) *gorm.DB {
	if tx, ok := ctx.Value(TransactionKey{}).(*gorm.DB); ok && tx != nil {
		return tx
	}
	return db.DB
}

// Transaction executes a function within a database transaction
func (db *DB) Transaction(ctx context.Context, fn func(tx *gorm.DB) error) error {
	return db.DB.Transaction(func(tx *gorm.DB) error {
		return fn(tx)
	})
}

// TransactionWithContext executes a function within a database transaction with context
func (db *DB) TransactionWithContext(ctx context.Context, fn func(ctx context.Context, tx *gorm.DB) error) error {
	return db.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		txCtx := WithTransaction(ctx, tx)
		return fn(txCtx, tx)
	})
}

// Begin starts a new transaction
func (db *DB) Begin() *gorm.DB {
	return db.DB.Begin()
}

// Commit commits the transaction
func Commit(tx *gorm.DB) error {
	return tx.Commit().Error
}

// Rollback rolls back the transaction
func Rollback(tx *gorm.DB) error {
	return tx.Rollback().Error
}
