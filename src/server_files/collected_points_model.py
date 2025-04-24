# collectedPointsModal.py

from website.models.collected.collected_point_history_model import CollectedPointHistory
from website.models.model_helpers import UTCDateTime
from website import db
from geoalchemy2 import Geometry
from sqlalchemy.orm import validates
from datetime import datetime
import pytz
import json


class CollectedPoints(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.String(20), nullable=False)
    fcode = db.Column(db.String(5), nullable=False)
    coords = db.Column(Geometry('Point', srid=4326), nullable=False)
    attributes = db.Column(db.JSON)

    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False, index=True)
    feature_id = db.Column(db.Integer, db.ForeignKey('collected_features.id'), nullable=False, index=True)

    # Relationships
    project = db.relationship('Project', back_populates='project_points', lazy='joined')
    collected_feature = db.relationship('CollectedFeatures', back_populates='points', lazy='joined')

    is_active = db.Column(db.Boolean, default=True)

    # Audit fields
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    created_at = db.Column(UTCDateTime, default=lambda: datetime.now(pytz.UTC), nullable=False)
    updated_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    updated_at = db.Column(UTCDateTime, default=lambda: datetime.now(pytz.UTC),
                          onupdate=lambda: datetime.now(pytz.UTC))

    @validates('error_overall', 'error_latitude', 'error_longitude', 'error_altitude')
    def validate_errors(self, key, value):
        if value is not None and value < 0:
            raise ValueError(f'{key} cannot be negative')
        return value

    def __repr__(self):
        return f'<CollectedPoint {self.id} for Feature {self.feature_id}>'

    def get_history(self):
        """Get the complete history of this point"""
        return CollectedPointHistory.query.filter_by(
            point_id=self.id
        ).order_by(CollectedPointHistory.changed_at.desc()).all()

    def get_changes(self):
        """Get only the history entries that have changes"""
        return CollectedPointHistory.query.filter(
            CollectedPointHistory.point_id == self.id,
            CollectedPointHistory.changes.isnot(None)
        ).order_by(CollectedPointHistory.changed_at.desc()).all()

    def restore_version(self, history_id, session=None):
        """Restore this point to a previous version"""
        if session is None:
            session = db.session

        history = CollectedPointHistory.query.get(history_id)
        if not history or history.point_id != self.id:
            raise ValueError("Invalid history ID")

        data = json.loads(history.data)
        exclude_fields = ['id', 'created_by', 'created_at']

        for key, value in data.items():
            if key not in exclude_fields and hasattr(self, key):
                if key == 'coords' and value is not None:
                    # Convert WKT back to geometry
                    from geoalchemy2.elements import WKTElement
                    from shapely import wkt
                    shape = wkt.loads(value)
                    setattr(self, key, WKTElement(shape.wkt, srid=4326))
                else:
                    setattr(self, key, value)

        return self

