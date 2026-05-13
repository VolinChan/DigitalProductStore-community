package services

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"mime/multipart"

	"golang.org/x/image/draw"
	"golang.org/x/image/webp"
)

// ImageVariant represents a resized version of an uploaded image.
type ImageVariant struct {
	// StorageKey is the internal key for the variant in the storage backend.
	StorageKey string `json:"storage_key"`

	// URL is the client-facing URL to access the variant.
	URL string `json:"url"`

	// Width is the actual width of the generated variant.
	Width int `json:"width"`

	// Height is the actual height of the generated variant.
	Height int `json:"height"`
}

// ImageProcessResult contains the results of processing an uploaded image,
// including the original upload result and generated variants.
type ImageProcessResult struct {
	// Original is the upload result for the original image.
	Original *UploadResult `json:"original"`

	// Thumbnail is the 200x200 max variant (maintains aspect ratio).
	Thumbnail *ImageVariant `json:"thumbnail,omitempty"`

	// Medium is the 800x800 max variant (maintains aspect ratio).
	Medium *ImageVariant `json:"medium,omitempty"`
}

// ImageProcessor handles image resizing and variant generation.
// It generates thumbnail (200x200) and medium (800x800) versions of
// uploaded images, storing them with content-addressable filenames.
type ImageProcessor struct {
	storage FileStorage
}

// NewImageProcessor creates an ImageProcessor backed by the given storage.
func NewImageProcessor(storage FileStorage) *ImageProcessor {
	return &ImageProcessor{storage: storage}
}

// Thumbnail and medium size constraints.
const (
	ThumbnailMaxWidth  = 200
	ThumbnailMaxHeight = 200
	MediumMaxWidth     = 800
	MediumMaxHeight    = 800
)

// ProcessImage decodes the given image content, generates thumbnail and
// medium variants, and stores them alongside the original. The variants
// are output as JPEG for consistent file sizes.
//
// The naming convention uses content-addressable storage:
//   - Thumbnail: {hash}_thumb.jpg
//   - Medium: {hash}_medium.jpg
//
// where {hash} is the SHA-256 hash of the variant's content.
func (p *ImageProcessor) ProcessImage(
	ctx context.Context,
	content []byte,
	subdir string,
) (*ImageProcessResult, error) {
	if p.storage == nil {
		return nil, ErrFileStorageNotConfigured
	}
	if len(content) == 0 {
		return nil, fmt.Errorf("empty image content")
	}

	// Decode the source image.
	src, err := decodeImage(content)
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	result := &ImageProcessResult{}

	// Generate thumbnail (200x200 max).
	thumbVariant, err := p.generateVariant(ctx, src, ThumbnailMaxWidth, ThumbnailMaxHeight, "thumb", subdir)
	if err != nil {
		return nil, fmt.Errorf("failed to generate thumbnail: %w", err)
	}
	result.Thumbnail = thumbVariant

	// Generate medium (800x800 max).
	mediumVariant, err := p.generateVariant(ctx, src, MediumMaxWidth, MediumMaxHeight, "medium", subdir)
	if err != nil {
		return nil, fmt.Errorf("failed to generate medium variant: %w", err)
	}
	result.Medium = mediumVariant

	return result, nil
}

// generateVariant resizes the source image to fit within maxWidth x maxHeight
// (maintaining aspect ratio), encodes it as JPEG, and stores it with a
// content-addressable filename.
func (p *ImageProcessor) generateVariant(
	ctx context.Context,
	src image.Image,
	maxWidth, maxHeight int,
	suffix string,
	subdir string,
) (*ImageVariant, error) {
	// Calculate the target dimensions maintaining aspect ratio.
	srcBounds := src.Bounds()
	srcWidth := srcBounds.Dx()
	srcHeight := srcBounds.Dy()

	targetWidth, targetHeight := fitDimensions(srcWidth, srcHeight, maxWidth, maxHeight)

	// If the source is already smaller than or equal to the target, use
	// the source dimensions (don't upscale).
	if srcWidth <= maxWidth && srcHeight <= maxHeight {
		targetWidth = srcWidth
		targetHeight = srcHeight
	}

	// Resize the image using high-quality CatmullRom interpolation.
	resized := resizeImage(src, targetWidth, targetHeight)

	// Encode as JPEG.
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, resized, &jpeg.Options{Quality: 85}); err != nil {
		return nil, fmt.Errorf("failed to encode variant as JPEG: %w", err)
	}

	variantContent := buf.Bytes()

	// Compute SHA-256 hash for content-addressable filename.
	hash := sha256.Sum256(variantContent)
	hashHex := hex.EncodeToString(hash[:])
	filename := hashHex + "_" + suffix + ".jpg"

	// Store the variant.
	reader := newBytesReader(variantContent)
	storageKey, err := p.storage.Save(ctx, subdir, filename, reader)
	if err != nil {
		return nil, fmt.Errorf("failed to store variant: %w", err)
	}

	return &ImageVariant{
		StorageKey: storageKey,
		URL:        p.storage.URL(storageKey),
		Width:      targetWidth,
		Height:     targetHeight,
	}, nil
}

