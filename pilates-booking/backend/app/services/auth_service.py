from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from ..models.user import User
from ..schemas.user import UserCreate
from ..core.security import get_password_hash, verify_password, create_access_token, create_refresh_token


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_user(self, user_create: UserCreate) -> User:
        """Create a new user."""
        # Check if user already exists
        stmt = select(User).where(User.email == user_create.email)
        result = await self.db.execute(stmt)
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create new user
        hashed_password = get_password_hash(user_create.password)
        db_user = User(
            email=user_create.email,
            hashed_password=hashed_password,
            first_name=user_create.first_name,
            last_name=user_create.last_name,
            phone=user_create.phone,
            role=user_create.role
        )
        
        self.db.add(db_user)
        await self.db.commit()
        await self.db.refresh(db_user)
        
        return db_user

    async def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate user by email and password."""
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user or not verify_password(password, user.hashed_password):
            return None
        
        return user

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID."""
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    def create_user_tokens(self, user: User) -> dict:
        """Create access and refresh tokens for user."""
        access_token = create_access_token(subject=user.id)
        refresh_token = create_refresh_token(subject=user.id)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }