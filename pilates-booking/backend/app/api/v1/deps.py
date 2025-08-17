from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import redis.asyncio as redis

from ...core.database import AsyncSessionLocal
from ...core.config import settings
from ...core.security import verify_token
from ...models.user import User, UserRole

security = HTTPBearer()


async def get_db() -> Generator[AsyncSession, None, None]:
    """Database dependency."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_redis() -> redis.Redis:
    """Redis dependency."""
    return redis.from_url(settings.REDIS_URL, encoding="utf8", decode_responses=True)


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """Get current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    user_id = verify_token(token)
    
    if user_id is None:
        raise credentials_exception
    
    stmt = select(User).where(User.id == int(user_id))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Inactive user"
        )
    return current_user


def require_roles(*allowed_roles: UserRole):
    """Dependency factory for role-based access control."""
    def check_roles(current_user: User = Depends(get_current_active_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted"
            )
        return current_user
    return check_roles


# Convenience dependencies for common role checks
get_admin_user = require_roles(UserRole.ADMIN)
get_instructor_user = require_roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
get_any_staff_user = require_roles(UserRole.INSTRUCTOR, UserRole.ADMIN)