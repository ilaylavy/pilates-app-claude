from typing import Generator, Optional, List
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import redis.asyncio as redis

from ...core.database import AsyncSessionLocal
from ...core.config import settings
from ...core.security import verify_token
from ...core.logging import auth_logger, db_logger
from ...models.user import User, UserRole

security = HTTPBearer()


async def get_db() -> AsyncSession:
    """Database dependency."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
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
        auth_logger.warning("Authentication failed - Invalid token")
        raise credentials_exception
    
    stmt = select(User).where(User.id == int(user_id))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if user is None:
        auth_logger.warning(f"Authentication failed - User not found: {user_id}")
        raise credentials_exception
    
    if not user.is_active:
        auth_logger.warning(f"Authentication failed - Inactive user: {user.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    auth_logger.debug(f"User authenticated successfully: {user.email}")
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


def require_admin_or_self(user_id_key: str = "user_id"):
    """Dependency factory that allows admin access or access to own resources."""
    def check_admin_or_self(
        request: Request,
        current_user: User = Depends(get_current_active_user)
    ):
        # Get the user_id from path parameters
        path_params = request.path_params
        target_user_id = path_params.get(user_id_key)
        
        # Allow if admin or accessing own resource
        if current_user.role == UserRole.ADMIN or (target_user_id and str(current_user.id) == str(target_user_id)):
            return current_user
            
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation not permitted"
        )
    return check_admin_or_self


def require_instructor_for_class():
    """Dependency to check if user is instructor for a specific class."""
    def check_instructor_access(
        request: Request,
        current_user: User = Depends(get_current_active_user),
        db: AsyncSession = Depends(get_db)
    ):
        # Admin always has access
        if current_user.role == UserRole.ADMIN:
            return current_user
            
        # For instructors, we would check if they're assigned to the specific class
        # This would require additional logic with class_id from path params
        if current_user.role == UserRole.INSTRUCTOR:
            return current_user
            
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only instructors can access this resource"
        )
    return check_instructor_access