"""Keep existing verb reviews and add reviews of individual word occurrences."""
import csv
import io
import json
import sqlite3
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, get_args
from uuid import UUID

from fastapi import APIRouter, HTTPException, Path as ApiPath
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field

from analysis_api import WordAnnotation, WordAnalysisRequest, validate_selected_word, locate_phrase

router = APIRouter()
database_file = Path(__file__).parent / "corpus.db"


@contextmanager
def database():
    try:
        with closing(sqlite3.connect(database_file.resolve().as_uri() + "?mode=rw", uri=True, timeout=10)) as connection:
            connection.row_factory = sqlite3.Row
            with connection:
                yield connection
    except sqlite3.Error as error:
        raise HTTPException(503, "The reviews database is unavailable. Please try again.") from error


class ReviewRequest(BaseModel):
    source_file: str = Field(min_length=1, max_length=255)
    paragraph_number: int = Field(ge=1)
    quotation: str = Field(min_length=1, max_length=200)
    verb_form: str = Field(min_length=1, max_length=200)
    model_name: str = Field(min_length=1, max_length=100)
    predicted_construction: str = Field(min_length=1, max_length=100)
    model_explanation: str = Field(min_length=1, max_length=300)
    review_status: Literal["correct", "incorrect"]
    corrected_construction: str | None = Field(default=None, max_length=100)
    reviewer_note: str = Field(default="", max_length=2000)


@router.post("/reviews", status_code=201)
def save_review(review: ReviewRequest):
    correction = (review.corrected_construction or "").strip()
    if review.review_status == "incorrect" and not correction:
        raise HTTPException(400, "Please provide the corrected grammatical label.")
    if review.review_status == "correct":
        correction = None
    with database() as connection:
        row = connection.execute(
            "SELECT text FROM paragraphs WHERE source_file = ? AND paragraph_number = ?",
            (review.source_file, review.paragraph_number)
        ).fetchone()
        if row is None:
            raise HTTPException(404, "Paragraph not found.")
        source_text = " ".join(row[0].split())
        quotation = " ".join(review.quotation.split())
        if not quotation or quotation not in source_text:
            raise HTTPException(400, "The quotation was not found in this paragraph.")
        cursor = connection.execute("""
            INSERT INTO reviews (
                source_file, paragraph_number, quotation, verb_form, model_name,
                predicted_construction, model_explanation, review_status,
                corrected_construction, reviewer_note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            review.source_file, review.paragraph_number, review.quotation,
            review.verb_form, review.model_name, review.predicted_construction,
            review.model_explanation, review.review_status, correction, review.reviewer_note
        ))
        review_id = cursor.lastrowid
    return {"review_id": review_id, "saved": True, "review_status": review.review_status,
            "corrected_construction": correction}


@router.get("/reviews")
def list_reviews():
    with database() as connection:
        rows = connection.execute("SELECT * FROM reviews ORDER BY id DESC").fetchall()
    reviews = [dict(row) for row in rows]
    return {"total_reviews": len(reviews), "reviews": reviews}


class ReviewedAnnotation(WordAnnotation):
    phrase_start: int = Field(ge=0, strict=True)
    phrase_end: int = Field(ge=1, strict=True)


class WordReviewRequest(WordAnalysisRequest):
    model_config = ConfigDict(extra="forbid")
    client_request_id: UUID
    model_name: str = Field(min_length=1, max_length=100)
    prompt_version: str = Field(min_length=1, max_length=100)
    annotation: ReviewedAnnotation
    pos_status: Literal["correct", "incorrect", "unsure"]
    corrected_part_of_speech: str | None = Field(default=None, max_length=100)
    role_status: Literal["correct", "incorrect", "unsure"]
    corrected_grammatical_role: str | None = Field(default=None, max_length=100)
    corrected_role_scope: str | None = Field(default=None, max_length=100)
    reviewer_note: str = Field(default="", max_length=2000)


def validate_corrections(review):
    pos = review.corrected_part_of_speech
    role = review.corrected_grammatical_role
    scope = review.corrected_role_scope
    allowed = {field: get_args(WordAnnotation.model_fields[field].annotation)
               for field in ("part_of_speech", "grammatical_role", "role_scope")}
    if review.pos_status == "incorrect":
        if pos not in allowed["part_of_speech"] or pos == "uncertain":
            raise HTTPException(400, "Choose a corrected part of speech, or choose Unsure as your judgment.")
        if pos == review.annotation.part_of_speech:
            raise HTTPException(400, "The corrected part of speech is unchanged. Choose Correct instead.")
    elif pos is not None:
        raise HTTPException(400, "A POS correction is only allowed for an Incorrect judgment.")
    if review.role_status == "incorrect":
        if role not in allowed["grammatical_role"] or scope not in allowed["role_scope"] or "uncertain" in (role, scope):
            raise HTTPException(400, "Choose the corrected role and scope, or choose Unsure as your judgment.")
        if (role, scope) == (review.annotation.grammatical_role, review.annotation.role_scope):
            raise HTTPException(400, "The role and scope are unchanged. Choose Correct instead.")
    elif role is not None or scope is not None:
        raise HTTPException(400, "Role corrections are only allowed for an Incorrect judgment.")
    if review.pos_status == "correct" and review.annotation.part_of_speech == "uncertain":
        raise HTTPException(400, "The model's POS is uncertain. Choose Unsure or provide a correction.")
    if review.role_status == "correct" and "uncertain" in (review.annotation.grammatical_role, review.annotation.role_scope):
        raise HTTPException(400, "The model's role is uncertain. Choose Unsure or provide a correction.")
    return {
        "final_part_of_speech": (pos if review.pos_status == "incorrect" else
                                 review.annotation.part_of_speech if review.pos_status == "correct" else None),
        "final_grammatical_role": (role if review.role_status == "incorrect" else
                                   review.annotation.grammatical_role if review.role_status == "correct" else None),
        "final_role_scope": (scope if review.role_status == "incorrect" else
                             review.annotation.role_scope if review.role_status == "correct" else None)
    }


def ensure_word_reviews(connection):
    # Add a separate table. Never drop or alter the existing reviews table.
    connection.execute("""
        CREATE TABLE IF NOT EXISTS word_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_request_id TEXT NOT NULL UNIQUE,
            request_json TEXT NOT NULL,
            review_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)


