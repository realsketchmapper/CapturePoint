# mobile_api.py

from datetime import datetime, timezone
from flask import request, jsonify, Blueprint
from flask_jwt_extended import jwt_required, get_jwt_identity
from geoalchemy2.shape import from_shape, to_shape
from shapely import Point
from website import db
from website.models.collected.collected_features_model import CollectedFeatures
from website.models.collected.collected_points_model import CollectedPoints
from website.models.project.project_model import Project
from dateutil import parser

mobile_api_bp = Blueprint('mobile_api', __name__)


@mobile_api_bp.route('/<int:project_id>/sync', methods=['POST'])
@jwt_required()
def sync_project(project_id):
    """
    Improved endpoint for bi-directional synchronization of features between client and server.
    Handles creation, updates, and deletions with efficient timestamp-based tracking.
    """
    try:
        # Get current user from JWT
        current_user_id = get_jwt_identity()

        # Validate project exists
        project = Project.query.get(project_id)
        if not project:
            return jsonify({
                "success": False,
                "message": f"Project {project_id} not found"
            }), 404

        # Get data from request
        data = request.json
        if not data or not isinstance(data, dict):
            return jsonify({
                "success": False,
                "message": "Invalid request format"
            }), 400

        # Get client features and last sync timestamp
        client_features = data.get('features', [])
        client_last_sync = data.get('lastSyncTimestamp')
        
        # Get client timezone if provided, default to UTC
        client_timezone = data.get('timezone', 'UTC')

        # Parse timestamp or default to epoch start
        last_sync_time = parse_iso_datetime(client_last_sync) or datetime.utcfromtimestamp(0)

        # Current server time for this sync operation
        server_time = datetime.utcnow()

        # Track processed features
        processed_feature_ids = []
        failed_feature_ids = []

        # Process client features in a batch transaction
        try:
            # Process client features and their points
            for feature_data in client_features:
                client_id = feature_data.get('clientId')
                if not client_id:
                    continue

                # Check if feature is marked as deleted
                is_deleted = feature_data.get('deleted', False)

                # If deleted, mark as inactive instead of actual deletion
                if is_deleted:
                    existing_feature = CollectedFeatures.query.filter_by(
                        client_id=client_id,
                        project_id=project_id
                    ).first()

                    if existing_feature:
                        existing_feature.is_active = False
                        existing_feature.updated_at = server_time
                        existing_feature.updated_by = current_user_id
                        processed_feature_ids.append(client_id)
                    continue

                # Get full feature data if not deleted
                feature_full_data = feature_data.get('data', {})
                if not feature_full_data:
                    failed_feature_ids.append(client_id)
                    continue
                    
                # Store timezone in attributes if not already present
                feature_attributes = feature_full_data.get('attributes', {}) or {}
                if 'timezone' not in feature_attributes:
                    feature_attributes['timezone'] = client_timezone
                feature_full_data['attributes'] = feature_attributes

                # Check if feature exists
                existing_feature = CollectedFeatures.query.filter_by(
                    client_id=client_id,
                    project_id=project_id
                ).first()

                if existing_feature:
                    # Only update if client version is newer
                    client_modified = parse_iso_datetime(feature_data.get('lastModified'))
                    if client_modified and client_modified > existing_feature.updated_at:
                        # Update existing feature
                        existing_feature.name = feature_full_data.get('name', existing_feature.name)
                        existing_feature.draw_layer = feature_full_data.get('draw_layer', existing_feature.draw_layer)
                        existing_feature.type = feature_full_data.get('type', existing_feature.type)
                        existing_feature.attributes = feature_attributes
                        existing_feature.updated_at = server_time
                        existing_feature.updated_by = current_user_id
                        feature = existing_feature
                    else:
                        # Server version is newer, skip update
                        feature = existing_feature
                else:
                    # Create new feature
                    feature = CollectedFeatures(
                        client_id=client_id,
                        draw_layer=feature_full_data.get('draw_layer'),
                        type=feature_full_data.get('type'),
                        name=feature_full_data.get('name'),
                        project_id=project_id,
                        attributes=feature_attributes,
                        created_by=current_user_id,
                        created_at=parse_iso_datetime(feature_full_data.get('created_at')) or server_time,
                        updated_at=server_time,
                        updated_by=current_user_id,
                        is_active=True
                    )
                    db.session.add(feature)
                    db.session.flush()  # Get the feature ID

                # Process points for this feature
                points_data = feature_full_data.get('points', [])
                for point_data in points_data:
                    point_client_id = point_data.get('client_id')
                    if not point_client_id:
                        continue

                    # Check if point exists
                    existing_point = CollectedPoints.query.filter_by(
                        client_id=point_client_id,
                        feature_id=feature.id
                    ).first()

                    # Get coordinates, defaulting to [0,0] if invalid
                    coords = point_data.get('coords', [0, 0])
                    if not isinstance(coords, list) or len(coords) < 2:
                        coords = [0, 0]

                    point_geom = Point(coords[0], coords[1])
                    
                    # Store timezone in point attributes if not already present
                    point_attributes = point_data.get('attributes', {}) or {}
                    if 'timezone' not in point_attributes:
                        point_attributes['timezone'] = client_timezone
                    
                    if existing_point:
                        # Update existing point
                        existing_point.coords = from_shape(point_geom, srid=4326)
                        existing_point.fcode = point_data.get('fcode', existing_point.fcode)
                        existing_point.attributes = point_attributes
                        existing_point.updated_at = server_time
                        existing_point.updated_by = current_user_id
                    else:
                        # Create new point
                        new_point = CollectedPoints(
                            client_id=point_client_id,
                            fcode=point_data.get('fcode', ''),
                            coords=from_shape(point_geom, srid=4326),
                            attributes=point_attributes,
                            project_id=project_id,
                            feature_id=feature.id,
                            created_by=current_user_id,
                            created_at=parse_iso_datetime(point_data.get('created_at')) or server_time,
                            updated_at=server_time,
                            updated_by=current_user_id,
                            is_active=True
                        )
                        db.session.add(new_point)

                processed_feature_ids.append(client_id)

            # Fetch server changes since last sync
            server_changes = get_server_changes_since(project_id, last_sync_time, current_user_id)

            # Commit all changes
            db.session.commit()

            return jsonify({
                "success": True,
                "processed": processed_feature_ids,
                "failed": failed_feature_ids,
                "changes": server_changes,
                "serverTimestamp": server_time.isoformat()
            }), 200

        except Exception as e:
            db.session.rollback()
            return jsonify({
                "success": False,
                "message": f"Database error: {str(e)}"
            }), 500

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Server error: {str(e)}"
        }), 500


