package services

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"image"
	"image/jpeg"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests for ImageProcessor -------------------------------------------

func TestImageProcessor_ProcessImage_JPEG(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	processor := NewImageProcessor(storage)

	// Create a 1000x600 JPEG image (landscape).
	content := createJPEGContent(1000, 600)

	result, err := processor.ProcessImage(context.Background(), content, "products")
	require.NoError(t, err)
	require.NotNil(t, result)

	// Verify thumbnail was generated.
	require.NotNil(t, result.Thumbnail)
	assert.True(t, result.Thumbnail.Width <= ThumbnailMaxWidth)
	assert.True(t, result.Thumbnail.Height <= ThumbnailMaxHeight)
	assert.Contains(t, result.Thumbnail.StorageKey, "_thumb.jpg")
	assert.NotEmpty(t, result.Thumbnail.URL)

	// Verify medium was generated.
	require.NotNil(t, result.Medium)
	assert.True(t, result.Medium.Width <= MediumMaxWidth)
	assert.True(t, result.Medium.Height <= MediumMaxHeight)
	assert.Contains(t, result.Medium.StorageKey, "_medium.jpg")
	assert.NotEmpty(t, result.Medium.URL)
}

func TestImageProcessor_ProcessImage_PNG(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	processor := NewImageProcessor(storage)

	// Create a 500x500 PNG image (square).
	content := createPNGContent(500, 500)

	result, err := processor.ProcessImage(context.Background(), content, "products")
	require.NoError(t, err)
	require.NotNil(t, result)

	// Thumbnail should be 200x200 (square fits perfectly).
	require.NotNil(t, result.Thumbnail)
	assert.Equal(t, 200, result.Thumbnail.Width)
	assert.Equal(t, 200, result.Thumbnail.Height)

	// Medium should be 500x500 (no upscaling).
	require.NotNil(t, result.Medium)
	assert.Equal(t, 500, result.Medium.Width)
	assert.Equal(t, 500, result.Medium.Height)
}

func TestImageProcessor_ProcessImage_LandscapeAspectRatio(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	processor := NewImageProcessor(storage)

	// Create a 1600x900 image (16:9 landscape).
	content := createJPEGContent(1600, 900)

	result, err := processor.ProcessImage(context.Background(), content, "products")
	require.NoError(t, err)
	require.NotNil(t, result)

	// Thumbnail: width should be the limiting factor.
	// 200/1600 = 0.125, 200/900 = 0.222 → scale = 0.125
	// Target: 200x112
	require.NotNil(t, result.Thumbnail)
	assert.Equal(t, 200, result.Thumbnail.Width)
	assert.True(t, result.Thumbnail.Height <= ThumbnailMaxHeight)
	assert.True(t, result.Thumbnail.Height > 0)

	// Medium: width should be the limiting factor.
	// 800/1600 = 0.5, 800/900 = 0.888 → scale = 0.5
	// Target: 800x450
	require.NotNil(t, result.Medium)
	assert.Equal(t, 800, result.Medium.Width)
	assert.Equal(t, 450, result.Medium.Height)
}

func TestImageProcessor_ProcessImage_PortraitAspectRatio(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	processor := NewImageProcessor(storage)

	// Create a 600x1200 image (portrait).
	content := createJPEGContent(600, 1200)

	result, err := processor.ProcessImage(context.Background(), content, "products")
	require.NoError(t, err)
	require.NotNil(t, result)

	// Thumbnail: height should be the limiting factor.
	// 200/600 = 0.333, 200/1200 = 0.166 → scale = 0.166
	// Target: 100x200
	require.NotNil(t, result.Thumbnail)
	assert.True(t, result.Thumbnail.Width <= ThumbnailMaxWidth)
	assert.Equal(t, 200, result.Thumbnail.Height)

	// Medium: height should be the limiting factor.
	// 800/600 = 1.333, 800/1200 = 0.666 → scale = 0.666
	// Target: 400x800
	require.NotNil(t, result.Medium)
	assert.Equal(t, 400, result.Medium.Width)
	assert.Equal(t, 800, result.Medium.Height)
}

func TestImageProcessor_ProcessImage_SmallImage_NoUpscale(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	processor := NewImageProcessor(storage)

	// Create a 150x100 image (smaller than both thumbnail and medium).
	content := createJPEGContent(150, 100)

	result, err := processor.ProcessImage(context.Background(), content, "products")
	require.NoError(t, err)
	require.NotNil(t, result)

	// Thumbnail should not upscale - keep original dimensions.
	require.NotNil(t, result.Thumbnail)
	assert.Equal(t, 150, result.Thumbnail.Width)
	assert.Equal(t, 100, result.Thumbnail.Height)

	// Medium should not upscale - keep original dimensions.
	require.NotNil(t, result.Medium)
	assert.Equal(t, 150, result.Medium.Width)
	assert.Equal(t, 100, result.Medium.Height)
}

