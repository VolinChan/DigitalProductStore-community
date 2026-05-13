package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
)

// File upload errors.
var (
	// ErrUnsupportedImageFormat is returned when the uploaded file is not
	// one of the accepted image formats (JPEG, PNG, WebP).
	ErrUnsupportedImageFormat = errors.New("unsupported image format: only JPEG, PNG, and WebP are accepted")

	// ErrFileTooLarge is returned when the uploaded file exceeds the size
	// limit for the given upload type.
	ErrFileTooLarge = errors.New("file exceeds maximum allowed size")
)

// UploadType categorises uploads so the service can apply the correct size
// limit and storage subdirectory.
type UploadType string

const (
	// UploadTypeProductImage is for product and SKU images (max 5MB).
	UploadTypeProductImage UploadType = "product_image"

	// UploadTypeTransferProof is for payment transfer proof files (max 10MB).
	UploadTypeTransferProof UploadType = "transfer_proof"

	// UploadTypeBanner is for homepage banner/carousel images (max 2MB).
	UploadTypeBanner UploadType = "banner"
)

// Size limits per upload type (in bytes).
const (
	MaxProductImageSize  = 5 * 1024 * 1024  // 5 MB
	MaxTransferProofSize2 = 10 * 1024 * 1024 // 10 MB (mirrors MaxTransferProofSize for backward compat)
	MaxBannerSize        = 2 * 1024 * 1024   // 2 MB
)

// maxSizeForType returns the maximum allowed file size in bytes for the
// given upload type.
func maxSizeForType(t UploadType) int64 {
	switch t {
	case UploadTypeProductImage:
		return MaxProductImageSize
	case UploadTypeTransferProof:
		return MaxTransferProofSize2
	case UploadTypeBanner:
		return MaxBannerSize
	default:
		return MaxProductImageSize // conservative default
	}
}

// subdirForType returns the storage subdirectory for the given upload type.
func subdirForType(t UploadType) string {
	switch t {
	case UploadTypeProductImage:
		return "products"
	case UploadTypeTransferProof:
		return "transfer-proofs"
	case UploadTypeBanner:
		return "banners"
	default:
		return "misc"
	}
}

// allowedImageMIMETypes maps accepted MIME types to their canonical file
// extensions. Only JPEG, PNG, and WebP are accepted per Requirement 23.1.
var allowedImageMIMETypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/jpg":  ".jpg",
	"image/pjpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

// allowedImageExtensions maps file extensions to canonical extensions for
// fallback validation when MIME type detection is unreliable.
var allowedImageExtensions = map[string]string{
	".jpg":  ".jpg",
	".jpeg": ".jpg",
	".png":  ".png",
	".webp": ".webp",
}

// UploadResult contains the result of a successful file upload.
type UploadResult struct {
	// StorageKey is the internal key used to reference the file in the
	// storage backend (e.g. "products/abcdef1234.jpg").
	StorageKey string `json:"storage_key"`

	// URL is the client-facing URL to access the uploaded file.
	URL string `json:"url"`

	// ContentHash is the SHA-256 hex digest of the file content.
	ContentHash string `json:"content_hash"`

	// Size is the actual file size in bytes.
	Size int64 `json:"size"`
}

// FileUploadService handles validated file uploads with format checking,
// size enforcement, and content-addressable storage. It delegates actual
// persistence to the underlying FileStorage implementation (local or S3).
type FileUploadService struct {
	storage FileStorage
}

// NewFileUploadService creates a FileUploadService backed by the given
// storage implementation.
func NewFileUploadService(storage FileStorage) *FileUploadService {
	return &FileUploadService{storage: storage}
}