// fitDimensions calculates the target width and height to fit within
// maxWidth x maxHeight while maintaining the original aspect ratio.
func fitDimensions(srcWidth, srcHeight, maxWidth, maxHeight int) (int, int) {
	if srcWidth <= 0 || srcHeight <= 0 {
		return maxWidth, maxHeight
	}

	// Calculate scale factors for both dimensions.
	scaleW := float64(maxWidth) / float64(srcWidth)
	scaleH := float64(maxHeight) / float64(srcHeight)

	// Use the smaller scale to ensure the image fits within both constraints.
	scale := scaleW
	if scaleH < scaleW {
		scale = scaleH
	}

	targetWidth := int(float64(srcWidth) * scale)
	targetHeight := int(float64(srcHeight) * scale)

	// Ensure at least 1 pixel in each dimension.
	if targetWidth < 1 {
		targetWidth = 1
	}
	if targetHeight < 1 {
		targetHeight = 1
	}

	return targetWidth, targetHeight
}

// resizeImage resizes the source image to the given dimensions using
// CatmullRom interpolation for high quality.
func resizeImage(src image.Image, width, height int) image.Image {
	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)
	return dst
}

// decodeImage attempts to decode the image content. It supports JPEG, PNG,
// and WebP formats.
func decodeImage(content []byte) (image.Image, error) {
	reader := bytes.NewReader(content)

	// Try standard image.Decode first (handles JPEG and PNG via registered decoders).
	img, _, err := image.Decode(reader)
	if err == nil {
		return img, nil
	}

	// If standard decode fails, try WebP explicitly.
	reader.Reset(content)
	img, err = webp.Decode(reader)
	if err == nil {
		return img, nil
	}

	return nil, fmt.Errorf("unsupported image format: unable to decode")
}

// Ensure standard image decoders are registered.
func init() {
	// image/jpeg and image/png are registered by importing them.
	// The blank imports ensure their init() functions run.
	_ = jpeg.Encode
	_ = png.Encode
}

// UploadWithProcessing uploads an image and generates thumbnail and medium
// variants. This is a convenience method that combines FileUploadService.Upload
// with ImageProcessor.ProcessImage.
func UploadWithProcessing(
	ctx context.Context,
	uploadSvc *FileUploadService,
	processor *ImageProcessor,
	uploadType UploadType,
	file multipart.File,
	header *multipart.FileHeader,
	content []byte,
) (*ImageProcessResult, error) {
	if uploadSvc == nil {
		return nil, fmt.Errorf("upload service is required")
	}

	// Upload the original.
	uploadResult, err := uploadSvc.Upload(ctx, uploadType, file, header)
	if err != nil {
		return nil, fmt.Errorf("failed to upload original: %w", err)
	}

	result := &ImageProcessResult{
		Original: uploadResult,
	}

	// Process variants if processor is available.
	if processor != nil {
		subdir := subdirForType(uploadType)
		processResult, err := processor.ProcessImage(ctx, content, subdir)
		if err != nil {
			// Log the error but don't fail the upload - variants are best-effort.
			// The original was already stored successfully.
			return result, nil
		}
		result.Thumbnail = processResult.Thumbnail
		result.Medium = processResult.Medium
	}

	return result, nil
}
