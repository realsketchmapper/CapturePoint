from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from flask_login import current_user, login_required
import os

from geoalchemy2.shape import from_shape
from shapely import Point, LineString, Polygon
from sqlalchemy.exc import SQLAlchemyError

from website import db
from website.models.collected.collected_features_model import CollectedFeatures
from website.models.collected.collected_points_model import CollectedPoints

views = Blueprint('views', __name__)


@views.route('/', methods=['GET'])
def enter():
   return redirect(url_for('auth.login'))


@views.route('/api/save_feature', methods=['POST'])
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