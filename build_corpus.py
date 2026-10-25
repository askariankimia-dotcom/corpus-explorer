import json
from pathlib import Path
from docx import Document

project_folder = Path(__file__).parent
data_folder = project_folder / "data"

records = []

for file in sorted(data_folder.glob("*.docx")):
    document = Document(file)

    for number, paragraph in enumerate(document.paragraphs, start=1):
        if paragraph.text.strip():
            record = {
                "source_file": file.name,
                "paragraph_number": number,
                "text": paragraph.text
            }
            records.append(record)

output_file = project_folder / "corpus.json"

output_file.write_text(
    json.dumps(records, ensure_ascii=False, indent=2),
    encoding="utf-8"
)

print("Paragraphs saved:", len(records))
print("Saved to:", output_file)
