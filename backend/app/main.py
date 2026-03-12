import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.database import init_db, users_collection
from app.auth import hash_password
from app.config import get_settings
from app.routes import auth, ideas, admin, superadmin

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    await init_db()
    try:
        await create_super_admin()
    except Exception as e:
        print(f"Warning: Could not create super admin - {e}")
    yield
    # Shutdown (nothing needed)


app = FastAPI(
    title="AI Idea Sharing & Evaluation Platform",
    description="A collaborative platform for sharing and evaluating innovative AI ideas",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(auth.router)
app.include_router(ideas.router)
app.include_router(admin.router)
app.include_router(superadmin.router)


async def create_super_admin():
    """Create super admin account if it doesn't exist."""
    from datetime import datetime, timezone

    existing = await users_collection.find_one({"email": settings.SUPER_ADMIN_EMAIL})
    if not existing:
        await users_collection.insert_one({
            "name": settings.SUPER_ADMIN_NAME,
            "email": settings.SUPER_ADMIN_EMAIL,
            "password": hash_password(settings.SUPER_ADMIN_PASSWORD),
            "department": "Administration",
            "role": "Super Admin",
            "description": "System Super Administrator",
            "user_type": "superadmin",
            "created_at": datetime.now(timezone.utc),
        })
        print(f"Super Admin created: {settings.SUPER_ADMIN_EMAIL}")


@app.get("/")
async def root():
    return {
        "message": "AI Idea Sharing & Evaluation Platform API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
