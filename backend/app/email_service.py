"""
Email notification service for sending validated idea details
to admins and selected recipients.
"""

import smtplib
import asyncio
from datetime import datetime
from io import BytesIO
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import List
from app.config import get_settings
from app.database import users_collection, email_recipients_collection
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

settings = get_settings()


def _build_idea_email_html(idea: dict, approvals: list, ratings: list, avg_rating: float) -> str:
    """Build a detailed HTML email body for a validated idea."""
    approval_rows = ""
    for a in approvals:
        icon = "&#9989;" if a["decision"] == "approved" else "&#10060;"
        approval_rows += f"""
        <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">{icon} {a['admin_name']}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">{a['decision'].upper()}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">{a.get('timestamp', 'N/A')}</td>
        </tr>"""

    rating_rows = ""
    for r in ratings:
        stars = "&#11088;" * r["rating"] + "&#9734;" * (5 - r["rating"])
        rating_rows += f"""
        <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">{r.get('admin_name', 'Admin')}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">{stars} ({r['rating']}/5)</td>
        </tr>"""

    files_html = ""
    if idea.get("multimedia_files"):
        files_list = "".join(
            f'<li style="padding:4px 0;">{f}</li>' for f in idea["multimedia_files"]
        )
        files_html = f"""
        <div style="margin-top:16px;">
            <h3 style="color:#4f46e5;margin-bottom:8px;">Attached Files</h3>
            <ul style="color:#475569;">{files_list}</ul>
        </div>"""

    return f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:700px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <div style="background:linear-gradient(135deg,#6366f1,#0ea5e9);padding:32px 24px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;">&#127775; Idea Validated & Rated</h1>
            <p style="color:#e0e7ff;margin:8px 0 0;font-size:14px;">This idea has been approved by {settings.REQUIRED_APPROVALS} admins and fully rated</p>
        </div>

        <div style="padding:24px;">
            <div style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:20px;border-left:4px solid #6366f1;">
                <h2 style="color:#1e293b;margin:0 0 8px;">{idea['title']}</h2>
                <p style="color:#64748b;margin:0 0 12px;font-size:14px;">
                    Submitted by <strong>{idea['user_name']}</strong> ({idea['user_email']}) &middot; {idea['user_role']}
                </p>
                <p style="color:#334155;line-height:1.7;margin:0;">{idea['description']}</p>
            </div>

            <div style="text-align:center;background:#fef9c3;border-radius:8px;padding:16px;margin-bottom:20px;">
                <div style="font-size:28px;font-weight:700;color:#b45309;">&#11088; {avg_rating:.1f} / 5.0</div>
                <div style="color:#92400e;font-size:13px;">Average Rating from {len(ratings)} Admin(s)</div>
            </div>

            <h3 style="color:#4f46e5;margin-bottom:8px;">Admin Validations ({len(approvals)}/{settings.REQUIRED_APPROVALS})</h3>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:8px 12px;text-align:left;color:#64748b;">Admin</th>
                        <th style="padding:8px 12px;text-align:left;color:#64748b;">Decision</th>
                        <th style="padding:8px 12px;text-align:left;color:#64748b;">Timestamp</th>
                    </tr>
                </thead>
                <tbody>{approval_rows}</tbody>
            </table>

            <h3 style="color:#4f46e5;margin-bottom:8px;">Individual Ratings</h3>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:8px 12px;text-align:left;color:#64748b;">Admin</th>
                        <th style="padding:8px 12px;text-align:left;color:#64748b;">Rating</th>
                    </tr>
                </thead>
                <tbody>{rating_rows}</tbody>
            </table>

            {files_html}
        </div>

        <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">
                AI Idea Sharing &amp; Evaluation Platform &middot; Automated Notification
            </p>
        </div>
    </div>
    """


async def _get_all_recipient_emails() -> List[str]:
    """Gather all admin emails + custom email recipients."""
    emails = set()

    cursor = users_collection.find(
        {"user_type": {"$in": ["admin", "superadmin"]}},
        {"email": 1}
    )
    async for user in cursor:
        if user.get("email"):
            emails.add(user["email"])

    cursor = email_recipients_collection.find({}, {"email": 1})
    async for recipient in cursor:
        if recipient.get("email"):
            emails.add(recipient["email"])

    return list(emails)


def _send_email_sync(
    to_emails: List[str],
    subject: str,
    html_body: str,
    attachments: List[dict] | None = None,
):
    """Send email via SMTP (synchronous, run in thread)."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"[EMAIL] SMTP not configured. Would send to: {', '.join(to_emails)}")
        print(f"[EMAIL] Subject: {subject}")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
    msg["To"] = ", ".join(to_emails)

    msg.attach(MIMEText(html_body, "html"))

    for attachment in attachments or []:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(attachment["content"])
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f"attachment; filename={attachment['filename']}")
        if attachment.get("mime_type"):
            part.add_header("Content-Type", attachment["mime_type"])
        msg.attach(part)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, to_emails, msg.as_string())
        print(f"[EMAIL] Successfully sent to {len(to_emails)} recipients")
    except Exception as e:
        print(f"[EMAIL] Failed to send email: {e}")


