package services

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"mime/multipart"
	"net/textproto"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Test helpers -------------------------------------------------------

// createMultipartHeader builds a *multipart.FileHeader for testing.
func createMultipartHeader(filename string, content []byte) *multipart.FileHeader {
	return &multipart.FileHeader{
		Filename: filename,
		Size:     int64(len(content)),
		Header:   textproto.MIMEHeader{},
	}
}

// createJPEGContent generates a minimal valid JPEG image.
func createJPEGContent(width, height int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.RGBA{R: 255, G: 0, B: 0, A: 255})
		}
	}
	var buf bytes.Buffer
	_ = jpeg.Encode(&buf, img, &jpeg.Options{Quality: 50})
	return buf.Bytes()
}

// createPNGContent generates a minimal valid PNG image.
func createPNGContent(width, height int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.RGBA{R: 0, G: 255, B: 0, A: 255})
		}
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}

// createWebPContent generates minimal WebP magic bytes (RIFF....WEBP).
func createWebPContent() []byte {
	// Minimal WebP file structure: RIFF header + WEBP + VP8 chunk
	content := make([]byte, 30)
	copy(content[0:4], "RIFF")
	// File size (little-endian, 22 bytes after RIFF header)
	content[4] = 22
	content[5] = 0
	content[6] = 0
	content[7] = 0
	copy(content[8:12], "WEBP")
	// VP8 chunk header
	copy(content[12:16], "VP8 ")
	content[16] = 10
	content[17] = 0
	content[18] = 0
	content[19] = 0
	// Minimal VP8 bitstream
	content[20] = 0x9D
	content[21] = 0x01
	content[22] = 0x2A
	// Width and height (1x1)
	content[23] = 0x01
	content[24] = 0x00
	content[25] = 0x01
	content[26] = 0x00
	return content
}

// inMemoryFile wraps a bytes.Reader to implement multipart.File.
type inMemoryFile struct {
	*bytes.Reader
}

func (f *inMemoryFile) Close() error { return nil }

func newInMemoryFile(data []byte) multipart.File {
	return &inMemoryFile{Reader: bytes.NewReader(data)}
}

// --- Tests for FileUploadService ----------------------------------------

func TestFileUploadService_Upload_JPEG(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	svc := NewFileUploadService(storage)

	content := createJPEGContent(100, 100)
	file := newInMemoryFile(content)
	header := createMultipartHeader("photo.jpg", content)

	result, err := svc.Upload(context.Background(), UploadTypeProductImage, file, header)
	require.NoError(t, err)
	require.NotNil(t, result)

	// Verify content-addressable filename.
	expectedHash := sha256.Sum256(content)
	expectedHashHex := hex.EncodeToString(expectedHash[:])
	assert.Equal(t, expectedHashHex, result.ContentHash)
	assert.Contains(t, result.StorageKey, expectedHashHex)
	assert.Contains(t, result.StorageKey, ".jpg")
	assert.Equal(t, int64(len(content)), result.Size)
	assert.NotEmpty(t, result.URL)
}

func TestFileUploadService_Upload_PNG(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	svc := NewFileUploadService(storage)

	content := createPNGContent(50, 50)
	file := newInMemoryFile(content)
	header := createMultipartHeader("image.png", content)

	result, err := svc.Upload(context.Background(), UploadTypeProductImage, file, header)
	require.NoError(t, err)
	require.NotNil(t, result)

	assert.Contains(t, result.StorageKey, ".png")
	assert.NotEmpty(t, result.ContentHash)
}

func TestFileUploadService_Upload_WebP(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	svc := NewFileUploadService(storage)

	content := createWebPContent()
	file := newInMemoryFile(content)
	header := createMultipartHeader("banner.webp", content)

	result, err := svc.Upload(context.Background(), UploadTypeBanner, file, header)
	require.NoError(t, err)
	require.NotNil(t, result)

	assert.Contains(t, result.StorageKey, ".webp")
}

func TestFileUploadService_Upload_RejectsUnsupportedFormat(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	svc := NewFileUploadService(storage)

	// Plain text content - not an image.
	content := []byte("this is not an image file")
	file := newInMemoryFile(content)
	header := createMultipartHeader("document.txt", content)

	result, err := svc.Upload(context.Background(), UploadTypeProductImage, file, header)
	assert.Nil(t, result)
	assert.ErrorIs(t, err, ErrUnsupportedImageFormat)
}

