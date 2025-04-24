# collected_feature_model.py
import json

from website import db
from datetime import datetime
import pytz

from website.models.collected.collected_feature_history_model import CollectedFeatureHistory
from website.models.model_helpers import UTCDateTime


class CollectedFeatures(db.Model):
    id = db.Column(db.Integer, primary_key=True) # unique DB id
    draw_layer = db.Column(db.String(50), nullable=False)  # Feature category (Water, Electric, Com, etc)
    client_id = db.Column(db.String(20), nullable=False)  # id for Maplibre = db.Column(db.String(50), nullable=False)
    type = db.Column(db.Enum('Point', 'Line', 'Polygon', name='feature_types'), nullable=False)  # feature type ( Point, Line, Polygon )
    name = db.Column(db.String(100))  # name of feature, example ( water valve, water line, com manhole )
    attributes = db.Column(db.JSON)  # any other attributes

    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False, index=True)

    # Relationships
    project = db.relationship('Project', back_populates='project_features', lazy='joined')
    points = db.relationship('CollectedPoints', back_populates='collected_feature',
                             cascade='all, delete-orphan', lazy='selectin')

    is_active = db.Column(db.Boolean, default=True)

    # Audit fields
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    created_at = db.Column(UTCDateTime, default=lambda: datetime.now(pytz.UTC), nullable=False)
    updated_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    updated_at = db.Column(UTCDateTime, default=lambda: datetime.now(pytz.UTC),
                           onupdate=lambda: datetime.now(pytz.UTC))

    def __repr__(self):
        return f'<CollectedFeature {self.name}>'

    # Add these methods to your CollectedFeatures class
    def get_history(self):
        """Get the complete history of this feature"""
        return CollectedFeatureHistory.query.filter_by(
            feature_id=self.id
        ).order_by(CollectedFeatureHistory.changed_at.desc()).all()

    def get_changes(self):
        """Get only the history entries that have changes"""
        return CollectedFeatureHistory.query.filter(
            CollectedFeatureHistory.feature_id == self.id,
            CollectedFeatureHistory.changes.isnot(None)
        ).order_by(CollectedFeatureHistory.changed_at.desc()).all()

    def restore_version(self, history_id, session=None):
        """Restore this feature to a previous version"""
        if session is None:
            session = db.session

        history = CollectedFeatureHistory.query.get(history_id)
        if not history or history.feature_id != self.id:
            raise ValueError("Invalid history ID")

        data = json.loads(history.data)
        # Don't restore id, created_by, created_at
        exclude_fields = ['id', 'created_by', 'created_at']

        for key, value in data.items():
            if key not in exclude_fields and hasattr(self, key):
                setattr(self, key, value)

        return self
