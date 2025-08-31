from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator

from ..models.notification import NotificationType, NotificationPriority


class NotificationBase(BaseModel):
    """Base notification schema"""
    type: NotificationType
    title: str = Field(..., max_length=200, min_length=1)
    body: str = Field(..., max_length=1000, min_length=1)
    data: Optional[Dict[str, Any]] = None
    priority: NotificationPriority = NotificationPriority.NORMAL
    expires_at: Optional[datetime] = None


class NotificationCreate(NotificationBase):
    """Schema for creating notifications"""
    user_id: int = Field(..., gt=0)
    source_type: Optional[str] = Field(None, max_length=50)
    source_id: Optional[int] = Field(None, gt=0)
    extra_data: Optional[Dict[str, Any]] = None


class NotificationBulkCreate(NotificationBase):
    """Schema for creating bulk notifications"""
    user_ids: List[int] = Field(..., min_items=1)
    source_type: Optional[str] = Field(None, max_length=50)
    source_id: Optional[int] = Field(None, gt=0)
    extra_data: Optional[Dict[str, Any]] = None
    
    @validator('user_ids')
    def validate_user_ids(cls, v):
        if any(uid <= 0 for uid in v):
            raise ValueError('All user IDs must be positive integers')
        if len(set(v)) != len(v):
            raise ValueError('User IDs must be unique')
        return v


class NotificationBroadcast(NotificationBase):
    """Schema for broadcast notifications"""
    target_roles: List[str] = Field(..., min_items=1)
    source_type: Optional[str] = Field(None, max_length=50)
    source_id: Optional[int] = Field(None, gt=0)
    extra_data: Optional[Dict[str, Any]] = None
    
    @validator('target_roles')
    def validate_target_roles(cls, v):
        from ..models.user import UserRole
        valid_roles = [role.value for role in UserRole]
        for role in v:
            if role not in valid_roles:
                raise ValueError(f'Invalid role: {role}. Valid roles: {valid_roles}')
        return v


class NotificationResponse(BaseModel):
    """Schema for notification response"""
    id: int
    type: str
    title: str
    body: str
    data: Optional[Dict[str, Any]]
    priority: str
    created_at: datetime
    expires_at: Optional[datetime]
    source_type: Optional[str]
    source_id: Optional[int]
    extra_data: Optional[Dict[str, Any]]
    is_broadcast: bool
    is_read: bool
    is_dismissed: bool

    class Config:
        from_attributes = True


class NotificationMarkRead(BaseModel):
    """Schema for marking notifications as read"""
    notification_ids: List[int] = Field(..., min_items=1, max_items=100)
    
    @validator('notification_ids')
    def validate_notification_ids(cls, v):
        if any(nid <= 0 for nid in v):
            raise ValueError('All notification IDs must be positive integers')
        return list(set(v))  # Remove duplicates


class NotificationUnreadCount(BaseModel):
    """Schema for unread count response"""
    count: int = Field(..., ge=0)


class NotificationPaginationResponse(BaseModel):
    """Schema for paginated notification response (your enhancement #8)"""
    notifications: List[NotificationResponse]
    pagination: Dict[str, Any] = Field(
        ..., 
        example={
            "total": 150,
            "skip": 0,
            "limit": 50,
            "has_more": True
        }
    )
    unread_count: int = Field(..., ge=0)


class NotificationPreferenceBase(BaseModel):
    """Base notification preference schema"""
    notification_type: NotificationType
    channel_email: bool = True
    channel_push: bool = True
    channel_in_app: bool = True
    enabled: bool = True


class NotificationPreferenceCreate(NotificationPreferenceBase):
    """Schema for creating notification preferences"""
    pass


class NotificationPreferenceUpdate(BaseModel):
    """Schema for updating notification preferences"""
    channel_email: Optional[bool] = None
    channel_push: Optional[bool] = None
    channel_in_app: Optional[bool] = None
    enabled: Optional[bool] = None


class NotificationPreferenceResponse(NotificationPreferenceBase):
    """Schema for notification preference response"""
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NotificationTemplateResponse(BaseModel):
    """Schema for notification template response"""
    id: int
    type: str
    title_en: str
    title_he: str
    body_en: str
    body_he: str
    variables: Optional[List[str]]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NotificationRenderRequest(BaseModel):
    """Schema for template rendering request"""
    notification_type: NotificationType
    language: str = Field("en", pattern="^(en|he)$")
    variables: Dict[str, Any] = Field(default_factory=dict)


class NotificationRenderResponse(BaseModel):
    """Schema for template rendering response"""
    title: str
    body: str


# Error response schemas
class NotificationError(BaseModel):
    """Standard error response"""
    detail: str
    error_code: Optional[str] = None


class NotificationValidationError(NotificationError):
    """Validation error response"""
    field_errors: Optional[Dict[str, List[str]]] = None