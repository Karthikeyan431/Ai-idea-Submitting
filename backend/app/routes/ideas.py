import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
import aiofiles

from app.schemas import IdeaCreate, IdeaOut, IdeaDuplicateWarning, ApprovalStatus
from app.database import ideas_collection, approvals_collection, ratings_collection
from app.auth import get_current_user
from app.ai_detection import check_duplicate_idea
from app.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/api/ideas", tags=["Ideas"])

ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp",  # Images
    ".mp4", ".avi", ".mov", ".wmv", ".webm",  # Videos
    ".mp3", ".wav", ".ogg", ".aac",  # Audio
    ".pdf", ".ppt", ".pptx", ".doc", ".docx", ".txt",  # Documents
}


def validate_file_extension(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS


async def enrich_idea(idea: dict) -> dict:
    """Add approvals, ratings, and average_rating to an idea."""
    idea_id = str(idea["_id"])

    # Get approvals
    approvals = []
    approval_count = 0
    cursor = approvals_collection.find({"idea_id": idea_id})
    async for approval in cursor:
        approvals.append({
            "admin_id": approval["admin_id"],
            "admin_name": approval["admin_name"],
            "decision": approval["decision"],
            "timestamp": approval["timestamp"].isoformat(),
        })
        if approval["decision"] == "approved":
            approval_count += 1

    # Get ratings
    ratings = []
    total_rating = 0
    cursor = ratings_collection.find({"idea_id": idea_id})
    async for rating in cursor:
        ratings.append({
            "admin_id": rating["admin_id"],
            "admin_name": rating.get("admin_name", ""),
            "rating": rating["rating"],
        })
        total_rating += rating["rating"]

    avg_rating = round(total_rating / len(ratings), 2) if ratings else None

    required = settings.REQUIRED_APPROVALS
    is_fully_validated = (
        approval_count >= required
        and len(ratings) >= required
        and idea["approval_status"] == "approved"
    )

    return IdeaOut(
        id=idea_id,
        title=idea["title"],
        description=idea["description"],
        multimedia_files=idea.get("multimedia_files", []),
        submitted_by_user_id=idea["submitted_by_user_id"],
        user_name=idea["user_name"],
        user_email=idea["user_email"],
        user_role=idea["user_role"],
        approval_status=idea["approval_status"],
        created_at=idea["created_at"],
        approvals=approvals,
        ratings=ratings,
        average_rating=avg_rating,
        approval_count=approval_count,
        required_approvals=required,
        rating_count=len(ratings),
        is_fully_validated=is_fully_validated,
        email_sent=idea.get("email_sent", False),
    )


@router.post("/check-duplicate", response_model=IdeaDuplicateWarning)
async def check_duplicate(
    idea: IdeaCreate,
    current_user: dict = Depends(get_current_user),
):
    """Check if a similar idea already exists before submitting."""
    result = await check_duplicate_idea(idea.title, idea.description)
    return IdeaDuplicateWarning(**result)


@router.post("/submit", response_model=IdeaOut, status_code=status.HTTP_201_CREATED)
async def submit_idea(
    title: str = Form(...),
    description: str = Form(...),
    files: List[UploadFile] = File(default=[]),
    current_user: dict = Depends(get_current_user),
):
    """Submit a new AI idea with optional multimedia files."""
    # Save uploaded files
    saved_files = []
    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)

    for file in files:
        if not file.filename:
            continue
        if not validate_file_extension(file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"File type not allowed: {file.filename}",
            )
        # Generate unique filename
        ext = os.path.splitext(file.filename)[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(upload_dir, unique_name)

        content = await file.read()
        if len(content) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail=f"File too large: {file.filename} (max {settings.MAX_FILE_SIZE_MB}MB)",
            )

        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)
        saved_files.append(unique_name)

    idea_doc = {
        "title": title,
        "description": description,
        "multimedia_files": saved_files,
        "submitted_by_user_id": str(current_user["_id"]),
        "user_name": current_user["name"],
        "user_email": current_user["email"],
        "user_role": current_user["role"],
        "approval_status": "pending",
        "created_at": datetime.now(timezone.utc),
    }

    result = await ideas_collection.insert_one(idea_doc)
    idea_doc["_id"] = result.inserted_id

    return await enrich_idea(idea_doc)


@router.get("/", response_model=List[IdeaOut])
async def get_all_ideas(current_user: dict = Depends(get_current_user)):
    """Get all ideas (non-rejected for regular users, all for admins)."""
    if current_user.get("user_type") in ["admin", "superadmin"]:
        cursor = ideas_collection.find().sort("created_at", -1)
    else:
        cursor = ideas_collection.find(
            {"approval_status": {"$ne": "rejected"}}
        ).sort("created_at", -1)

    ideas = []
    async for idea in cursor:
        ideas.append(await enrich_idea(idea))
    return ideas


@router.get("/my-ideas", response_model=List[IdeaOut])
async def get_my_ideas(current_user: dict = Depends(get_current_user)):
    """Get ideas submitted by the current user."""
    cursor = ideas_collection.find(
        {"submitted_by_user_id": str(current_user["_id"])}
    ).sort("created_at", -1)

    ideas = []
    async for idea in cursor:
        ideas.append(await enrich_idea(idea))
    return ideas


@router.get("/rankings", response_model=List[dict])
async def get_idea_rankings(current_user: dict = Depends(get_current_user)):
    """Get all approved ideas ranked by average rating."""
    cursor = ideas_collection.find({"approval_status": "approved"})

    ranked = []
    async for idea in cursor:
        idea_id = str(idea["_id"])
        # Calculate average rating
        ratings_cursor = ratings_collection.find({"idea_id": idea_id})
        total = 0
        count = 0
        ratings_list = []
        async for rating in ratings_cursor:
            total += rating["rating"]
            count += 1
            ratings_list.append({
                "admin_id": rating["admin_id"],
                "admin_name": rating.get("admin_name", ""),
                "rating": rating["rating"],
            })

        avg = round(total / count, 2) if count > 0 else 0

        ranked.append({
            "id": idea_id,
            "title": idea["title"],
            "description": idea["description"],
            "user_name": idea["user_name"],
            "average_rating": avg,
            "total_ratings": count,
            "ratings": ratings_list,
        })

    # Sort by average rating descending
    ranked.sort(key=lambda x: x["average_rating"], reverse=True)

    # Add rank
    for i, item in enumerate(ranked):
        item["rank"] = i + 1

    return ranked


@router.get("/{idea_id}", response_model=IdeaOut)
async def get_idea(idea_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single idea by ID."""
    try:
        idea = await ideas_collection.find_one({"_id": ObjectId(idea_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid idea ID")

    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    return await enrich_idea(idea)
