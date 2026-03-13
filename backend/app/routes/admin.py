from fastapi import APIRouter, Depends, HTTPException, status, Response
from datetime import datetime, timezone
from bson import ObjectId
from typing import List

from app.schemas import (
    ApprovalCreate, ApprovalOut, RatingCreate, RatingOut, Decision,
    EmailRecipientCreate, EmailRecipientOut, ReportEmailSendRequest,
)
from app.database import (
    ideas_collection, approvals_collection, ratings_collection,
    users_collection, email_recipients_collection,
)
from app.auth import get_current_admin
from app.config import get_settings
from app.email_service import send_validated_idea_email
from app.email_service import send_detailed_report_email
from app.email_service import build_detailed_report_pdf

settings = get_settings()

router = APIRouter(prefix="/api/admin", tags=["Admin"])


async def _build_approved_ideas_report() -> List[dict]:
    """Build full detailed report for approved ideas ranked by average rating."""
    report_items = []
    cursor = ideas_collection.find({"approval_status": "approved"})

    async for idea in cursor:
        idea_id = str(idea["_id"])

        approvals = []
        approved_validators = []
        approval_cursor = approvals_collection.find({"idea_id": idea_id})
        async for approval in approval_cursor:
            approvals.append({
                "admin_id": approval["admin_id"],
                "admin_name": approval["admin_name"],
                "decision": approval["decision"],
                "timestamp": approval["timestamp"].isoformat() if isinstance(approval["timestamp"], datetime) else str(approval["timestamp"]),
            })
            if approval["decision"] == "approved":
                approved_validators.append(approval["admin_name"])

        ratings = []
        total_rating = 0
        ratings_cursor = ratings_collection.find({"idea_id": idea_id})
        async for rating in ratings_cursor:
            ratings.append({
                "admin_id": rating["admin_id"],
                "admin_name": rating.get("admin_name", ""),
                "rating": rating["rating"],
            })
            total_rating += rating["rating"]

        avg_rating = round(total_rating / len(ratings), 2) if ratings else 0
        validation_votes = len(approvals)
        approved_votes = len([a for a in approvals if a.get("decision") == "approved"])
        rejected_votes = len([a for a in approvals if a.get("decision") == "rejected"])

        report_items.append({
            "idea_id": idea_id,
            "title": idea["title"],
            "description": idea["description"],
            "user_name": idea.get("user_name", ""),
            "user_email": idea.get("user_email", ""),
            "user_role": idea.get("user_role", ""),
            "created_at": idea["created_at"].isoformat() if isinstance(idea["created_at"], datetime) else str(idea["created_at"]),
            "validators": approved_validators,
            "approvals": approvals,
            "ratings": ratings,
            "validation_votes": validation_votes,
            "approved_votes": approved_votes,
            "rejected_votes": rejected_votes,
            "average_rating": avg_rating,
            "total_ratings": len(ratings),
        })

    report_items.sort(
        key=lambda x: (x["average_rating"], x["total_ratings"]),
        reverse=True,
    )

    for idx, item in enumerate(report_items):
        item["rank"] = idx + 1

    return report_items


async def _build_structured_report_payload() -> dict:
    """Build a structured report payload shared by API response and email content."""
    report_items = await _build_approved_ideas_report()

    total_ratings = sum(item.get("total_ratings", 0) for item in report_items)
    weighted_rating_sum = sum(
        item.get("average_rating", 0) * item.get("total_ratings", 0)
        for item in report_items
    )
    overall_average_rating = round(weighted_rating_sum / total_ratings, 2) if total_ratings else 0

    total_validation_votes = sum(len(item.get("approvals", [])) for item in report_items)
    top_project = report_items[0] if report_items else None

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_approved_projects": len(report_items),
            "total_validation_votes": total_validation_votes,
            "total_ratings": total_ratings,
            "overall_average_rating": overall_average_rating,
            "top_project": {
                "title": top_project.get("title", "") if top_project else "",
                "average_rating": top_project.get("average_rating", 0) if top_project else 0,
                "rank": top_project.get("rank", 0) if top_project else 0,
            },
        },
        "report": report_items,
    }


async def _check_and_send_email(idea_id: str):
    """Check if idea has required approvals + ratings and send email if not already sent."""
    idea = await ideas_collection.find_one({"_id": ObjectId(idea_id)})
    if not idea or idea["approval_status"] != "approved":
        return
    if idea.get("email_sent"):
        return

    required = settings.REQUIRED_APPROVALS

    # Count approvals
    approval_count = await approvals_collection.count_documents({
        "idea_id": idea_id,
        "decision": "approved",
    })
    if approval_count < required:
        return

    # Count ratings
    rating_count = await ratings_collection.count_documents({"idea_id": idea_id})
    if rating_count < required:
        return

    # Gather full approval & rating details for the email
    approvals = []
    cursor = approvals_collection.find({"idea_id": idea_id})
    async for a in cursor:
        approvals.append({
            "admin_name": a["admin_name"],
            "decision": a["decision"],
            "timestamp": a["timestamp"].isoformat() if isinstance(a["timestamp"], datetime) else str(a["timestamp"]),
        })

    ratings = []
    total = 0
    cursor = ratings_collection.find({"idea_id": idea_id})
    async for r in cursor:
        ratings.append({
            "admin_name": r.get("admin_name", "Admin"),
            "rating": r["rating"],
        })
        total += r["rating"]

    avg_rating = round(total / len(ratings), 2) if ratings else 0

    # Mark email_sent to avoid duplicate sends
    await ideas_collection.update_one(
        {"_id": ObjectId(idea_id)},
        {"$set": {"email_sent": True}},
    )

    # Send email (async, non-blocking)
    await send_validated_idea_email(idea, approvals, ratings, avg_rating)


