# projects.py
import os
from datetime import datetime, timezone

import pytz
from dateutil import parser
from flask import Blueprint, render_template, request, flash, jsonify, redirect, url_for, session
from flask_login import login_required, current_user
from geoalchemy2.shape import to_shape, from_shape
from google.cloud import storage
from google.oauth2 import service_account
from shapely import Point
from sqlalchemy import or_, and_
from website import db
from website.blueprints.auth_decorators import flexible_login_required
from website.forms import ProjectForm
from website.models.collected.collected_features_model import CollectedFeatures
from website.models.collected.collected_points_model import CollectedPoints
from website.models.feature.feature_model import Feature
from website.models.project.project_model import Project
from website.models.worktype_model import worktype_features, WorkType

key_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
credentials = service_account.Credentials.from_service_account_file(
    key_path,
    scopes=['https://www.googleapis.com/auth/cloud-platform']
)

# global settings variables
delete_toggle = False
storage_client = storage.Client(credentials=credentials)
# Define the name of the bucket
bucket_name = os.environ.get("APP_BUCKET_NAME")
bucket = storage_client.bucket(bucket_name)

projects_bp = Blueprint('projects', __name__)


@projects_bp.route('/openproject/', methods=['GET'])
@login_required
def display_projects():
    isGlobalAdmin = False
    # Check multiple conditions to identify API requests
    is_api_request = any([
        request.headers.get('X-Requested-With') == 'XMLHttpRequest',
        'application/json' in request.headers.get('Accept', ''),
        request.headers.get('Content-Type', '').startswith('application/json'),
        request.args.get('format') == 'json'
    ])

    print("Headers:", dict(request.headers))  # Debug print
    print("Is API request:", is_api_request)  # Debug print

    try:
        if isGlobalAdmin:
            projects = Project.query.filter(
                Project.is_active == True
            ).order_by(Project.date.desc()).all()
        else:
            employee_id = current_user.employee_id
            employee_id_pattern = f"%{employee_id},%"
            employee_id_end_pattern = f"%{employee_id}"

            print(f"Searching for employee ID: {employee_id}")  # Debug print

            projects = Project.query.filter(
                and_(
                    or_(
                        Project.technicians.like(employee_id_pattern),
                        Project.technicians.like(employee_id_end_pattern),
                        Project.technicians == employee_id
                    ),
                    Project.is_active == True
                )
            ).order_by(Project.date.desc()).all()

        print(f"Found {len(projects)} projects")  # Debug print

        if is_api_request:
            return jsonify({
                'success': True,
                'projects': [{
                    'id': project.id,
                    'name': project.name,
                    'date': project.formatted_date(),
                    'address': project.address,
                    'client_name': project.client_name,
                    'notes': project.notes,
                    'cost_center': project.cost_center,
                    'technicians': project.technicians
                } for project in projects]
            })

        # Web interface response
        return render_template(
            'openproject.html',
            is_mobile=session.get("is_mobile", False),
            projects=projects,
            user=current_user,
            isGlobalAdmin=isGlobalAdmin
        )

    except Exception as e:
        print(f"Error: {str(e)}")  # Debug print
        if is_api_request:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
        return render_template('error.html', error_message=str(e)), 500


@projects_bp.route('/createproject/', methods=['GET', 'POST'])
@login_required
def create_project():
    form = ProjectForm()
    is_mobile = session.get("is_mobile")

    # Get work types for the form
    work_types = WorkType.query.all()

    if request.method == 'POST' and form.validate_on_submit():
        project_date = form.project_date.data
        project_name = form.project_name.data
        client_name = form.client_name.data
        project_address = form.project_address.data
        project_notes = form.project_notes.data
        cost_center = form.cost_center.data
        technicians = form.technicians.data

        # Fix the trailing comma that made this a tuple instead of a value
        work_type_id = form.work_type_id.data if form.work_type_id.data else None

        new_cost_center = check_cost_center(cost_center)

        # Check if project name already exists
        existing_project = Project.query.filter_by(name=project_name).first()

        if existing_project:
            # Project name already exists, show an error message or handle accordingly
            flash(f"A project with the name '{project_name}' already exists.", "error")
            return render_template('createproject.html', user=current_user, form=form, work_types=work_types)

        new_project = Project(
            name=project_name,
            client_name=client_name,
            address=project_address,
            notes=project_notes,
            cost_center=new_cost_center,
            date=project_date,
            technicians=technicians,
            work_type_id=work_type_id  # Add work_type_id to the project creation
        )

        db.session.add(new_project)
        db.session.commit()

        return redirect(url_for('projects.display_projects'))

    return render_template('createproject.html', is_mobile=is_mobile, user=current_user, form=form,
                           work_types=work_types)


