package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDocsHandler(t *testing.T) {
	handler := DocsHandler()
	req := httptest.NewRequest(http.MethodGet, "/docs", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Header().Get("Content-Type"), "text/html") {
		t.Fatalf("expected text/html content type, got %s", rec.Header().Get("Content-Type"))
	}
	if !strings.Contains(rec.Body.String(), "SwaggerUIBundle") {
		t.Fatalf("expected response body to contain SwaggerUIBundle")
	}
}

func TestOpenAPISpecHandler(t *testing.T) {
	handler := OpenAPISpecHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/openapi.json", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Header().Get("Content-Type"), "application/json") {
		t.Fatalf("expected application/json content type, got %s", rec.Header().Get("Content-Type"))
	}
	if !strings.Contains(rec.Body.String(), "Coordinator • Downloads") {
		t.Fatalf("expected openapi spec to contain Coordinator tags")
	}
	if !strings.Contains(rec.Body.String(), "Storage • Media & Folders") {
		t.Fatalf("expected openapi spec to contain Storage tags")
	}
	if !strings.Contains(rec.Body.String(), "Download • Service") {
		t.Fatalf("expected openapi spec to contain Download service tags")
	}
}
