# Docuscribe API Documentation

## 1. List Documentations

**Endpoint:** `GET /api/documentations`

**Description:**
Returns a list of all unique documentation names (document titles) and their aggregated hashtags.

**Query Parameters:**
- `limit` (optional, default: 100, max: 1000): Maximum number of results.
- `offset` (optional, default: 0): Pagination offset.

**Example Request:**
```sh
curl -s 'http://localhost:9002/api/documentations?limit=50&offset=0' | jq
```

**Example Response:**
```json
{
  "compilations": [
    { "name": "PocketFlow", "hashtags": ["ml", "optimization"] },
    { "name": "React", "hashtags": ["frontend", "ui"] }
  ]
}
```

---

## 2. Get Documentation by Name

**Endpoint:** `GET /api/documentations/:name`

**Description:**
Returns the first document whose title matches `:name` (case-insensitive, exact match). The response omits the `image` field.

**Path Parameter:**
- `name`: Documentation name (URL-encoded, case-insensitive).

**Example Request:**
```sh
curl -s 'http://localhost:9002/api/documentations/pocketflow' | jq
curl -s 'http://localhost:9002/api/documentations/PocketFlow' | jq
```

**Example Response:**
```json
{
  "document": {
    "id": 1,
    "title": "PocketFlow",
    "url": "https://pocketflow.ai/",
    "aiHint": "web document compilation",
    "content": "...markdown...",
    "hashtags": ["ml", "optimization"],
    "lastUpdated": "2025-08-23T12:34:56.789Z",
    "schedule": "none",
    "maxPages": 5
  }
}
```

**Error Responses:**
- 404 Not Found: `{ "error": "Not found" }`
  - 400 Bad Request: `{ "error": "Missing documentation name" }`

---

## Notes
- All endpoints are read-only.
- The second endpoint is case-insensitive and does not return the `image` field.
- For best results, always URL-encode the documentation name in requests.
- Hashtags are returned as arrays.