async def send_validated_idea_email(idea: dict, approvals: list, ratings: list, avg_rating: float):
    """Send the validated idea details to all admins and custom recipients."""
    to_emails = await _get_all_recipient_emails()
    if not to_emails:
        print("[EMAIL] No recipients found, skipping email")
        return

    subject = f"[AI Idea Platform] Idea Validated: {idea['title']}"
    html_body = _build_idea_email_html(idea, approvals, ratings, avg_rating)

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _send_email_sync, to_emails, subject, html_body)


def _build_detailed_report_pdf(report_payload: dict) -> bytes:
    """Generate downloadable PDF bytes for the detailed report."""
    summary = report_payload.get("summary", {})
    report_items = report_payload.get("report", [])
    generated_at = report_payload.get("generated_at", "")

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )

    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("Approved Projects Detailed Report", styles["Title"]))
    story.append(Paragraph(f"Generated: {generated_at}", styles["Normal"]))
    story.append(Spacer(1, 6))

    summary_table = Table(
        [
            ["Approved Projects", "Validation Votes", "Total Ratings", "Overall Avg"],
            [
                str(summary.get("total_approved_projects", 0)),
                str(summary.get("total_validation_votes", 0)),
                str(summary.get("total_ratings", 0)),
                str(summary.get("overall_average_rating", 0)),
            ],
        ],
        colWidths=[42 * mm, 42 * mm, 42 * mm, 42 * mm],
    )
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 10))

    for item in report_items:
        story.append(Paragraph(f"#{item.get('rank', '-')} {item.get('title', '')}", styles["Heading3"]))
        story.append(Paragraph(
            f"By {item.get('user_name', '')} ({item.get('user_email', '')}) | Role: {item.get('user_role', '')}",
            styles["Normal"],
        ))
        story.append(Paragraph(item.get("description", ""), styles["Normal"]))
        story.append(Spacer(1, 4))

        metrics_table = Table([
            ["Validation Votes", "Approved", "Rejected", "Total Ratings", "Average Rating"],
            [
                str(item.get("validation_votes", 0)),
                str(item.get("approved_votes", 0)),
                str(item.get("rejected_votes", 0)),
                str(item.get("total_ratings", 0)),
                str(item.get("average_rating", 0)),
            ],
        ], colWidths=[31 * mm, 31 * mm, 31 * mm, 31 * mm, 31 * mm])
        metrics_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]))
        story.append(metrics_table)
        story.append(Spacer(1, 6))

        approvals = item.get("approvals", [])
        if approvals:
            story.append(Paragraph("Approval Decisions", styles["Heading4"]))
            approval_rows = [["Validator", "Decision", "Timestamp"]]
            for a in approvals:
                approval_rows.append([
                    a.get("admin_name", ""),
                    a.get("decision", "").upper(),
                    a.get("timestamp", ""),
                ])
            approval_table = Table(approval_rows, colWidths=[50 * mm, 30 * mm, 90 * mm])
            approval_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ]))
            story.append(approval_table)
            story.append(Spacer(1, 6))

        ratings = item.get("ratings", [])
        if ratings:
            story.append(Paragraph("Individual Ratings", styles["Heading4"]))
            rating_rows = [["Validator", "Rating"]]
            for r in ratings:
                rating_rows.append([r.get("admin_name", ""), f"{r.get('rating', 0)}/5"])
            rating_table = Table(rating_rows, colWidths=[100 * mm, 70 * mm])
            rating_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ]))
            story.append(rating_table)

        story.append(Spacer(1, 12))

    if not report_items:
        story.append(Paragraph("No approved ideas found.", styles["Normal"]))

    doc.build(story)
    pdf_data = buffer.getvalue()
    buffer.close()
    return pdf_data