func TestFileUploadService_Upload_RejectsGIF(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	svc := NewFileUploadService(storage)

	// GIF magic bytes.
	content := []byte("GIF89a" + string(make([]byte, 100)))
	file := newInMemoryFile(content)
	header := createMultipartHeader("animation.gif", content)

	result, err := svc.Upload(context.Background(), UploadTypeProductImage, file, header)
	assert.Nil(t, result)
	assert.ErrorIs(t, err, ErrUnsupportedImageFormat)
}

func TestFileUploadService_Upload_ProductImageSizeLimit(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	svc := NewFileUploadService(storage)

	// Create content that exceeds 5MB.
	content := make([]byte, MaxProductImageSize+1)
	// Add JPEG magic bytes so format validation would pass.
	copy(content, []byte{0xFF, 0xD8, 0xFF, 0xE0})
	file := newInMemoryFile(content)
	header := createMultipartHeader("huge.jpg", content)

	result, err := svc.Upload(context.Background(), UploadTypeProductImage, file, header)
	assert.Nil(t, result)
	assert.ErrorIs(t, err, ErrFileTooLarge)
}

func TestFileUploadService_Upload_BannerSizeLimit(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	svc := NewFileUploadService(storage)

	// Create content that exceeds 2MB.
	content := make([]byte, MaxBannerSize+1)
	copy(content, []byte{0xFF, 0xD8, 0xFF, 0xE0})
	file := newInMemoryFile(content)
	header := createMultipartHeader("banner.jpg", content)

	result, err := svc.Upload(context.Background(), UploadTypeBanner, file, header)
	assert.Nil(t, result)
	assert.ErrorIs(t, err, ErrFileTooLarge)
}

func TestFileUploadService_Upload_TransferProofSizeLimit(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	svc := NewFileUploadService(storage)

	// Create content that exceeds 10MB.
	content := make([]byte, MaxTransferProofSize2+1)
	copy(content, []byte{0xFF, 0xD8, 0xFF, 0xE0})
	file := newInMemoryFile(content)
	header := createMultipartHeader("proof.jpg", content)

	result, err := svc.Upload(context.Background(), UploadTypeTransferProof, file, header)
	assert.Nil(t, result)
	assert.ErrorIs(t, err, ErrFileTooLarge)
}

func TestFileUploadService_Upload_WithinTransferProofLimit(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	svc := NewFileUploadService(storage)

	// A valid JPEG within the 10MB limit.
	content := createJPEGContent(200, 200)
	file := newInMemoryFile(content)
	header := createMultipartHeader("receipt.jpg", content)

	result, err := svc.Upload(context.Background(), UploadTypeTransferProof, file, header)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Contains(t, result.StorageKey, "transfer-proofs/")
}

func TestFileUploadService_Upload_ContentAddressable(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	svc := NewFileUploadService(storage)

	content := createJPEGContent(80, 80)

	// Upload the same content twice.
	file1 := newInMemoryFile(content)
	header1 := createMultipartHeader("first.jpg", content)
	result1, err := svc.Upload(context.Background(), UploadTypeProductImage, file1, header1)
	require.NoError(t, err)

	file2 := newInMemoryFile(content)
	header2 := createMultipartHeader("second.jpg", content)
	result2, err := svc.Upload(context.Background(), UploadTypeProductImage, file2, header2)
	require.NoError(t, err)

	// Same content should produce the same storage key (content-addressable).
	assert.Equal(t, result1.StorageKey, result2.StorageKey)
	assert.Equal(t, result1.ContentHash, result2.ContentHash)
}

func TestFileUploadService_Upload_DifferentSubdirs(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	svc := NewFileUploadService(storage)

	content := createPNGContent(10, 10)

	// Product image goes to "products/" subdir.
	file1 := newInMemoryFile(content)
	header1 := createMultipartHeader("img.png", content)
	result1, err := svc.Upload(context.Background(), UploadTypeProductImage, file1, header1)
	require.NoError(t, err)
	assert.Contains(t, result1.StorageKey, "products/")

	// Banner goes to "banners/" subdir.
	file2 := newInMemoryFile(content)
	header2 := createMultipartHeader("img.png", content)
	result2, err := svc.Upload(context.Background(), UploadTypeBanner, file2, header2)
	require.NoError(t, err)
	assert.Contains(t, result2.StorageKey, "banners/")
}

