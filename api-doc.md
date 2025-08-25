# Docuscribe API Documentation

## 1. List All Documents (list_all_docs)

**Endpoint:** `GET /api/list_all_docs`

**Description:**
Returns a list of documents with stable ids, names (titles), and their hashtags. Ordered by last updated (desc).

**Query Parameters:**
- `limit` (optional, default: 100, max: 1000): Maximum number of results.
- `offset` (optional, default: 0): Pagination offset.

**Example Request:**
```sh
curl -s 'http://localhost:9002/api/list_all_docs?limit=50&offset=0' | jq
```

**Example Response:**
```json
{
  "documents": [
    { "id": "d3b6d6a1-...", "name": "PocketFlow", "hashtags": ["ml", "optimization"] },
    { "id": "3ae1c920-...", "name": "React", "hashtags": ["frontend", "ui"] }
  ]
}
```

---

## 2. Fetch Document Content (fetch_doc_content)

**Endpoint:** `GET /api/fetch_doc_content/:id`

**Description:**
Returns the document whose stable id matches `:id`. If not found, treats the value as a legacy title for backward compatibility (case-insensitive). The response omits the `image` field.

**Path Parameter:**
- `id`: Stable document id (string UUID). Legacy title also accepted temporarily.

**Example Request:**
```sh
curl -s 'http://localhost:9002/api/fetch_doc_content/d3b6d6a1-....' | jq
curl -s 'http://localhost:9002/api/fetch_doc_content/PocketFlow' | jq # legacy name fallback
```

**Example Response:**
```json
{
  "document": {
    "id": 1,
  "doc_uid": "d3b6d6a1-...",
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
- The detail endpoint omits the `image` field.
- The list endpoint returns the stable `id` (UUID) which should be used for subsequent lookups.
- Deprecated endpoints:
  - `/api/documentations` -> use `/api/list_all_docs`
  - `/api/documentations/:id` -> use `/api/fetch_doc_content/:id`
  - `/api/list-all-docs` (hyphen) -> use `/api/list_all_docs`
- Legacy title fallback remains for now in `fetch_doc_content`.
- Hashtags are returned as arrays.
