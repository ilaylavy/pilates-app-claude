"""
Device token management endpoints for push notifications
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis

from ....core.deps import get_db, get_current_user, get_admin_user, get_redis
from ....models.user import User
from ....models.device_token import DevicePlatform
from ....services.device_token_service import DeviceTokenService, DeviceTokenStats
from pydantic import BaseModel

router = APIRouter()

class DeviceTokenCreate(BaseModel):
    token: str
    platform: DevicePlatform
    app_version: Optional[str] = None
    device_info: Optional[Dict[str, Any]] = None

class DeviceTokenResponse(BaseModel):
    id: int
    token: str
    platform: DevicePlatform
    app_version: Optional[str]
    device_info: Optional[Dict[str, Any]]
    is_active: bool
    created_at: str
    last_used_at: str

class DeviceTokenStatsResponse(BaseModel):
    total_tokens: int
    active_tokens: int
    android_tokens: int
    ios_tokens: int
    inactive_tokens: int
    recent_registrations: int

@router.post("/register", response_model=DeviceTokenResponse)
async def register_device_token(
    token_data: DeviceTokenCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Register a device token for push notifications"""
    
    # Platform validation - currently only Android is supported
    if token_data.platform.lower() not in ['android']:
        raise HTTPException(
            status_code=400, 
            detail="Only Android push notifications are currently supported. iOS support coming soon!"
        )
    
    token_service = DeviceTokenService(db, redis_client)
    
    try:
        device_token = await token_service.register_token(
            user_id=current_user.id,
            token=token_data.token,
            platform=token_data.platform,
            app_version=token_data.app_version,
            device_info=token_data.device_info
        )
        
        return DeviceTokenResponse(
            id=device_token.id,
            token=device_token.token,
            platform=device_token.platform,
            app_version=device_token.app_version,
            device_info=device_token.device_info,
            is_active=device_token.is_active,
            created_at=device_token.created_at.isoformat(),
            last_used_at=device_token.last_used_at.isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/my-tokens", response_model=List[DeviceTokenResponse])
async def get_my_device_tokens(
    platform: Optional[DevicePlatform] = None,
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Get current user's device tokens"""
    
    token_service = DeviceTokenService(db, redis_client)
    
    try:
        tokens = await token_service.get_user_tokens(
            user_id=current_user.id,
            platform=platform,
            active_only=active_only
        )
        
        return [
            DeviceTokenResponse(
                id=token.id,
                token=token.token,
                platform=token.platform,
                app_version=token.app_version,
                device_info=token.device_info,
                is_active=token.is_active,
                created_at=token.created_at.isoformat(),
                last_used_at=token.last_used_at.isoformat()
            )
            for token in tokens
        ]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/deactivate/{token_id}")
async def deactivate_device_token(
    token_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Deactivate a specific device token"""
    
    token_service = DeviceTokenService(db, redis_client)
    
    try:
        success = await token_service.deactivate_token(token_id, current_user.id)
        
        if not success:
            raise HTTPException(
                status_code=404, 
                detail="Device token not found or doesn't belong to current user"
            )
        
        return {"status": "success", "message": "Device token deactivated"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/deactivate-all")
async def deactivate_all_tokens(
    platform: Optional[DevicePlatform] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Deactivate all device tokens for current user"""
    
    token_service = DeviceTokenService(db, redis_client)
    
    try:
        deactivated_count = await token_service.deactivate_user_tokens(
            user_id=current_user.id,
            platform=platform
        )
        
        return {
            "status": "success", 
            "message": f"Deactivated {deactivated_count} device tokens"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats", response_model=DeviceTokenStatsResponse)
async def get_device_token_stats(
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Get device token statistics (admin only)"""
    
    token_service = DeviceTokenService(db, redis_client)
    
    try:
        stats = await token_service.get_token_stats()
        
        return DeviceTokenStatsResponse(
            total_tokens=stats.total_tokens,
            active_tokens=stats.active_tokens,
            android_tokens=stats.android_tokens,
            ios_tokens=stats.ios_tokens,
            inactive_tokens=stats.inactive_tokens,
            recent_registrations=stats.recent_registrations
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/cleanup")
async def cleanup_inactive_tokens(
    days_inactive: int = 30,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Cleanup inactive device tokens (admin only)"""
    
    if days_inactive < 7:
        raise HTTPException(
            status_code=400,
            detail="Minimum days_inactive is 7 to prevent accidental cleanup"
        )
    
    token_service = DeviceTokenService(db, redis_client)
    
    try:
        removed_count = await token_service.cleanup_inactive_tokens(days_inactive)
        
        return {
            "status": "success",
            "message": f"Removed {removed_count} inactive device tokens",
            "removed_count": removed_count
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/platform-support")
async def get_platform_support():
    """Get information about supported platforms"""
    
    return {
        "supported_platforms": {
            "android": {
                "supported": True,
                "status": "fully_supported",
                "description": "Android push notifications via Firebase FCM",
                "requirements": ["Firebase registration", "FCM token"]
            },
            "ios": {
                "supported": False,
                "status": "coming_soon", 
                "description": "iOS push notifications coming soon",
                "requirements": ["Apple Developer Account ($99/year)", "APNs certificates", "iOS app configuration"],
                "eta": "Available once Apple Developer account is obtained"
            }
        },
        "current_implementation": {
            "provider": "Firebase Cloud Messaging (FCM)",
            "android_ready": True,
            "ios_infrastructure_ready": True,
            "ios_blocked_by": "Apple Developer Account requirement"
        }
    }

@router.post("/test-android")
async def test_android_tokens(
    user_id: Optional[int] = None,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Test Android token retrieval (admin only)"""
    
    token_service = DeviceTokenService(db, redis_client)
    target_user_id = user_id or admin_user.id
    
    try:
        android_tokens = await token_service.get_android_tokens(target_user_id)
        
        return {
            "user_id": target_user_id,
            "android_tokens_found": len(android_tokens),
            "tokens": [
                {
                    "id": token.id,
                    "platform": token.platform,
                    "is_active": token.is_active,
                    "created_at": token.created_at.isoformat(),
                    "device_info": token.device_info
                }
                for token in android_tokens
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))