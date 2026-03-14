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
npm run dev          # HTTP bridge on port 3939
npm run build        # Build compiled output (tsup)
```

### Windsurf MCP Integration

Add U:Echo to your Windsurf MCP config (`~/.codeium/windsurf/mcp_config.json`):

```json
{
  "mcpServers": {
    "uecho": {
      "command": "npx",
      "args": ["tsx", "src/mcp-stdio-server.ts"],
      "cwd": "/path/to/uecho/mcp-bridge",
      "env": {
        "UECHO_BRIDGE_URL": "http://localhost:3939"
      }
    }
  }
}
```

Or using the compiled build:
```json
{
  "mcpServers": {
    "uecho": {
      "command": "node",
      "args": ["dist/mcp-stdio-server.js"],
      "cwd": "/path/to/uecho/mcp-bridge"
    }
  }
}
```

**Available MCP tools:**
- `get_uecho_prompts` — List pending design-change prompts
- `get_uecho_prompt_detail` — Get full prompt content by ID
- `apply_uecho_prompt` — Mark prompt as delivered and return implementation instructions
- `uecho_bridge_status` — Check bridge connectivity

**MCP prompt:**
- `uecho_apply` — Appears in Cascade's prompt picker; auto-selects the latest queued prompt and returns developer-ready instructions

**Real-time notifications:** The MCP server connects to the bridge's SSE endpoint and notifies Cascade when new prompts arrive via `prompts/list_changed`.

## Permissions & Site Access

U:Echo uses a **minimal-permission model** aligned with Chrome Manifest V3 best practices.

### Host Permissions (manifest)

The extension ships with these `host_permissions`:

```json
"host_permissions": [
  "http://localhost/*",
  "http://127.0.0.1/*",
  "<all_urls>"
]
```

- **`http://localhost/*`** and **`http://127.0.0.1/*`** — content script injection and backend/bridge communication.
- **`<all_urls>`** — required for `chrome.tabs.captureVisibleTab` (screenshot capture during gesture processing). The `activeTab` permission alone is insufficient because screenshot capture is triggered asynchronously by content script events, not by direct user clicks on the extension icon.

### `activeTab` — Temporary Tab Access

The `activeTab` permission grants the extension **temporary** access to the currently active tab when the user clicks the extension's toolbar icon. This enables:

- **`chrome.scripting.executeScript`** — programmatic content script injection on any site
- **`chrome.tabs.captureVisibleTab`** — screenshot capture of the visible tab
- **`chrome.scripting.insertCSS`** — overlay stylesheet injection

Access is automatically revoked when the tab navigates to a new origin or is closed. No persistent broad host permission is needed.

### Expanding to Other Sites

To use U:Echo on non-localhost sites (e.g., staging or production URLs):

1. **Add explicit origins** to both `host_permissions` and `content_scripts.matches` in `manifest.json`:
   ```json
   "host_permissions": [
     "http://localhost/*",
     "http://127.0.0.1/*",
     "https://staging.example.com/*"
   ]
   ```
2. **Or use on-demand permissions** via the Chrome optional permissions API (avoids re-approval prompts for existing users):
   ```ts
   const granted = await chrome.permissions.request({
     origins: ['https://example.com/*'],
   });
   ```

> **Note:** Changing `host_permissions` after Chrome Web Store publication triggers a re-approval prompt for all existing users. Prefer optional permissions for gradual rollout.

### Microphone Access

Mic access for voice input is handled at runtime via `navigator.mediaDevices.getUserMedia()` in the side panel — no manifest permission is needed. If the browser blocks the prompt, a helper page (`src/mic-permission/mic-permission.html`) opens in a new tab to recover the permission grant.

## Google Cloud Project
- **Project ID:** `user-echo-ui-navigator`
- **Project Number:** `11807439487`

## License
MIT
