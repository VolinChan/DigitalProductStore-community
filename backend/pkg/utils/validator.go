package utils

import (
	"regexp"
	"strings"
	"unicode"
)

// Validator provides validation utilities
type Validator struct{}

// NewValidator creates a new validator instance
func NewValidator() *Validator {
	return &Validator{}
}

// IsEmail validates email format
func (v *Validator) IsEmail(email string) bool {
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(email)
}

// IsPhone validates phone number format (E.164)
func (v *Validator) IsPhone(phone string) bool {
	phoneRegex := regexp.MustCompile(`^\+?[1-9]\d{1,14}$`)
	return phoneRegex.MatchString(strings.ReplaceAll(phone, " ", ""))
}

// IsStrongPassword checks if password meets security requirements
func (v *Validator) IsStrongPassword(password string) bool {
	if len(password) < 8 || len(password) > 72 {
		return false
	}

	var hasUpper, hasLower, hasNumber, hasSpecial bool
	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsNumber(char):
			hasNumber = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	return hasUpper && hasLower && hasNumber && hasSpecial
}

// MinLength checks if string has minimum length
func (v *Validator) MinLength(s string, min int) bool {
	return len(s) >= min
}

// MaxLength checks if string has maximum length
func (v *Validator) MaxLength(s string, max int) bool {
	return len(s) <= max
}

// InRange checks if value is within range
func (v *Validator) InRange(value, min, max int) bool {
	return value >= min && value <= max
}

// IsEmpty checks if string is empty or whitespace only
func (v *Validator) IsEmpty(s string) bool {
	return strings.TrimSpace(s) == ""
}

// SanitizeString removes leading/trailing whitespace
func (v *Validator) SanitizeString(s string) string {
	return strings.TrimSpace(s)
}

// SanitizeAndValidateEmail sanitizes and validates email
func (v *Validator) SanitizeAndValidateEmail(email string) (string, bool) {
	email = strings.ToLower(strings.TrimSpace(email))
	return email, v.IsEmail(email)
}
