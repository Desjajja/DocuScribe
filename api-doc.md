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
Fetches content for a document by its stable id (`:id`). Supports multiple modes:

### Modes:
1. **Index Mode** (no positional params):
   - Returns structured metadata for the document's index page.
   - Example Request:
     ```sh
     curl -s 'http://localhost:9002/api/fetch_doc_content/<doc_uid>' | jq
     ```
   - Example Response:
     ```json
     {
       "document": {
         "id": 1,
         "title": "asyncio.html",
         "index": true
       },
       "meta": {
         "mode": "index",
         "of": "ugijhfayb",
         "pages": [
           { "page": 1, "start": 0, "end": 335, "len": 335, "title": "asyncio — Asynchronous I/O — Python 3.13.7 documentation" }
         ]
       }
     }
     ```

2. **Single Range Mode**:
   - Fetches a slice of content based on `start` and `max_length`.
   - Query Parameters:
     - `start`: Starting word index (default: 0).
     - `max_length`: Maximum number of words to return (default: 10000, capped at 50000).
   - Example Request:
     ```sh
     curl -s 'http://localhost:9002/api/fetch_doc_content/<doc_uid>?start=0&max_length=100' | jq
     ```
   - Example Response:
     ```json
     {
       "document": {
         "id": 1,
         "title": "asyncio.html",
         "content": "...markdown slice..."
       },
       "meta": {
         "mode": "single",
         "total_words": 5000,
         "returned_words": 100,
         "start": 0,
         "max_length": 100,
         "end": 100,
         "has_more": true,
         "next_start": 100
       }
     }
     ```

3. **Multi-Range Mode**:
   - Fetches concatenated paragraphs for multiple ranges.
   - Query Parameters:
     - `ranges`: Comma-separated list of `start-end` pairs (end exclusive).
   - Example Request:
     ```sh
     curl -s 'http://localhost:9002/api/fetch_doc_content/<doc_uid>?ranges=0-100,200-300' | jq
     ```
   - Example Response:
     ```json
     {
       "document": {
         "id": 1,
         "title": "asyncio.html",
         "content": "Paragraph 1...\n\nParagraph 2..."
       },
       "meta": {
         "mode": "multi",
         "total_words": 5000,
         "requested_ranges": [
           { "start": 0, "end": 100 },
           { "start": 200, "end": 300 }
         ],
         "merged_ranges": [
           { "start": 0, "end": 100 },
           { "start": 200, "end": 300 }
         ],
         "paragraphs": [
           { "index": 0, "start": 0, "end": 50 },
           { "index": 1, "start": 50, "end": 100 }
         ],
         "total_returned_words": 150
       }
     }
     ```

**Error Responses:**
- 404 Not Found: `{ "error": "Not found" }`
- 400 Bad Request: `{ "error": "Invalid ranges" }`

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
