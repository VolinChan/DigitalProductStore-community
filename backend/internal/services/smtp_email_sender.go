package services

import (
	"bytes"
	"context"
	"embed"
	"errors"
	"fmt"
	"html/template"
	"net/smtp"
	"strings"
	"time"

	"github.com/digital-store/backend/pkg/logger"
)

// emailTemplates embeds all HTML templates used by SMTPEmailSender so
// the binary ships self-contained and tests don't need the filesystem.
//
//go:embed email_templates/*.html
var emailTemplates embed.FS

// Template name constants — these match the filenames under
// email_templates/ (without the .html extension).
const (
	tmplOrderConfirmation      = "order_confirmation"
	tmplPaymentConfirmation    = "payment_confirmation"
	tmplShippingNotification   = "shipping_notification"
	tmplPaymentRejection       = "payment_rejection"
	tmplOrderCancellation      = "order_cancellation"
	tmplPasswordReset          = "password_reset"
	tmplTransferDeadlineRemind = "transfer_deadline_reminder"
)

// SMTPConfig groups the SMTP credentials and sender identity for
// SMTPEmailSender. It is populated from config.EmailConfig in main.go.
type SMTPConfig struct {
	// Host is the SMTP server host (e.g. "smtp.sendgrid.net").
	Host string
	// Port is the SMTP server port (usually 587 for STARTTLS, 465 for
	// SMTPS, 25 for plain).
	Port int
	// Username for SMTP authentication. Leave empty to skip auth.
	Username string
	// Password for SMTP authentication.
	Password string
	// FromAddress is the envelope sender and From header value.
	FromAddress string
	// FromName is the display name used in the From header.
	FromName string
	// BrandName is rendered in templates and subject lines.
	BrandName string
	// PasswordResetBaseURL is prepended to the reset token when building
	// the link placed in the password reset email. The link is built
	// as <PasswordResetBaseURL>?token=<token>.
	PasswordResetBaseURL string
}

// Validate returns an error if the config is missing values required to
// actually send mail. Callers can fall back to NoopEmailSender when this
// fails.
func (c SMTPConfig) Validate() error {
	if c.Host == "" {
		return errors.New("smtp host is required")
	}
	if c.Port == 0 {
		return errors.New("smtp port is required")
	}
	if c.FromAddress == "" {
		return errors.New("from address is required")
	}
	return nil
}

// SMTPEmailSender implements EmailSender using net/smtp. It renders
// HTML templates embedded at build time and retries transient failures
// with exponential backoff (Requirement 21.6).
type SMTPEmailSender struct {
	cfg       SMTPConfig
	templates *template.Template
	log       *logger.Logger

	// sendFunc is the function used to actually dispatch an email. It is
	// pluggable so tests can swap in a mock. Defaults to smtp.SendMail.
	sendFunc func(addr string, auth smtp.Auth, from string, to []string, msg []byte) error

	// retryDelays controls the retry backoff schedule. Defaults to
	// {1s, 2s, 4s} meaning up to 3 total attempts (the first try plus
	// two retries with 1s and 2s waits; the third retry waits 4s).
	// len(retryDelays) == max attempts - 1.
	retryDelays []time.Duration
}

// retry schedule: total of 3 attempts, waits of 1s and 2s between them.
// This matches Requirement 21.6 ("retry up to 3 times with exponential
// backoff").
var defaultRetryDelays = []time.Duration{1 * time.Second, 2 * time.Second}

// NewSMTPEmailSender constructs an SMTPEmailSender. It parses and caches
// the embedded templates at construction time so rendering at send time
// is cheap.
func NewSMTPEmailSender(cfg SMTPConfig, log *logger.Logger) (*SMTPEmailSender, error) {
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid SMTP config: %w", err)
	}

	tmpls, err := template.ParseFS(emailTemplates, "email_templates/*.html")
	if err != nil {
		return nil, fmt.Errorf("parse email templates: %w", err)
	}

	if cfg.BrandName == "" {
		cfg.BrandName = cfg.FromName
	}
	if cfg.BrandName == "" {
		cfg.BrandName = "Digital Store"
	}

	return &SMTPEmailSender{
		cfg:         cfg,
		templates:   tmpls,
		log:         log,
		sendFunc:    smtp.SendMail,
		retryDelays: defaultRetryDelays,
	}, nil
}

// SendPasswordReset sends a password reset email with the reset link.
func (s *SMTPEmailSender) SendPasswordReset(ctx context.Context, email, token string) error {
	resetURL := token
	if s.cfg.PasswordResetBaseURL != "" {
		sep := "?"
		if strings.Contains(s.cfg.PasswordResetBaseURL, "?") {
			sep = "&"
		}
		resetURL = fmt.Sprintf("%s%stoken=%s", s.cfg.PasswordResetBaseURL, sep, token)
	}
	data := map[string]any{
		"BrandName": s.cfg.BrandName,
		"ResetURL":  resetURL,
		"Token":     token,
	}
	return s.renderAndSend(ctx, email, "重置您的密码", tmplPasswordReset, data)
}

// SendOrderConfirmation sends an order confirmation email.
func (s *SMTPEmailSender) SendOrderConfirmation(ctx context.Context, email, orderNumber string) error {
	return s.sendOrderEmail(ctx, email, orderNumber, "订单确认通知", tmplOrderConfirmation, nil)
}

// SendPaymentConfirmation sends a payment confirmation email.
func (s *SMTPEmailSender) SendPaymentConfirmation(ctx context.Context, email, orderNumber string) error {
	return s.sendOrderEmail(ctx, email, orderNumber, "支付确认通知", tmplPaymentConfirmation, nil)
}

