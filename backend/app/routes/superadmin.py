from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from bson import ObjectId
from typing import List

from app.schemas import AdminCreate, UserOut
from app.database import users_collection, ideas_collection, approvals_collection, ratings_collection
from app.auth import get_current_superadmin, hash_password

router = APIRouter(prefix="/api/superadmin", tags=["Super Admin"])


def user_doc_to_out(user: dict) -> UserOut:
    return UserOut(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        department=user["department"],
        role=user["role"],
        description=user.get("description"),
        user_type=user["user_type"],
        created_at=user["created_at"],
    )


@router.post("/create-admin", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_admin(
    admin_data: AdminCreate,
    current_user: dict = Depends(get_current_superadmin),
):
    """Create a new admin account. Only super admin can do this."""
    existing = await users_collection.find_one({"email": admin_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    admin_doc = {
        "name": admin_data.name,
        "email": admin_data.email,
        "password": hash_password(admin_data.password),
        "department": admin_data.department,
        "role": admin_data.role,
        "description": admin_data.description,
        "user_type": "admin",
        "created_at": datetime.now(timezone.utc),
    }
    result = await users_collection.insert_one(admin_doc)
    admin_doc["_id"] = result.inserted_id

    return user_doc_to_out(admin_doc)


@router.post("/create-user", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: AdminCreate,
    current_user: dict = Depends(get_current_superadmin),
):
    """Create a new user account. Only super admin can do this."""
    existing = await users_collection.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "name": user_data.name,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "department": user_data.department,
        "role": user_data.role,
        "description": user_data.description,
        "user_type": "user",
        "created_at": datetime.now(timezone.utc),
    }
    result = await users_collection.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    return user_doc_to_out(user_doc)


@router.delete("/remove-admin/{admin_id}")
async def remove_admin(
    admin_id: str,
    current_user: dict = Depends(get_current_superadmin),
):
    """Remove an admin account. Only super admin can do this."""
    try:
        admin = await users_collection.find_one({"_id": ObjectId(admin_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid admin ID")

    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    if admin["user_type"] == "superadmin":
        raise HTTPException(status_code=400, detail="Cannot remove super admin")

    if admin["user_type"] != "admin":
        raise HTTPException(status_code=400, detail="User is not an admin")

    await users_collection.delete_one({"_id": ObjectId(admin_id)})
    return {"message": f"Admin '{admin['name']}' removed successfully"}


@router.get("/admins", response_model=List[UserOut])
async def get_all_admins(current_user: dict = Depends(get_current_superadmin)):
    """Get all admin accounts."""
    cursor = users_collection.find({"user_type": "admin"}).sort("created_at", -1)
    admins = []
    async for admin in cursor:
        admins.append(user_doc_to_out(admin))
    return admins


@router.get("/users", response_model=List[UserOut])
async def get_all_users(current_user: dict = Depends(get_current_superadmin)):
    """Get all user accounts."""
    cursor = users_collection.find().sort("created_at", -1)
    users = []
    async for user in cursor:
        users.append(user_doc_to_out(user))
    return users


@router.get("/analytics")
async def get_system_analytics(current_user: dict = Depends(get_current_superadmin)):
    """Get system analytics and statistics."""
    total_users = await users_collection.count_documents({"user_type": "user"})
    total_admins = await users_collection.count_documents({"user_type": "admin"})
    total_ideas = await ideas_collection.count_documents({})
    pending_ideas = await ideas_collection.count_documents({"approval_status": "pending"})
    approved_ideas = await ideas_collection.count_documents({"approval_status": "approved"})
    rejected_ideas = await ideas_collection.count_documents({"approval_status": "rejected"})
    total_approvals = await approvals_collection.count_documents({})
    total_ratings = await ratings_collection.count_documents({})

    return {
        "total_users": total_users,
        "total_admins": total_admins,
        "total_ideas": total_ideas,
        "pending_ideas": pending_ideas,
        "approved_ideas": approved_ideas,
        "rejected_ideas": rejected_ideas,
        "total_approvals": total_approvals,
        "total_ratings": total_ratings,
    }
