package services

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"
	"time"
)

// S3FileStorage implements FileStorage by writing files to an AWS S3 or
// MinIO-compatible object store using raw HTTP requests (AWS Signature V4).
// It is suitable for multi-instance production deployments where all API
// replicas need access to the same uploaded files.
//
// This implementation uses the standard library HTTP client with AWS
// Signature V4 authentication, avoiding a heavy SDK dependency while
// remaining compatible with both AWS S3 and MinIO.
type S3FileStorage struct {
	httpClient *http.Client
	bucket     string
	region     string
	accessKey  string
	secretKey  string
	endpoint   string // non-empty for MinIO / custom endpoints
}

// S3Config holds the configuration needed to connect to S3 or MinIO.
type S3Config struct {
	Bucket    string
	Region    string
	AccessKey string
	SecretKey string
	Endpoint  string // For MinIO or custom S3-compatible endpoints
}

// NewS3FileStorage constructs an S3FileStorage backed by the given config.
// If Endpoint is set, the client targets that endpoint (for MinIO); otherwise
// it targets the standard AWS S3 endpoint for the configured region.
func NewS3FileStorage(cfg S3Config) (*S3FileStorage, error) {
	if cfg.Bucket == "" {
		return nil, fmt.Errorf("S3 bucket name is required")
	}
	if cfg.Region == "" {
		cfg.Region = "us-east-1"
	}
	if cfg.AccessKey == "" || cfg.SecretKey == "" {
		return nil, fmt.Errorf("S3 access key and secret key are required")
	}

	return &S3FileStorage{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		bucket:     cfg.Bucket,
		region:     cfg.Region,
		accessKey:  cfg.AccessKey,
		secretKey:  cfg.SecretKey,
		endpoint:   strings.TrimRight(cfg.Endpoint, "/"),
	}, nil
}

// Save uploads the content from r to S3 under the key <subdir>/<filename>.
// It returns the object key as the storage key.
func (s *S3FileStorage) Save(ctx context.Context, subdir, filename string, r io.Reader) (string, error) {
	if strings.TrimSpace(filename) == "" {
		return "", fmt.Errorf("%w: empty filename", ErrInvalidFileName)
	}
	if strings.ContainsAny(filename, `\`) {
		return "", fmt.Errorf("%w: %q", ErrInvalidFileName, filename)
	}

	// Build the S3 object key.
	key := filename
	if subdir != "" {
		key = path.Join(subdir, filename)
	}
	// Normalise to forward slashes (S3 uses / as delimiter).
	key = strings.ReplaceAll(key, `\`, "/")

	// Read all content into a buffer for the PUT request.
	content, err := io.ReadAll(r)
	if err != nil {
		return "", fmt.Errorf("failed to read file content: %w", err)
	}

	contentType := detectS3ContentType(filename, content)

	// Build the request URL.
	reqURL := s.buildObjectURL(key)

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, reqURL, bytes.NewReader(content))
	if err != nil {
		return "", fmt.Errorf("failed to create S3 request: %w", err)
	}

	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Cache-Control", "public, max-age=604800") // 7 days
	req.ContentLength = int64(len(content))

	// Sign the request with AWS Signature V4.
	s.signRequest(req, content)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to upload to S3: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("S3 upload failed with status %d: %s", resp.StatusCode, string(body))
	}

	return key, nil
}

// URL returns the public URL for the given storage key.
func (s *S3FileStorage) URL(key string) string {
	if key == "" {
		return ""
	}
	return s.buildObjectURL(key)
}

// buildObjectURL constructs the URL for an S3 object.
func (s *S3FileStorage) buildObjectURL(key string) string {
	if s.endpoint != "" {
		// MinIO / custom endpoint: path-style URL.
		return fmt.Sprintf("%s/%s/%s", s.endpoint, s.bucket, key)
	}
	// Standard AWS S3 virtual-hosted-style URL.
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s.bucket, s.region, key)
}

// signRequest signs an HTTP request using AWS Signature Version 4.
// This is a simplified implementation suitable for S3 PutObject operations.
func (s *S3FileStorage) signRequest(req *http.Request, payload []byte) {
	now := time.Now().UTC()
	dateStamp := now.Format("20060102")
	amzDate := now.Format("20060102T150405Z")

	req.Header.Set("X-Amz-Date", amzDate)
	req.Header.Set("Host", req.URL.Host)

	// Step 1: Create canonical request.
	payloadHash := sha256Hex(payload)
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)

	signedHeaders := "content-type;host;x-amz-content-sha256;x-amz-date"
	canonicalHeaders := fmt.Sprintf("content-type:%s\nhost:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n",
		req.Header.Get("Content-Type"),
		req.URL.Host,
		payloadHash,
		amzDate,
	)

	canonicalRequest := strings.Join([]string{
		req.Method,
		req.URL.Path,
		req.URL.RawQuery,
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	}, "\n")

	// Step 2: Create string to sign.
	credentialScope := fmt.Sprintf("%s/%s/s3/aws4_request", dateStamp, s.region)
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")

	// Step 3: Calculate signature.
	signingKey := getSignatureKey(s.secretKey, dateStamp, s.region, "s3")
	signature := hex.EncodeToString(hmacSHA256(signingKey, []byte(stringToSign)))

	// Step 4: Add authorization header.
	authHeader := fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		s.accessKey, credentialScope, signedHeaders, signature)
	req.Header.Set("Authorization", authHeader)
}

// sha256Hex returns the hex-encoded SHA-256 hash of the data.
func sha256Hex(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

// hmacSHA256 computes HMAC-SHA256.
func hmacSHA256(key, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}

// getSignatureKey derives the signing key for AWS Signature V4.
func getSignatureKey(secret, dateStamp, region, service string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secret), []byte(dateStamp))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte(service))
	kSigning := hmacSHA256(kService, []byte("aws4_request"))
	return kSigning
}

// detectS3ContentType determines the MIME type for the S3 object based on
// the filename extension, falling back to content sniffing.
func detectS3ContentType(filename string, content []byte) string {
	ext := strings.ToLower(path.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".pdf":
		return "application/pdf"
	default:
		if len(content) > 0 {
			return http.DetectContentType(content)
		}
		return "application/octet-stream"
	}
}
