# U:Echo — Architecture Diagram

```mermaid
graph TB
    subgraph Chrome_Browser["Chrome Browser"]
        subgraph Extension["U:Echo Chrome Extension (Manifest V3)"]
            CS["Content Script<br/>• Grid/Div-Box Overlay<br/>• Element Highlighting<br/>• Gesture Capture<br/>• Selection Manager"]
            SW["Background Service Worker<br/>• Message Router<br/>• Screenshot Capture<br/>• Session Manager<br/>• Backend API Client"]
            SP["Side Panel (React)<br/>• Chat UI<br/>• Agent Panel<br/>• Verify & Handoff<br/>• History & Logs<br/>• Settings"]
        end
        LP["Live Localhost Page<br/>(User's Web App)"]
    end

    subgraph GCP["Google Cloud (user-echo-ui-navigator)"]
        subgraph CloudRun["Cloud Run Backend (FastAPI)"]
            API["REST API<br/>• /process-gesture<br/>• /enhance-text<br/>• /send-to-ide<br/>• /upload-screenshot<br/>• /export/csv"]
            subgraph ADK["ADK Agent Pipeline (SequentialAgent)"]
                AR["Action Recorder Agent<br/>• Interpret gestures<br/>• Generate intent strings"]
                EMB["Embedding Step<br/>• multimodalembedding@001<br/>• 1408-dim vectors"]
                PB["Prompt Builder Agent<br/>• skill.md rules<br/>• FR-10 schema output<br/>• gemini-3.1-flash-lite"]
                VA["Verification Agent<br/>• Schema check<br/>• Safety check<br/>• Semantic drift check"]
            end
        end
        FS["Firestore<br/>• users, sessions, requests<br/>• vector_examples (1408-dim)<br/>• settings"]
        GCS["Cloud Storage<br/>• Screenshots (PNG)<br/>• CSV Exports"]
        VAI["Vertex AI<br/>• gemini-3.1-flash-lite-preview<br/>• multimodalembedding@001"]
        FA["Firebase Auth<br/>• Google Sign-In"]
    end

    subgraph Local["Developer Machine"]
        MCP["MCP Bridge (Node.js)<br/>• localhost:3939<br/>• Token auth<br/>• IDE adapters"]
        IDE["IDE<br/>• VS Code / Cursor<br/>• Windsurf / Antigravity"]
    end

    %% Content Script ↔ Page
    LP -.->|"DOM access<br/>elementFromPoint<br/>getBoundingClientRect"| CS

    %% Extension internal messaging
    CS -->|"chrome.runtime.sendMessage<br/>gesture events, element info"| SW
    SW -->|"chrome.tabs.sendMessage<br/>activate/deactivate overlay"| CS
    SW <-->|"chrome.runtime messaging<br/>agent responses, intents"| SP

    %% Service Worker → Backend
    SW -->|"HTTPS POST<br/>metadata payload"| API
    API --> AR
    AR --> EMB
    EMB --> PB
    PB --> VA
    VA -->|"structured prompt"| API
    API -->|"agent response"| SW

    %% Screenshot flow
    SW -->|"chrome.tabs.captureVisibleTab()"| SW
    SW -->|"upload PNG"| GCS

    %% Backend ↔ Storage
    API <--> FS
    EMB <-->|"vector search<br/>top-3 KNN"| FS
    AR & PB & VA <-->|"LLM calls"| VAI
    EMB -->|"embedding call"| VAI

    %% Auth
    SP -->|"Firebase Auth"| FA
    FA -->|"ID token"| API

    %% IDE delivery
    API -->|"confirmed prompt"| MCP
    MCP -->|"MCP protocol"| IDE

    %% Styling
    classDef extension fill:#1392ec,stroke:#0d6ebd,color:#fff
    classDef gcp fill:#4285f4,stroke:#2a65c9,color:#fff
    classDef local fill:#34a853,stroke:#1e7e34,color:#fff
    classDef storage fill:#fbbc04,stroke:#c99400,color:#000

    class CS,SW,SP extension
    class API,AR,EMB,PB,VA gcp
    class MCP,IDE local
    class FS,GCS,VAI,FA storage
```

## Data Flow Summary

1. **Gesture Capture:** Content script detects user interaction → packages gesture metadata
2. **Screenshot:** Service worker calls `chrome.tabs.captureVisibleTab()` → uploads to Cloud Storage
3. **Action Recorder:** Backend agent interprets gesture → generates plain-English intent
4. **Auto-Populate:** Intent string returns to side panel chat field
5. **Embedding:** `multimodalembedding@001` creates 1408-dim joint vector from screenshot + intent
6. **Vector Search:** Firestore KNN query returns top-3 similar example prompts
7. **Prompt Builder:** Gemini 3.1 Flash-Lite generates FR-10 structured prompt
8. **Verification:** Schema + safety + semantic drift check (cosine sim ≥ 0.80)
9. **IDE Delivery:** Confirmed prompt sent via MCP bridge to developer's IDE
