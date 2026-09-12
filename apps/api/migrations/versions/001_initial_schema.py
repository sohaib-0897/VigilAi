"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-09-11

Creates all VigilAI tables: users, cameras, zones, virtual_lines,
analytics_rules, events, evidence, camera_sessions, track_summaries,
model_artifacts.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Users table
    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("username", sa.String(100), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_username", "users", ["username"])

    # Cameras table
    op.create_table(
        "cameras",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source_type", sa.String(50), nullable=False),  # local_video, webcam, rtsp
        sa.Column("source_uri", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "analytics_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column("status", sa.String(50), nullable=False, server_default=sa.text("'offline'")),
        sa.Column("status_message", sa.Text(), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("fps", sa.Float(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_cameras_user_id", "cameras", ["user_id"])
    op.create_index("ix_cameras_status", "cameras", ["status"])

    # Zones table
    op.create_table(
        "zones",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "camera_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cameras.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("zone_type", sa.String(50), nullable=False, server_default=sa.text("'custom'")),
        sa.Column("points", postgresql.JSON(), nullable=False),
        sa.Column("color", sa.String(20), nullable=False, server_default=sa.text("'#3B82F6'")),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_zones_camera_id", "zones", ["camera_id"])

    # Virtual lines table
    op.create_table(
        "virtual_lines",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "camera_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cameras.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("start_point", postgresql.JSON(), nullable=False),
        sa.Column("end_point", postgresql.JSON(), nullable=False),
        sa.Column(
            "direction_mode", sa.String(20), nullable=False, server_default=sa.text("'both'")
        ),
        sa.Column("color", sa.String(20), nullable=False, server_default=sa.text("'#EF4444'")),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_virtual_lines_camera_id", "virtual_lines", ["camera_id"])

    # Analytics rules table
    op.create_table(
        "analytics_rules",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "camera_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cameras.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("rule_type", sa.String(50), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("severity", sa.String(20), nullable=False, server_default=sa.text("'medium'")),
        sa.Column("object_classes", postgresql.JSON(), nullable=True),
        sa.Column(
            "zone_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("zones.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "line_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("virtual_lines.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("threshold_value", sa.Float(), nullable=True),
        sa.Column("cooldown_seconds", sa.Integer(), nullable=False, server_default=sa.text("30")),
        sa.Column("configuration", postgresql.JSON(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_analytics_rules_camera_id", "analytics_rules", ["camera_id"])
    op.create_index("ix_analytics_rules_zone_id", "analytics_rules", ["zone_id"])
    op.create_index("ix_analytics_rules_line_id", "analytics_rules", ["line_id"])

    # Events table
    op.create_table(
        "events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "camera_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cameras.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "rule_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("analytics_rules.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default=sa.text("'medium'")),
        sa.Column("object_class", sa.String(50), nullable=True),
        sa.Column("track_id", sa.Integer(), nullable=True),
        sa.Column(
            "zone_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("zones.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "line_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("virtual_lines.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata", postgresql.JSON(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'active'")),
        sa.Column("fingerprint", sa.String(64), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_events_camera_id", "events", ["camera_id"])
    op.create_index("ix_events_event_type", "events", ["event_type"])
    op.create_index("ix_events_severity", "events", ["severity"])
    op.create_index("ix_events_status", "events", ["status"])
    op.create_index("ix_events_fingerprint", "events", ["fingerprint"])
    op.create_index("ix_events_started_at", "events", ["started_at"])

    # Evidence table
    op.create_table(
        "evidence",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "evidence_type", sa.String(20), nullable=False, server_default=sa.text("'snapshot'")
        ),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column(
            "mime_type", sa.String(50), nullable=False, server_default=sa.text("'image/jpeg'")
        ),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("metadata", postgresql.JSON(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_evidence_event_id", "evidence", ["event_id"])

    # Camera sessions table
    op.create_table(
        "camera_sessions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "camera_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cameras.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("frames_received", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("frames_processed", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("frames_dropped", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("total_detections", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("total_events", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("status", sa.String(50), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    op.create_index("ix_camera_sessions_camera_id", "camera_sessions", ["camera_id"])

    # Track summaries table
    op.create_table(
        "track_summaries",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "camera_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cameras.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("camera_sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("track_id", sa.Integer(), nullable=False),
        sa.Column("object_class", sa.String(50), nullable=False),
        sa.Column("first_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("total_frames", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("zones_visited", postgresql.JSON(), nullable=True),
        sa.Column("lines_crossed", postgresql.JSON(), nullable=True),
        sa.Column("metadata", postgresql.JSON(), nullable=True),
    )
    op.create_index("ix_track_summaries_camera_id", "track_summaries", ["camera_id"])

    # Model artifacts table
    op.create_table(
        "model_artifacts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("task", sa.String(50), nullable=False),
        sa.Column("framework", sa.String(50), nullable=False),
        sa.Column("weights_path", sa.Text(), nullable=False),
        sa.Column("format", sa.String(20), nullable=False),
        sa.Column("img_size", sa.Integer(), nullable=False, server_default=sa.text("640")),
        sa.Column("classes", postgresql.JSON(), nullable=True),
        sa.Column("metrics", postgresql.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )


def downgrade() -> None:
    op.drop_table("model_artifacts")
    op.drop_table("track_summaries")
    op.drop_table("camera_sessions")
    op.drop_table("evidence")
    op.drop_table("events")
    op.drop_table("analytics_rules")
    op.drop_table("virtual_lines")
    op.drop_table("zones")
    op.drop_table("cameras")
    op.drop_table("users")
