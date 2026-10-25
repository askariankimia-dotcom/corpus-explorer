from pathlib import Path
from docx import Document

file = Path(__file__).parent / "data" / "Corpus book 3 headway edition 5.docx"
document = Document(file)

for number, paragraph in enumerate(document.paragraphs[:80], start=1):
    if paragraph.text.strip():
        print(number, "|", paragraph.style.name, "|", paragraph.text[:100])