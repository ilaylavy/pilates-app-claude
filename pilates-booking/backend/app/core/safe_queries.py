"""
Utilities for safe database queries that prevent DetachedInstanceError.
"""
from typing import Any, Dict, List, Optional, Type, TypeVar
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.orm.strategy_options import Load

from .database import Base

T = TypeVar("T", bound=Base)


class SafeQueryBuilder:
    """Builder for creating queries with proper relationship loading."""
    
    def __init__(self, session: AsyncSession, model_class: Type[T]):
        self.session = session
        self.model_class = model_class
        self._stmt = select(model_class)
        
    def with_relationships(self, *relationships: str) -> "SafeQueryBuilder":
        """Add selectinload for specified relationships."""
        for rel in relationships:
            self._stmt = self._stmt.options(selectinload(getattr(self.model_class, rel)))
        return self
        
    def with_nested_relationship(self, relationship: str, nested: str) -> "SafeQueryBuilder":
        """Add nested selectinload (e.g., booking.class_instance.template)."""
        rel_attr = getattr(self.model_class, relationship)
        nested_attr = getattr(rel_attr.property.mapper.class_, nested)
        self._stmt = self._stmt.options(
            selectinload(rel_attr).selectinload(nested_attr)
        )
        return self
        
    def where(self, *conditions) -> "SafeQueryBuilder":
        """Add WHERE conditions."""
        self._stmt = self._stmt.where(*conditions)
        return self
        
    def order_by(self, *ordering) -> "SafeQueryBuilder":
        """Add ORDER BY clauses."""
        self._stmt = self._stmt.order_by(*ordering)
        return self
        
    def limit(self, limit: int) -> "SafeQueryBuilder":
        """Add LIMIT clause."""
        self._stmt = self._stmt.limit(limit)
        return self
        
    async def get_one(self) -> Optional[T]:
        """Execute query and return one result."""
        result = await self.session.execute(self._stmt)
        return result.scalar_one_or_none()
        
    async def get_all(self) -> List[T]:
        """Execute query and return all results."""
        result = await self.session.execute(self._stmt)
        return result.scalars().all()


def safe_query(session: AsyncSession, model_class: Type[T]) -> SafeQueryBuilder:
    """Create a SafeQueryBuilder for the given model."""
    return SafeQueryBuilder(session, model_class)


# Common relationship loading patterns
BOOKING_RELATIONSHIPS = [
    "user",
    "class_instance", 
    "user_package"
]

CLASS_INSTANCE_RELATIONSHIPS = [
    "template",
    "instructor", 
    "bookings",
    "waitlist_entries"
]

USER_RELATIONSHIPS = [
    "bookings",
    "waitlist_entries",
    "user_packages"
]


async def safe_get_booking_with_relationships(session: AsyncSession, booking_id: int) -> Optional[Any]:
    """Safely get a booking with all needed relationships loaded."""
    from ..models.booking import Booking
    from ..models.class_schedule import ClassInstance
    
    return await (safe_query(session, Booking)
                 .with_relationships("user", "user_package")
                 .with_nested_relationship("class_instance", "template")
                 .with_nested_relationship("class_instance", "instructor")
                 .where(Booking.id == booking_id)
                 .get_one())


async def safe_get_user_bookings(session: AsyncSession, user_id: int, include_past: bool = False) -> List[Any]:
    """Safely get user bookings with all needed relationships."""
    from ..models.booking import Booking
    from ..models.class_schedule import ClassInstance
    from datetime import datetime, timezone
    
    query = (safe_query(session, Booking)
            .with_relationships("user", "user_package") 
            .with_nested_relationship("class_instance", "template")
            .with_nested_relationship("class_instance", "instructor")
            .where(Booking.user_id == user_id))
    
    if not include_past:
        # Join with ClassInstance to filter by datetime
        from sqlalchemy import and_
        query = query.where(ClassInstance.start_datetime > datetime.now(timezone.utc))
        query._stmt = query._stmt.join(ClassInstance)
        query = query.order_by(ClassInstance.start_datetime)
    else:
        query._stmt = query._stmt.join(ClassInstance)
        query = query.order_by(ClassInstance.start_datetime.desc())
        
    return await query.get_all()


async def safe_get_class_instance_with_counts(session: AsyncSession, class_id: int) -> Optional[Any]:
    """Safely get class instance with bookings and waitlist loaded for accurate counts."""
    from ..models.class_schedule import ClassInstance
    
    return await (safe_query(session, ClassInstance)
                 .with_relationships("template", "instructor", "bookings", "waitlist_entries")
                 .where(ClassInstance.id == class_id)
                 .get_one())