@router.post("/reviews/words", status_code=201)
def save_word_review(review: WordReviewRequest):
    final_labels = validate_corrections(review)
    submitted = review.model_dump(mode="json")
    request_json = json.dumps(submitted, ensure_ascii=False, sort_keys=True)
    with database() as connection:
        # Serialize duplicate retries so the same save request produces one row.
        connection.execute("BEGIN IMMEDIATE")
        ensure_word_reviews(connection)
        previous = connection.execute(
            "SELECT id, request_json FROM word_reviews WHERE client_request_id = ?",
            (str(review.client_request_id),)
        ).fetchone()
        if previous:
            if previous["request_json"] != request_json:
                raise HTTPException(409, "This save identifier was already used for a different review.")
            return {"saved": True, "review_id": previous["id"], "already_saved": True}
        row = connection.execute(
            "SELECT text FROM paragraphs WHERE source_file = ? AND paragraph_number = ?",
            (review.source_file, review.paragraph_number)
        ).fetchone()
        if row is None:
            raise HTTPException(404, "Paragraph not found.")
        text = row["text"]
        if not isinstance(text, str) or len(text) > 6000:
            raise HTTPException(400, "The source paragraph is not suitable for this annotation.")
        validate_selected_word(review, text)
        try:
            phrase_start, phrase_end = locate_phrase(review.annotation.phrase, text, review.start, review.end)
        except HTTPException as error:
            raise HTTPException(400, "The quoted phrase does not surround this occurrence. Request a new annotation.") from error
        if (phrase_start, phrase_end) != (review.annotation.phrase_start, review.annotation.phrase_end):
            raise HTTPException(409, "The phrase positions no longer match the source. Request a new annotation.")
        timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
        document = {
            **submitted, **final_labels, "paragraph_snapshot": text,
            "review_type": "word_annotation", "schema_version": 1,
            "source_verified_at_save": True,
            "review_scope": "part_of_speech_and_grammatical_role",
            "explanation_reviewed": False,
            "ready_for_training": False
        }
        cursor = connection.execute(
            "INSERT INTO word_reviews (client_request_id, request_json, review_json, created_at) VALUES (?, ?, ?, ?)",
            (str(review.client_request_id), request_json, json.dumps(document, ensure_ascii=False), timestamp)
        )
        review_id = cursor.lastrowid
    return {"saved": True, "review_id": review_id, "already_saved": False}