func TestImageProcessor_ProcessImage_ContentAddressable(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	processor := NewImageProcessor(storage)

	content := createJPEGContent(400, 300)

	// Process the same image twice.
	result1, err := processor.ProcessImage(context.Background(), content, "products")
	require.NoError(t, err)

	result2, err := processor.ProcessImage(context.Background(), content, "products")
	require.NoError(t, err)

	// Same content should produce the same storage keys (content-addressable).
	assert.Equal(t, result1.Thumbnail.StorageKey, result2.Thumbnail.StorageKey)
	assert.Equal(t, result1.Medium.StorageKey, result2.Medium.StorageKey)
}

func TestImageProcessor_ProcessImage_NilStorage(t *testing.T) {
	processor := NewImageProcessor(nil)

	content := createJPEGContent(100, 100)
	result, err := processor.ProcessImage(context.Background(), content, "products")
	assert.Nil(t, result)
	assert.ErrorIs(t, err, ErrFileStorageNotConfigured)
}

func TestImageProcessor_ProcessImage_EmptyContent(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	processor := NewImageProcessor(storage)

	result, err := processor.ProcessImage(context.Background(), []byte{}, "products")
	assert.Nil(t, result)
	assert.Error(t, err)
}

func TestImageProcessor_ProcessImage_InvalidContent(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	processor := NewImageProcessor(storage)

	result, err := processor.ProcessImage(context.Background(), []byte("not an image"), "products")
	assert.Nil(t, result)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to decode image")
}

func TestImageProcessor_ProcessImage_VariantFilenameFormat(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "/uploads")
	processor := NewImageProcessor(storage)

	content := createJPEGContent(300, 300)

	result, err := processor.ProcessImage(context.Background(), content, "products")
	require.NoError(t, err)

	// Verify the filename format: {hash}_thumb.jpg and {hash}_medium.jpg
	// The hash is of the variant content, not the original.
	assert.Contains(t, result.Thumbnail.StorageKey, "products/")
	assert.Contains(t, result.Thumbnail.StorageKey, "_thumb.jpg")
	assert.Contains(t, result.Medium.StorageKey, "products/")
	assert.Contains(t, result.Medium.StorageKey, "_medium.jpg")

	// Verify the hash in the filename is a valid SHA-256 hex string (64 chars).
	// Extract hash from storage key like "products/{hash}_thumb.jpg"
	thumbKey := result.Thumbnail.StorageKey
	// Remove "products/" prefix and "_thumb.jpg" suffix.
	hashPart := thumbKey[len("products/") : len(thumbKey)-len("_thumb.jpg")]
	assert.Len(t, hashPart, 64) // SHA-256 hex is 64 characters
}

// --- Tests for fitDimensions -------------------------------------------

func TestFitDimensions_Landscape(t *testing.T) {
	// 1000x500 into 200x200 → scale by width: 200/1000 = 0.2 → 200x100
	w, h := fitDimensions(1000, 500, 200, 200)
	assert.Equal(t, 200, w)
	assert.Equal(t, 100, h)
}

func TestFitDimensions_Portrait(t *testing.T) {
	// 500x1000 into 200x200 → scale by height: 200/1000 = 0.2 → 100x200
	w, h := fitDimensions(500, 1000, 200, 200)
	assert.Equal(t, 100, w)
	assert.Equal(t, 200, h)
}

func TestFitDimensions_Square(t *testing.T) {
	// 1000x1000 into 200x200 → scale: 0.2 → 200x200
	w, h := fitDimensions(1000, 1000, 200, 200)
	assert.Equal(t, 200, w)
	assert.Equal(t, 200, h)
}

func TestFitDimensions_AlreadySmaller(t *testing.T) {
	// 100x50 into 200x200 → scale: 2.0 (but we don't upscale in ProcessImage)
	// fitDimensions itself just calculates the fit.
	w, h := fitDimensions(100, 50, 200, 200)
	assert.Equal(t, 200, w)
	assert.Equal(t, 100, h)
}

func TestFitDimensions_ZeroDimensions(t *testing.T) {
	w, h := fitDimensions(0, 0, 200, 200)
	assert.Equal(t, 200, w)
	assert.Equal(t, 200, h)
}

func TestFitDimensions_NonSquareTarget(t *testing.T) {
	// 1600x900 into 800x800 → scaleW=0.5, scaleH=0.888 → scale=0.5 → 800x450
	w, h := fitDimensions(1600, 900, 800, 800)
	assert.Equal(t, 800, w)
	assert.Equal(t, 450, h)
}

// --- Tests for decodeImage ----------------------------------------------

func TestDecodeImage_JPEG(t *testing.T) {
	content := createJPEGContent(100, 80)
	img, err := decodeImage(content)
	require.NoError(t, err)
	require.NotNil(t, img)
	assert.Equal(t, 100, img.Bounds().Dx())
	assert.Equal(t, 80, img.Bounds().Dy())
}

