"""
VigilAi — Models API Endpoint

Exposes safe public metadata for all available vision models.
Allows clients and camera configuration interfaces to query supported models.
"""

from typing import Any
from fastapi import APIRouter, Depends, HTTPException

from vigilai_api.core.deps import require_auth
from vigilai_api.core.models_registry import (
    AVAILABLE_MODELS,
    get_model_metadata,
    list_available_models,
)
from vigilai_api.db.models.user import User

router = APIRouter()


@router.get("", response_model=list[dict[str, Any]])
async def list_models(current_user: User = Depends(require_auth)):
    """List all available vision models with safe metadata (framework, classes, metrics)."""
    return list_available_models()


@router.get("/{model_id}", response_model=dict[str, Any])
async def get_model(model_id: str, current_user: User = Depends(require_auth)):
    """Get metadata for a specific vision model by ID or alias."""
    meta = get_model_metadata(model_id)
    if not meta or not meta.is_active:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    return meta.to_safe_dict()
