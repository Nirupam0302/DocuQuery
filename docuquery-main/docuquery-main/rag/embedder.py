import threading

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer


_model = None
_model_lock = threading.Lock()
_sessions = {}


def _get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def build_index(session_id, chunks):
    if not chunks:
        raise ValueError("No text chunks were extracted from the PDF.")

    model = _get_model()
    embeddings = model.encode(chunks, convert_to_numpy=True).astype("float32")

    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings)

    _sessions[session_id] = {
        "chunks": list(chunks),
        "index": index,
    }


def retrieve(session_id, query, top_k=4):
    session = _sessions.get(session_id)
    if session is None:
        raise ValueError("Session not found. Please upload a PDF first.")

    model = _get_model()
    query_embedding = model.encode([query], convert_to_numpy=True).astype("float32")
    limit = min(top_k, len(session["chunks"]))

    _, indices = session["index"].search(query_embedding, limit)
    return [
        session["chunks"][idx]
        for idx in indices[0]
        if idx != -1 and idx < len(session["chunks"])
    ]


def delete_index(session_id):
    _sessions.pop(session_id, None)
