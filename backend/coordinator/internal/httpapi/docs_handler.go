package httpapi

import (
	"net/http"
)

// SwaggerUIHTML returns a self-contained modern Swagger UI dashboard.
const SwaggerUIHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AppView API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5/favicon-32x32.png" sizes="32x32" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #0f1117; color: #e1e7ec; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .topbar { display: none !important; }
    .swagger-ui { color: #c9d1d9; }
    .swagger-ui .info .title { color: #58a6ff; }
    .swagger-ui .info p, .swagger-ui .info li { color: #8b949e; }
    .swagger-ui .scheme-container { background: #161b22; box-shadow: none; border-bottom: 1px solid #30363d; padding: 15px 0; }
    .swagger-ui .opblock { border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); border: 1px solid #30363d; background: #161b22; }
    .swagger-ui .opblock .opblock-summary { border-color: #30363d; }
    .swagger-ui .opblock .opblock-summary-method { border-radius: 6px; font-weight: 700; }
    .swagger-ui .opblock .opblock-summary-path { color: #f0f6fc; font-weight: 600; }
    .swagger-ui .opblock .opblock-summary-description { color: #8b949e; }
    .swagger-ui .opblock-tag { font-size: 18px; color: #58a6ff; border-bottom: 1px solid #30363d; margin-top: 24px; padding-bottom: 8px; }
    .swagger-ui section.models { border: 1px solid #30363d; border-radius: 8px; background: #161b22; }
    .swagger-ui section.models h4 { color: #8b949e; }
    .swagger-ui select, .swagger-ui input[type=text] { background: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius: 6px; }
    .swagger-ui .btn { border-radius: 6px; }
    .swagger-ui .response-col_status { color: #58a6ff; }
    .swagger-ui table thead tr td, .swagger-ui table thead tr th { color: #8b949e; border-bottom: 1px solid #30363d; }
    .swagger-ui .tab li button.tablinks { color: #8b949e; }
    .swagger-ui .tab li button.tablinks.active { color: #58a6ff; border-bottom: 2px solid #58a6ff; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`

// OpenAPISpecJSON is the OpenAPI 3.0 specification covering all three AppView backends.
const OpenAPISpecJSON = `{
  "openapi": "3.0.3",
  "info": {
    "title": "AppView Microservices API Documentation",
    "version": "1.0.0",
    "description": "Unified API specification for AppView LAN Media Architecture.\n\n### Backends breakdown:\n- **1. Coordinator Service (Go :8090)**: Orchestrates download-jobs, worker capabilities, and cookie storage RPC.\n- **2. Storage Service (Go Fiber :8080)**: Owns local media filesystem, folder CRUD, streaming, and batch jobs.\n- **3. Download Service (Python FastAPI :8000)**: Direct URL inspection/resolver worker and WebSocket broadcasts."
  },
  "servers": [
    {
      "url": "http://localhost:8090",
      "description": "Coordinator Service (Go - Port 8090)"
    },
    {
      "url": "http://localhost:8080",
      "description": "Storage Service (Go Fiber - Port 8080)"
    },
    {
      "url": "http://localhost:8000",
      "description": "Download Service (Python FastAPI - Port 8000)"
    }
  ],
  "tags": [
    { "name": "Coordinator • Downloads", "description": "Download job lifecycle and proxy APIs (Go Coordinator :8090)" },
    { "name": "Coordinator • Cookies", "description": "Cookie file verification and persistence (Go Coordinator :8090)" },
    { "name": "Coordinator • System", "description": "System health and generic task orchestration (Go Coordinator :8090)" },
    { "name": "Storage • Media & Folders", "description": "Local media browsing, streaming and folder CRUD (Go Storage :8080)" },
    { "name": "Storage • Jobs", "description": "Batch operations, archive extraction and video conversion (Go Storage :8080)" },
    { "name": "Download • Service", "description": "Direct URL resolution, task progress & WebSocket (Python Download :8000)" }
  ],
  "paths": {
    "/api/v1/download": {
      "post": {
        "tags": ["Coordinator • Downloads"],
        "summary": "[Coordinator] Create Download Job",
        "description": "Initiates a new two-stage download pipeline across Python Download and Go Storage.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["url", "destination"],
                "properties": {
                  "url": { "type": "string", "example": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
                  "destination": { "type": "string", "example": "/Downloads/Music" },
                  "drive": { "type": "string", "example": "SSD" },
                  "quality": { "type": "integer", "example": 1080 },
                  "mediaType": { "type": "string", "enum": ["video", "images", "text"], "example": "video" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Job created successfully" },
          "400": { "description": "Invalid payload" }
        }
      },
      "get": {
        "tags": ["Coordinator • Downloads"],
        "summary": "[Coordinator] List Download Jobs",
        "description": "Returns all active and historical download jobs.",
        "responses": {
          "200": { "description": "List of download jobs" }
        }
      }
    },
    "/api/v1/download/preview": {
      "post": {
        "tags": ["Coordinator • Downloads"],
        "summary": "[Coordinator] Preview Media Download",
        "description": "Resolves media metadata (title, qualities, thumbnails, multi-images) before downloading.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["url"],
                "properties": {
                  "url": { "type": "string", "example": "https://www.facebook.com/share/p/..." }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Metadata preview object" }
        }
      }
    },
    "/api/v1/download/{id}": {
      "get": {
        "tags": ["Coordinator • Downloads"],
        "summary": "[Coordinator] Get Download Job Details",
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "responses": {
          "200": { "description": "Detailed job state" },
          "404": { "description": "Job not found" }
        }
      },
      "delete": {
        "tags": ["Coordinator • Downloads"],
        "summary": "[Coordinator] Delete Download Job",
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "responses": {
          "200": { "description": "Job deleted" }
        }
      }
    },
    "/api/v1/download/{id}/cancel": {
      "post": {
        "tags": ["Coordinator • Downloads"],
        "summary": "[Coordinator] Cancel Download Job",
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "responses": {
          "200": { "description": "Job cancelled" }
        }
      }
    },
    "/api/v1/download/{id}/retry": {
      "post": {
        "tags": ["Coordinator • Downloads"],
        "summary": "[Coordinator] Retry Download Job",
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "responses": {
          "200": { "description": "Job re-queued" }
        }
      }
    },
    "/api/v1/download/{id}/extract": {
      "post": {
        "tags": ["Coordinator • Downloads"],
        "summary": "[Coordinator] Trigger Archive Extraction",
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "responses": {
          "200": { "description": "Extraction started" }
        }
      }
    },
    "/api/v1/download/proxy-image": {
      "get": {
        "tags": ["Coordinator • Downloads"],
        "summary": "[Coordinator] Image CORS Proxy",
        "parameters": [
          { "name": "url", "in": "query", "required": true, "schema": { "type": "string" } }
        ],
        "responses": {
          "200": { "description": "Binary image stream" }
        }
      }
    },
    "/api/v1/cookies/status": {
      "get": {
        "tags": ["Coordinator • Cookies"],
        "summary": "[Coordinator] Get Cookie File Status",
        "parameters": [
          { "name": "platform", "in": "query", "required": true, "schema": { "type": "string", "example": "youtube" } }
        ],
        "responses": {
          "200": { "description": "File existence and modification time" }
        }
      }
    },
    "/api/v1/cookies/verify": {
      "post": {
        "tags": ["Coordinator • Cookies"],
        "summary": "[Coordinator] Verify Cookies",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["platform"],
                "properties": {
                  "platform": { "type": "string", "example": "tiktok" },
                  "fields": { "type": "object" },
                  "cookies": { "type": "string" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Verification result" }
        }
      }
    },
    "/api/v1/cookies/save": {
      "post": {
        "tags": ["Coordinator • Cookies"],
        "summary": "[Coordinator] Save/Merge Cookies",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["platform"],
                "properties": {
                  "platform": { "type": "string", "example": "facebook" },
                  "fields": { "type": "object" },
                  "cookies": { "type": "string" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Saved successfully" }
        }
      }
    },
    "/api/v1/storage": {
      "get": {
        "tags": ["Coordinator • System"],
        "summary": "[Coordinator] Get Storage Volumes Info",
        "responses": {
          "200": { "description": "Drives and available space" }
        }
      }
    },
    "/health": {
      "get": {
        "tags": ["Coordinator • System"],
        "summary": "[Coordinator] Healthcheck & Worker Status",
        "responses": {
          "200": { "description": "System status and connected workers" }
        }
      }
    },
    "/api/v1/drives": {
      "get": {
        "tags": ["Storage • Media & Folders"],
        "summary": "[Storage] List Storage Drives",
        "responses": {
          "200": { "description": "List of available drives (SSD/HDD)" }
        }
      }
    },
    "/api/v1/folder": {
      "get": {
        "tags": ["Storage • Media & Folders"],
        "summary": "[Storage] Get Folder Contents",
        "parameters": [
          { "name": "path", "in": "query", "schema": { "type": "string" } },
          { "name": "drive", "in": "query", "schema": { "type": "string" } }
        ],
        "responses": {
          "200": { "description": "Folder hierarchy, files and pictures" }
        }
      },
      "post": {
        "tags": ["Storage • Media & Folders"],
        "summary": "[Storage] Create New Folder",
        "responses": {
          "200": { "description": "Folder created" }
        }
      },
      "delete": {
        "tags": ["Storage • Media & Folders"],
        "summary": "[Storage] Delete Folder",
        "responses": {
          "200": { "description": "Folder deleted" }
        }
      }
    },
    "/api/v1/tree-folder": {
      "get": {
        "tags": ["Storage • Media & Folders"],
        "summary": "[Storage] Get Recursive Folder Tree",
        "responses": {
          "200": { "description": "Full directory tree structure" }
        }
      }
    },
    "/api/v1/pictures/{drive}/{path}": {
      "get": {
        "tags": ["Storage • Media & Folders"],
        "summary": "[Storage] Serve Original Picture File",
        "parameters": [
          { "name": "drive", "in": "path", "required": true, "schema": { "type": "string" } },
          { "name": "path", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "responses": {
          "200": { "description": "Binary image stream" }
        }
      }
    },
    "/api/v1/thumbnails/{drive}/{path}": {
      "get": {
        "tags": ["Storage • Media & Folders"],
        "summary": "[Storage] Serve Lazy Thumbnail",
        "parameters": [
          { "name": "drive", "in": "path", "required": true, "schema": { "type": "string" } },
          { "name": "path", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "responses": {
          "200": { "description": "Thumbnail webp/jpeg stream" }
        }
      }
    },
    "/api/v1/videos/{drive}/{path}": {
      "get": {
        "tags": ["Storage • Media & Folders"],
        "summary": "[Storage] Stream Video (Range Requests)",
        "parameters": [
          { "name": "drive", "in": "path", "required": true, "schema": { "type": "string" } },
          { "name": "path", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "responses": {
          "206": { "description": "Partial content byte stream" }
        }
      }
    },
    "/api/v1/items/batch": {
      "post": {
        "tags": ["Storage • Jobs"],
        "summary": "[Storage] Batch Move/Copy/Delete Items",
        "responses": {
          "200": { "description": "Batch job queued" }
        }
      }
    },
    "/api/v1/jobs/convert": {
      "post": {
        "tags": ["Storage • Jobs"],
        "summary": "[Storage] Trigger Standalone Video Convert",
        "responses": {
          "200": { "description": "Convert job queued" }
        }
      }
    },
    "/api/v1/download/ws": {
      "get": {
        "tags": ["Download • Service"],
        "summary": "[Python Download] Realtime Task WebSocket",
        "description": "WebSocket endpoint broadcasting task progress, status changes and summary updates.",
        "responses": {
          "101": { "description": "Switching Protocols to WebSocket" }
        }
      }
    },
    "/api/v1/download/tasks": {
      "get": {
        "tags": ["Download • Service"],
        "summary": "[Python Download] Get In-Memory Tasks Summary",
        "responses": {
          "200": { "description": "Summary of active and historical tasks" }
        }
      }
    }
  }
}`

// DocsHandler returns the Swagger UI interactive web interface.
func DocsHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(SwaggerUIHTML))
	}
}

// OpenAPISpecHandler serves the JSON OpenAPI 3.0 specification.
func OpenAPISpecHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(OpenAPISpecJSON))
	}
}
