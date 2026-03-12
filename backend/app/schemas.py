from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ── Enums ──

class UserType(str, Enum):
    user = "user"
    admin = "admin"
    superadmin = "superadmin"


class ApprovalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class Decision(str, Enum):
    approved = "approved"
    rejected = "rejected"


# ── User Schemas ──

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    department: str = Field(..., min_length=1, max_length=100)
    role: str = Field(..., min_length=1, max_length=100)  # Student / Developer / Researcher
    description: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    department: str
    role: str
    description: Optional[str] = None
    user_type: UserType
    created_at: datetime


class AdminCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    department: str = Field(default="Admin", max_length=100)
    role: str = Field(default="Admin", max_length=100)
    description: Optional[str] = None


# ── Token Schemas ──

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TokenData(BaseModel):
    user_id: Optional[str] = None
    user_type: Optional[str] = None


# ── Idea Schemas ──

class IdeaCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10)


class IdeaOut(BaseModel):
    id: str
    title: str
    description: str
    multimedia_files: List[str] = []
    submitted_by_user_id: str
    user_name: str
    user_email: str
    user_role: str
    approval_status: ApprovalStatus
    created_at: datetime
    approvals: Optional[List[dict]] = []
    ratings: Optional[List[dict]] = []
    average_rating: Optional[float] = None


class IdeaDuplicateWarning(BaseModel):
    is_duplicate: bool
    similar_ideas: List[dict] = []
    message: str = ""


# ── Approval Schemas ──

class ApprovalCreate(BaseModel):
    idea_id: str
    decision: Decision


class ApprovalOut(BaseModel):
    id: str
    idea_id: str
    admin_id: str
    admin_name: str
    decision: Decision
    timestamp: datetime


# ── Rating Schemas ──

class RatingCreate(BaseModel):
    idea_id: str
    rating: int = Field(..., ge=1, le=5)


class RatingOut(BaseModel):
    id: str
    idea_id: str
    admin_id: str
    admin_name: Optional[str] = None
    rating: int


# ── Ranking Schema ──

class IdeaRanking(BaseModel):
    id: str
    title: str
    description: str
    user_name: str
    average_rating: float
    total_ratings: int
    rank: int
