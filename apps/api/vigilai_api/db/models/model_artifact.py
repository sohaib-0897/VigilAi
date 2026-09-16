"""Model Artifact Model"""

from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.dialects.postgresql import JSONB

from vigilai_api.db.base import Base


class ModelArtifact(Base):
    __tablename__ = "model_artifacts"

    name = Column(String(255), nullable=False)
    version = Column(String(50), nullable=False)
    task = Column(String(100), nullable=False)
    framework = Column(String(100), nullable=False)
    weights_path = Column(String(1024), nullable=False)
    format = Column(String(50), nullable=False)
    img_size = Column(Integer, nullable=False)
    classes = Column(JSONB, nullable=False)
    metrics = Column(JSONB, nullable=True)
    is_active = Column(Boolean, default=False, nullable=False)
