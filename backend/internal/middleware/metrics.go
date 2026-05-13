// Package middleware contains cross-cutting HTTP concerns such as auth, CORS,
// rate limiting, error handling, and observability.
//
// This file wires Prometheus instrumentation for incoming HTTP traffic. The
// collectors registered here populate the `/metrics` endpoint scraped by the
// `digital-store-api` job in `monitoring/prometheus/prometheus.yml`, which in
// turn feeds the Grafana dashboard shipped under `monitoring/grafana`.
//
// Scope is deliberately minimal: request counts and latencies labeled by
// method, route template, and status. Domain metrics (orders, payments,
// inventory) can be layered on top later without touching this file.
package middleware

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// httpRequestsTotal counts every HTTP request handled by the server, labeled
// with the HTTP method, the Gin route template (not the raw path, to keep
// cardinality bounded), and the response status code.
var httpRequestsTotal = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total number of HTTP requests processed, labeled by method, route template, and status code.",
	},
	[]string{"method", "path", "status"},
)

// httpRequestDuration observes request latency in seconds. The default
// buckets cover typical web traffic (5ms to 10s); adjust if the service
// grows much slower or faster tail behaviour.
var httpRequestDuration = prometheus.NewHistogramVec(
	prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request latency in seconds, labeled by method, route template, and status code.",
		Buckets: prometheus.DefBuckets,
	},
	[]string{"method", "path", "status"},
)

func init() {
	prometheus.MustRegister(httpRequestsTotal, httpRequestDuration)
}

// MetricsMiddleware records a count and latency observation for each request
// handled by the Gin engine. It uses the matched route template (e.g.
// "/api/v1/products/:id") as the `path` label so high-cardinality dynamic
// segments do not blow up the time series.
func MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		// Prefer the matched route template over the raw request path to
		// avoid unbounded label cardinality from path parameters. Requests
		// that did not match any route (404s) are bucketed under
		// "unmatched".
		routePath := c.FullPath()
		if routePath == "" {
			routePath = "unmatched"
		}

		status := strconv.Itoa(c.Writer.Status())
		elapsed := time.Since(start).Seconds()

		httpRequestsTotal.WithLabelValues(c.Request.Method, routePath, status).Inc()
		httpRequestDuration.WithLabelValues(c.Request.Method, routePath, status).Observe(elapsed)
	}
}

// PrometheusHandler returns a Gin handler that serves the Prometheus exposition
// format at `/metrics`. It wraps the default `promhttp.Handler()`.
func PrometheusHandler() gin.HandlerFunc {
	h := promhttp.Handler()
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}
