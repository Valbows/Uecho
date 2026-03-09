# U:Echo — User Echo

> Turn UI feedback into implementation-ready prompts.

U:Echo is a Chrome extension for localhost web development that injects an intelligent overlay and side panel into the active browser tab. It allows users to interact with live websites in real time, select visual regions or DOM elements, describe UI changes in natural language (voice or text) or through direct visual gestures, and receive structured development prompts.

## Architecture

- **Chrome Extension** (Manifest V3): Content script overlay, background service worker, React side panel
- **Backend** (Cloud Run + FastAPI): ADK multi-agent pipeline (Action Recorder → Embedding → Prompt Builder → Verifier)
- **MCP Bridge** (Node.js): Local service delivering prompts to IDEs (VS Code, Cursor, Windsurf, Antigravity)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | Chrome Manifest V3, TypeScript, Vite + CRXJS |
| Side Panel UI | React 18, TailwindCSS |
| Content Script | Vanilla TypeScript (60fps overlay) |
| Backend | Python 3.11+, FastAPI, Google ADK |
| LLM | Gemini 3.1 Flash-Lite Preview |
| Embeddings | multimodalembedding@001 (Vertex AI) |
| Database | Firebase Firestore (Spark plan) + vector search |
| Storage | Firebase Cloud Storage |
| Auth | Firebase Auth (Google sign-in) |
| MCP Bridge | Node.js, TypeScript |

## Project Structure

```
uecho/
├── extension/          # Chrome Extension (Manifest V3)
│   ├── src/
│   │   ├── background/ # Service worker
│   │   ├── content/    # Content script + overlays
│   │   ├── sidepanel/  # React side panel app
│   │   └── shared/     # Types, messages, constants
│   └── manifest.json
├── backend/            # Cloud Run backend (FastAPI + ADK)
│   ├── src/
│   │   ├── agents/     # ADK agent definitions
│   │   ├── embedding/  # Multimodal embedding + vector search
│   │   ├── api/        # REST endpoints
│   │   └── storage/    # Firestore + Cloud Storage
│   └── Dockerfile
├── mcp-bridge/         # Local MCP bridge service
│   └── src/
│       ├── server.ts   # MCP server
│       └── adapters/   # IDE-specific adapters
└── docs/               # Architecture diagrams
```

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11+
- Chrome 120+
- Google Cloud project (`user-echo-ui-navigator`)

### Extension Development
```bash
cd extension
npm install
npm run dev    # Builds and watches for changes
```
Load unpacked extension from `extension/dist/` in `chrome://extensions/`

### Backend Development
```bash
cd backend
pip install -r requirements.txt
uvicorn src.api.routes:app --reload --port 8080
```

### MCP Bridge
```bash
cd mcp-bridge
npm install
npm run dev
```

## Google Cloud Project
- **Project ID:** `user-echo-ui-navigator`
- **Project Number:** `11807439487`

## License
MIT
