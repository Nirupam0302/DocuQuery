import uuid

from dotenv import load_dotenv

load_dotenv()

import os

from flask import Flask, jsonify, render_template, request
from google.cloud import storage

from rag.chain import clear_session, get_answer
from rag.embedder import build_index, delete_index, retrieve
from rag.loader import load_pdf_chunks_from_bytes


app = Flask(__name__)


def _error(message, status_code):
    return jsonify({"error": message}), status_code


def _upload_to_gcs(bucket_name, session_id, pdf_bytes):
    client = storage.Client(project=os.getenv("GCP_PROJECT_ID") or None)
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(f"uploads/{session_id}.pdf")
    blob.upload_from_string(pdf_bytes, content_type="application/pdf")


@app.route("/", methods=["GET"])
def index():
    try:
        return render_template("index.html")
    except Exception as exc:
        return _error(str(exc), 500)


@app.route("/upload", methods=["POST"])
def upload():
    try:
        if "file" not in request.files:
            return _error("Missing PDF file in form field 'file'.", 400)

        uploaded_file = request.files["file"]
        if not uploaded_file.filename:
            return _error("No file selected.", 400)

        if not uploaded_file.filename.lower().endswith(".pdf"):
            return _error("Only PDF files are supported.", 400)

        pdf_bytes = uploaded_file.read()
        if not pdf_bytes:
            return _error("Uploaded PDF is empty.", 400)

        session_id = str(uuid.uuid4())
        bucket_name = os.getenv("GCS_BUCKET_NAME", "").strip()

        if bucket_name:
            _upload_to_gcs(bucket_name, session_id, pdf_bytes)

        chunks = load_pdf_chunks_from_bytes(pdf_bytes)
        if not chunks:
            return _error("No extractable text found in the PDF.", 400)

        build_index(session_id, chunks)
        return jsonify({"session_id": session_id, "chunk_count": len(chunks)})

    except ValueError as exc:
        return _error(str(exc), 400)
    except Exception as exc:
        return _error(str(exc), 500)


@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json(silent=True) or {}
        session_id = data.get("session_id", "").strip()
        question = data.get("question", "").strip()

        if not session_id:
            return _error("Missing session_id.", 400)

        if not question:
            return _error("Missing question.", 400)

        context_chunks = retrieve(session_id, question, top_k=4)
        answer = get_answer(session_id, question, context_chunks)
        return jsonify({"answer": answer})

    except ValueError as exc:
        return _error(str(exc), 400)
    except Exception as exc:
        return _error(str(exc), 500)


@app.route("/reset", methods=["POST"])
def reset():
    try:
        data = request.get_json(silent=True) or {}
        session_id = data.get("session_id", "").strip()

        if not session_id:
            return _error("Missing session_id.", 400)

        clear_session(session_id)
        delete_index(session_id)
        return jsonify({"status": "cleared"})

    except Exception as exc:
        return _error(str(exc), 500)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