@router.post("/approve", response_model=ApprovalOut)
async def approve_or_reject_idea(
    data: ApprovalCreate,
    current_admin: dict = Depends(get_current_admin),
):
    """Approve or reject an idea. Requires 3 admin approvals to validate."""
    # Validate idea exists
    try:
        idea = await ideas_collection.find_one({"_id": ObjectId(data.idea_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid idea ID")

    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    if idea["approval_status"] == "rejected":
        raise HTTPException(status_code=400, detail="Idea is already rejected")

    if idea["approval_status"] == "approved":
        raise HTTPException(status_code=400, detail="Idea is already approved")

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
        # Check if REQUIRED_APPROVALS (3) admins have approved
        total_approvals = await approvals_collection.count_documents({
            "idea_id": data.idea_id,
            "decision": "approved",
        })

        if total_approvals >= settings.REQUIRED_APPROVALS:
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
    """Rate an approved idea (1-5 stars). Only admins who approved can rate."""
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

    # Verify this admin approved the idea
    admin_approval = await approvals_collection.find_one({
        "idea_id": data.idea_id,
        "admin_id": admin_id,
        "decision": "approved",
    })
    if not admin_approval:
        raise HTTPException(
            status_code=400,
            detail="Only admins who approved this idea can rate it",
        )

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
        # Check if email should be sent after rating update
        await _check_and_send_email(data.idea_id)
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

    # Check if all required ratings are in → trigger email
    await _check_and_send_email(data.idea_id)

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


# ── Email Recipient Management ──

@router.post("/email-recipients", response_model=EmailRecipientOut, status_code=status.HTTP_201_CREATED)
async def add_email_recipient(
    data: EmailRecipientCreate,
    current_admin: dict = Depends(get_current_admin),
):
    """Add an external email recipient for validated idea notifications."""
    existing = await email_recipients_collection.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already in recipient list")

    doc = {
        "name": data.name,
        "email": data.email,
        "added_by": current_admin["name"],
        "added_at": datetime.now(timezone.utc),
    }
    result = await email_recipients_collection.insert_one(doc)
    return EmailRecipientOut(
        id=str(result.inserted_id),
        name=doc["name"],
        email=doc["email"],
        added_by=doc["added_by"],
        added_at=doc["added_at"],
    )


@router.get("/email-recipients", response_model=List[EmailRecipientOut])
async def get_email_recipients(current_admin: dict = Depends(get_current_admin)):
    """Get all external email recipients."""
    recipients = []
    cursor = email_recipients_collection.find().sort("added_at", -1)
    async for r in cursor:
        recipients.append(EmailRecipientOut(
            id=str(r["_id"]),
            name=r["name"],
            email=r["email"],
            added_by=r.get("added_by", ""),
            added_at=r["added_at"],
        ))
    return recipients


@router.delete("/email-recipients/{recipient_id}")
async def remove_email_recipient(
    recipient_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """Remove an external email recipient."""
    try:
        result = await email_recipients_collection.delete_one({"_id": ObjectId(recipient_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid recipient ID")

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipient not found")

    return {"message": "Recipient removed successfully"}


@router.get("/reports/detailed")
async def get_detailed_report(current_admin: dict = Depends(get_current_admin)):
    """Get a full detailed approved ideas report ranked by average rating."""
    return await _build_structured_report_payload()


@router.get("/reports/detailed/pdf")
async def download_detailed_report_pdf(current_admin: dict = Depends(get_current_admin)):
    """Download the detailed report as PDF."""
    report_payload = await _build_structured_report_payload()
    pdf_bytes = build_detailed_report_pdf(report_payload)
    filename = f"approved_projects_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/reports/send")
async def send_detailed_report(
    payload: ReportEmailSendRequest,
    current_admin: dict = Depends(get_current_admin),
):
    """Send detailed approved ideas report to admins/superadmins and selected recipients."""
    report_payload = await _build_structured_report_payload()

    emails = set()

    # Always include all admins and super admins.
    cursor = users_collection.find({"user_type": {"$in": ["admin", "superadmin"]}}, {"email": 1})
    async for user in cursor:
        if user.get("email"):
            emails.add(user["email"])

    # Add selected custom recipients by ID.
    selected_count = 0
    if payload.recipient_ids:
        for recipient_id in payload.recipient_ids:
            try:
                recipient = await email_recipients_collection.find_one({"_id": ObjectId(recipient_id)})
            except Exception:
                raise HTTPException(status_code=400, detail=f"Invalid recipient ID: {recipient_id}")

            if recipient and recipient.get("email"):
                emails.add(recipient["email"])
                selected_count += 1

    if not emails:
        raise HTTPException(status_code=400, detail="No valid recipient emails found")

    await send_detailed_report_email(report_payload, list(emails))

    return {
        "message": "Detailed report email sent successfully",
        "report_items": len(report_payload.get("report", [])),
        "generated_at": report_payload.get("generated_at"),
        "selected_recipients": selected_count,
        "total_emails_sent": len(emails),
    }
