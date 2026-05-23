"""Threshold-band split engine.

Computes team or player performance when a chosen stat crosses a threshold.
"""
import logging

logger = logging.getLogger(__name__)


async def compute_threshold_splits(
    entity_type: str,
    entity_id: str,
    metric: str,
    threshold: float,
    operator: str,
) -> dict:
    """
    Compute threshold-band splits.
    
    This is a placeholder that will be expanded to:
    - Pull game logs for the entity (team or player)
    - Filter games where metric is above/below threshold
    - Compute aggregated stats (W-L, PPG, RPG, APG, Net Rating)
    - Support multi-band segmentation (2-band default, optional 3-band)
    
    Supported metrics (planned):
    - usage_rate, minutes, points, assists, rebounds
    - fg_pct, ts_pct, turnover_pct
    - pace, off_rating, def_rating
    """
    return {
        "entityType": entity_type,
        "entityId": entity_id,
        "metric": metric,
        "threshold": threshold,
        "operator": operator,
        "status": "not_implemented",
        "message": "Threshold splits require game log data. Coming soon.",
    }
