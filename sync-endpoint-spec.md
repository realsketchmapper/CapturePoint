# Sync Points Endpoint Specification

## Endpoint Purpose
Enable bi-directional synchronization of points between client and server, tracking both client-to-server and server-to-client changes.

## Request Details

**Method:** POST

**URL Structure:** `/{projectId}/sync-points`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "points": [
    {
      "client_id": "string",
      "category": "string",
      "type": "string",
      "name": "string (optional)",
      "description": "string (optional)",
      "project_id": "number",
      "coords": [0, 0],
      "created_by": "string (optional)",
      "created_at": "string (ISO timestamp)",
      "properties": {
        "key": "value"
      },
      "nmea_data": {
        "gga": {
          "latitude": 0,
          "longitude": 0
        },
        "gst": {}
      }
    }
  ],
  "last_sync": "string (ISO timestamp) | null"
}
```

## Response Format

**Success Response (200 OK):**
```json
{
  "success": true,
  "syncedIds": ["string"],
  "serverPoints": [
    {
      "client_id": "string",
      "category": "string",
      "type": "string",
      "name": "string (optional)",
      "description": "string (optional)",
      "project_id": "number",
      "coords": [0, 0],
      "created_by": "string",
      "created_at": "string (ISO timestamp)",
      "updated_at": "string (ISO timestamp)",
      "properties": {
        "key": "value"
      },
      "nmea_data": {
        "gga": {
          "latitude": 0,
          "longitude": 0
        },
        "gst": {}
      }
    }
  ],
  "serverTime": "string (ISO timestamp)"
}
```

**Error Response (400, 401, 403, 500):**
```json
{
  "success": false,
  "message": "string"
}
```

## Server-Side Logic Requirements

1. **Authentication & Authorization**
   - Validate JWT token
   - Verify user has access to specified project

2. **Input Validation**
   - Validate project ID exists
   - Validate all required fields in points array
   - Validate coordinates are within acceptable ranges

3. **Point Processing**
   - For each client point:
     - If point exists (by client_id), update it
     - If point is new, create it
     - Preserve client_id for future reference
     - Update updated_at timestamp

4. **Change Tracking**
   - Track updated_at timestamp for all point modifications
   - Query points modified since last_sync timestamp
   - Include newly created points in server response

5. **Error Handling**
   - Handle partial success scenarios
   - Provide meaningful error messages
   - Roll back changes if batch operation fails

## Notes

1. All timestamps should be in ISO 8601 format
2. Coordinates should be in [latitude, longitude] format
3. The server should preserve client_id values
4. Points returned from server should include updated_at timestamp
5. Server should handle both null and invalid last_sync values gracefully

## Implementation Steps

1. Create the endpoint with the specified URL structure
2. Implement authentication middleware
3. Add input validation
4. Create database queries for point processing
5. Implement change tracking logic
6. Add error handling
7. Test with various scenarios:
   - First sync (null last_sync)
   - Incremental sync
   - Conflict scenarios
   - Error cases 