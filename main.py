import re
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query

app = FastAPI()

database_file = Path(__file__).parent / "corpus.db"

if not database_file.exists():
    raise RuntimeError("Run import_database.py before starting the API.")


def load_paragraphs(source_file):
    with closing(sqlite3.connect(database_file)) as connection:
        connection.row_factory = sqlite3.Row

        if source_file:
            rows = connection.execute("""
                SELECT source_file, paragraph_number, text
                FROM paragraphs
                WHERE source_file = ?
                ORDER BY source_file, paragraph_number
            """, (source_file,)).fetchall()
        else:
            rows = connection.execute("""
                SELECT source_file, paragraph_number, text
                FROM paragraphs
                ORDER BY source_file, paragraph_number
            """).fetchall()

        return [dict(row) for row in rows]


@app.get("/sources")
def get_sources():
    with closing(sqlite3.connect(database_file)) as connection:
        rows = connection.execute("""
            SELECT DISTINCT source_file
            FROM paragraphs
            ORDER BY source_file
        """).fetchall()

    return {"sources": [row[0] for row in rows]}


@app.get("/search")
def search(
    q: str = Query(min_length=1, max_length=100),
    mode: Literal["partial", "whole_word"] = "partial",
    source_file: str | None = None
):
    query = q.strip()

    if not query:
        raise HTTPException(
            status_code=400,
            detail="Please enter a search term."
        )

    records = load_paragraphs(source_file)

    search_pattern = re.escape(query)

    if mode == "whole_word":
        search_pattern = r"(?<!\w)" + search_pattern + r"(?!\w)"

    pattern = re.compile(search_pattern, re.IGNORECASE)

    matches = []
    kwic_results = []
    total_occurrences = 0
    context_size = 10

    for record in records:
        text = record["text"]
        occurrences = list(pattern.finditer(text))

        if not occurrences:
            continue

        matches.append({
            **record,
            "occurrences": len(occurrences)
        })

        total_occurrences = total_occurrences + len(occurrences)

        for occurrence in occurrences:
            if len(kwic_results) >= 100:
                break

            start = occurrence.start()
            end = occurrence.end()

            left_context = " ".join(
                text[:start].split()[-context_size:]
            )
            right_context = " ".join(
                text[end:].split()[:context_size]
            )

            kwic_results.append({
                "source_file": record["source_file"],
                "paragraph_number": record["paragraph_number"],
                "start": start,
                "end": end,
                "left_context": left_context,
                "match": occurrence.group(),
                "right_context": right_context
            })

    return {
        "query": query,
        "mode": mode,
        "source_file": source_file,
        "total_matching_paragraphs": len(matches),
        "total_occurrences": total_occurrences,
        "results": matches[:20],
        "kwic_results": kwic_results
    }
from analysis_api import router as analysis_router

app.include_router(analysis_router)
from reviews_api import router as reviews_router

app.include_router(reviews_router)