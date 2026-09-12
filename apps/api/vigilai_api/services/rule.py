from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.exceptions import NotFoundError, ValidationError
from vigilai_api.db.models.analytics_rule import AnalyticsRule
from vigilai_api.repositories.rule import RuleRepository


class RuleService:
    def __init__(self, session: AsyncSession):
        self.repo = RuleRepository(session)

    async def create_rule(self, camera_id: UUID, data: dict) -> AnalyticsRule:
        await self._validate(camera_id, data)
        return await self.repo.create(camera_id, **data)

    async def get_rule(self, rule_id: UUID, camera_id: UUID) -> AnalyticsRule:
        rule = await self.repo.get_by_id(rule_id, camera_id)
        if not rule:
            raise NotFoundError("Rule not found")
        return rule

    async def list_rules(self, camera_id: UUID) -> list[AnalyticsRule]:
        return await self.repo.list_by_camera(camera_id)

    async def update_rule(self, rule_id: UUID, camera_id: UUID, data: dict) -> AnalyticsRule:
        existing = await self.get_rule(rule_id, camera_id)
        merged = {
            key: getattr(existing, key)
            for key in ("rule_type", "zone_id", "line_id", "threshold_value", "object_classes")
        }
        merged.update(data)
        await self._validate(camera_id, merged)
        rule = await self.repo.update(rule_id, camera_id, **data)
        if not rule:
            raise NotFoundError("Rule not found")
        return rule

    async def delete_rule(self, rule_id: UUID, camera_id: UUID) -> bool:
        success = await self.repo.delete(rule_id, camera_id)
        if not success:
            raise NotFoundError("Rule not found")
        return True

    async def _validate(self, camera_id: UUID, data: dict):
        from vigilai_api.repositories.line import LineRepository
        from vigilai_api.repositories.zone import ZoneRepository

        kind = data.get("rule_type")
        if kind in (
            "zone_entry",
            "zone_exit",
            "dwell_time",
            "occupancy_threshold",
        ) and not data.get("zone_id"):
            raise ValidationError("This rule requires a zone")
        if kind == "line_crossing" and not data.get("line_id"):
            raise ValidationError("Line crossing requires a line")
        if kind in ("dwell_time", "occupancy_threshold"):
            import math

            threshold = data.get("threshold_value")
            if threshold is None or not math.isfinite(threshold) or threshold <= 0:
                raise ValidationError("Threshold must be finite and positive")
        if kind == "class_presence" and not data.get("object_classes"):
            raise ValidationError("Class presence requires object classes")
        for key, repo in (("zone_id", ZoneRepository), ("line_id", LineRepository)):
            if data.get(key) and not await repo(self.repo.session).get_by_id(data[key], camera_id):
                raise ValidationError("Rule geometry must belong to this camera")
