# API Endpoints Documentation

## Authentication

### Login
**Endpoint:** `POST /login`

**Description:**  
Authenticates user and returns JWT token for subsequent requests.

**Authentication Required:** No

**Request Body:**
```json
{
    "username": "string",
    "password": "string"
}
```

**Response:**
```json
{
    "token": "string",
    "user": {
        "id": "number",
        "username": "string"
    }
}
```

### Validate Token
**Endpoint:** `GET /validate/`

**Description:**  
Validates the current JWT token.

**Authentication Required:** Yes (JWT Token)

**Response:**
```json
{
    "valid": boolean,
    "user": {
        "id": "number",
        "username": "string"
    }
}
```

## Projects

### Get Projects
**Endpoint:** `GET /projects`

**Description:**  
Retrieves all active projects for the current user.

**Authentication Required:** Yes (JWT Token)

**Response:**
```json
{
    "success": boolean,
    "projects": [
        {
            "id": "number",
            "name": "string",
            "date": "string",
            "address": "string",
            "client_name": "string",
            "notes": "string",
            "cost_center": "string",
            "technicians": "string"
        }
    ]
}
```

### Get Feature Types
**Endpoint:** `GET /projects/:projectId/feature_types`

**Description:**  
Retrieves feature type definitions for a specific project.

**Authentication Required:** Yes (JWT Token)

**Response:**
```json
{
    "success": boolean,
    "feature_types": [
        {
            "id": "number",
            "name": "string",
            "draw_layer": "string",
            "attributes": {}
        }
    ]
}
```

## Features

### Sync Features
**Endpoint:** `POST /:projectId/sync`

**Description:**  
Handles bi-directional synchronization of features between client and server, including creation, updates, and deletions using timestamp-based tracking.

**Authentication Required:** Yes (JWT Token)

**Request Body:**
```json
{
    "features": [
        {
            "clientId": "string",
            "deleted": boolean,
            "lastModified": "ISO-8601 timestamp",
            "data": {
                "name": "string",
                "draw_layer": "string",
                "type": "string",
                "attributes": {},
                "points": [
                    {
                        "client_id": "string",
                        "coords": [number, number],
                        "fcode": "string",
                        "attributes": {},
                        "created_at": "ISO-8601 timestamp"
                    }
                ],
                "created_at": "ISO-8601 timestamp"
            }
        }
    ],
    "lastSyncTimestamp": "ISO-8601 timestamp"
}
```

**Response:**
```json
{
    "success": boolean,
    "processed": ["array of processed client IDs"],
    "failed": ["array of failed client IDs"],
    "changes": "server changes since last sync",
    "serverTimestamp": "ISO-8601 timestamp"
}
```

### Get Active Features
**Endpoint:** `GET /:projectId/active-features`

**Description:**  
Retrieves all active features for a specific project.

**Authentication Required:** Yes (JWT Token)

**Response:**
```json
{
    "success": boolean,
    "features": [
        {
            "id": "number",
            "client_id": "string",
            "name": "string",
            "draw_layer": "string",
            "type": "string",
            "attributes": {},
            "points": [
                {
                    "client_id": "string",
                    "coords": [number, number],
                    "fcode": "string",
                    "attributes": {}
                }
            ]
        }
    ]
}
```

### Inactivate Feature
**Endpoint:** `POST /:projectId/inactivate-feature`

**Description:**  
Marks a feature as inactive (soft delete).

**Authentication Required:** Yes (JWT Token)

**Request Body:**
```json
{
    "client_id": "string"
}
```

**Response:**
```json
{
    "success": boolean,
    "message": "string"
}
```

## Notes
- All timestamps should be in ISO-8601 format
- Coordinates are expected in [longitude, latitude] format
- Point geometries are stored with SRID 4326
- Features and points maintain audit trails (created_by, updated_by, timestamps)
- All endpoints require JWT token in Authorization header except login
- Error responses include appropriate HTTP status codes and error messages