@projects_bp.route('/set_project_id/', methods=['POST'])
def set_session():
    data = request.json
    session['project_id'] = data['project_id']
    return '', 204


# this endpoing gets feature types
@projects_bp.route('/projects/<int:project_id>/feature_types', methods=['GET'])
@flexible_login_required
def get_project_feature_types(project_id):
    try:
        project = Project.query.options(
            db.joinedload(Project.work_type)
        ).get_or_404(project_id)

        # Check if user has access to this project
        user = request.current_user
        if user.role != 'Admin':
            employee_id = user.employee_id
            if str(employee_id) not in project.technicians.split(','):
                return jsonify({
                    'success': False,
                    'error': 'Unauthorized access'
                }), 403

        if not project.work_type:
            return jsonify({
                'success': True,
                'features': []
            })

        # Get features for the project's work type
        features = Feature.query.join(worktype_features).filter(
            worktype_features.c.worktype_id == project.work_type_id
        ).all()

        # Import datetime for generating signed URLs
        import datetime

        feature_list = []
        for feature in features:
            feature_dict = {
                'name': feature.name,
                'type': feature.type,
                'color': feature.color,
                'line_weight': feature.line_weight,
                'dash_pattern': feature.dash_pattern,
                'label': feature.label,
                'svg': feature.svg,
                'draw_layer': feature.draw_layer,
                'z_value': feature.z_value
            }

            # Generate signed URL for the image if image_file_name exists
            if hasattr(feature, 'image_file_name') and feature.image_file_name:
                try:
                    # Construct the object path in your bucket
                    object_path = f"Feature_PNG/{feature.draw_layer}/{feature.image_file_name}"

                    # Get the blob from your bucket
                    blob = bucket.blob(object_path)

                    # Check if the blob exists (optional, but helpful for debugging)
                    if blob.exists():
                        # Generate a signed URL valid for 24 hours
                        signed_url = blob.generate_signed_url(
                            version="v4",
                            expiration=datetime.timedelta(hours=24),
                            method="GET",
                            credentials=credentials
                        )
                        feature_dict['image_url'] = signed_url
                        print(f"Generated signed URL for {object_path}")
                    else:
                        print(f"Warning: Image does not exist in bucket: {object_path}")
                        feature_dict['image_url'] = None
                except Exception as e:
                    print(f"Error generating signed URL for {feature.name}: {str(e)}")
                    feature_dict['image_url'] = None
            else:
                feature_dict['image_url'] = None

            feature_list.append(feature_dict)
        print(f"Sending features to client: {feature_list}")
        return jsonify({
            'success': True,
            'features': feature_list
        })

    except Exception as e:
        print(f"Error getting project features: {str(e)}")
        import traceback
        traceback.print_exc()  # Print full stack trace for debugging
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def check_cost_center(cost_center):
    if cost_center == "CORP":
        cost_center = "9013"
    if cost_center == "MDW":
        cost_center = "8101"
    if cost_center == "EAST":
        cost_center = "8102"
    if cost_center == "WEST":
        cost_center = "8109"
    if cost_center == "SOUTH":
        cost_center = "8103"
    return cost_center