def get_server_changes_since(project_id, last_sync_time, current_user_id):
    """
    Get all features that have changed since the last sync.

    Args:
        project_id: The project ID
        last_sync_time: Datetime object representing last sync time
        current_user_id: The current user ID

    Returns:
        List of changed features with their points
    """
    # Ensure last_sync_time is timezone-aware UTC time for consistent comparison
    if last_sync_time.tzinfo is None:
        # If naive, assume it's UTC
        last_sync_time = last_sync_time.replace(tzinfo=timezone.utc)
    else:
        # Convert to UTC if it has a different timezone
        last_sync_time = last_sync_time.astimezone(timezone.utc)
    
    # Query features updated since last sync
    query = db.session.query(CollectedFeatures) \
        .filter(CollectedFeatures.project_id == project_id) \
        .filter(CollectedFeatures.updated_at > last_sync_time)

    # Format server features for response
    changes = []
    for feature in query.all():
        # Get active points for this feature
        feature_points = []
        for point in feature.points:
            if point.is_active:
                point_geom = to_shape(point.coords)
                feature_points.append({
                    "client_id": point.client_id,
                    "fcode": point.fcode,
                    "coords": [point_geom.x, point_geom.y],
                    "attributes": point.attributes,
                    "created_by": point.created_by,
                    "created_at": point.created_at.isoformat() if point.created_at else None,
                    "updated_by": point.updated_by,
                    "updated_at": point.updated_at.isoformat() if point.updated_at else None,
                    "is_active": point.is_active,
                    "timezone": point.attributes.get("timezone", "UTC") if point.attributes else "UTC"
                })

        # Only include active features or those marked inactive since last sync
        if feature.is_active or feature.updated_at > last_sync_time:
            changes.append({
                "clientId": feature.client_id,
                "lastModified": feature.updated_at.isoformat() if feature.updated_at else None,
                "deleted": not feature.is_active,
                "data": {
                    "name": feature.name,
                    "draw_layer": feature.draw_layer,
                    "type": feature.type,
                    "project_id": feature.project_id,
                    "attributes": feature.attributes,
                    "created_by": feature.created_by,
                    "created_at": feature.created_at.isoformat() if feature.created_at else None,
                    "updated_by": feature.updated_by,
                    "updated_at": feature.updated_at.isoformat() if feature.updated_at else None,
                    "points": feature_points if feature.is_active else [],
                    "timezone": feature.attributes.get("timezone", "UTC") if feature.attributes else "UTC"
                }
            })

    return changes


def parse_iso_datetime(datetime_str):
    """Convert ISO format datetime string to a Python datetime in UTC"""
    if not datetime_str or not isinstance(datetime_str, str):
        return None

    try:
        dt = parser.isoparse(datetime_str)
        # Convert to UTC if timezone info exists
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc)
        else:
            # If no timezone info, assume it's already UTC
            # but we don't add timezone info to avoid db comparison issues
            pass
        return dt
    except (ValueError, TypeError):
        return None


@mobile_api_bp.route('/<int:project_id>/active-features', methods=['GET'])
@jwt_required()
def get_active_features(project_id):
    """Endpoint to retrieve all active features and their points for a project"""
    try:
        # Validate project exists
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"success": False, "error": f"Project {project_id} not found"}), 404

        # Query all active features for this project
        features = CollectedFeatures.query.filter_by(
            project_id=project_id,
            is_active=True
        ).all()

        if not features:
            return jsonify({
                "success": True,
                "features": [],
                "message": "No active features found for this project"
            }), 200

        result = []

        # For each feature, get its points and structure the response
        for feature in features:
            # Get all active points for this feature
            points = CollectedPoints.query.filter_by(
                feature_id=feature.id,
                project_id=project_id,
                is_active=True
            ).all()

            # Format points with coordinates
            formatted_points = []
            for point in points:
                # Convert geometry to coordinates
                wkb_element = to_shape(point.coords)
                longitude, latitude = wkb_element.x, wkb_element.y

                formatted_points.append({
                    "client_id": point.client_id,
                    "coordinates": [longitude, latitude],
                    "attributes": point.attributes,
                    "created_at": point.created_at.isoformat() if point.created_at else None,
                    "created_by": point.created_by
                })

            # Only add features that have active points
            if formatted_points:
                result.append({
                    "client_id": feature.client_id,
                    "name": feature.name,
                    "created_at": feature.created_at.isoformat() if feature.created_at else None,
                    "created_by": feature.created_by,
                    "points": formatted_points
                })

        return jsonify({
            "success": True,
            "features": result,
            "count": len(result),
            "message": f"Retrieved {len(result)} active features"
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Server error: {str(e)}"
        }), 500
