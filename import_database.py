import json
import sqlite3
from pathlib import Path

project_folder = Path(__file__).parent
corpus_file = project_folder / "corpus.json"
database_file = project_folder / "corpus.db"

records = json.loads(corpus_file.read_text(encoding="utf-8"))

rows = [
    (
        record["source_file"],
        record["paragraph_number"],
        record["text"]
    )
    for record in records
]

with sqlite3.connect(database_file) as connection:
    connection.execute("""
        CREATE TABLE IF NOT EXISTS paragraphs (
            id INTEGER PRIMARY KEY,
            source_file TEXT NOT NULL,
            paragraph_number INTEGER NOT NULL,
            text TEXT NOT NULL,
            UNIQUE(source_file, paragraph_number)
        )
    """)

    connection.execute("DELETE FROM paragraphs")

    connection.executemany("""
        INSERT INTO paragraphs (
            source_file,
            paragraph_number,
            text
        )
        VALUES (?, ?, ?)
    """, rows)

    paragraph_count = connection.execute(
        "SELECT COUNT(*) FROM paragraphs"
    ).fetchone()[0]

print("Database created:", database_file.name)
print("Paragraphs stored:", paragraph_count)