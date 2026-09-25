"""add_camera_model_id

Revision ID: b83f12a4d5e6
Revises: 754ed4cfa449
Create Date: 2026-09-21 10:45:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b83f12a4d5e6"
down_revision: str | None = "754ed4cfa449"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "cameras",
        sa.Column(
            "model_id",
            sa.String(length=100),
            server_default="coco-yolov8n-onnx",
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("cameras", "model_id")