// SendShippingNotification sends a shipping notification email with a
// tracking number (Requirement 21.3).
func (s *SMTPEmailSender) SendShippingNotification(ctx context.Context, email, orderNumber, trackingNumber string) error {
	extra := map[string]any{
		"TrackingNumber": trackingNumber,
	}
	return s.sendOrderEmail(ctx, email, orderNumber, "您的订单已发货", tmplShippingNotification, extra)
}

// SendPaymentRejection sends a payment rejection email.
func (s *SMTPEmailSender) SendPaymentRejection(ctx context.Context, email, orderNumber, reason string) error {
	extra := map[string]any{
		"Reason": reason,
	}
	return s.sendOrderEmail(ctx, email, orderNumber, "您的支付未通过", tmplPaymentRejection, extra)
}

// SendOrderCancellation sends an order cancellation email.
func (s *SMTPEmailSender) SendOrderCancellation(ctx context.Context, email, orderNumber string) error {
	return s.sendOrderEmail(ctx, email, orderNumber, "订单已取消", tmplOrderCancellation, nil)
}

// SendTransferDeadlineReminder sends a transfer deadline reminder email.
func (s *SMTPEmailSender) SendTransferDeadlineReminder(ctx context.Context, email, orderNumber string) error {
	return s.sendOrderEmail(ctx, email, orderNumber, "转账确认即将到期", tmplTransferDeadlineRemind, nil)
}

// sendOrderEmail merges the common order fields with optional extras
// and dispatches the email.
func (s *SMTPEmailSender) sendOrderEmail(ctx context.Context, email, orderNumber, subject, templateName string, extra map[string]any) error {
	data := map[string]any{
		"BrandName":   s.cfg.BrandName,
		"OrderNumber": orderNumber,
	}
	for k, v := range extra {
		data[k] = v
	}
	fullSubject := fmt.Sprintf("[%s] %s - %s", s.cfg.BrandName, subject, orderNumber)
	return s.renderAndSend(ctx, email, fullSubject, templateName, data)
}

// renderAndSend renders the given template with the given data and
// sends the resulting HTML email via sendWithRetry.
func (s *SMTPEmailSender) renderAndSend(ctx context.Context, to, subject, templateName string, data map[string]any) error {
	if to == "" {
		return errors.New("recipient email is required")
	}

	body, err := s.renderTemplate(templateName, data)
	if err != nil {
		return fmt.Errorf("render template %q: %w", templateName, err)
	}

	msg := s.buildMessage(to, subject, body)
	return s.sendWithRetry(ctx, to, msg)
}

// renderTemplate executes the named template (without .html extension)
// with data and returns the rendered bytes.
func (s *SMTPEmailSender) renderTemplate(name string, data map[string]any) ([]byte, error) {
	var buf bytes.Buffer
	// ParseFS names templates by filename (e.g. "order_confirmation.html").
	if err := s.templates.ExecuteTemplate(&buf, name+".html", data); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// buildMessage composes the raw RFC 822 message with HTML content type.
// A Date header is included because some SMTP servers will reject
// messages without one.
func (s *SMTPEmailSender) buildMessage(to, subject string, htmlBody []byte) []byte {
	from := s.cfg.FromAddress
	if s.cfg.FromName != "" {
		from = fmt.Sprintf("%s <%s>", s.cfg.FromName, s.cfg.FromAddress)
	}
	var b bytes.Buffer
	fmt.Fprintf(&b, "From: %s\r\n", from)
	fmt.Fprintf(&b, "To: %s\r\n", to)
	fmt.Fprintf(&b, "Subject: %s\r\n", subject)
	fmt.Fprintf(&b, "Date: %s\r\n", time.Now().UTC().Format(time.RFC1123Z))
	fmt.Fprint(&b, "MIME-Version: 1.0\r\n")
	fmt.Fprint(&b, "Content-Type: text/html; charset=\"UTF-8\"\r\n")
	fmt.Fprint(&b, "Content-Transfer-Encoding: 8bit\r\n")
	fmt.Fprint(&b, "\r\n")
	b.Write(htmlBody)
	return b.Bytes()
}

// sendWithRetry dispatches the email and retries on transient failures.
// It uses exponential backoff delays from s.retryDelays. If all
// attempts fail, the final error is returned.
//
// Requirement 21.6: retry up to 3 times with exponential backoff.
func (s *SMTPEmailSender) sendWithRetry(ctx context.Context, to string, msg []byte) error {
	addr := fmt.Sprintf("%s:%d", s.cfg.Host, s.cfg.Port)

	var auth smtp.Auth
	if s.cfg.Username != "" {
		auth = smtp.PlainAuth("", s.cfg.Username, s.cfg.Password, s.cfg.Host)
	}

	// Total attempts = len(retryDelays) + 1. With the default schedule
	// this yields 3 attempts.
	attempts := len(s.retryDelays) + 1
	var lastErr error

	for i := 0; i < attempts; i++ {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		err := s.sendFunc(addr, auth, s.cfg.FromAddress, []string{to}, msg)
		if err == nil {
			if i > 0 && s.log != nil {
				s.log.Infow("email sent after retries",
					"recipient", to,
					"attempts", i+1,
				)
			}
			return nil
		}
		lastErr = err
		if s.log != nil {
			s.log.Warnw("email send failed",
				"recipient", to,
				"attempt", i+1,
				"max_attempts", attempts,
				"error", err.Error(),
			)
		}
		if i < len(s.retryDelays) {
			delay := s.retryDelays[i]
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
		}
	}

	if s.log != nil {
		s.log.Errorw("email send gave up after retries",
			"recipient", to,
			"attempts", attempts,
			"error", lastErr.Error(),
		)
	}
	return fmt.Errorf("send email after %d attempts: %w", attempts, lastErr)
}
