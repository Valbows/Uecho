# U:Echo — Architecture Diagram

```mermaid
graph TB
    subgraph Chrome_Browser["Chrome Browser"]
        subgraph Extension["U:Echo Chrome Extension (Manifest V3)"]
            CS["Content Script<br/>• Grid/Div-Box Overlay<br/>• Element Highlighting<br/>• Gesture Capture<br/>• Selection Manager"]
            SW["Background Service Worker<br/>• Message Router<br/>• Screenshot Capture<br/>• Session Manager<br/>• Backend API Client"]
            SP["Side Panel (React)<br/>• Chat UI<br/>• Agent Panel<br/>• Verify & Handoff<br/>• History & Logs"]
        end
        LP["Live Localhost Page<br/>(User's Web App)"]
    end

    subgraph Backend["Local Backend (FastAPI :8080)"]
        API["REST API<br/>• /api/process-gesture<br/>• /api/enhance-text<br/>• /api/generate-prompt<br/>• /api/export/csv"]
        subgraph Pipeline["Agent Pipeline"]
            AR["Intent Interpreter<br/>• Interpret gestures<br/>• Generate intent strings"]
            EMB["Embedding Step<br/>• gemini-embedding-2-preview<br/>• 3072-dim vectors"]
            PB["Prompt Builder<br/>• skill.md rules<br/>• FR-10 schema output<br/>• gemini-3.1-flash-lite-preview"]
            VA["Verification<br/>• Schema check<br/>• Safety check<br/>• Semantic drift check"]
        end
        VS["In-Memory Vector Store<br/>• Cosine similarity search<br/>• Seeded examples"]
    end

    subgraph AIStudio["Google AI Studio"]
        GEMINI["Gemini API<br/>• gemini-3.1-flash-lite-preview (LLM)<br/>• gemini-embedding-2-preview (Embeddings)"]
    end

    subgraph Local["Developer Machine"]
        BRIDGE["MCP Bridge (Node.js :3939)<br/>• HTTP queue + SSE events<br/>• IDE adapters (Windsurf/Cursor/VS Code)"]
        MCP_STDIO["MCP Stdio Server<br/>• Tools: get/apply prompts<br/>• Prompt: uecho_apply<br/>• SSE → sendPromptListChanged"]
        IDE["IDE (Windsurf / Cascade)<br/>• MCP client<br/>• Prompt picker integration"]
    end

    %% Content Script ↔ Page
    LP -.->|"DOM access<br/>elementFromPoint<br/>getBoundingClientRect"| CS

    %% Extension internal messaging
    CS -->|"chrome.runtime.sendMessage<br/>gesture events, element info"| SW
    SW -->|"chrome.tabs.sendMessage<br/>activate/deactivate overlay"| CS
    SW <-->|"chrome.runtime messaging<br/>agent responses, intents"| SP

    %% Service Worker → Backend
    SW -->|"HTTP POST<br/>metadata payload"| API
    API --> AR
    AR --> EMB
    EMB --> PB
    PB --> VA
    VA -->|"structured prompt"| API
    API -->|"agent response"| SW

    %% Screenshot flow
    SW -->|"chrome.tabs.captureVisibleTab()"| SW

    %% Backend ↔ AI Studio
    AR & PB & VA -->|"LLM calls"| GEMINI
    EMB -->|"embedding call"| GEMINI
    EMB <-->|"vector search<br/>top-3 KNN"| VS

    %% IDE delivery
    SW -->|"POST /prompt"| BRIDGE
    BRIDGE -->|"SSE events"| MCP_STDIO
    MCP_STDIO -->|"JSON-RPC stdio"| IDE

    %% Styling
    classDef extension fill:#1392ec,stroke:#0d6ebd,color:#fff
    classDef backend fill:#4285f4,stroke:#2a65c9,color:#fff
    classDef local fill:#34a853,stroke:#1e7e34,color:#fff
    classDef ai fill:#fbbc04,stroke:#c99400,color:#000

    class CS,SW,SP extension
    class API,AR,EMB,PB,VA,VS backend
    class BRIDGE,MCP_STDIO,IDE local
    class GEMINI ai
```

## Data Flow Summary

1. **Gesture Capture:** Content script detects user interaction → packages gesture metadata
2. **Screenshot:** Service worker calls `chrome.tabs.captureVisibleTab()` → base64 PNG
3. **Intent Interpretation:** Backend agent interprets gesture → generates plain-English intent
4. **Auto-Populate:** Intent string returns to side panel chat field
5. **Embedding:** `gemini-embedding-2-preview` creates 3072-dim vector from intent text
6. **Vector Search:** In-memory cosine similarity search returns top-3 similar example prompts
7. **Prompt Builder:** `gemini-3.1-flash-lite-preview` generates FR-10 structured prompt
8. **Verification:** Schema + safety + semantic drift check (cosine sim ≥ 0.80)
9. **IDE Delivery:** Confirmed prompt POSTed to MCP bridge → SSE notifies MCP stdio server → prompt appears in Cascade via MCP protocol
