import json
from pathlib import Path

corpus_file = Path(__file__).parent / "corpus.json"
records = json.loads(corpus_file.read_text(encoding="utf-8"))

print("Paragraphs loaded:", len(records))

query = input("Search for: ").strip()

if not query:
    raise SystemExit("Please enter a search term.")

matches = []

for record in records:
    if query.lower() in record["text"].lower():
        matches.append(record)

print("\nMatching paragraphs:", len(matches))

for record in matches[:5]:
    print("\nSource:", record["source_file"])
    print("Paragraph:", record["paragraph_number"])
    print(record["text"])
    