func TestFileUploadService_Upload_NilStorage(t *testing.T) {
	svc := NewFileUploadService(nil)

	content := createJPEGContent(10, 10)
	file := newInMemoryFile(content)
	header := createMultipartHeader("test.jpg", content)

	result, err := svc.Upload(context.Background(), UploadTypeProductImage, file, header)
	assert.Nil(t, result)
	assert.ErrorIs(t, err, ErrFileStorageNotConfigured)
}

func TestFileUploadService_Upload_EmptyFile(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	svc := NewFileUploadService(storage)

	content := []byte{}
	file := newInMemoryFile(content)
	header := createMultipartHeader("empty.jpg", content)

	result, err := svc.Upload(context.Background(), UploadTypeProductImage, file, header)
	assert.Nil(t, result)
	assert.ErrorIs(t, err, ErrUnsupportedImageFormat)
}

func TestFileUploadService_Upload_NilFile(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	svc := NewFileUploadService(storage)

	result, err := svc.Upload(context.Background(), UploadTypeProductImage, nil, nil)
	assert.Nil(t, result)
	assert.Error(t, err)
}

// --- Tests for validateImageFormat --------------------------------------

func TestValidateImageFormat_JPEG(t *testing.T) {
	content := createJPEGContent(10, 10)
	ext, err := validateImageFormat(content, "photo.jpg")
	require.NoError(t, err)
	assert.Equal(t, ".jpg", ext)
}

func TestValidateImageFormat_PNG(t *testing.T) {
	content := createPNGContent(10, 10)
	ext, err := validateImageFormat(content, "image.png")
	require.NoError(t, err)
	assert.Equal(t, ".png", ext)
}

func TestValidateImageFormat_WebP(t *testing.T) {
	content := createWebPContent()
	ext, err := validateImageFormat(content, "banner.webp")
	require.NoError(t, err)
	assert.Equal(t, ".webp", ext)
}

func TestValidateImageFormat_Rejects_TextFile(t *testing.T) {
	content := []byte("Hello, this is plain text content that is not an image.")
	_, err := validateImageFormat(content, "readme.txt")
	assert.ErrorIs(t, err, ErrUnsupportedImageFormat)
}

func TestValidateImageFormat_Rejects_Empty(t *testing.T) {
	_, err := validateImageFormat([]byte{}, "empty.jpg")
	assert.ErrorIs(t, err, ErrUnsupportedImageFormat)
}

// --- Tests for S3FileStorage URL generation -----------------------------

func TestS3FileStorage_URL_StandardAWS(t *testing.T) {
	s := &S3FileStorage{
		bucket:   "my-bucket",
		region:   "us-west-2",
		endpoint: "",
	}
	url := s.URL("products/abc123.jpg")
	assert.Equal(t, "https://my-bucket.s3.us-west-2.amazonaws.com/products/abc123.jpg", url)
}

func TestS3FileStorage_URL_MinIO(t *testing.T) {
	s := &S3FileStorage{
		bucket:   "uploads",
		region:   "us-east-1",
		endpoint: "http://minio:9000",
	}
	url := s.URL("products/abc123.jpg")
	assert.Equal(t, "http://minio:9000/uploads/products/abc123.jpg", url)
}

func TestS3FileStorage_URL_Empty(t *testing.T) {
	s := &S3FileStorage{
		bucket: "my-bucket",
		region: "us-east-1",
	}
	assert.Equal(t, "", s.URL(""))
}

// --- Tests for isWebP ---------------------------------------------------

func TestIsWebP_Valid(t *testing.T) {
	content := createWebPContent()
	assert.True(t, isWebP(content))
}

func TestIsWebP_Invalid(t *testing.T) {
	assert.False(t, isWebP([]byte("not a webp file")))
	assert.False(t, isWebP([]byte("RIFF")))
	assert.False(t, isWebP(nil))
}

// --- Tests for maxSizeForType -------------------------------------------

func TestMaxSizeForType(t *testing.T) {
	assert.Equal(t, int64(5*1024*1024), maxSizeForType(UploadTypeProductImage))
	assert.Equal(t, int64(10*1024*1024), maxSizeForType(UploadTypeTransferProof))
	assert.Equal(t, int64(2*1024*1024), maxSizeForType(UploadTypeBanner))
}

// --- Tests for subdirForType --------------------------------------------

func TestSubdirForType(t *testing.T) {
	assert.Equal(t, "products", subdirForType(UploadTypeProductImage))
	assert.Equal(t, "transfer-proofs", subdirForType(UploadTypeTransferProof))
	assert.Equal(t, "banners", subdirForType(UploadTypeBanner))
}