// Upload validates and stores an uploaded file. It:
//  1. Validates the image format (JPEG, PNG, WebP) via content sniffing
//  2. Enforces the size limit for the given upload type
//  3. Computes a SHA-256 hash of the file content for content-addressable naming
//  4. Stores the file using the hash-based filename
//  5. Returns the storage key and URL
func (s *FileUploadService) Upload(
	ctx context.Context,
	uploadType UploadType,
	file multipart.File,
	header *multipart.FileHeader,
) (*UploadResult, error) {
	if s.storage == nil {
		return nil, ErrFileStorageNotConfigured
	}
	if file == nil || header == nil {
		return nil, fmt.Errorf("file and header are required")
	}

	// Step 1: Check declared size against limit (fast fail).
	maxSize := maxSizeForType(uploadType)
	if header.Size > maxSize {
		return nil, fmt.Errorf("%w: %s allows max %d bytes, got %d",
			ErrFileTooLarge, uploadType, maxSize, header.Size)
	}

	// Step 2: Read the file content into memory (bounded by maxSize+1 to
	// detect oversized payloads even when header.Size is understated).
	limitedReader := io.LimitReader(file, maxSize+1)
	content, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("failed to read uploaded file: %w", err)
	}
	if int64(len(content)) > maxSize {
		return nil, fmt.Errorf("%w: %s allows max %d bytes, actual content exceeds limit",
			ErrFileTooLarge, uploadType, maxSize)
	}

	// Step 3: Validate image format via content sniffing (first 512 bytes).
	ext, err := validateImageFormat(content, header.Filename)
	if err != nil {
		return nil, err
	}

	// Step 4: Compute SHA-256 hash for content-addressable filename.
	hash := sha256.Sum256(content)
	hashHex := hex.EncodeToString(hash[:])

	// Step 5: Build filename from hash + extension.
	filename := hashHex + ext

	// Step 6: Store the file.
	subdir := subdirForType(uploadType)
	reader := newBytesReader(content)
	storageKey, err := s.storage.Save(ctx, subdir, filename, reader)
	if err != nil {
		return nil, fmt.Errorf("failed to store file: %w", err)
	}

	return &UploadResult{
		StorageKey:  storageKey,
		URL:         s.storage.URL(storageKey),
		ContentHash: hashHex,
		Size:        int64(len(content)),
	}, nil
}

// validateImageFormat checks the file content against accepted image MIME
// types using http.DetectContentType (which reads the magic bytes). Falls
// back to extension-based validation if content sniffing is inconclusive.
func validateImageFormat(content []byte, filename string) (string, error) {
	if len(content) == 0 {
		return "", fmt.Errorf("%w: empty file", ErrUnsupportedImageFormat)
	}

	// http.DetectContentType uses the first 512 bytes.
	sniffSize := 512
	if len(content) < sniffSize {
		sniffSize = len(content)
	}
	detectedType := http.DetectContentType(content[:sniffSize])

	// Check if the detected MIME type is in our allow list.
	if ext, ok := allowedImageMIMETypes[detectedType]; ok {
		return ext, nil
	}

	// Some browsers/systems may report "application/octet-stream" for
	// WebP files. Fall back to extension-based validation.
	fileExt := strings.ToLower(filepath.Ext(filename))
	if ext, ok := allowedImageExtensions[fileExt]; ok {
		// Double-check: for WebP, verify the RIFF/WEBP magic bytes.
		if ext == ".webp" && isWebP(content) {
			return ext, nil
		}
		// For JPEG/PNG, the content sniffing should have caught them.
		// If it didn't, the file is likely not a valid image.
		if ext == ".webp" {
			return "", fmt.Errorf("%w: file extension suggests WebP but content does not match",
				ErrUnsupportedImageFormat)
		}
	}

	return "", fmt.Errorf("%w: detected content type %q",
		ErrUnsupportedImageFormat, detectedType)
}

// isWebP checks if the content starts with the RIFF....WEBP magic bytes.
func isWebP(content []byte) bool {
	if len(content) < 12 {
		return false
	}
	return string(content[0:4]) == "RIFF" && string(content[8:12]) == "WEBP"
}

// bytesReaderWrapper wraps a byte slice to implement io.Reader for passing
// to FileStorage.Save after we've already read the content for hashing.
type bytesReaderWrapper struct {
	data   []byte
	offset int
}

func newBytesReader(data []byte) *bytesReaderWrapper {
	return &bytesReaderWrapper{data: data}
}

func (r *bytesReaderWrapper) Read(p []byte) (int, error) {
	if r.offset >= len(r.data) {
		return 0, io.EOF
	}
	n := copy(p, r.data[r.offset:])
	r.offset += n
	return n, nil
}
