import sqlite3
from contextlib import closing
from pathlib import Path

database_file = Path(__file__).parent / "corpus.db"

if not database_file.exists():
    raise FileNotFoundError("corpus.db was not found beside this script.")

with closing(sqlite3.connect(database_file)) as connection:
    with connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY,
                source_file TEXT NOT NULL,
                paragraph_number INTEGER NOT NULL,
                quotation TEXT NOT NULL,
                verb_form TEXT NOT NULL,
                model_name TEXT NOT NULL,
                predicted_construction TEXT NOT NULL,
                model_explanation TEXT NOT NULL,
                review_status TEXT NOT NULL
                    CHECK (review_status IN ('correct', 'incorrect')),
                corrected_construction TEXT,
                reviewer_note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

                CHECK (
                    review_status = 'correct'
                    OR length(
                        trim(coalesce(corrected_construction, ''))
                    ) > 0
                )
            )
        """)

    review_count = connection.execute(
        "SELECT COUNT(*) FROM reviews"
    ).fetchone()[0]

print("Reviews table is ready.")
print("Saved reviews:", review_count)
