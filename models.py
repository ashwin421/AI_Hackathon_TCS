from enum import Enum
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class RequestType(Enum):
    ACCESS_CARD = "access_card"
    EQUIPMENT = "equipment"
    SOFTWARE_LICENSE = "software_license"
    PARKING_SPACE = "parking_space"
    MEETING_ROOM = "meeting_room"
    IT_SUPPORT = "it_support"
    OFFICE_SUPPLIES = "office_supplies"

class RequestStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class RequestPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class WorkplaceRequest(BaseModel):
    id: Optional[int] = None
    request_type: RequestType
    employee_id: str
    employee_name: str
    department: str
    title: str
    description: str
    priority: RequestPriority = RequestPriority.MEDIUM
    status: RequestStatus = RequestStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approval_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    notes: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class ApprovalDecision(BaseModel):
    request_id: int
    decision: str  # "approve" or "reject"
    approver: str
    reason: Optional[str] = None
    conditions: Optional[str] = None
