from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.database import get_db
from ....core.deps import get_current_user
from ....models import User
from ....services.social_service import SocialService

router = APIRouter(prefix="/social", tags=["social"])


class FriendRequestModel(BaseModel):
    friend_id: int


class ClassInvitationModel(BaseModel):
    recipient_id: int
    class_id: int


class PrivacySettingsModel(BaseModel):
    show_in_attendees: bool = True
    allow_profile_viewing: bool = True
    show_stats: bool = True


@router.post("/friend-request", response_model=Dict)
async def send_friend_request(
    request: FriendRequestModel,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send a friend request."""
    social_service = SocialService(db)
    result = await social_service.send_friend_request(current_user.id, request.friend_id)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


@router.post("/friend-request/{user_id}/accept", response_model=Dict)
async def accept_friend_request(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Accept a friend request."""
    social_service = SocialService(db)
    result = await social_service.accept_friend_request(current_user.id, user_id)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


@router.delete("/friend-request/{user_id}", response_model=Dict)
async def reject_friend_request(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reject or remove a friend request/friendship."""
    social_service = SocialService(db)
    result = await social_service.reject_friend_request(current_user.id, user_id)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


@router.post("/block/{user_id}", response_model=Dict)
async def block_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Block a user."""
    social_service = SocialService(db)
    result = await social_service.block_user(current_user.id, user_id)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


@router.get("/friends", response_model=List[Dict])
async def get_friends(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of friends."""
    social_service = SocialService(db)
    return await social_service.get_friends(current_user.id)


@router.get("/friend-requests", response_model=Dict)
async def get_friend_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get pending friend requests."""
    social_service = SocialService(db)
    return await social_service.get_pending_friend_requests(current_user.id)


@router.get("/classes/{class_id}/attendees", response_model=List[Dict])
async def get_class_attendees(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of class attendees."""
    social_service = SocialService(db)
    return await social_service.get_class_attendees(class_id, current_user.id)


@router.post("/invite-to-class", response_model=Dict)
async def invite_to_class(
    invitation: ClassInvitationModel,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Invite a friend to a class."""
    social_service = SocialService(db)
    result = await social_service.invite_to_class(
        current_user.id, invitation.recipient_id, invitation.class_id
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


@router.get("/mutual-classes/{friend_id}", response_model=List[Dict])
async def get_mutual_classes(
    friend_id: int,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get classes attended together with a friend."""
    social_service = SocialService(db)
    return await social_service.get_mutual_classes(current_user.id, friend_id, limit)


@router.get("/classes/{class_id}/friends", response_model=List[Dict])
async def get_friends_in_class(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get friends attending a specific class."""
    social_service = SocialService(db)
    return await social_service.get_friends_in_class(current_user.id, class_id)


@router.get("/users/{user_id}/public-profile", response_model=Dict)
async def get_public_profile(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get public profile of a user."""
    from sqlalchemy.future import select
    from sqlalchemy.orm import selectinload
    
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    privacy_settings = user.privacy_settings or {}
    
    # Check if profile viewing is allowed
    if not privacy_settings.get("allow_profile_viewing", True):
        # Only allow friends to view
        social_service = SocialService(db)
        if not await social_service.are_friends(current_user.id, user_id):
            raise HTTPException(status_code=403, detail="Profile viewing not allowed")
    
    # Get basic profile info
    profile = {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "avatar_url": user.avatar_url,
        "member_since": user.created_at,
    }
    
    # Add stats if allowed
    if privacy_settings.get("show_stats", True):
        from sqlalchemy import func
        from ....models import Booking
        
        # Get user stats
        stats_stmt = select(
            func.count(Booking.id).label("total_bookings")
        ).where(
            Booking.user_id == user_id,
            Booking.status.in_(["confirmed", "completed"])
        )
        stats_result = await db.execute(stats_stmt)
        stats = stats_result.first()
        
        profile["stats"] = {
            "total_bookings": stats.total_bookings if stats else 0
        }
    
    # Check friendship status
    social_service = SocialService(db)
    profile["is_friend"] = await social_service.are_friends(current_user.id, user_id)
    
    return profile


@router.put("/privacy-settings", response_model=Dict)
async def update_privacy_settings(
    settings: PrivacySettingsModel,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update user privacy settings."""
    current_user.privacy_settings = settings.dict()
    await db.commit()
    
    return {"success": True, "privacy_settings": current_user.privacy_settings}