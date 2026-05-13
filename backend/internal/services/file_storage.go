package services

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// FileStorage errors. Callers can match against these sentinels when
// reporting specific failure modes to the user (for example, a full disk).
var (
	// ErrFileStorageNotConfigured is returned when a file operation is
	// requested but the service was constructed without a FileStorage
	// implementation. Primarily useful for services that expose file
	// upload methods (payment transfer proofs, product images, etc.).
	ErrFileStorageNotConfigured = errors.New("file storage not configured")

	// ErrInvalidFileName is returned when the provided filename cannot
	// be used safely on disk (empty, contains path separators, or
	// resolves outside the storage root after cleaning).
	ErrInvalidFileName = errors.New("invalid file name")
)

// FileStorage is a small abstraction over the blob-storage layer used by
// services that need to persist customer-uploaded files (transfer proofs
// today, and eventually product images).
//
// The interface is intentionally narrow so it can be backed by a local
// directory during development / tests and swapped for an S3 / MinIO
// implementation in production without touching the services that depend
// on it.
type FileStorage interface {
	// Save persists the bytes available from r under the given subdirectory
	// and filename. It returns an opaque storage key (for example the
	// relative path on disk) that callers can later hand to URL() to build
	// a client-facing URL, or to a future Delete() method when removing
	// the file.
	//
	// Implementations MUST treat subdir and filename as untrusted input and
	// reject values that attempt to escape the storage root via "..".
	Save(ctx context.Context, subdir, filename string, r io.Reader) (string, error)

	// URL returns a client-facing URL for a previously-saved storage key.
	// For local storage this is typically a relative path the frontend can
	// fetch through a static-files handler.
	URL(key string) string
}

// LocalFileStorage implements FileStorage by writing files beneath a base
// directory on the local filesystem. It is suitable for single-instance
// deployments and local development; production deployments that run more
// than one API replica should use a shared object store instead.
type LocalFileStorage struct {
	// BaseDir is the root directory for all files managed by this
	// storage. It is created on first write if it does not exist.
	BaseDir string

	// URLPrefix is prepended to the storage key when building a
	// client-facing URL. It typically matches the path under which the
	// API serves static assets (e.g. "/uploads").
	URLPrefix string
}

// NewLocalFileStorage constructs a LocalFileStorage with sane defaults.
// baseDir is required; urlPrefix may be empty if the caller does not need
// URL() to return anything other than the bare storage key.
func NewLocalFileStorage(baseDir, urlPrefix string) *LocalFileStorage {
	return &LocalFileStorage{
		BaseDir:   baseDir,
		URLPrefix: urlPrefix,
	}
}

// Save writes the content of r to <BaseDir>/<subdir>/<filename> and returns
// the storage key "<subdir>/<filename>". The subdir and filename are
// sanitised via filepath.Clean and rejected if they resolve outside the
// storage root.
func (s *LocalFileStorage) Save(ctx context.Context, subdir, filename string, r io.Reader) (string, error) {
	if s.BaseDir == "" {
		return "", ErrFileStorageNotConfigured
	}
	if r == nil {
		return "", fmt.Errorf("reader is required")
	}
	if strings.TrimSpace(filename) == "" {
		return "", fmt.Errorf("%w: empty filename", ErrInvalidFileName)
	}
	// Disallow path separators inside the filename so callers cannot
	// traverse out of the target directory via "a/../../etc/passwd".
	if strings.ContainsAny(filename, `/\`) {
		return "", fmt.Errorf("%w: %q", ErrInvalidFileName, filename)
	}

	// Clean the subdir separately and verify it does not escape the
	// base directory once joined.
	cleanedSubdir := filepath.Clean(subdir)
	if cleanedSubdir == "." {
		cleanedSubdir = ""
	}
	if strings.HasPrefix(cleanedSubdir, "..") ||
		strings.Contains(cleanedSubdir, string(os.PathSeparator)+"..") {
		return "", fmt.Errorf("%w: subdir %q escapes storage root", ErrInvalidFileName, subdir)
	}

	targetDir := filepath.Join(s.BaseDir, cleanedSubdir)
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return "", fmt.Errorf("failed to create storage dir: %w", err)
	}

	targetPath := filepath.Join(targetDir, filename)
	// Final safety check: the fully resolved path must still live under
	// the (absolute) base directory.
	absBase, err := filepath.Abs(s.BaseDir)
	if err != nil {
		return "", fmt.Errorf("failed to resolve base dir: %w", err)
	}
	absTarget, err := filepath.Abs(targetPath)
	if err != nil {
		return "", fmt.Errorf("failed to resolve target path: %w", err)
	}
	if !strings.HasPrefix(absTarget, absBase+string(os.PathSeparator)) && absTarget != absBase {
		return "", fmt.Errorf("%w: resolved path outside storage root", ErrInvalidFileName)
	}

	// Write with 0644 so the file is readable by the web server user and
	// any adjacent worker processes but not world-writable.
	out, err := os.OpenFile(targetPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		return "", fmt.Errorf("failed to open file for writing: %w", err)
	}
	// Ensure the file is flushed and closed on all exit paths.
	defer func() { _ = out.Close() }()

	if _, err := io.Copy(out, r); err != nil {
		// Best-effort cleanup: remove partial file so the caller does
		// not end up with a half-written proof referenced by the DB.
		_ = os.Remove(targetPath)
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	// Build the storage key with forward slashes so it is stable across
	// operating systems and easy to concatenate into URLs.
	key := filename
	if cleanedSubdir != "" {
		key = strings.ReplaceAll(cleanedSubdir, string(os.PathSeparator), "/") + "/" + filename
	}
	return key, nil
}

// URL joins URLPrefix and the storage key using forward slashes. Callers
// receive an empty string when URLPrefix is unset and key is empty.
func (s *LocalFileStorage) URL(key string) string {
	if key == "" {
		return ""
	}
	if s.URLPrefix == "" {
		return key
	}
	prefix := strings.TrimRight(s.URLPrefix, "/")
	return prefix + "/" + strings.TrimLeft(key, "/")
}
