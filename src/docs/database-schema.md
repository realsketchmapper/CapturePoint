# Database Schema Documentation

## Collected Features

### Table: `collected_features`
Stores the main feature data including points, lines, and polygons.

#### Columns
| Column Name | Type | Description | Constraints |
|------------|------|-------------|-------------|
| id | Integer | Primary key | Primary Key |
| draw_layer | String(50) | Feature category (Water, Electric, Com, etc) | Not Null |
| client_id | String(20) | Unique identifier from client | Not Null |
| type | Enum | Feature type | Not Null, Values: 'Point', 'Line', 'Polygon' |
| name | String(100) | Feature name | Nullable |
| attributes | JSON | Additional feature attributes | Nullable |
| project_id | Integer | Foreign key to project | Not Null, Indexed |
| is_active | Boolean | Soft delete flag | Default: True |
| created_by | Integer | User ID who created the feature | Nullable |
| created_at | UTCDateTime | Creation timestamp | Not Null |
| updated_by | Integer | User ID who last updated the feature | Nullable |
| updated_at | UTCDateTime | Last update timestamp | Auto-updates |

#### Relationships
- `project`: Many-to-One relationship with Project table
- `points`: One-to-Many relationship with CollectedPoints table

#### History Tracking
- Maintains complete history of changes through `CollectedFeatureHistory` table
- Supports version restoration
- Tracks all modifications with timestamps and user IDs

## Collected Points

### Table: `collected_points`
Stores point data associated with features.

#### Columns
| Column Name | Type | Description | Constraints |
|------------|------|-------------|-------------|
| id | Integer | Primary key | Primary Key |
| client_id | String(20) | Unique identifier from client | Not Null |
| fcode | String(5) | Feature code | Not Null |
| coords | Geometry(Point) | Geographic coordinates | Not Null, SRID: 4326 |
| attributes | JSON | Additional point attributes | Nullable |
| project_id | Integer | Foreign key to project | Not Null, Indexed |
| feature_id | Integer | Foreign key to collected feature | Not Null, Indexed |
| is_active | Boolean | Soft delete flag | Default: True |
| created_by | Integer | User ID who created the point | Nullable |
| created_at | UTCDateTime | Creation timestamp | Not Null |
| updated_by | Integer | User ID who last updated the point | Nullable |
| updated_at | UTCDateTime | Last update timestamp | Auto-updates |

#### Relationships
- `project`: Many-to-One relationship with Project table
- `collected_feature`: Many-to-One relationship with CollectedFeatures table

#### History Tracking
- Maintains complete history of changes through `CollectedPointHistory` table
- Supports version restoration
- Tracks all modifications with timestamps and user IDs

## Important Notes

### Geometry Handling
- Points are stored using PostGIS geometry type
- SRID 4326 is used for all geographic coordinates
- Coordinates are stored in [longitude, latitude] format

### Audit Trail
- All tables maintain creation and update timestamps
- User IDs are tracked for both creation and updates
- All changes are recorded in history tables

### Soft Deletion
- Both features and points use `is_active` flag for soft deletion
- Historical data is preserved even after deletion

### Data Validation
- Error values cannot be negative
- Feature types are restricted to Point, Line, or Polygon
- Client IDs must be unique within their context

### Indexing
- Project IDs are indexed for better query performance
- Feature IDs are indexed for point lookups 