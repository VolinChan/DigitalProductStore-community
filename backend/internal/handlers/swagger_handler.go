package handlers

import (
	"encoding/json"
	"html/template"
	"net/http"

	"github.com/gin-gonic/gin"
)

// swaggerUITemplate is the HTML template for Swagger UI
const swaggerUITemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Store API Documentation</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
    <style>
        body { margin: 0; padding: 0; }
        .topbar { display: none; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: "{{.SpecURL}}",
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.SwaggerUIStandalonePreset
            ],
            layout: "BaseLayout"
        });
    </script>
</body>
</html>`

// SwaggerHandler serves Swagger UI and the OpenAPI spec
type SwaggerHandler struct {
	specJSON []byte
	tmpl     *template.Template
}

// NewSwaggerHandler creates a new swagger handler
func NewSwaggerHandler(specJSON []byte) *SwaggerHandler {
	tmpl := template.Must(template.New("swagger-ui").Parse(swaggerUITemplate))
	return &SwaggerHandler{
		specJSON: specJSON,
		tmpl:     tmpl,
	}
}

// ServeUI serves the Swagger UI HTML page
func (h *SwaggerHandler) ServeUI(c *gin.Context) {
	c.Header("Content-Type", "text/html; charset=utf-8")
	// Swagger UI loads CSS/JS from unpkg.com and runs an inline bootstrap
	// script. The global SecurityHeadersMiddleware sets a strict
	// `default-src 'self'` CSP that blocks both. Override it just for this
	// page with a scoped policy; business endpoints keep the strict one.
	c.Header("Content-Security-Policy",
		"default-src 'self'; "+
			"script-src 'self' 'unsafe-inline' https://unpkg.com; "+
			"style-src 'self' 'unsafe-inline' https://unpkg.com; "+
			"img-src 'self' data: https://unpkg.com; "+
			"font-src 'self' https://unpkg.com; "+
			"connect-src 'self'")
	data := struct {
		SpecURL string
	}{
		SpecURL: "/api/docs/swagger.json",
	}
	if err := h.tmpl.Execute(c.Writer, data); err != nil {
		c.String(http.StatusInternalServerError, "failed to render swagger UI")
	}
}

// ServeSpec serves the OpenAPI JSON specification.
// The static file has `host: localhost:8080` and explicit `schemes` baked
// in, which breaks "Try it out" when the API is reached via a reverse
// proxy (nginx, Kubernetes ingress, etc.). We strip both fields on the
// fly so Swagger UI falls back to the origin serving this doc page.
func (h *SwaggerHandler) ServeSpec(c *gin.Context) {
	c.Header("Content-Type", "application/json")
	c.Header("Cache-Control", "public, max-age=3600")

	var spec map[string]interface{}
	if err := json.Unmarshal(h.specJSON, &spec); err != nil {
		// Fall back to raw bytes if we somehow can't parse (shouldn't happen
		// because swag generates valid JSON).
		c.Data(http.StatusOK, "application/json", h.specJSON)
		return
	}
	delete(spec, "host")
	delete(spec, "schemes")
	c.JSON(http.StatusOK, spec)
}

// RegisterSwaggerRoutes registers swagger routes on the given router
func RegisterSwaggerRoutes(router *gin.Engine, specJSON []byte) {
	handler := NewSwaggerHandler(specJSON)
	router.GET("/api/docs", handler.ServeUI)
	router.GET("/api/docs/swagger.json", handler.ServeSpec)
}
