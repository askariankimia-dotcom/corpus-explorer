import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

database_file = Path(__file__).parent / "corpus.db"


class ReviewRequest(BaseModel):
    source_file: str = Field(min_length=1, max_length=255)
    paragraph_number: int = Field(ge=1)
    quotation: str = Field(min_length=1, max_length=200)
    verb_form: str = Field(min_length=1, max_length=200)
    model_name: str = Field(min_length=1, max_length=100)
    predicted_construction: str = Field(min_length=1, max_length=100)
    model_explanation: str = Field(min_length=1, max_length=300)
    review_status: Literal["correct", "incorrect"]
    corrected_construction: str | None = Field(
        default=None,
        max_length=100
    )
    reviewer_note: str = Field(default="", max_length=2000)


@router.post("/reviews", status_code=201)
def save_review(review: ReviewRequest):
    correction = (review.corrected_construction or "").strip()

    if review.review_status == "incorrect" and not correction:
        raise HTTPException(
            status_code=400,
            detail="Please provide the corrected grammatical label."
        )

    if review.review_status == "correct":
        correction = None

    with closing(sqlite3.connect(database_file)) as connection:
        with connection:
            row = connection.execute("""
                SELECT text
                FROM paragraphs
                WHERE source_file = ? AND paragraph_number = ?
            """, (
                review.source_file,
                review.paragraph_number
            )).fetchone()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Paragraph not found."
                )

            source_text = " ".join(row[0].split())
            quotation = " ".join(review.quotation.split())

            if not quotation or quotation not in source_text:
                raise HTTPException(
                    status_code=400,
                    detail="The quotation was not found in this paragraph."
                )

            cursor = connection.execute("""
                INSERT INTO reviews (
                    source_file,
                    paragraph_number,
                    quotation,
                    verb_form,
                    model_name,
                    predicted_construction,
                    model_explanation,
                    review_status,
                    corrected_construction,
                    reviewer_note
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                review.source_file,
                review.paragraph_number,
                review.quotation,
                review.verb_form,
                review.model_name,
                review.predicted_construction,
                review.model_explanation,
                review.review_status,
                correction,
                review.reviewer_note
            ))

            review_id = cursor.lastrowid

    return {
        "review_id": review_id,
        "saved": True,
        "review_status": review.review_status,
        "corrected_construction": correction
    }
@router.get("/reviews")
def list_reviews():
    with closing(sqlite3.connect(database_file)) as connection:
        connection.row_factory = sqlite3.Row

        rows = connection.execute("""
            SELECT *
            FROM reviews
            ORDER BY id DESC
        """).fetchall()

    reviews = [dict(row) for row in rows]

    return {
        "total_reviews": len(reviews),
        "reviews": reviews
    }