# Sync Points Endpoint Specification V2

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
      "category": "number",
      "type": "string",
      "name": "string",
      "project_id": "number",
      "coords": [number, number],
      "created_by": "number",
      "created_at": "string (ISO timestamp)",
      "attributes": {
        "description": "string (optional)",
        // Additional point-specific attributes
      },
      "properties": {
        // Feature-level properties
        "name": "string",
        "featureType": "string",
        "draw_layer": "string",
        "pointId": "string",
        "featureName": "string",
        "userId": "number",
        "deviceInfo": "string"
      },
      "nmea_data": {
        "gga": {
          "latitude": "number",
          "longitude": "number",
          // Additional GGA fields
        },
        "gst": {
          // GST fields
        }
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
      "category": "number",
      "type": "string",
      "name": "string",
      "project_id": "number",
      "coords": [number, number],
      "created_by": "number",
      "created_at": "string (ISO timestamp)",
      "updated_at": "string (ISO timestamp)",
      "attributes": {
        "description": "string (optional)",
        // Additional point-specific attributes
      },
      "properties": {
        // Feature-level properties
      },
      "nmea_data": {
        "gga": {},
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

## Important Notes

1. The `description` field is point-specific metadata and should ONLY be included in the `attributes` object. It should NOT be included at the top level of the point object.

2. The `CollectedFeatures` table stores feature templates/definitions and does not include point-specific metadata like descriptions.

3. The `CollectedPoints` table stores individual points, each with their own attributes including description.

4. All timestamps should be in ISO 8601 format.

5. Coordinates should be in [longitude, latitude] format.

6. The server should preserve client_id values.

7. Points returned from server should include updated_at timestamp.

8. Server should handle both null and invalid last_sync values gracefully.

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