from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import (AsyncSession, async_sessionmaker,
                                    create_async_engine)
from sqlalchemy.ext.declarative import declarative_base

from .config import settings

# Create async engine with database-specific configuration
db_url = settings.DATABASE_URL
connect_args = {}

# Handle different database types
if "postgresql" in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
    connect_args = {"server_settings": {"jit": "off"}}
elif "sqlite" in db_url:
    connect_args = {"check_same_thread": False}

engine = create_async_engine(
    db_url,
    echo=settings.DEBUG,
    future=True,
    connect_args=connect_args,
    # Connection pooling configuration for performance and stability
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=settings.DB_POOL_RECYCLE,
    pool_pre_ping=True,  # Verify connections before use
    # Connection pool logging for debugging
    echo_pool=settings.DEBUG and settings.ENVIRONMENT == "development",
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Create base model with naming convention for constraints
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=convention)


class SafeReprMixin:
    """Mixin that provides a safe __repr__ method that handles detached instances."""
    
    def __repr__(self):
        """Safe repr that handles DetachedInstanceError."""
        class_name = self.__class__.__name__
        
        # Try to get the primary key
        try:
            pk_value = getattr(self, 'id', 'unknown')
        except Exception:
            pk_value = "detached"
            
        # Try to get a few safe attributes
        attrs = []
        for attr_name in ['id', 'name', 'email', 'status']:
            if hasattr(self.__class__, attr_name):
                try:
                    value = getattr(self, attr_name)
                    if value is not None:
                        attrs.append(f"{attr_name}={value!r}")
                except Exception:
                    continue
                    
        if not attrs:
            attrs.append(f"id={pk_value}")
            
        return f"<{class_name}({', '.join(attrs)})>"


class SafeBase(SafeReprMixin):
    """Base class with safe __repr__ method."""
    pass


Base = declarative_base(metadata=metadata, cls=SafeBase)


async def get_db():
    """Get database session dependency."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize database connection."""
    # Database tables are managed by Alembic migrations
    # Do not auto-create tables here - use Alembic migrations instead
    pass
