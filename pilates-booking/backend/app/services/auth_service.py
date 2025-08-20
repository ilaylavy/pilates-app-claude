from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status, Request

from ..models.user import User
from ..models.refresh_token import RefreshToken
from ..schemas.user import UserCreate
from ..core.security import (
    get_password_hash, 
    verify_password, 
    create_access_token, 
    create_refresh_token,
    generate_refresh_token,
    hash_token,
    generate_verification_token,
    generate_otp,
    validate_password_strength
)
from ..core.config import settings


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

    async def create_user_tokens(
        self, 
        user: User, 
        device_info: Optional[Dict[str, Any]] = None
    ) -> dict:
        """Create access and refresh tokens for user with device tracking."""
        access_token = create_access_token(subject=user.id)
        refresh_token_string = generate_refresh_token()
        refresh_token_hash = hash_token(refresh_token_string)
        
        # Create refresh token record for tracking
        refresh_token_record = RefreshToken(
            token_hash=refresh_token_hash,
            user_id=user.id,
            device_id=device_info.get("device_id") if device_info else None,
            device_name=device_info.get("device_name") if device_info else None,
            device_type=device_info.get("device_type") if device_info else None,
            ip_address=device_info.get("ip_address") if device_info else None,
            user_agent=device_info.get("user_agent") if device_info else None,
        )
        
        self.db.add(refresh_token_record)
        await self.db.commit()
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token_string,
            "token_type": "bearer"
        }

    async def refresh_access_token(
        self, 
        refresh_token: str,
        device_info: Optional[Dict[str, Any]] = None
    ) -> dict:
        """Refresh access token using refresh token with rotation."""
        refresh_token_hash = hash_token(refresh_token)
        
        # Find and validate refresh token
        stmt = select(RefreshToken).where(
            and_(
                RefreshToken.token_hash == refresh_token_hash,
                RefreshToken.is_active == True
            )
        )
        result = await self.db.execute(stmt)
        token_record = result.scalar_one_or_none()
        
        if not token_record or not token_record.is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token"
            )
        
        # Get user
        user = await self.get_user_by_id(token_record.user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        # Deactivate the old refresh token
        token_record.deactivate()
        
        # Create new tokens (rotation)
        return await self.create_user_tokens(user, device_info)

    async def logout_user(self, refresh_token: str) -> bool:
        """Logout user by invalidating refresh token."""
        refresh_token_hash = hash_token(refresh_token)
        
        stmt = select(RefreshToken).where(RefreshToken.token_hash == refresh_token_hash)
        result = await self.db.execute(stmt)
        token_record = result.scalar_one_or_none()
        
        if token_record:
            token_record.deactivate()
            await self.db.commit()
            return True
        return False

    async def logout_all_devices(self, user_id: int) -> int:
        """Logout user from all devices by invalidating all refresh tokens."""
        stmt = select(RefreshToken).where(
            and_(
                RefreshToken.user_id == user_id,
                RefreshToken.is_active == True
            )
        )
        result = await self.db.execute(stmt)
        tokens = result.scalars().all()
        
        count = 0
        for token in tokens:
            token.deactivate()
            count += 1
        
        await self.db.commit()
        return count

    async def get_user_sessions(self, user_id: int) -> list:
        """Get all active sessions for a user."""
        stmt = select(RefreshToken).where(
            and_(
                RefreshToken.user_id == user_id,
                RefreshToken.is_active == True
            )
        ).order_by(RefreshToken.last_used_at.desc())
        
        result = await self.db.execute(stmt)
        tokens = result.scalars().all()
        
        sessions = []
        for token in tokens:
            sessions.append({
                "id": token.id,
                "device_name": token.device_name,
                "device_type": token.device_type,
                "ip_address": token.ip_address,
                "last_used": token.last_used_at,
                "created_at": token.created_at
            })
        
        return sessions

    async def validate_password_requirements(self, password: str) -> dict:
        """Validate password meets security requirements."""
        return validate_password_strength(password)

    async def create_user_with_verification(self, user_create: UserCreate) -> tuple[User, str]:
        """Create user and return verification token."""
        # Validate password strength
        password_validation = await self.validate_password_requirements(user_create.password)
        if not password_validation["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Password does not meet security requirements",
                    "requirements": password_validation["requirements"]
                }
            )
        
        # Check if user already exists
        existing_user = await self.get_user_by_email(user_create.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create user with verification token
        verification_token = generate_verification_token()
        hashed_password = get_password_hash(user_create.password)
        
        db_user = User(
            email=user_create.email,
            hashed_password=hashed_password,
            first_name=user_create.first_name,
            last_name=user_create.last_name,
            phone=user_create.phone,
            role=user_create.role,
            is_verified=False,
            verification_token=verification_token
        )
        
        self.db.add(db_user)
        await self.db.commit()
        await self.db.refresh(db_user)
        
        return db_user, verification_token

    async def verify_email(self, token: str) -> bool:
        """Verify user email with token."""
        stmt = select(User).where(User.verification_token == token)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            return False
        
        user.is_verified = True
        user.verification_token = None
        await self.db.commit()
        return True

    async def generate_password_reset_token(self, email: str) -> str:
        """Generate password reset token for user."""
        user = await self.get_user_by_email(email)
        if not user:
            # Don't reveal if email exists or not
            return generate_verification_token()
        
        reset_token = generate_verification_token()
        user.reset_token = reset_token
        await self.db.commit()
        
        return reset_token

    async def reset_password(self, token: str, new_password: str) -> bool:
        """Reset user password with token."""
        # Validate new password
        password_validation = await self.validate_password_requirements(new_password)
        if not password_validation["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Password does not meet security requirements",
                    "requirements": password_validation["requirements"]
                }
            )
        
        stmt = select(User).where(User.reset_token == token)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            return False
        
        # Update password and clear reset token
        user.hashed_password = get_password_hash(new_password)
        user.reset_token = None
        
        # Logout from all devices for security
        await self.logout_all_devices(user.id)
        
        await self.db.commit()
        return True