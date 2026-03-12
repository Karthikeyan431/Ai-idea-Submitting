from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas import UserRegister, UserLogin, Token, UserOut
from app.database import users_collection
from app.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


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


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister):
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

    token = create_access_token(data={"sub": str(result.inserted_id), "user_type": "user"})
    return Token(access_token=token, user=user_doc_to_out(user_doc))


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await users_collection.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(
        data={"sub": str(user["_id"]), "user_type": user["user_type"]}
    )
    return Token(access_token=token, user=user_doc_to_out(user))


@router.get("/me", response_model=UserOut)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return user_doc_to_out(current_user)
