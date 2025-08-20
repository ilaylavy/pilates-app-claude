from pydantic import BaseModel, computed_field
from typing import Optional, List
from datetime import datetime, time
from ..models.class_schedule import WeekDay, ClassLevel, ClassStatus


class ClassTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    duration_minutes: int = 60
    capacity: int = 12
    level: ClassLevel = ClassLevel.ALL_LEVELS
    day_of_week: WeekDay
    start_time: time


class ClassTemplateCreate(ClassTemplateBase):
    pass


class ClassTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    capacity: Optional[int] = None
    level: Optional[ClassLevel] = None
    day_of_week: Optional[WeekDay] = None
    start_time: Optional[time] = None
    is_active: Optional[bool] = None


class ClassTemplateResponse(ClassTemplateBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClassInstanceBase(BaseModel):
    start_datetime: datetime
    end_datetime: datetime
    status: ClassStatus = ClassStatus.SCHEDULED
    actual_capacity: Optional[int] = None
    notes: Optional[str] = None


class ClassInstanceCreate(ClassInstanceBase):
    template_id: int
    instructor_id: int


class ClassInstanceUpdate(BaseModel):
    instructor_id: Optional[int] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    status: Optional[ClassStatus] = None
    actual_capacity: Optional[int] = None
    notes: Optional[str] = None


class InstructorResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    
    model_config = {"from_attributes": True}


class ParticipantResponse(BaseModel):
    id: int
    name: str
    email: str
    booking_date: datetime

    model_config = {"from_attributes": True}


class ClassInstanceResponse(ClassInstanceBase):
    id: int
    template_id: int
    instructor_id: int
    template: ClassTemplateResponse
    instructor: InstructorResponse
    available_spots: int
    is_full: bool
    waitlist_count: int
    participant_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClassInstanceWithParticipants(ClassInstanceResponse):
    participants: List[ParticipantResponse] = []

    model_config = {"from_attributes": True}