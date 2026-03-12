"""
AI Duplicate Idea Detection Service

Uses TF-IDF + cosine similarity for lightweight duplicate detection.
Falls back gracefully if sentence-transformers is not available.
"""

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from app.database import ideas_collection
from app.config import get_settings

settings = get_settings()

# Try to use sentence-transformers for better accuracy, fall back to TF-IDF
_model = None
_use_transformers = False

try:
    from sentence_transformers import SentenceTransformer
    _model = SentenceTransformer("all-MiniLM-L6-v2")
    _use_transformers = True
except Exception:
    _use_transformers = False


def _compute_similarity_tfidf(new_text: str, existing_texts: list[str]) -> list[float]:
    """Compute similarity using TF-IDF + cosine similarity."""
    if not existing_texts:
        return []
    all_texts = [new_text] + existing_texts
    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf_matrix = vectorizer.fit_transform(all_texts)
    similarities = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
    return similarities.tolist()


def _compute_similarity_transformers(new_text: str, existing_texts: list[str]) -> list[float]:
    """Compute similarity using sentence transformers."""
    if not existing_texts or _model is None:
        return []
    all_texts = [new_text] + existing_texts
    embeddings = _model.encode(all_texts)
    similarities = cosine_similarity([embeddings[0]], embeddings[1:]).flatten()
    return similarities.tolist()


async def check_duplicate_idea(title: str, description: str) -> dict:
    """
    Check if a similar idea already exists in the database.
    Returns a dict with is_duplicate, similar_ideas list, and message.
    """
    new_text = f"{title}. {description}"

    # Fetch all existing ideas
    existing_ideas = []
    existing_texts = []
    cursor = ideas_collection.find(
        {"approval_status": {"$ne": "rejected"}},
        {"_id": 1, "title": 1, "description": 1}
    )
    async for idea in cursor:
        existing_ideas.append({
            "id": str(idea["_id"]),
            "title": idea["title"],
            "description": idea.get("description", ""),
        })
        existing_texts.append(f"{idea['title']}. {idea.get('description', '')}")

    if not existing_texts:
        return {"is_duplicate": False, "similar_ideas": [], "message": "No existing ideas to compare."}

    # Compute similarities
    if _use_transformers:
        similarities = _compute_similarity_transformers(new_text, existing_texts)
    else:
        similarities = _compute_similarity_tfidf(new_text, existing_texts)

    # Find similar ideas above threshold
    similar = []
    threshold = settings.SIMILARITY_THRESHOLD
    for i, score in enumerate(similarities):
        if score >= threshold:
            similar.append({
                "id": existing_ideas[i]["id"],
                "title": existing_ideas[i]["title"],
                "similarity": round(float(score) * 100, 1),
            })

    similar.sort(key=lambda x: x["similarity"], reverse=True)

    if similar:
        titles = ", ".join([f'"{s["title"]}" ({s["similarity"]}%)' for s in similar[:3]])
        return {
            "is_duplicate": True,
            "similar_ideas": similar[:5],
            "message": f"Similar idea(s) already exist: {titles}",
        }

    return {"is_duplicate": False, "similar_ideas": [], "message": "No similar ideas found."}