@router.get("/reviews/words")
def list_word_reviews():
    with database() as connection:
        exists = connection.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'word_reviews'").fetchone()
        rows = connection.execute("SELECT id, review_json, created_at FROM word_reviews ORDER BY id DESC").fetchall() if exists else []
    try:
        reviews = [{**json.loads(row["review_json"]), "id": row["id"], "created_at": row["created_at"]} for row in rows]
    except (ValueError, TypeError) as error:
        raise HTTPException(500, "A saved word review could not be read.") from error
    return {"total_reviews": len(reviews), "reviews": reviews}


@router.get("/reviews/words/export")
def export_word_reviews():
    return JSONResponse(
        content={"export_version": 1, "exported_at": datetime.now(timezone.utc).isoformat(), **list_word_reviews()},
        headers={"Content-Disposition": 'attachment; filename="word-reviews.json"'}
    )


def spreadsheet_cell(value):
    """Keep text as text when CSV is opened in a spreadsheet."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    text = str(value)
    # CSV quoting alone does not stop spreadsheet formula interpretation.
    if text.lstrip().startswith(("=", "+", "-", "@")) or text.startswith(("\t", "\r", "\n")):
        return "'" + text
    return text


@router.get("/reviews/words/export.csv")
def export_word_reviews_csv():
    fields = [
        "id", "created_at", "source_file", "paragraph_number", "start", "end",
        "selected_text", "model_name", "prompt_version", "client_request_id",
        "model_part_of_speech", "model_grammatical_role", "model_role_scope",
        "phrase", "phrase_start", "phrase_end", "model_explanation", "model_uncertainty",
        "pos_status", "corrected_part_of_speech", "final_part_of_speech",
        "role_status", "corrected_grammatical_role", "corrected_role_scope",
        "final_grammatical_role", "final_role_scope", "reviewer_note",
        "paragraph_snapshot", "source_verified_at_save", "review_scope",
        "explanation_reviewed", "ready_for_training", "schema_version"
    ]
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fields, quoting=csv.QUOTE_ALL)
    writer.writeheader()
    for review in list_word_reviews()["reviews"]:
        annotation = review["annotation"]
        flat = {
            **review,
            "model_part_of_speech": annotation["part_of_speech"],
            "model_grammatical_role": annotation["grammatical_role"],
            "model_role_scope": annotation["role_scope"],
            "phrase": annotation["phrase"],
            "phrase_start": annotation["phrase_start"],
            "phrase_end": annotation["phrase_end"],
            "model_explanation": annotation["explanation"],
            "model_uncertainty": annotation["uncertainty"]
        }
        writer.writerow({field: spreadsheet_cell(flat.get(field)) for field in fields})
    return Response(
        # A UTF-8 BOM helps Excel recognise names such as João correctly.
        content=output.getvalue().encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="word-reviews.csv"',
                 "Cache-Control": "no-store"}
    )


def remove_review(table, review_id, review_type):
    # The table name is chosen by our code, never taken from a request.
    if table not in ("word_reviews", "reviews"):
        raise ValueError("Unknown review table")
    with database() as connection:
        exists = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)
        ).fetchone()
        if not exists:
            raise HTTPException(404, "Review not found.")
        cursor = connection.execute(f"DELETE FROM {table} WHERE id = ?", (review_id,))
        if cursor.rowcount != 1:
            raise HTTPException(404, "Review not found.")
    return {"deleted": True, "review_id": review_id, "review_type": review_type}


@router.delete("/reviews/words/{review_id}")
def delete_word_review(review_id: int = ApiPath(ge=1)):
    return remove_review("word_reviews", review_id, "word_annotation")


@router.delete("/reviews/verbs/{review_id}")
def delete_verb_review(review_id: int = ApiPath(ge=1)):
    return remove_review("reviews", review_id, "verb_analysis")

# Genitive candidate, annotation and review routes use existing proxy prefixes.
from Genitive_api import router as genitive_router
router.include_router(genitive_router)
