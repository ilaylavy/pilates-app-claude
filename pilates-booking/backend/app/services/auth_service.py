from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..core.logging_config import get_logger
from ..core.security import (create_access_token, create_refresh_token,
                             generate_otp, generate_refresh_token,
                             generate_verification_token, get_password_hash,
                             hash_token, validate_password_strength,
                             verify_password)
from ..models.refresh_token import RefreshToken
from ..models.user import User
from ..schemas.user import UserCreate
from ..services.business_logging_service import business_logger
from ..services.security_logging_service import security_logger


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.logger = get_logger("app.auth")

    async def create_user(self, user_create: UserCreate) -> User:
        """Create a new user."""
        try:
            self.logger.info("User registration attempt", email=user_create.email)

            # Check if user already exists
            stmt = select(User).where(User.email == user_create.email)
            result = await self.db.execute(stmt)
            existing_user = result.scalar_one_or_none()

            if existing_user:
                self.logger.warning(
                    "User registration failed - email already exists",
                    email=user_create.email,
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered",
                )

            # Create new user
            hashed_password = get_password_hash(user_create.password)
            db_user = User(
                email=user_create.email,
                hashed_password=hashed_password,
                first_name=user_create.first_name,
                last_name=user_create.last_name,
                phone=user_create.phone,
                role=user_create.role,
            )

            self.db.add(db_user)
            await self.db.commit()
            await self.db.refresh(db_user)

            # Log successful registration
            business_logger.log_user_registered(
                user_id=str(db_user.id), email=db_user.email, registration_method="web"
            )

            self.logger.info(
                "User registration successful",
                user_id=str(db_user.id),
                email=db_user.email,
                role=db_user.role.value,
            )

            return db_user

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(
                "User registration failed with exception",
                exc_info=True,
                email=user_create.email,
                error=str(e),
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Registration failed",
            )

    async def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate user by email and password."""
        try:
            self.logger.debug("User authentication attempt", email=email)

            stmt = select(User).where(User.email == email)
            result = await self.db.execute(stmt)
            user = result.scalar_one_or_none()

            if not user:
                self.logger.warning(
                    "Authentication failed - user not found", email=email
                )
                return None

            if not verify_password(password, user.hashed_password):
                self.logger.warning(
                    "Authentication failed - invalid password",
                    email=email,
                    user_id=str(user.id),
                )
                return None

            if not user.is_active:
                self.logger.warning(
                    "Authentication failed - user inactive",
                    email=email,
                    user_id=str(user.id),
                )
                return None

            self.logger.info(
                "User authentication successful", email=email, user_id=str(user.id)
            )

            return user

        except Exception as e:
            self.logger.error(
                "Authentication failed with exception",
                exc_info=True,
                email=email,
                error=str(e),
            )
            return None

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID with user_packages relationship loaded."""
        from sqlalchemy.orm import selectinload
        from app.models.package import UserPackage
        
        stmt = (
            select(User)
            .options(selectinload(User.user_packages))
            .where(User.id == user_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_user_tokens(
        self, user: User, device_info: Optional[Dict[str, Any]] = None
    ) -> dict:
        """Create access and refresh tokens for user with device tracking."""
        try:
            self.logger.debug(
                "Creating user tokens",
                user_id=str(user.id),
                device_type=device_info.get("device_type") if device_info else None,
            )

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

            # Log token creation
            business_logger.log_event(
                "auth.token_created",
                user_id=str(user.id),
                device_type=device_info.get("device_type")
                if device_info
                else "unknown",
                ip_address=device_info.get("ip_address") if device_info else None,
            )

            self.logger.info(
                "User tokens created successfully",
                user_id=str(user.id),
                token_id=str(refresh_token_record.id),
            )

            return {
                "access_token": access_token,
                "refresh_token": refresh_token_string,
                "token_type": "bearer",
            }

        except Exception as e:
            self.logger.error(
                "Token creation failed",
                exc_info=True,
                user_id=str(user.id),
                error=str(e),
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Token creation failed",
            )

    async def refresh_access_token(
        self, refresh_token: str, device_info: Optional[Dict[str, Any]] = None
    ) -> dict:
        """Refresh access token using refresh token with rotation."""
        refresh_token_hash = hash_token(refresh_token)

        # Find and validate refresh token
        stmt = select(RefreshToken).where(
            and_(
                RefreshToken.token_hash == refresh_token_hash,
                RefreshToken.is_active == True,
            )
        )
        result = await self.db.execute(stmt)
        token_record = result.scalar_one_or_none()

        if not token_record or not token_record.is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            )

        # Get user
        user = await self.get_user_by_id(token_record.user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )

        # Deactivate the old refresh token
        token_record.deactivate()

        # Create new tokens (rotation)
        return await self.create_user_tokens(user, device_info)

    async def logout_user(self, refresh_token: str) -> bool:
        """Logout user by invalidating refresh token."""
        try:
            refresh_token_hash = hash_token(refresh_token)

            stmt = select(RefreshToken).where(
                RefreshToken.token_hash == refresh_token_hash
            )
            result = await self.db.execute(stmt)
            token_record = result.scalar_one_or_none()

            if token_record:
                user_id = str(token_record.user_id)

                token_record.deactivate()
                await self.db.commit()

                # Log logout event
                business_logger.log_event(
                    "auth.logout",
                    user_id=user_id,
                    device_type=token_record.device_type,
                    ip_address=token_record.ip_address,
                )

                self.logger.info(
                    "User logout successful",
                    user_id=user_id,
                    token_id=str(token_record.id),
                )
                return True

            self.logger.warning("Logout attempted with invalid token")
            return False

        except Exception as e:
            self.logger.error(
                "Logout failed with exception", exc_info=True, error=str(e)
            )
            return False

    async def logout_all_devices(self, user_id: int) -> int:
        """Logout user from all devices by invalidating all refresh tokens."""
        stmt = select(RefreshToken).where(
            and_(RefreshToken.user_id == user_id, RefreshToken.is_active == True)
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
        stmt = (
            select(RefreshToken)
            .where(
                and_(RefreshToken.user_id == user_id, RefreshToken.is_active == True)
            )
            .order_by(RefreshToken.last_used_at.desc())
        )

        result = await self.db.execute(stmt)
        tokens = result.scalars().all()

        sessions = []
        for token in tokens:
            sessions.append(
                {
                    "id": token.id,
                    "device_name": token.device_name,
                    "device_type": token.device_type,
                    "ip_address": token.ip_address,
                    "last_used": token.last_used_at,
                    "created_at": token.created_at,
                }
            )

        return sessions

    async def validate_password_requirements(self, password: str) -> dict:
        """Validate password meets security requirements."""
        return validate_password_strength(password)

    async def create_user_with_verification(
        self, user_create: UserCreate
    ) -> tuple[User, str]:
        """Create user and return verification token."""
        # Validate password strength
        password_validation = await self.validate_password_requirements(
            user_create.password
        )
        if not password_validation["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Password does not meet security requirements",
                    "requirements": password_validation["requirements"],
                },
            )

        # Check if user already exists
        existing_user = await self.get_user_by_email(user_create.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
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
            verification_token=verification_token,
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
                    "requirements": password_validation["requirements"],
                },
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
