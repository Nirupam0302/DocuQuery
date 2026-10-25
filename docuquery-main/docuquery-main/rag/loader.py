from io import BytesIO

from langchain.text_splitter import RecursiveCharacterTextSplitter
from pypdf import PdfReader


def load_pdf_chunks(pdf_file):
    reader = PdfReader(pdf_file)
    pages = []

    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            pages.append(text)

    full_text = "\n\n".join(pages).strip()
    if not full_text:
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=512,
        chunk_overlap=102,
        separators=["\n\n", "\n", ".", " "],
    )
    return splitter.split_text(full_text)


def load_pdf_chunks_from_bytes(pdf_bytes):
    return load_pdf_chunks(BytesIO(pdf_bytes))