@projects_bp.route('/projects/', methods=['GET'])
@flexible_login_required
def mobile_projects():
    try:
        user = request.current_user

        if user.role == 'Admin':
            projects = Project.query.filter(
                Project.is_active == True
            ).options(
                db.joinedload(Project.work_type)  # Just load the work type info, not features
            ).order_by(Project.date.desc()).all()
        else:
            employee_id = user.employee_id
            employee_id_pattern = f"%{employee_id},%"
            employee_id_end_pattern = f"%{employee_id}"

            projects = Project.query.filter(
                and_(
                    or_(
                        Project.technicians.like(employee_id_pattern),
                        Project.technicians.like(employee_id_end_pattern),
                        Project.technicians == employee_id
                    ),
                    Project.is_active == True
                )
            ).options(
                db.joinedload(Project.work_type)
            ).order_by(Project.date.desc()).all()

        return jsonify({
            'success': True,
            'projects': [{
                'id': project.id,
                'name': project.name,
                'client_name': project.client_name,
                'address': project.address,
                'coords': [to_shape(project.coords).x, to_shape(project.coords).y] if project.coords else None,
                'work_type': {
                    'id': project.work_type.id,
                    'name': project.work_type.name
                } if project.work_type else None
            } for project in projects]
        })

    except Exception as e:
        print(f"Error in mobile API: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@projects_bp.route('/<int:project_id>/sync_web_features', methods=['POST'])
@login_required
def sync_web_features(project_id):
    """Endpoint for bidirectional synchronization of manually drawn features from web app"""
    try:
        # Get current user ID from JWT
        current_user_id = current_user.id if hasattr(current_user, 'id') else current_user

        # Validate project exists and user has access
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"success": False, "message": f"Project {project_id} not found"}), 404

        # Get data from request
        data = request.json
        if not data or not isinstance(data, dict):
            return jsonify({"success": False, "message": "Invalid request format"}), 400

        # Get features array and last_sync timestamp
        features = data.get('features', [])
        last_sync = data.get('last_sync')

        # Parse last_sync timestamp
        last_sync_dt = None
        if last_sync:
            try:
                last_sync_dt = parser.isoparse(last_sync)
                # Convert to UTC time if it has timezone info
                if last_sync_dt.tzinfo is not None:
                    last_sync_dt = last_sync_dt.astimezone(timezone.utc).replace(tzinfo=None)
            except (ValueError, TypeError):
                # If last_sync is invalid, assume first sync
                last_sync_dt = None

        # Track successfully created/updated features
        synced_ids = []

        # Current server time for response
        server_time = datetime.utcnow()

        # Function to parse ISO datetime strings
        def parse_iso_datetime(datetime_str):
            """Convert ISO format datetime string to a Python datetime in UTC"""
            if not datetime_str or not isinstance(datetime_str, str):
                return datetime.utcnow()

            try:
                # Parse with dateutil which handles various ISO formats
                dt = parser.isoparse(datetime_str)
                # Convert to UTC time if it has timezone info
                if dt.tzinfo is not None:
                    dt = dt.astimezone(timezone.utc)
                else:
                    # If no timezone info, assume it's already UTC
                    # but we don't add timezone info to avoid db comparison issues
                    pass
                return dt
            except (ValueError, TypeError):
                return datetime.utcnow()

        # Begin transaction
        try:
            # Process client features
            for feature_data in features:
                # Extract required fields
                client_id = feature_data.get('client_id')
                if not client_id:
                    continue  # Skip features without client_id

                feature_type = feature_data.get('type')  # Point, Line, Polygon
                draw_layer = feature_data.get('draw_layer')
                name = feature_data.get('name', f"Feature {client_id}")

                # Extract attributes and properties
                attributes = feature_data.get('attributes', {}) or {}
                properties = feature_data.get('properties', {}) or {}

                # Mark as manually drawn
                if 'source' not in properties:
                    properties['source'] = 'manual'

                # Store styling information in properties if provided
                style = feature_data.get('style', {})
                if style:
                    properties['style'] = style

                # Parse created_at date correctly
                created_at = parse_iso_datetime(feature_data.get('created_at'))

                # Check if feature already exists
                existing_feature = CollectedFeatures.query.filter_by(
                    client_id=client_id,
                    project_id=project_id
                ).first()

                if existing_feature:
                    # Feature exists, update it
                    existing_feature.name = name
                    existing_feature.draw_layer = draw_layer
                    existing_feature.type = feature_type
                    existing_feature.updated_at = server_time
                    existing_feature.attributes = attributes
                    feature = existing_feature
                else:
                    # Create new CollectedFeatures entry
                    feature = CollectedFeatures(
                        client_id=client_id,
                        draw_layer=draw_layer,
                        type=feature_type,
                        name=name,
                        project_id=project_id,
                        attributes=attributes,
                        created_by=current_user_id if isinstance(current_user_id, int) else getattr(current_user_id,
                                                                                                    'id', None),
                        updated_by=current_user_id if isinstance(current_user_id, int) else getattr(current_user_id,
                                                                                                    'id', None),
                        created_at=created_at,
                        updated_at=server_time
                    )
                    db.session.add(feature)
                    # Flush to get the ID
                    db.session.flush()

                # Handle point geometry
                if feature_type == 'Point':
                    coords = feature_data.get('coords', [0, 0])
                    if len(coords) < 2:
                        coords = [0, 0]  # Default if invalid

                    # Frontend sends [longitude, latitude]
                    longitude, latitude = coords

                    # FIX: Don't swap the order - use the coordinates as they come
                    # The Point constructor should expect (longitude, latitude)
                    # to create a proper WKT POINT(longitude latitude)
                    point_geom = Point(longitude, latitude)  # FIXED ORDER - NO SWAP

                    # Check if point already exists for this feature
                    existing_point = CollectedPoints.query.filter_by(
                        client_id=client_id,
                        feature_id=feature.id
                    ).first()

                    if existing_point:
                        # Update existing point
                        existing_point.coords = from_shape(point_geom, srid=4326)
                        existing_point.properties = properties
                        existing_point.attributes = attributes
                        existing_point.updated_at = server_time
                    else:
                        # Create new point
                        point = CollectedPoints(
                            client_id=client_id,
                            fcode=str(draw_layer)[:5],  # Truncate to 5 chars
                            coords=from_shape(point_geom, srid=4326),
                            attributes=attributes,
                            project_id=project_id,
                            feature_id=feature.id,
                            created_by=current_user_id if isinstance(current_user_id, int) else getattr(current_user_id,
                                                                                                        'id', None),
                            updated_by=current_user_id if isinstance(current_user_id, int) else getattr(current_user_id,
                                                                                                        'id', None),
                            created_at=created_at,
                            updated_at=server_time
                        )
                        db.session.add(point)

                # Add client_id to successful list
                synced_ids.append(client_id)

            # Query for server features updated since last_sync
            server_features = []
            if last_sync_dt is not None:
                # Get all features for this project that have been updated since last_sync
                query = db.session.query(CollectedFeatures) \
                    .filter(CollectedFeatures.project_id == project_id) \
                    .filter(CollectedFeatures.is_active == True) \
                    .filter(CollectedFeatures.updated_at > last_sync_dt)

                # Exclude features that were just synced from client
                if synced_ids:
                    query = query.filter(CollectedFeatures.client_id.notin_(synced_ids))

                # Get all matching features
                for feature in query.all():
                    # Get all points for this feature
                    points = CollectedPoints.query.filter_by(
                        feature_id=feature.id,
                        is_active=True
                    ).all()

                    # Skip features with no points
                    if not points:
                        continue

                    # Convert first point's coords from WKB to lng/lat array
                    point_geom = to_shape(points[0].coords)
                    lng, lat = point_geom.x, point_geom.y

                    # Ensure feature has required attributes
                    feature_attrs = feature.attributes or {}
                    feature_attrs.update({
                        'type': feature.type,
                        'featureTypeName': feature.name,
                        'draw_layer': feature.draw_layer
                    })

                    # Format all points for this feature
                    feature_points = []
                    for point in points:
                        point_geom = to_shape(point.coords)
                        feature_points.append({
                            "client_id": point.client_id,
                            "fcode": point.fcode,
                            "coords": [point_geom.x, point_geom.y],
                            "attributes": point.attributes or {},
                            "created_by": point.created_by,
                            "updated_by": point.updated_by,
                            "created_at": point.created_at.isoformat() if point.created_at else None,
                            "updated_at": point.updated_at.isoformat() if point.updated_at else None
                        })

                    # Format feature data for response
                    feature_data = {
                        "client_id": feature.client_id,
                        "draw_layer": feature.draw_layer,
                        "type": feature.type,
                        "name": feature.name,
                        "project_id": feature.project_id,
                        "coords": [lng, lat],  # Use first point's coordinates
                        "created_by": feature.created_by,
                        "updated_by": feature.updated_by,
                        "created_at": feature.created_at.isoformat() if feature.created_at else None,
                        "updated_at": feature.updated_at.isoformat() if feature.updated_at else None,
                        "attributes": feature_attrs,
                        "points": feature_points
                    }
                    server_features.append(feature_data)

            # Commit all changes
            db.session.commit()

            # Format response
            return jsonify({
                "success": True,
                "syncedIds": synced_ids,
                "serverFeatures": server_features,
                "serverTime": server_time.isoformat()
            }), 200

        except Exception as e:
            db.session.rollback()
            import traceback
            print(f"Database error: {str(e)}")
            print(traceback.format_exc())
            return jsonify({
                "success": False,
                "message": f"Database error: {str(e)}"
            }), 500

    except Exception as e:
        import traceback
        print(f"Server error: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            "success": False,
            "message": f"Server error: {str(e)}"
        }), 500