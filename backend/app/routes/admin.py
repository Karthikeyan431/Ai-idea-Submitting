from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from bson import ObjectId
from typing import List

from app.schemas import ApprovalCreate, ApprovalOut, RatingCreate, RatingOut, Decision
from app.database import ideas_collection, approvals_collection, ratings_collection, users_collection
from app.auth import get_current_admin

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.post("/approve", response_model=ApprovalOut)
async def approve_or_reject_idea(
    data: ApprovalCreate,
    current_admin: dict = Depends(get_current_admin),
):
    """Approve or reject an idea. If any admin rejects, idea is rejected."""
    # Validate idea exists
    try:
        idea = await ideas_collection.find_one({"_id": ObjectId(data.idea_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid idea ID")

    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    if idea["approval_status"] == "rejected":
        raise HTTPException(status_code=400, detail="Idea is already rejected")

    admin_id = str(current_admin["_id"])

    # Check if this admin already reviewed
    existing = await approvals_collection.find_one({
        "idea_id": data.idea_id,
        "admin_id": admin_id,
    })
    if existing:
        raise HTTPException(status_code=400, detail="You have already reviewed this idea")

    # Create approval record
    approval_doc = {
        "idea_id": data.idea_id,
        "admin_id": admin_id,
        "admin_name": current_admin["name"],
        "decision": data.decision.value,
        "timestamp": datetime.now(timezone.utc),
    }
    result = await approvals_collection.insert_one(approval_doc)

    # If rejected by any admin → reject idea
    if data.decision == Decision.rejected:
        await ideas_collection.update_one(
            {"_id": ObjectId(data.idea_id)},
            {"$set": {"approval_status": "rejected"}},
        )
    else:
        # Check if ALL admins have approved
        total_admins = await users_collection.count_documents(
            {"user_type": {"$in": ["admin", "superadmin"]}}
        )
        total_approvals = await approvals_collection.count_documents({
            "idea_id": data.idea_id,
            "decision": "approved",
        })

        if total_approvals >= total_admins:
            await ideas_collection.update_one(
                {"_id": ObjectId(data.idea_id)},
                {"$set": {"approval_status": "approved"}},
            )

    approval_doc["_id"] = result.inserted_id
    return ApprovalOut(
        id=str(result.inserted_id),
        idea_id=approval_doc["idea_id"],
        admin_id=approval_doc["admin_id"],
        admin_name=approval_doc["admin_name"],
        decision=approval_doc["decision"],
        timestamp=approval_doc["timestamp"],
    )


@router.get("/approvals/{idea_id}", response_model=List[ApprovalOut])
async def get_approvals_for_idea(
    idea_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """Get all approval records for an idea."""
    approvals = []
    cursor = approvals_collection.find({"idea_id": idea_id})
    async for approval in cursor:
        approvals.append(ApprovalOut(
            id=str(approval["_id"]),
            idea_id=approval["idea_id"],
            admin_id=approval["admin_id"],
            admin_name=approval["admin_name"],
            decision=approval["decision"],
            timestamp=approval["timestamp"],
        ))
    return approvals


@router.post("/rate", response_model=RatingOut)
async def rate_idea(
    data: RatingCreate,
    current_admin: dict = Depends(get_current_admin),
):
    """Rate an approved idea (1-5 stars). Only admins can rate."""
    # Validate idea
    try:
        idea = await ideas_collection.find_one({"_id": ObjectId(data.idea_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid idea ID")

    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    if idea["approval_status"] != "approved":
        raise HTTPException(status_code=400, detail="Can only rate approved ideas")

    admin_id = str(current_admin["_id"])

    # Check existing rating
    existing = await ratings_collection.find_one({
        "idea_id": data.idea_id,
        "admin_id": admin_id,
    })

    if existing:
        # Update existing rating
        await ratings_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {"rating": data.rating}},
        )
        return RatingOut(
            id=str(existing["_id"]),
            idea_id=data.idea_id,
            admin_id=admin_id,
            admin_name=current_admin["name"],
            rating=data.rating,
        )

    # Create new rating
    rating_doc = {
        "idea_id": data.idea_id,
        "admin_id": admin_id,
        "admin_name": current_admin["name"],
        "rating": data.rating,
    }
    result = await ratings_collection.insert_one(rating_doc)

    return RatingOut(
        id=str(result.inserted_id),
        idea_id=data.idea_id,
        admin_id=admin_id,
        admin_name=current_admin["name"],
        rating=data.rating,
    )


@router.get("/ratings/{idea_id}", response_model=List[RatingOut])
async def get_ratings_for_idea(
    idea_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """Get all ratings for an idea."""
    ratings = []
    cursor = ratings_collection.find({"idea_id": idea_id})
    async for rating in cursor:
        ratings.append(RatingOut(
            id=str(rating["_id"]),
            idea_id=rating["idea_id"],
            admin_id=rating["admin_id"],
            admin_name=rating.get("admin_name", ""),
            rating=rating["rating"],
        ))
    return ratings


@router.get("/dashboard", response_model=List[dict])
async def admin_dashboard(current_admin: dict = Depends(get_current_admin)):
    """Get all ideas with full details for admin dashboard."""
    from app.routes.ideas import enrich_idea

    cursor = ideas_collection.find().sort("created_at", -1)
    ideas = []
    async for idea in cursor:
        enriched = await enrich_idea(idea)
        ideas.append(enriched.model_dump())
    return ideas
