# features.py
import json
import os
import uuid
from datetime import datetime

import pytz
from flask import Blueprint, render_template, request, flash, jsonify, redirect, url_for, session
from flask_login import login_required, current_user
from geoalchemy2.shape import from_shape
from google.cloud import storage
from google.oauth2 import service_account
from shapely import Point, LineString, Polygon
from sqlalchemy.exc import SQLAlchemyError
from website import db
from sqlalchemy import or_, func
from website.forms import FeatureForm, FeatureFormEdit
from werkzeug.utils import secure_filename

from website.models.collected.collected_features_model import CollectedFeatures
from website.models.collected.collected_points_model import CollectedPoints
from website.models.feature.feature_model import Feature


key_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
credentials = service_account.Credentials.from_service_account_file(
    key_path,
    scopes=['https://www.googleapis.com/auth/cloud-platform']
)


features_bp = Blueprint('features', __name__)

# global settings variables
delete_toggle = False
storage_client = storage.Client(credentials=credentials)
# Define the name of the bucket
bucket_name = os.environ.get("APP_BUCKET_NAME")
bucket = storage_client.bucket(bucket_name)


@features_bp.route('/create_feature/', methods=['GET', 'POST'])
@login_required
def create_feature():
    form = FeatureForm()

    try:
        if form.validate_on_submit():
            # Validate required fields
            if not form.name.data or not form.type.data:
                flash('Name and Type are required fields', 'error')
                return render_template('createfeature.html', user=current_user, form=form)

            # Validate numeric fields
            try:
                line_weight = int(form.line_weight.data) if form.line_weight.data else 1
                z_value = int(form.z_value.data) if form.z_value.data is not None else 0
            except ValueError:
                flash('Line weight and Z value must be valid numbers', 'error')
                return render_template('createfeature.html', user=current_user, form=form)

            # Check if feature already exists to handle updates
            existing_feature = Feature.query.filter_by(name=form.name.data).first()

            # Process the PNG file if uploaded
            image_filename = ''
            if form.png_image.data:
                try:
                    # Get the PNG file
                    png_file = form.png_image.data

                    # Create a filename based just on the feature name (without timestamp)
                    safe_name = secure_filename(form.name.data)
                    feature_type = secure_filename(form.type.data)
                    filename = f"{safe_name}.png"
                    storage_path = f"Feature_PNG/{feature_type}/{filename}"

                    # If the feature exists and already has an image, delete the old one
                    if existing_feature and existing_feature.image_path:
                        old_storage_path = f"Feature_PNG/{feature_type}/{existing_feature.image_path}"
                        if old_storage_path != storage_path:
                            try:
                                old_blob = bucket.blob(old_storage_path)
                                old_blob.delete()
                                print(f"Deleted old image: {old_storage_path}")
                            except Exception as e:
                                print(f"Warning: Could not delete old image: {str(e)}")

                    # Upload the new file (this will overwrite existing file with same path)
                    blob = bucket.blob(storage_path)
                    blob.upload_from_string(
                        png_file.read(),
                        content_type=png_file.content_type
                    )

                    # Store only the filename, not the full path
                    image_filename = filename
                    print(f"PNG uploaded to: {storage_path}")
                    print(f"Filename '{filename}' will be saved to database")

                except Exception as e:
                    print(f"Error uploading PNG: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    flash('Error uploading image. Feature will be created without image.', 'warning')
            elif existing_feature:
                # If no new image is uploaded but a feature exists, keep the old image filename
                image_filename = existing_feature.image_path or ''

            # Create or update the Feature object
            try:
                if existing_feature:
                    # Update existing feature
                    existing_feature.draw_layer = form.draw_layer.data or ''
                    existing_feature.type = form.type.data
                    existing_feature.color = form.color.data or ''
                    existing_feature.line_weight = line_weight
                    existing_feature.dash_pattern = form.dash_pattern.data or ''
                    existing_feature.label = form.label.data or ''
                    existing_feature.svg = form.svg.data or ''
                    existing_feature.image_file_name = image_filename
                    existing_feature.z_value = z_value

                    db.session.commit()
                    print(f"Feature updated in database with image_path: {existing_feature.image_path}")
                    flash('Feature updated successfully!', 'success')
                    return redirect(url_for('projects.display_features'))
                else:
                    # Create a new feature
                    feature = Feature.create_feature(
                        name=form.name.data,
                        draw_layer=form.draw_layer.data or '',
                        type=form.type.data,
                        color=form.color.data or '',
                        line_weight=line_weight,
                        dash_pattern=form.dash_pattern.data or '',
                        label=form.label.data or '',
                        svg=form.svg.data or '',
                        image_file_name=image_filename or None,  # Use correct field name
                        z_value=z_value
                    )

                    if feature:
                        print(f"New feature created with image_path: {image_filename}")
                        flash('Feature created successfully!', 'success')
                        return redirect(url_for('projects.display_features'))
                    else:
                        flash('Error creating feature. Please try again.', 'error')
                        return render_template('createfeature.html', user=current_user, form=form)

            except Exception as e:
                flash('Error creating/updating feature. Please check your input.', 'error')
                print(f"Feature creation/update error: {str(e)}")
                import traceback
                traceback.print_exc()
                return render_template('createfeature.html', user=current_user, form=form)

        elif request.method == 'POST':
            # If form validation failed, show specific field errors
            for field, errors in form.errors.items():
                for error in errors:
                    flash(f'{field}: {error}', 'error')

    except Exception as e:
        flash('An unexpected error occurred. Please try again.', 'error')
        print(f"Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        return render_template('createfeature.html', user=current_user, form=form)

    return render_template('createfeature.html', user=current_user, form=form)


@features_bp.route('/display_features/', methods=['GET'])
@login_required
def display_features():
    is_mobile = session.get("is_mobile")
    features = Feature.query.all()
    return render_template('displayfeatures.html', features=features, user=current_user)


@features_bp.route('/toggle_feature_active/', methods=['POST'])
def toggle_feature_active():
    try:
        data = request.get_json()
        feature_id = data.get('feature_id')

        if not feature_id:
            return jsonify({'error': 'Feature ID is required'}), 400

        feature = Feature.query.get(feature_id)
        if not feature:
            return jsonify({'error': 'Feature not found'}), 404

        feature.is_active = not feature.is_active  # Toggle the status
        db.session.commit()

        return jsonify({
            'success': True,
            'is_active': feature.is_active,
            'message': f"Feature {'activated' if feature.is_active else 'deactivated'} successfully"
        })

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@features_bp.route('/edit_feature/', methods=['GET', 'POST'])
@login_required
def edit_feature():
    form = FeatureFormEdit()
    feature_id = session.get('feature_id')
    feature = Feature.query.get_or_404(feature_id)

    # On POST request, update feature with form data
    if request.method == 'POST':
        if form.validate_on_submit():
            # Access the file directly from request.files
            uploaded_file = request.files.get('png_image')
            print("uploaded file", uploaded_file)
            if uploaded_file and uploaded_file.filename:
                try:
                    # Create a filename based on the feature name
                    safe_name = secure_filename(form.name.data)
                    feature_type = secure_filename(form.type.data)
                    filename = f"{safe_name}.png"

                    # Define storage path for Google Cloud
                    storage_path = f"Feature_PNG/{feature_type}/{filename}"

                    # Check if feature already has an image and delete old one if needed
                    if hasattr(feature, 'image_path') and feature.image_path:
                        old_feature_type = feature.type
                        old_storage_path = f"Feature_PNG/{old_feature_type}/{feature.image_path}"

                        if old_storage_path != storage_path:
                            try:
                                old_blob = bucket.blob(old_storage_path)
                                old_blob.delete()
                                print(f"Deleted old image: {old_storage_path}")
                            except Exception as e:
                                print(f"Warning: Could not delete old image: {str(e)}")

                    # Upload the new file
                    blob = bucket.blob(storage_path)
                    file_content = uploaded_file.read()

                    blob.upload_from_string(
                        file_content,
                        content_type=uploaded_file.content_type
                    )

                    # Store only the filename in the database using the correct field name
                    feature.image_path = filename
                    print(f"PNG uploaded successfully to: {storage_path}")
                    print(f"Filename '{filename}' saved to database as image_path")

                except Exception as e:
                    print(f"Error uploading PNG: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    flash('Error uploading image. Feature will be updated without changing the image.', 'warning')

            # Update other feature fields
            feature.name = form.name.data
            feature.draw_layer = form.draw_layer.data
            feature.type = form.type.data
            feature.color = form.color.data
            feature.line_weight = form.line_weight.data
            feature.dash_pattern = form.dash_pattern.data
            feature.label = form.label.data
            feature.svg = form.svg.data
            feature.z_value = int(form.z_value.data)

            try:
                db.session.commit()
                print(f"Feature updated in database with image_path: {feature.image_path}")
                flash('Feature updated successfully!', 'success')
                return redirect(url_for('projects.display_features'))
            except Exception as e:
                db.session.rollback()
                print(f"Database error: {str(e)}")
                flash('Error saving to database. Please try again.', 'error')
        else:
            print("Form validation failed!")
            for field, errors in form.errors.items():
                print(f"Field: {field}, Errors: {errors}")
                flash(f"{field}: {', '.join(errors)}", 'error')

    # On GET request, pre-fill form with existing feature data
    elif request.method == 'GET':
        form.name.data = feature.name
        form.draw_layer.data = feature.draw_layer
        form.type.data = feature.type
        form.color.data = feature.color
        form.line_weight.data = feature.line_weight
        form.dash_pattern.data = feature.dash_pattern
        form.label.data = feature.label
        form.svg.data = feature.svg
        form.z_value.data = int(feature.z_value)

    return render_template('editfeature.html', user=current_user, form=form, feature=feature)


def get_total_features_count():
    return Feature.query.count()


def get_filtered_features(search_term, order_column, order_direction, offset, limit):
    query = Feature.query

    if search_term:
        search_conditions = []
        for column in [Feature.name, Feature.type, Feature.draw_layer]:
            search_conditions.append(column.ilike(f'%{search_term}%'))
        query = query.filter(or_(*search_conditions))

    if order_column and order_direction:
        column = getattr(Feature, order_column)
        if order_direction == 'desc':
            column = column.desc()
        query = query.order_by(column)

    return query.offset(offset).limit(limit).all()


@features_bp.route('/api/features')
def get_features():
    # Get DataTables parameters
    draw = request.args.get('draw', type=int)
    start = request.args.get('start', type=int)
    length = request.args.get('length', type=int)
    search = request.args.get('search[value]')

    # Get show_active parameter (defaults to showing only active features)
    show_active = request.args.get('show_active', 'true').lower() == 'true'

    # Get ordering parameters
    order_column_idx = request.args.get('order[0][column]', type=int)
    order_direction = request.args.get('order[0][dir]')

    # Define your columns - match these with your DataTable columns
    # UPDATED: Added form_definition column
    columns = [
        {'db_column': Feature.id, 'searchable': False},
        {'db_column': Feature.svg, 'searchable': False},
        {'db_column': Feature.name, 'searchable': True},
        {'db_column': Feature.type, 'searchable': True},
        {'db_column': Feature.color, 'searchable': True},
        {'db_column': Feature.line_weight, 'searchable': True},
        {'db_column': Feature.dash_pattern, 'searchable': True},
        {'db_column': Feature.label, 'searchable': True},
        {'db_column': Feature.z_value, 'searchable': True},
        {'db_column': Feature.draw_layer, 'searchable': True},
        {'db_column': Feature.form_definition, 'searchable': False},  # ADDED THIS LINE
        {'db_column': Feature.created_by, 'searchable': False},
        {'db_column': Feature.created_at, 'searchable': False},
        {'db_column': Feature.updated_at, 'searchable': False}
    ]

    # Base query
    query = Feature.query

    # Apply active filter
    if show_active:
        query = query.filter(Feature.is_active == True)

    # Apply search if present
    if search:
        search_conditions = []
        for column in columns:
            if column['searchable']:
                search_conditions.append(
                    column['db_column'].ilike(f'%{search}%')
                )
        if search_conditions:
            query = query.filter(or_(*search_conditions))

    # Count total records before filtering
    total_records = Feature.query.filter(Feature.is_active == True).count() if show_active else Feature.query.count()

    # Count filtered records
    filtered_records = query.count()

    # Apply sorting
    if order_column_idx is not None:
        column = columns[order_column_idx]['db_column']
        if order_direction == 'desc':
            column = column.desc()
        query = query.order_by(column)

    # Apply pagination
    features = query.offset(start).limit(length).all()

    # Prepare data for response
    data = []
    for feature in features:
        data.append({
            'id': feature.id,
            'svg': feature.svg,
            'name': feature.name,
            'type': feature.type,
            'color': feature.color,
            'line_weight': feature.line_weight,
            'dash_pattern': feature.dash_pattern,
            'label': feature.label,
            'z_value': feature.z_value,
            'draw_layer': feature.draw_layer,
            'form_definition': feature.form_definition,  # ADDED THIS LINE
            'created_by': feature.created_by,
            'created_at': feature.created_at.strftime('%Y-%m-%d'),
            'updated_at': feature.updated_at.strftime('%Y-%m-%d'),
            'is_active': feature.is_active
        })

    return jsonify({
        'draw': draw,
        'recordsTotal': total_records,
        'recordsFiltered': filtered_records,
        'data': data
    })

@features_bp.route('/clone_feature/', methods=['GET'])
def clone_feature():
    feature_id = session.get('feature_id')
    feature = Feature.clone_default_feature(feature_id)
    if feature:
        # Return success message, or redirect to the user's new custom feature
        flash(f'Feature {feature.name} cloned successfully!', "success")
        return redirect(url_for('projects.display_features'))
    else:
        # Handle error if the feature couldn't be cloned (e.g., if it's not a default)
        flash(f'Feature {feature.name} not cloned!', "error")
        return redirect(url_for('projects.display_features'))


@features_bp.route('/set_feature_id/', methods=['POST'])
def set_feature():
    data = request.json
    session['feature_id'] = data['feature_id']
    return '', 204


@features_bp.route('/api/save_feature', methods=['POST'])
@login_required
def save_feature():
    try:
        data = request.json
        project_id = session.get('project_id')

        if not project_id:
            return jsonify({'error': 'No project selected'}), 400

        feature_type = data.get('type')
        category = data.get('category')
        coordinates = data.get('coordinates')

        if not all([feature_type, category, coordinates]):
            return jsonify({'error': 'Missing required data'}), 400

        # Create the collected feature
        collected_feature = CollectedFeatures(
            project_id=project_id,
            category=category,
            type=feature_type,
            name=data.get('name'),
            description=data.get('description'),
            created_by=current_user.id
        )
        db.session.add(collected_feature)
        db.session.flush()  # Get the ID without committing

        # Create geometry based on feature type
        if feature_type == 'Point':
            geometry = Point(coordinates[0], coordinates[1])
            point = CollectedPoints(
                project_id=project_id,
                feature_id=collected_feature.id,
                fcode=category[:5],  # First 5 chars as feature code
                type=feature_type,
                coords=from_shape(geometry, srid=4326),
                created_by=current_user.id
            )
            db.session.add(point)

        elif feature_type == 'Line':
            # For lines, create a point for each vertex
            line = LineString(coordinates)
            for coord in coordinates:
                point = CollectedPoints(
                    project_id=project_id,
                    feature_id=collected_feature.id,
                    fcode=category[:5],
                    type=feature_type,
                    coords=from_shape(Point(coord[0], coord[1]), srid=4326),
                    created_by=current_user.id
                )
                db.session.add(point)

        elif feature_type == 'Polygon':
            # For polygons, create a point for each vertex
            polygon = Polygon(coordinates[0])  # First ring of coordinates
            for coord in coordinates[0]:  # Use first ring of coordinates
                point = CollectedPoints(
                    project_id=project_id,
                    feature_id=collected_feature.id,
                    fcode=category[:5],
                    type=feature_type,
                    coords=from_shape(Point(coord[0], coord[1]), srid=4326),
                    created_by=current_user.id
                )
                db.session.add(point)

        db.session.commit()
        return jsonify({'success': True, 'feature_id': collected_feature.id}), 200

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@features_bp.route('/api/project_features/<int:project_id>', methods=['GET'])
@login_required
def get_project_features(project_id):
    """Get all features for a project in GeoJSON format"""
    try:
        # Query for features related to this project (only active ones)
        collected_features = CollectedFeatures.query.filter_by(
            project_id=project_id,
            is_active=True
        ).all()

        # Get all available features for reference, indexed by name
        features_lookup = {feature.name: feature for feature in Feature.query.filter_by(is_active=True).all()}

        # Prepare GeoJSON collection
        geojson_data = {
            "type": "FeatureCollection",
            "features": []
        }

        # For each collected feature, create a GeoJSON feature
        for collected_feature in collected_features:
            # Look up the feature definition by name
            feature_def = features_lookup.get(collected_feature.name)

            # Handle different feature types
            if collected_feature.type == 'Point':
                # For Point features (which have only one point associated)
                if collected_feature.points and len(collected_feature.points) > 0:
                    point = collected_feature.points[0]  # Get the first (and should be only) point
                    if point.is_active and point.coords is not None:
                        # Get WKB hex and convert to coordinates
                        point_geom = db.session.scalar(func.ST_AsGeoJSON(point.coords))
                        point_json = json.loads(point_geom)

                        # Add styling information from the feature definition
                        style_info = {}
                        if feature_def:
                            style_info = {
                                "color": feature_def.color,
                                "lineWeight": feature_def.line_weight,
                                "dashPattern": feature_def.dash_pattern,
                                "svg": feature_def.svg
                            }

                        geojson_feature = {
                            "type": "Feature",
                            "geometry": {
                                "type": "Point",
                                "coordinates": point_json["coordinates"]
                            },
                            "properties": {
                                "id": collected_feature.id,
                                "name": collected_feature.name,
                                "category": collected_feature.category,
                                "type": collected_feature.type,
                                "color": style_info.get("color"),
                                "lineWeight": style_info.get("lineWeight"),
                                "dashPattern": style_info.get("dashPattern"),
                                "svg": style_info.get("svg")
                            }
                        }
                        geojson_data["features"].append(geojson_feature)

            elif collected_feature.type == 'Line':
                # For Line features (which have multiple points)
                active_points = [p for p in collected_feature.points if p.is_active and p.coords is not None]
                if active_points:
                    # Extract coordinates from points
                    coordinates = []
                    for point in active_points:
                        point_geom = db.session.scalar(func.ST_AsGeoJSON(point.coords))
                        point_json = json.loads(point_geom)
                        coordinates.append(point_json["coordinates"])

                    # Add styling information from the feature definition
                    style_info = {}
                    if feature_def:
                        style_info = {
                            "color": feature_def.color,
                            "lineWeight": feature_def.line_weight,
                            "dashPattern": feature_def.dash_pattern,
                            "svg": feature_def.svg
                        }

                    # Create a LineString feature
                    geojson_feature = {
                        "type": "Feature",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": coordinates
                        },
                        "properties": {
                            "id": collected_feature.id,
                            "name": collected_feature.name,
                            "category": collected_feature.category,
                            "type": collected_feature.type,
                            "color": style_info.get("color"),
                            "lineWeight": style_info.get("lineWeight"),
                            "dashPattern": style_info.get("dashPattern"),
                            "svg": style_info.get("svg")
                        }
                    }
                    geojson_data["features"].append(geojson_feature)

            elif collected_feature.type == 'Polygon':
                # For Polygon features (multiple points forming a closed ring)
                active_points = [p for p in collected_feature.points if p.is_active and p.coords is not None]
                if active_points:
                    # Extract coordinates from points
                    coordinates = []
                    for point in active_points:
                        point_geom = db.session.scalar(func.ST_AsGeoJSON(point.coords))
                        point_json = json.loads(point_geom)
                        coordinates.append(point_json["coordinates"])

                    # Make sure polygon is closed (first point = last point)
                    if coordinates and coordinates[0] != coordinates[-1]:
                        coordinates.append(coordinates[0])

                    # Add styling information from the feature definition
                    style_info = {}
                    if feature_def:
                        style_info = {
                            "color": feature_def.color,
                            "lineWeight": feature_def.line_weight,
                            "dashPattern": feature_def.dash_pattern,
                            "svg": feature_def.svg
                        }

                    # Create a Polygon feature (GeoJSON requires an array of linear rings)
                    geojson_feature = {
                        "type": "Feature",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [coordinates]  # Note the extra array level
                        },
                        "properties": {
                            "id": collected_feature.id,
                            "name": collected_feature.name,
                            "category": collected_feature.category,
                            "type": collected_feature.type,
                            "color": style_info.get("color"),
                            "lineWeight": style_info.get("lineWeight"),
                            "dashPattern": style_info.get("dashPattern"),
                            "svg": style_info.get("svg")
                        }
                    }
                    geojson_data["features"].append(geojson_feature)

        return jsonify({"success": True, "features": geojson_data["features"]})

    except Exception as e:
        db.session.rollback()
        print(f"Error getting project features: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@features_bp.route('/api/update_feature', methods=['POST'])
@login_required
def update_feature():
    """Update an existing feature in the database"""
    try:
        data = request.json
        feature_id = data.get('id')
        project_id = session.get('project_id')

        if not feature_id or not project_id:
            return jsonify({'error': 'Missing feature ID or project ID'}), 400

        # Get the feature to update
        feature = CollectedFeatures.query.get(feature_id)
        if not feature:
            return jsonify({'error': 'Feature not found'}), 404

        # Update feature properties
        if 'name' in data:
            feature.name = data['name']
        if 'category' in data:
            feature.category = data['category']
        if 'type' in data:
            feature.type = data['type']
        if 'description' in data:
            if feature.attributes is None:
                feature.attributes = {}
            feature.attributes['description'] = data['description']

        # Handle the geometry update - first, deactivate existing points
        for point in feature.points:
            point.is_active = False

        # Create new points with updated coordinates
        coordinates = data.get('coordinates')
        if coordinates:
            if feature.type == 'Point':
                point = CollectedPoints(
                    project_id=project_id,
                    feature_id=feature.id,
                    client_id=str(uuid.uuid4()),
                    fcode=feature.category[:5],
                    type=feature.type,
                    coords=from_shape(Point(coordinates[0], coordinates[1]), srid=4326),
                    created_by=current_user.id,
                    is_active=True
                )
                db.session.add(point)

            elif feature.type == 'Line':
                for coord in coordinates:
                    point = CollectedPoints(
                        project_id=project_id,
                        feature_id=feature.id,
                        client_id=str(uuid.uuid4()),
                        fcode=feature.category[:5],
                        type=feature.type,
                        coords=from_shape(Point(coord[0], coord[1]), srid=4326),
                        created_by=current_user.id,
                        is_active=True
                    )
                    db.session.add(point)

            elif feature.type == 'Polygon':
                # For polygons, create a point for each vertex in the first ring
                polygon_coordinates = coordinates[0] if isinstance(coordinates[0][0], list) else coordinates
                for coord in polygon_coordinates:
                    point = CollectedPoints(
                        project_id=project_id,
                        feature_id=feature.id,
                        client_id=str(uuid.uuid4()),
                        fcode=feature.category[:5],
                        type=feature.type,
                        coords=from_shape(Point(coord[0], coord[1]), srid=4326),
                        created_by=current_user.id,
                        is_active=True
                    )
                    db.session.add(point)

        # Update the last modified timestamp
        feature.updated_at = datetime.now(pytz.UTC)
        feature.updated_by = current_user.id

        db.session.commit()
        return jsonify({'success': True, 'feature_id': feature.id}), 200

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@features_bp.route('/api/inactivate_feature', methods=['POST'])
@login_required
def inactivate_feature():
    """Inactivate (soft delete) a feature and its associated points"""
    try:
        data = request.json
        feature_id = data.get('feature_id')

        if not feature_id:
            return jsonify({'error': 'Missing feature ID'}), 400

        # Get the feature to inactivate
        feature = CollectedFeatures.query.get(feature_id)
        if not feature:
            return jsonify({'error': 'Feature not found'}), 404

        # Mark the feature as inactive
        feature.is_active = False

        # Mark all associated points as inactive
        for point in feature.points:
            point.is_active = False

        db.session.commit()
        return jsonify({'success': True, 'message': f'Feature {feature_id} inactivated successfully'}), 200

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@features_bp.route('/build_form/<int:feature_id>')
@login_required
def build_form(feature_id):
    """Display the form builder for a specific feature"""
    from website.forms import CSRFForm  # Import your CSRFForm
    feature = Feature.query.get_or_404(feature_id)
    csrf_form = CSRFForm()
    return render_template('feature_form_builder.html', feature=feature, csrf_form=csrf_form)


@features_bp.route('/save_form_definition/<int:feature_id>', methods=['POST'])
@login_required
def save_form_definition(feature_id):
    """Save the form definition for a feature"""
    print(f"Route reached! Feature ID: {feature_id}")  # Debug line
    try:
        feature = Feature.query.get_or_404(feature_id)
        print(f"Feature found: {feature.name}")  # Debug line

        form_definition = request.get_json()
        print(f"Form definition received: {form_definition}")  # Debug line

        # Validate the form definition
        if not isinstance(form_definition, dict) or 'questions' not in form_definition:
            print("Invalid form definition structure")  # Debug line
            return jsonify({'success': False, 'error': 'Invalid form definition structure'})

        # Basic validation of questions
        for question in form_definition['questions']:
            required_fields = ['id', 'question', 'type', 'required']
            if not all(field in question for field in required_fields):
                print(f"Invalid question structure: {question}")  # Debug line
                return jsonify({'success': False, 'error': 'Invalid question structure'})

            # Validate question type
            valid_types = ['text', 'number', 'boolean', 'select', 'photo', 'date', 'textarea']
            if question['type'] not in valid_types:
                print(f"Invalid question type: {question['type']}")  # Debug line
                return jsonify({'success': False, 'error': f'Invalid question type: {question["type"]}'})

        # Save to database
        feature.form_definition = form_definition
        feature.updated_by = current_user.id
        feature.updated_at = datetime.now(pytz.UTC)

        db.session.commit()
        print("Form definition saved successfully!")  # Debug line

        return jsonify({'success': True, 'message': 'Form definition saved successfully'})

    except Exception as e:
        db.session.rollback()
        print(f"Error saving form definition: {e}")
        import traceback
        traceback.print_exc()  # Print full error traceback
        return jsonify({'success': False, 'error': str(e)})


@features_bp.route('/get_form_definition/<int:feature_id>')
@login_required
def get_form_definition(feature_id):
    """Get the form definition for a feature (for API access)"""
    feature = Feature.query.get_or_404(feature_id)
    return jsonify({
        'success': True,
        'form_definition': feature.form_definition or {'questions': []}
    })


@features_bp.route('/clear_form_definition/<int:feature_id>', methods=['POST'])
@login_required
def clear_form_definition(feature_id):
    """Clear the form definition for a feature"""
    try:
        feature = Feature.query.get_or_404(feature_id)
        feature.form_definition = None
        feature.updated_by = current_user.id
        feature.updated_at = datetime.now(pytz.UTC)

        db.session.commit()

        return jsonify({'success': True, 'message': 'Form definition cleared'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)})