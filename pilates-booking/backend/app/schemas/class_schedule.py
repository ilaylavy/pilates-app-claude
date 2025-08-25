from datetime import datetime, time
from typing import List, Optional

from pydantic import BaseModel

from ..models.class_schedule import ClassLevel, ClassStatus, WeekDay


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
    template: Optional[ClassTemplateResponse] = None
    instructor: Optional[InstructorResponse] = None
    available_spots: int = 0
    is_full: bool = False
    waitlist_count: int = 0
    participant_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClassInstanceWithParticipants(ClassInstanceResponse):
    participants: List[ParticipantResponse] = []

    model_config = {"from_attributes": True}
