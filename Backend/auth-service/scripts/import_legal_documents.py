"""Import approved DOCX files verbatim, preserving paragraphs and tables.

Run with Python and python-docx: import_legal_documents.py <source-directory>
The source DOCX files remain alongside the published JSON as an audit copy.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn


def source_items(element, parent):
    # Approved files also contain tables inside Word content controls (w:sdt),
    # which python-docx's top-level iter_inner_content omits.
    for child in element:
        if child.tag == qn('w:p'):
            yield Paragraph(child, parent)
        elif child.tag == qn('w:tbl'):
            yield Table(child, parent)
        else:
            yield from source_items(child, parent)

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
args = parser.parse_args()
target = Path(__file__).resolve().parents[1] / 'internal/auth/legal_documents'
target.mkdir(parents=True, exist_ok=True)
for key, title in [
    ('privacy', 'Политика обработки персональных данных'),
    ('personal_data', 'Согласие на обработку персональных данных'),
    ('marketing', 'Согласие на получение рекламных рассылок'),
]:
    source = args.source / f'{title}.docx'
    document = Document(source)
    blocks = []
    texts = []
    for item in source_items(document.element.body, document._body):
        if isinstance(item, Paragraph):
            blocks.append({'kind': 'paragraph', 'text': item.text})
            texts.append(item.text)
        elif isinstance(item, Table):
            rows = [[cell.text for cell in row.cells] for row in item.rows]
            blocks.append({'kind': 'table', 'rows': rows})
            for row in item.rows:
                for cell in row.cells:
                    texts.extend(p.text for p in cell.paragraphs)
    text = '\n'.join(texts)
    payload = {
        'type': key, 'title': title,
        'version': '2026-09-05-' + hashlib.sha256(text.encode()).hexdigest()[:12],
        'updatedAt': '2026-09-05', 'text': text, 'blocks': blocks,
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    }
    (target / f'{key}.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    shutil.copy2(source, target / f'{key}.docx')
