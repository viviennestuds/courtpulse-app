"""Analytics endpoints: threshold splits, custom metrics, lab queries."""
from fastapi import APIRouter, Query
from app.services.threshold_service import compute_threshold_splits

router = APIRouter()


@router.get("/threshold-splits")
async def threshold_splits(
    entityType: str = Query(..., description="team or player"),
    entityId: str = Query(...),
    metric: str = Query(..., description="e.g. usage_rate, minutes, points"),
    threshold: float = Query(...),
    operator: str = Query(..., description="above or below"),
):
    """Compute threshold-band splits for a team or player."""
    return await compute_threshold_splits(
        entity_type=entityType,
        entity_id=entityId,
        metric=metric,
        threshold=threshold,
        operator=operator,
    )