def build_detailed_report_pdf(report_payload: dict) -> bytes:
    """Public wrapper for report PDF generation."""
    return _build_detailed_report_pdf(report_payload)


def _build_detailed_report_html(report_payload: dict) -> str:
    """Build mobile-friendly HTML for structured ranked approved ideas report."""
    summary = report_payload.get("summary", {})
    report_items = report_payload.get("report", [])
    generated_at = report_payload.get("generated_at", "")

    ranking_cards = ""
    detail_cards = ""

    for item in report_items:
        idea_link = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/reports#idea-{item.get('idea_id', '')}"
        description = item.get("description", "")
        description_preview = description if len(description) <= 220 else f"{description[:220]}..."

        approvals_items = "".join(
            f"<li style='margin:0 0 6px;color:#334155;line-height:1.5;'><strong>{a.get('admin_name', 'Admin')}</strong> - {a.get('decision', '').upper()}<br/><span style='color:#64748b;font-size:12px;'>{a.get('timestamp', '')}</span></li>"
            for a in item.get("approvals", [])
        ) or "<li style='color:#64748b;'>No validator decisions</li>"

        ratings_items = "".join(
            f"<li style='margin:0 0 6px;color:#334155;line-height:1.5;'><strong>{r.get('admin_name', 'Admin')}</strong> - {r.get('rating', 0)}/5</li>"
            for r in item.get("ratings", [])
        ) or "<li style='color:#64748b;'>No ratings</li>"

        ranking_cards += f"""
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:10px;background:#ffffff;word-break:break-word;overflow-wrap:anywhere;">
            <div style="font-size:12px;color:#64748b;margin-bottom:4px;">Rank #{item.get('rank', '-')}</div>
            <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:6px;line-height:1.35;">{item.get('title', '')}</div>
            <div style="font-size:13px;color:#334155;line-height:1.5;">Submitted by {item.get('user_name', '')}</div>
            <div style="font-size:13px;color:#334155;line-height:1.5;">Validation Votes {item.get('validation_votes', len(item.get('approvals', [])))} | Ratings {item.get('total_ratings', 0)} | Avg {item.get('average_rating', 0)}</div>
            <a href="{idea_link}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:600;margin-top:10px;">Open In App</a>
        </div>
        """

        detail_cards += f"""
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px;background:#ffffff;word-break:break-word;overflow-wrap:anywhere;">
            <h3 style="margin:0 0 6px;color:#0f172a;font-size:18px;line-height:1.35;">#{item.get('rank', '-')} {item.get('title', '')}</h3>
            <p style="margin:0 0 8px;color:#475569;font-size:13px;line-height:1.5;">By {item.get('user_name', '')} ({item.get('user_email', '')}) | Role: {item.get('user_role', '')}</p>
            <p style="margin:0 0 10px;color:#334155;font-size:13px;line-height:1.6;">{description_preview}</p>
            <a href="{idea_link}" style="display:block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 12px;border-radius:6px;font-size:13px;font-weight:600;text-align:center;margin-bottom:10px;">View Full Idea Details In App</a>
            <div style="font-size:13px;color:#0f172a;margin-bottom:8px;"><strong>Validation Votes:</strong> {item.get('validation_votes', len(item.get('approvals', [])))} (Approved {item.get('approved_votes', 0)}, Rejected {item.get('rejected_votes', 0)})<br/><strong>Total Ratings:</strong> {item.get('total_ratings', 0)}<br/><strong>Average Rating:</strong> {item.get('average_rating', 0)}</div>
            <div style="font-size:13px;color:#0f172a;margin-bottom:4px;"><strong>Validator Decisions</strong></div>
            <ul style="margin:0 0 10px 18px;padding:0;">{approvals_items}</ul>
            <div style="font-size:13px;color:#0f172a;margin-bottom:4px;"><strong>Individual Ratings</strong></div>
            <ul style="margin:0 0 0 18px;padding:0;">{ratings_items}</ul>
        </div>
        """

    if not ranking_cards:
        ranking_cards = "<div style='padding:12px;border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;color:#64748b;'>No approved ideas found.</div>"

    return f"""
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body {{ margin: 0; padding: 0; background: #f1f5f9; }}
          .container {{ width: 100%; max-width: 640px; margin: 0 auto; }}
          .content {{ padding: 16px; }}
          .metric-table td {{ width: 50%; padding: 8px; vertical-align: top; }}
          @media only screen and (max-width: 600px) {{
            .content {{ padding: 12px !important; }}
            .metric-table td {{ display: block !important; width: 100% !important; padding: 6px 0 !important; }}
          }}
        </style>
      </head>
      <body>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="container" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;">
                <tr>
                  <td style="background:linear-gradient(135deg,#0ea5e9,#2563eb);padding:20px;">
                    <h2 style="margin:0;color:#ffffff;font-size:22px;line-height:1.3;">Approved Projects Detailed Report</h2>
                    <p style="margin:6px 0 0;color:#dbeafe;font-size:12px;line-height:1.5;">Generated: {generated_at}</p>
                  </td>
                </tr>
                <tr>
                  <td class="content" style="padding:16px;">
                    <p style="margin:0 0 12px;color:#334155;font-size:13px;line-height:1.6;">This email is optimized for mobile. Use the button under each idea to open full details in the app.</p>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="metric-table" style="margin-bottom:12px;">
                      <tr>
                        <td>
                          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;"><div style="font-size:11px;color:#64748b;">Approved Projects</div><div style="font-size:18px;font-weight:700;color:#0f172a;">{summary.get('total_approved_projects', 0)}</div></div>
                        </td>
                        <td>
                          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;"><div style="font-size:11px;color:#64748b;">Validation Votes</div><div style="font-size:18px;font-weight:700;color:#0f172a;">{summary.get('total_validation_votes', 0)}</div></div>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;"><div style="font-size:11px;color:#64748b;">Total Ratings</div><div style="font-size:18px;font-weight:700;color:#0f172a;">{summary.get('total_ratings', 0)}</div></div>
                        </td>
                        <td>
                          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;"><div style="font-size:11px;color:#64748b;">Overall Avg Rating</div><div style="font-size:18px;font-weight:700;color:#0f172a;">{summary.get('overall_average_rating', 0)}</div></div>
                        </td>
                      </tr>
                    </table>

                    <h3 style="margin:0 0 8px;color:#0f172a;font-size:18px;">Ranking</h3>
                    {ranking_cards}

                    <h3 style="margin:14px 0 8px;color:#0f172a;font-size:18px;">Project Details</h3>
                    {detail_cards}

                    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.5;">If a link asks you to log in, sign in with an admin or super admin account to view full details in the app.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """


async def send_detailed_report_email(report_payload: dict, to_emails: List[str]):
    """Send the detailed approved-ideas report to selected recipients."""
    if not to_emails:
        print("[EMAIL] No recipients provided for detailed report")
        return

    subject = "[AI Idea Platform] Approved Projects Detailed Report"
    html_body = _build_detailed_report_html(report_payload)
    pdf_bytes = _build_detailed_report_pdf(report_payload)
    pdf_filename = f"approved_projects_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    attachments = [{
        "filename": pdf_filename,
        "content": pdf_bytes,
        "mime_type": "application/pdf",
    }]

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _send_email_sync, to_emails, subject, html_body, attachments)
