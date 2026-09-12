from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.db.models.evidence import Evidence


class EvidenceRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, event_id: UUID, **data) -> Evidence:
        evidence = Evidence(event_id=event_id, **data)
        self.session.add(evidence)
        await self.session.commit()
        await self.session.refresh(evidence)
        return evidence

    async def get_by_id(self, evidence_id: UUID) -> Evidence | None:
        query = select(Evidence).where(Evidence.id == evidence_id)
        result = await self.session.execute(query)
        return result.scalars().first()

    async def list_by_event(self, event_id: UUID) -> list[Evidence]:
        query = select(Evidence).where(Evidence.event_id == event_id)
        result = await self.session.execute(query)
        return list(result.scalars().all())
