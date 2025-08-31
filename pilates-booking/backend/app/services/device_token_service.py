import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis

from ..models.device_token import DeviceToken, DevicePlatform
from ..models.user import User
from ..core.config import settings

logger = logging.getLogger("device_tokens")

@dataclass
class DeviceTokenStats:
    """Statistics for device tokens"""
    total_tokens: int
    active_tokens: int
    android_tokens: int
    ios_tokens: int
    inactive_tokens: int
    recent_registrations: int

class DeviceTokenService:
    """Service for managing device tokens"""
    
    def __init__(self, db: AsyncSession, redis_client: Optional[redis.Redis] = None):
        self.db = db
        self.redis = redis_client
    
    async def register_token(
        self,
        user_id: int,
        token: str,
        platform: DevicePlatform,
        app_version: Optional[str] = None,
        device_info: Optional[Dict[str, Any]] = None
    ) -> DeviceToken:
        """Register or update device token"""
        
        logger.info(f"Registering device token for user {user_id} on platform {platform}")
        
        try:
            # Check if token already exists for this user
            stmt = select(DeviceToken).where(
                and_(
                    DeviceToken.user_id == user_id,
                    DeviceToken.token == token
                )
            )
            result = await self.db.execute(stmt)
            existing_token = result.scalar_one_or_none()
            
            if existing_token:
                # Update existing token
                existing_token.platform = platform
                existing_token.app_version = app_version
                existing_token.device_info = device_info
                existing_token.is_active = True
                existing_token.update_last_used()
                
                await self.db.commit()
                await self.db.refresh(existing_token)
                
                logger.info(f"Updated existing device token {existing_token.id}")
                return existing_token
            else:
                # Create new token
                device_token = DeviceToken(
                    user_id=user_id,
                    token=token,
                    platform=platform,
                    app_version=app_version,
                    device_info=device_info,
                    is_active=True
                )
                
                self.db.add(device_token)
                await self.db.commit()
                await self.db.refresh(device_token)
                
                logger.info(f"Created new device token {device_token.id}")
                return device_token
                
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to register device token: {str(e)}")
            raise
    
    async def get_user_tokens(
        self,
        user_id: int,
        platform: Optional[DevicePlatform] = None,
        active_only: bool = True
    ) -> List[DeviceToken]:
        """Get device tokens for a user"""
        
        stmt = select(DeviceToken).where(DeviceToken.user_id == user_id)
        
        if platform:
            stmt = stmt.where(DeviceToken.platform == platform)
        
        if active_only:
            stmt = stmt.where(DeviceToken.is_active == True)
        
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
    
    async def get_android_tokens(self, user_id: int) -> List[DeviceToken]:
        """Get active Android tokens for a user"""
        return await self.get_user_tokens(
            user_id=user_id,
            platform=DevicePlatform.ANDROID,
            active_only=True
        )
    
    async def get_ios_tokens(self, user_id: int) -> List[DeviceToken]:
        """Get active iOS tokens for a user"""
        return await self.get_user_tokens(
            user_id=user_id,
            platform=DevicePlatform.IOS,
            active_only=True
        )
    
    async def deactivate_token(self, token_id: int, user_id: int) -> bool:
        """Deactivate a device token"""
        
        try:
            stmt = select(DeviceToken).where(
                and_(
                    DeviceToken.id == token_id,
                    DeviceToken.user_id == user_id
                )
            )
            result = await self.db.execute(stmt)
            device_token = result.scalar_one_or_none()
            
            if not device_token:
                logger.warning(f"Device token {token_id} not found for user {user_id}")
                return False
            
            device_token.deactivate()
            await self.db.commit()
            
            logger.info(f"Deactivated device token {token_id}")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to deactivate device token: {str(e)}")
            raise
    
    async def deactivate_user_tokens(
        self,
        user_id: int,
        platform: Optional[DevicePlatform] = None
    ) -> int:
        """Deactivate all tokens for a user"""
        
        try:
            stmt = select(DeviceToken).where(
                and_(
                    DeviceToken.user_id == user_id,
                    DeviceToken.is_active == True
                )
            )
            
            if platform:
                stmt = stmt.where(DeviceToken.platform == platform)
            
            result = await self.db.execute(stmt)
            tokens = result.scalars().all()
            
            deactivated_count = 0
            for token in tokens:
                token.deactivate()
                deactivated_count += 1
            
            await self.db.commit()
            
            logger.info(f"Deactivated {deactivated_count} tokens for user {user_id}")
            return deactivated_count
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to deactivate user tokens: {str(e)}")
            raise
    
    async def cleanup_inactive_tokens(self, days_inactive: int = 30) -> int:
        """Remove tokens that haven't been used for specified days"""
        
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_inactive)
            
            stmt = select(DeviceToken).where(
                DeviceToken.last_used_at < cutoff_date
            )
            result = await self.db.execute(stmt)
            old_tokens = result.scalars().all()
            
            removed_count = 0
            for token in old_tokens:
                await self.db.delete(token)
                removed_count += 1
            
            await self.db.commit()
            
            logger.info(f"Removed {removed_count} inactive device tokens")
            return removed_count
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to cleanup inactive tokens: {str(e)}")
            raise
    
    async def update_token_usage(self, token_id: int) -> bool:
        """Update last used timestamp for a token"""
        
        try:
            stmt = select(DeviceToken).where(DeviceToken.id == token_id)
            result = await self.db.execute(stmt)
            device_token = result.scalar_one_or_none()
            
            if device_token:
                device_token.update_last_used()
                await self.db.commit()
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to update token usage: {str(e)}")
            return False
    
    async def get_token_stats(self) -> DeviceTokenStats:
        """Get device token statistics"""
        
        try:
            # Total tokens
            total_stmt = select(func.count(DeviceToken.id))
            total_result = await self.db.execute(total_stmt)
            total_tokens = total_result.scalar() or 0
            
            # Active tokens
            active_stmt = select(func.count(DeviceToken.id)).where(
                DeviceToken.is_active == True
            )
            active_result = await self.db.execute(active_stmt)
            active_tokens = active_result.scalar() or 0
            
            # Android tokens
            android_stmt = select(func.count(DeviceToken.id)).where(
                and_(
                    DeviceToken.platform == DevicePlatform.ANDROID,
                    DeviceToken.is_active == True
                )
            )
            android_result = await self.db.execute(android_stmt)
            android_tokens = android_result.scalar() or 0
            
            # iOS tokens
            ios_stmt = select(func.count(DeviceToken.id)).where(
                and_(
                    DeviceToken.platform == DevicePlatform.IOS,
                    DeviceToken.is_active == True
                )
            )
            ios_result = await self.db.execute(ios_stmt)
            ios_tokens = ios_result.scalar() or 0
            
            # Recent registrations (last 7 days)
            recent_date = datetime.utcnow() - timedelta(days=7)
            recent_stmt = select(func.count(DeviceToken.id)).where(
                DeviceToken.created_at > recent_date
            )
            recent_result = await self.db.execute(recent_stmt)
            recent_registrations = recent_result.scalar() or 0
            
            return DeviceTokenStats(
                total_tokens=total_tokens,
                active_tokens=active_tokens,
                android_tokens=android_tokens,
                ios_tokens=ios_tokens,
                inactive_tokens=total_tokens - active_tokens,
                recent_registrations=recent_registrations
            )
            
        except Exception as e:
            logger.error(f"Failed to get token stats: {str(e)}")
            return DeviceTokenStats(
                total_tokens=0,
                active_tokens=0,
                android_tokens=0,
                ios_tokens=0,
                inactive_tokens=0,
                recent_registrations=0
            )
    
    async def validate_token_ownership(self, token_id: int, user_id: int) -> bool:
        """Validate that a token belongs to a user"""
        
        stmt = select(DeviceToken).where(
            and_(
                DeviceToken.id == token_id,
                DeviceToken.user_id == user_id
            )
        )
        result = await self.db.execute(stmt)
        token = result.scalar_one_or_none()
        
        return token is not None
    
    async def get_tokens_for_users(
        self,
        user_ids: List[int],
        platform: Optional[DevicePlatform] = None
    ) -> Dict[int, List[DeviceToken]]:
        """Get tokens for multiple users, grouped by user_id"""
        
        stmt = select(DeviceToken).where(
            and_(
                DeviceToken.user_id.in_(user_ids),
                DeviceToken.is_active == True
            )
        )
        
        if platform:
            stmt = stmt.where(DeviceToken.platform == platform)
        
        result = await self.db.execute(stmt)
        tokens = result.scalars().all()
        
        # Group by user_id
        user_tokens = {}
        for token in tokens:
            if token.user_id not in user_tokens:
                user_tokens[token.user_id] = []
            user_tokens[token.user_id].append(token)
        
        return user_tokens