func TestDecodeImage_PNG(t *testing.T) {
	content := createPNGContent(60, 40)
	img, err := decodeImage(content)
	require.NoError(t, err)
	require.NotNil(t, img)
	assert.Equal(t, 60, img.Bounds().Dx())
	assert.Equal(t, 40, img.Bounds().Dy())
}

func TestDecodeImage_Invalid(t *testing.T) {
	img, err := decodeImage([]byte("not an image"))
	assert.Nil(t, img)
	assert.Error(t, err)
}

// --- Tests for resizeImage ----------------------------------------------

func TestResizeImage(t *testing.T) {
	// Create a source image.
	src := image.NewRGBA(image.Rect(0, 0, 400, 300))
	resized := resizeImage(src, 200, 150)
	assert.Equal(t, 200, resized.Bounds().Dx())
	assert.Equal(t, 150, resized.Bounds().Dy())
}

// --- Tests for UploadWithProcessing -------------------------------------

func TestUploadWithProcessing_Success(t *testing.T) {
	tmpDir := t.TempDir()
	storage := NewLocalFileStorage(tmpDir, "/uploads")
	uploadSvc := NewFileUploadService(storage)
	processor := NewImageProcessor(storage)

	content := createJPEGContent(1000, 800)
	file := newInMemoryFile(content)
	header := createMultipartHeader("product.jpg", content)

	result, err := UploadWithProcessing(
		context.Background(),
		uploadSvc,
		processor,
		UploadTypeProductImage,
		file,
		header,
		content,
	)
	require.NoError(t, err)
	require.NotNil(t, result)

	// Original should be stored.
	require.NotNil(t, result.Original)
	expectedHash := sha256.Sum256(content)
	assert.Equal(t, hex.EncodeToString(expectedHash[:]), result.Original.ContentHash)

	// Thumbnail should be generated.
	require.NotNil(t, result.Thumbnail)
	assert.True(t, result.Thumbnail.Width <= ThumbnailMaxWidth)
	assert.True(t, result.Thumbnail.Height <= ThumbnailMaxHeight)

	// Medium should be generated.
	require.NotNil(t, result.Medium)
	assert.True(t, result.Medium.Width <= MediumMaxWidth)
	assert.True(t, result.Medium.Height <= MediumMaxHeight)
}

func TestUploadWithProcessing_NilProcessor(t *testing.T) {
	tmpDir := t.TempDir()
	storage := NewLocalFileStorage(tmpDir, "/uploads")
	uploadSvc := NewFileUploadService(storage)

	content := createJPEGContent(100, 100)
	file := newInMemoryFile(content)
	header := createMultipartHeader("photo.jpg", content)

	result, err := UploadWithProcessing(
		context.Background(),
		uploadSvc,
		nil, // no processor
		UploadTypeProductImage,
		file,
		header,
		content,
	)
	require.NoError(t, err)
	require.NotNil(t, result)

	// Original should be stored.
	require.NotNil(t, result.Original)

	// No variants when processor is nil.
	assert.Nil(t, result.Thumbnail)
	assert.Nil(t, result.Medium)
}

func TestUploadWithProcessing_NilUploadService(t *testing.T) {
	content := createJPEGContent(100, 100)
	file := newInMemoryFile(content)
	header := createMultipartHeader("photo.jpg", content)

	result, err := UploadWithProcessing(
		context.Background(),
		nil,
		nil,
		UploadTypeProductImage,
		file,
		header,
		content,
	)
	assert.Nil(t, result)
	assert.Error(t, err)
}

// --- Tests for PNG output quality verification --------------------------

func TestImageProcessor_OutputIsValidJPEG(t *testing.T) {
	tmpDir := t.TempDir()
	storage := NewLocalFileStorage(tmpDir, "/uploads")
	processor := NewImageProcessor(storage)

	// Use a PNG source to verify it gets converted to JPEG.
	content := createPNGContent(400, 300)

	result, err := processor.ProcessImage(context.Background(), content, "products")
	require.NoError(t, err)

	// Read the stored thumbnail file and verify it's valid JPEG.
	thumbContent := readStoredFile(t, tmpDir, result.Thumbnail.StorageKey)
	_, err = jpeg.Decode(bytes.NewReader(thumbContent))
	assert.NoError(t, err, "thumbnail should be valid JPEG")

	// Read the stored medium file and verify it's valid JPEG.
	mediumContent := readStoredFile(t, tmpDir, result.Medium.StorageKey)
	_, err = jpeg.Decode(bytes.NewReader(mediumContent))
	assert.NoError(t, err, "medium should be valid JPEG")
}

// readStoredFile reads a file from the storage directory by its key.
func readStoredFile(t *testing.T, baseDir, key string) []byte {
	t.Helper()
	filePath := filepath.Join(baseDir, key)
	content, err := os.ReadFile(filePath)
	require.NoError(t, err)
	return content
}
