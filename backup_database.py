import sqlite3
from contextlib import closing
from datetime import datetime
from pathlib import Path

project_folder = Path(__file__).resolve().parent
database_file = project_folder / "corpus.db"

if not database_file.exists():
    raise FileNotFoundError("corpus.db was not found.")

backup_folder = project_folder / "backups"
backup_folder.mkdir(exist_ok=True)

timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S_%f")
backup_file = backup_folder / f"corpus_{timestamp}.db"

source_uri = database_file.as_uri() + "?mode=ro"

with closing(sqlite3.connect(source_uri, uri=True)) as source:
    with closing(sqlite3.connect(backup_file)) as destination:
        source.backup(destination)

        checks = destination.execute(
            "PRAGMA integrity_check"
        ).fetchall()

        if checks != [("ok",)]:
            raise RuntimeError("The backup failed its integrity check.")

        review_count = destination.execute(
            "SELECT COUNT(*) FROM reviews"
        ).fetchone()[0]

print("Backup created:", backup_file)
print("Integrity check: passed")
print("Reviews in backup:", review_count)