# DocuQuery

A RAG-based PDF question-answering chatbot. Upload any PDF and ask questions in natural language — answers are grounded strictly in the document with source citations pulled directly from the text.

Built as a learning project exploring LLMs, retrieval-augmented generation, and cloud-native deployment.

---

## How it works

1. **Upload** — PDF is parsed and split into 512-token chunks with 20% overlap using LangChain's `RecursiveCharacterTextSplitter`
2. **Embed** — Each chunk is embedded using `sentence-transformers/all-MiniLM-L6-v2`
3. **Index** — Embeddings are stored in a FAISS vector index (per session, in memory)
4. **Retrieve** — On each question, top-4 most relevant chunks are retrieved via cosine similarity
5. **Generate** — Retrieved chunks + conversation history are passed to Gemini 2.0 Flash, which generates a grounded answer with a source citation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, Flask |
| RAG | LangChain, sentence-transformers, FAISS |
| LLM | Google Gemini 2.0 Flash (via `langchain-google-genai`) |
| PDF Parsing | pypdf |
| Frontend | HTML, CSS, Vanilla JS |
| Containerisation | Docker |
| Deployment | GCP Cloud Run + Google Cloud Storage |

---

## Features

- Drag-and-drop PDF upload with staged progress indicator
- Per-session FAISS vector index — sessions are fully isolated
- Conversational memory — follow-up questions retain context
- Source citations displayed separately below each answer
- Copy answer to clipboard
- Auto-growing chat input, Enter to send / Shift+Enter for newline
- Fully containerised with Docker, deployable to GCP Cloud Run

---

## Project Structure

```
docuquery/
├── app.py               # Flask app, API routes
├── rag/
│   ├── loader.py        # PDF parsing and chunking
│   ├── embedder.py      # Embedding + FAISS index management
│   └── chain.py         # LangChain conversational chain
├── static/
│   ├── style.css
│   └── script.js
├── templates/
│   └── index.html
├── requirements.txt
├── Dockerfile
└── .env.example
```

---

## Local Setup

```bash
# Clone
git clone https://github.com/PranavSana/docuquery.git
cd docuquery

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Add your GOOGLE_API_KEY to .env

# Run
python app.py
```

Open `http://localhost:8080`

---

## Docker

```bash
docker build -t docuquery .
docker run -p 8080:8080 --env-file .env docuquery
```

---

## Deploy to GCP Cloud Run

```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/docuquery
gcloud run deploy docuquery \
  --image gcr.io/PROJECT_ID/docuquery \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_API_KEY` | Yes | Gemini API key from aistudio.google.com |
| `GCS_BUCKET_NAME` | No | GCP bucket for PDF storage (skipped if blank) |
| `GCP_PROJECT_ID` | No | GCP project ID |
