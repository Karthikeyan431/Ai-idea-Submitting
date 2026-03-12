# AI Idea Sharing & Evaluation Platform

A collaborative full-stack platform where users submit innovative AI ideas, admins review/approve/rate them, and top ideas are ranked on a leaderboard.

## Tech Stack

| Layer          | Technology             |
|----------------|------------------------|
| Frontend       | React + Vite           |
| Backend        | FastAPI (Python)       |
| Database       | MongoDB                |
| Authentication | JWT (JSON Web Tokens)  |
| AI Feature     | TF-IDF / Sentence Transformers for duplicate detection |

## Features

- **User Registration & Login** — JWT-based authentication with role-based access
- **Idea Submission** — Submit AI ideas with multimedia file uploads (images, video, audio, PDF, PPT, DOCX, TXT)
- **AI Duplicate Detection** — Detects similar existing ideas using NLP similarity
- **Multi-Admin Approval** — All admins must approve; any single rejection removes the idea
- **Admin Rating System** — 1-5 star ratings from each admin
- **Idea Rankings** — Leaderboard sorted by average admin rating
- **Super Admin Panel** — Create/remove admins, view system analytics, manage all users
- **Admin Dashboard** — Review pending ideas, approve/reject, rate approved ideas

## User Roles

| Role         | Capabilities |
|-------------|-------------|
| User        | Register, login, submit ideas, view ideas & rankings |
| Admin       | All user capabilities + approve/reject/rate ideas |
| Super Admin | All admin capabilities + create/remove admins, system analytics |

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application entry point
│   │   ├── config.py            # Settings and environment variables
│   │   ├── database.py          # MongoDB connection and collections
│   │   ├── auth.py              # JWT authentication and authorization
│   │   ├── schemas.py           # Pydantic models
│   │   ├── ai_detection.py      # AI duplicate idea detection
│   │   └── routes/
│   │       ├── auth.py          # Registration & login endpoints
│   │       ├── ideas.py         # Idea CRUD & rankings endpoints
│   │       ├── admin.py         # Admin approval & rating endpoints
│   │       └── superadmin.py    # Super admin management endpoints
│   ├── requirements.txt
│   ├── .env
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── api.js               # Axios API client
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # Authentication context
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   └── StarRating.jsx
│   │   └── pages/
│   │       ├── Home.jsx
│   │       ├── Login.jsx
│   │       ├── Register.jsx
│   │       ├── IdeaFeed.jsx
│   │       ├── SubmitIdea.jsx
│   │       ├── MyIdeas.jsx
│   │       ├── Rankings.jsx
│   │       ├── AdminDashboard.jsx
│   │       └── SuperAdminPanel.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## Setup & Installation

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **MongoDB** (local or Atlas)

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
# Edit .env file with your MongoDB URI and settings

# Run the server
uvicorn app.main:app --reload --port 8000
```

The API docs will be available at: **http://localhost:8000/docs**

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at: **http://localhost:5173**

### 3. Default Super Admin

On first run, a super admin account is automatically created:

| Field    | Value                        |
|----------|------------------------------|
| Email    | superadmin@aiplatform.com    |
| Password | SuperAdmin@123               |

**Change these credentials in production!**

## API Endpoints

### Authentication
| Method | Endpoint           | Description      |
|--------|--------------------|------------------|
| POST   | /api/auth/register | Register user    |
| POST   | /api/auth/login    | Login            |
| GET    | /api/auth/me       | Get current user |

### Ideas
| Method | Endpoint                    | Description               |
|--------|-----------------------------|---------------------------|
| POST   | /api/ideas/submit           | Submit new idea           |
| POST   | /api/ideas/check-duplicate  | Check for similar ideas   |
| GET    | /api/ideas/                 | Get all ideas             |
| GET    | /api/ideas/my-ideas         | Get user's ideas          |
| GET    | /api/ideas/rankings         | Get idea rankings         |
| GET    | /api/ideas/{id}             | Get single idea           |

### Admin
| Method | Endpoint                    | Description               |
|--------|-----------------------------|---------------------------|
| POST   | /api/admin/approve          | Approve/reject idea       |
| POST   | /api/admin/rate             | Rate an idea              |
| GET    | /api/admin/dashboard        | Admin dashboard data      |
| GET    | /api/admin/approvals/{id}   | Get approvals for idea    |
| GET    | /api/admin/ratings/{id}     | Get ratings for idea      |

### Super Admin
| Method | Endpoint                         | Description          |
|--------|----------------------------------|----------------------|
| POST   | /api/superadmin/create-admin     | Create admin         |
| DELETE | /api/superadmin/remove-admin/{id}| Remove admin         |
| GET    | /api/superadmin/admins           | List all admins      |
| GET    | /api/superadmin/users            | List all users       |
| GET    | /api/superadmin/analytics        | System analytics     |

## Idea Workflow

1. User submits an idea (with optional AI duplicate check)
2. Idea is visible to all users (status: **pending**)
3. Admins review the idea
   - If **ANY** admin rejects → idea status becomes **rejected**
   - If **ALL** admins approve → idea status becomes **approved**
4. Admins rate approved ideas (1-5 stars)
5. Ideas are ranked by average admin rating

## Security

- Password hashing with **bcrypt**
- **JWT** token-based authentication
- Role-based access control (User / Admin / Super Admin)
- File upload validation (allowed extensions & size limits)
- CORS configuration
- Protected API routes
