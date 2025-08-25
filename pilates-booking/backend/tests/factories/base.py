"""
Base factory configuration for all test factories.
"""

import factory
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal


class AsyncSQLAlchemyModelFactory(factory.alchemy.SQLAlchemyModelFactory):
    """Base factory for async SQLAlchemy models."""
    
    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        """Override to handle async session."""
        session = cls._meta.sqlalchemy_session
        obj = model_class(*args, **kwargs)
        session.add(obj)
        return obj


class BaseFactory(AsyncSQLAlchemyModelFactory):
    """Base factory class with common configuration."""
    
    class Meta:
        abstract = True
        sqlalchemy_session_persistence = "commit"