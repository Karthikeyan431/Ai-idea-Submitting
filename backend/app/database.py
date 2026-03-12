from motor.motor_asyncio import AsyncIOMotorClient
from app.config import get_settings

settings = get_settings()

client = AsyncIOMotorClient(
    settings.MONGODB_URL,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
)
db = client[settings.DATABASE_NAME]

# Collections
users_collection = db["users"]
ideas_collection = db["ideas"]
approvals_collection = db["approvals"]
ratings_collection = db["ratings"]


async def init_db():
    """Create indexes for the database collections."""
    try:
        await users_collection.create_index("email", unique=True)
        await ideas_collection.create_index("submitted_by_user_id")
        await ideas_collection.create_index("approval_status")
        await approvals_collection.create_index([("idea_id", 1), ("admin_id", 1)], unique=True)
        await ratings_collection.create_index([("idea_id", 1), ("admin_id", 1)], unique=True)
        print("Database indexes created successfully")
    except Exception as e:
        print(f"Warning: Could not create indexes - {e}")
        print("Make sure MongoDB is running. The app will retry on first request.")
