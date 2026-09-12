from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.db.models.analytics_rule import AnalyticsRule


class RuleRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, camera_id: UUID, **data) -> AnalyticsRule:
        rule = AnalyticsRule(camera_id=camera_id, **data)
        self.session.add(rule)
        await self.session.commit()
        await self.session.refresh(rule)
        return rule

    async def get_by_id(self, rule_id: UUID, camera_id: UUID) -> AnalyticsRule | None:
        query = select(AnalyticsRule).where(
            AnalyticsRule.id == rule_id, AnalyticsRule.camera_id == camera_id
        )
        result = await self.session.execute(query)
        return result.scalars().first()

    async def list_by_camera(self, camera_id: UUID) -> list[AnalyticsRule]:
        query = select(AnalyticsRule).where(AnalyticsRule.camera_id == camera_id)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update(self, rule_id: UUID, camera_id: UUID, **data) -> AnalyticsRule | None:
        rule = await self.get_by_id(rule_id, camera_id)
        if not rule:
            return None
        for key, value in data.items():
            setattr(rule, key, value)
        await self.session.commit()
        await self.session.refresh(rule)
        return rule

    async def delete(self, rule_id: UUID, camera_id: UUID) -> bool:
        rule = await self.get_by_id(rule_id, camera_id)
        if not rule:
            return False
        await self.session.delete(rule)
        await self.session.commit()
        return True
