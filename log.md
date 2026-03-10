# U:Echo — Error & Decision Log (S.A.F.E. Protocol)

## Format
Each entry: `[DATE] [SEVERITY] [COMPONENT] — Description → Resolution`

## Entries
- `[2026-03-09] [INFO] [INIT] — Project initialized from https://github.com/Valbows/Uecho`

### Phase 0–1: Scaffolding
- `[2026-03-09] [INFO] [ARCH] — Architecture diagram, shared types (FR-10 PromptSchema), constants, .env created`
- `[2026-03-09] [INFO] [EXT] — Chrome extension scaffold: manifest v3, Vite + CRXJS, service worker, content script, side panel`
- `[2026-03-09] [INFO] [BACKEND] — FastAPI backend scaffold: health, process-gesture, enhance-text, send-to-ide, export-csv routes`
- `[2026-03-09] [INFO] [MCP] — MCP bridge scaffold: Express server with auth middleware, /health, /prompt endpoints`

### Phase 2: UI & Design
- `[2026-03-09] [INFO] [UI] — 6 side panel screens built: Welcome, Workspace, Agent, Verify, History + StatusBar`
- `[2026-03-09] [INFO] [UI] — Design tokens extracted from Stitch, applied to all components`
- `[2026-03-09] [INFO] [UI] — App.tsx wired with state machine routing between screens`

### Test Infrastructure
- `[2026-03-09] [INFO] [TEST] — Jest configured for extension (ts-jest, jsdom, module mappers)`
- `[2026-03-09] [ERROR] [TEST] — jest.config.ts required ts-node → switched to jest.config.js`
- `[2026-03-09] [ERROR] [TEST] — setupFiles with @testing-library/jest-dom failed (expect not defined before framework init) → moved Chrome mocks to setup-chrome.ts, removed jest-dom from early setup`
- `[2026-03-09] [ERROR] [TEST] — Playwright spec failed under Jest jsdom (crypto.random) → excluded e2e/ from Jest, runs via Playwright CLI only`
- `[2026-03-09] [INFO] [TEST] — Extension: 79 tests (unit: constants, types, messages, overlay-engine; perf: benchmarks)`
- `[2026-03-09] [INFO] [TEST] — Backend: 25 pytest tests (health, gesture, enhance, IDE, export, pipeline, latency)`
- `[2026-03-09] [INFO] [TEST] — MCP Bridge: 18 Jest tests (health, prompt, auth, integration, performance)`
- `[2026-03-09] [INFO] [TEST] — Total: 122 tests, 0 failures across 3 packages`

### Phase 3: Overlay Engine
- `[2026-03-09] [INFO] [OVERLAY] — Grid renderer: CSS background-image grid (60fps), hover highlight, click/shift/drag selection, cell region dispatch`
- `[2026-03-09] [INFO] [OVERLAY] — DivBox renderer: floating highlight, element tooltip (tag+dims), click-to-select, Escape deselect, element info extraction`
- `[2026-03-09] [INFO] [OVERLAY] — Gesture capture: 8 resize handles (nw,n,ne,w,e,sw,s,se), center move handle, GestureEvent emission with before/after bbox + delta`
- `[2026-03-09] [INFO] [OVERLAY] — Content script rewired: mode switching (grid/divbox/off), custom event listeners, gesture → CS_GESTURE_EVENT routing`

### Bug Fixes (Code Review)
- `[2026-03-09] [BUG] [DIVBOX] — generateSelector used :nth-child with tag-filtered siblings → fixed to :nth-of-type`
- `[2026-03-09] [BUG] [GRID] — Browser click after drag overwrote selection → added lastDragEndTimestamp with 50ms guard in handleGridClick`
- `[2026-03-09] [BUG] [GRID] — cleanup() didn't remove document drag listeners (closures) → hoisted to activeDragMoveHandler/activeDragEndHandler module refs, added cleanupDragListeners()`
- `[2026-03-09] [BUG] [GRID] — cleanup() had unused container param → removed param and updated callers`
- `[2026-03-09] [BUG] [GESTURE] — detachHandles() mid-drag leaked document mousemove/mouseup → added activeDragCleanup callback, set in handleResizeStart/handleMoveStart, called in detachHandles`

### Phase 4: Action Recorder & Gesture Pipeline
- `[2026-03-09] [INFO] [RECORDER] — ActionRecorder state machine: idle → recording → captured → processing → complete/error, with RESET`
- `[2026-03-09] [INFO] [RECORDER] — Metadata assembly pipeline: assembles MetadataPayload from GestureEvent + viewport + scroll + session context`
- `[2026-03-09] [INFO] [RECORDER] — RequestRecord lifecycle: created on PROCESSING_START, updated on AGENT_RESPONSE or ERROR`
- `[2026-03-09] [INFO] [RECORDER] — State change listener pattern with unsubscribe support`
- `[2026-03-09] [INFO] [QUEUE] — RequestQueue: FIFO processing with rate limiting (MAX_AGENT_INVOCATIONS_PER_MINUTE)`
- `[2026-03-09] [INFO] [QUEUE] — Queue callback wired to recorder dispatch + side panel messaging`
- `[2026-03-09] [INFO] [SESSION] — SessionManager: create/resume sessions via chrome.storage.local, tracks overlay mode + agent active state`
- `[2026-03-09] [INFO] [SW] — Service worker rewritten: uses ActionRecorder, RequestQueue, SessionManager modules`
- `[2026-03-09] [INFO] [SW] — New message handlers: SP_SUBMIT_TEXT → enhance endpoint, SP_UPDATE_SETTINGS → storage + overlay mode sync, SP_EXPORT_CSV → backend export`
- `[2026-03-09] [INFO] [SW] — SP_CONFIRM_PROMPT now forwards to MCP bridge at localhost:3939/prompt`
- `[2026-03-09] [INFO] [TEST] — 25 new tests: recorder state machine (15), request queue (10). Extension total: 104`

### Phase 4 Hardening: Code Review Fixes
- `[2026-03-10] [BUG] [SW] — CS_GESTURE_EVENT: captureScreenshot empty result silently continued → added validation, dispatch ERROR + return ok:false`
- `[2026-03-10] [BUG] [SW] — CS_GESTURE_EVENT: falsy metadata silently fell through to ok:true → added validation, dispatch ERROR + return ok:false`
- `[2026-03-10] [BUG] [SW] — elementInfo cast "as undefined" discarded actual value → changed to "as { element_info?: ElementInfo }", added ElementInfo import`
- `[2026-03-10] [BUG] [SW] — SP_SUBMIT_TEXT: no fetch error handling → wrapped in try/catch, added enhanceRes.ok check`
- `[2026-03-10] [BUG] [SW] — SP_EXPORT_CSV: no fetch error handling, raw session_id in URL → added try/catch, encodeURIComponent, exportRes.ok check`
- `[2026-03-10] [BUG] [SW] — Global singleton recorder caused cross-tab interference → replaced with Map<number, ActionRecorder> keyed by tabId`
- `[2026-03-10] [INFO] [SW] — Added chrome.tabs.onRemoved listener to clean up per-tab recorders`
- `[2026-03-10] [INFO] [SW] — Outer catch block now uses sender.tab?.id to dispatch ERROR to correct per-tab recorder`
- `[2026-03-10] [BUG] [RECORDER] — tab_id fallback 0 could collide with real Chrome tab IDs → changed to -1 sentinel`
- `[2026-03-10] [BUG] [RECORDER] — START_RECORDING left stale activeGesture/metadata/requestRecord from prior cycle → now calls createInitialContext() first`
- `[2026-03-10] [BUG] [QUEUE] — clear() didn't cancel in-flight fetch → added AbortController tracking, abort on clear(), ignore abort errors in catch`
- `[2026-03-10] [BUG] [QUEUE] — fetch had no timeout, could hang queue indefinitely → added setTimeout abort after PROMPT_TURNAROUND_TARGET_MS*2 (10s)`
- `[2026-03-10] [BUG] [QUEUE] — Timeout vs manual abort distinguished via controller.signal.reason`
- `[2026-03-10] [BUG] [TEST] — request-queue.test.ts: global.fetch mock not restored by jest.restoreAllMocks → saved originalFetch, restored in afterEach`
- `[2026-03-10] [INFO] [TEST] — Full suite: extension 104, backend 25, MCP bridge 18 = 147 total, 0 failures`
- `[2026-03-10] [INFO] [TS] — Zero TypeScript compiler errors across all packages`

### Phase 5: Backend Agents, Embeddings, Vector Search, Prompt Building
- `[2026-03-10] [INFO] [MODELS] — Extracted Pydantic models to src/api/models.py to break circular import between routes ↔ agents`
- `[2026-03-10] [INFO] [AGENT] — Intent interpreter: gesture metadata → human-readable intent with action verb, target description, magnitude, route`
- `[2026-03-10] [INFO] [AGENT] — Prompt builder: assembles PromptSchema from metadata + intent + retrieved examples with markdown prompt_text`
- `[2026-03-10] [INFO] [AGENT] — Verification engine: schema validation, safety checks (blocked selectors/keywords), consistency cross-checks, Jaccard drift scoring`
- `[2026-03-10] [INFO] [AGENT] — Safety blocklist: html, body, head, script, style, meta, link, iframe, object, embed, applet + universal selector (*)`
- `[2026-03-10] [INFO] [AGENT] — Blocked keywords: delete, drop, truncate, exec(, eval(, document.cookie, __proto__, constructor.prototype`
- `[2026-03-10] [INFO] [EMBED] — Deterministic hash-based embedding (SHA-512 → L2-normalized 1408-dim vector). Swappable to Gemini/Jina in Phase 8`
- `[2026-03-10] [INFO] [EMBED] — Cosine similarity search, in-memory VectorStore with configurable top_k (default 3)`
- `[2026-03-10] [INFO] [STORE] — 10 seed examples covering resize, move, color, text, spacing, visibility categories`
- `[2026-03-10] [INFO] [ROUTES] — /api/process-gesture wired to full 5-step pipeline: interpret → embed → search → build → verify`
- `[2026-03-10] [INFO] [ROUTES] — Response status derived from verification: error if schema/safety fail, needs_review if drift warning, success otherwise`
- `[2026-03-10] [INFO] [TEST] — 40 new agent pipeline tests: interpreter (7), builder (8), verification (8), embedding (7), vector store (6), example store (3), OWASP safety (1)`
- `[2026-03-10] [INFO] [TEST] — Full suite: extension 104, backend 65, MCP bridge 18 = 187 total, 0 failures`

### Phase 5 Hardening: Code Review Fixes
- `[2026-03-10] [BUG] [VERIFY] — _check_safety selector parsing: chained .split() missed blocked elements in compound selectors → replaced with re.split on CSS delimiters`
- `[2026-03-10] [BUG] [VERIFY] — _check_consistency: selector check was case-sensitive while action_type check was case-insensitive → normalized both to .lower()`
- `[2026-03-10] [BUG] [ROUTES] — All 5 except blocks leaked str(e) to client → added logger.exception() server-side, return generic "Internal server error"`
- `[2026-03-10] [BUG] [INTENT] — resize_right/resize_bottom used hardcoded "+" prefix causing "+-5px" → switched to {:+.0f} signed format`
- `[2026-03-10] [BUG] [MODELS] — target_dimensions typed as dict while current_dimensions was BoundingBox → unified to BoundingBox, updated builder/verifier/tests`
- `[2026-03-10] [INFO] [TEST] — Full suite after hardening: extension 104, backend 65, MCP bridge 18 = 187 total, 0 failures`

### Phase 6: Side Panel Chat & Voice Integration
- `[2026-03-10] [INFO] [VOICE] — useVoiceInput hook: Web Speech API (SpeechRecognition/webkitSpeechRecognition), idle/listening/processing/error states`
- `[2026-03-10] [INFO] [VOICE] — Graceful fallback when API unavailable (isSupported=false), continuous mode, interim results, lang=en-US`
- `[2026-03-10] [INFO] [VOICE] — speech-recognition.d.ts type declarations for SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent`
- `[2026-03-10] [INFO] [CHAT] — useChatStore hook: extracted chat state from AgentScreen into reusable hook with messages, input, processing state`
- `[2026-03-10] [INFO] [CHAT] — Listens for SW_INTENT_POPULATE and SW_AGENT_RESPONSE messages, auto-scrolls on new messages`
- `[2026-03-10] [INFO] [UI] — AgentScreen refactored: uses useChatStore + useVoiceInput hooks, added VoiceButton with mic SVG icon`
- `[2026-03-10] [INFO] [UI] — Voice status indicators: red pulsing "Listening" badge in header, red border glow on textarea, animated ping on mic button`
- `[2026-03-10] [INFO] [UI] — Voice auto-populates input textarea on final transcript, stops on send`
- `[2026-03-10] [INFO] [TEST] — 7 new voice/chat hook tests: API detection, module contracts, unsupported browser behavior`
- `[2026-03-10] [INFO] [TEST] — Full suite: extension 111, backend 65, MCP bridge 18 = 194 total, 0 failures`

### Phase 6 Hardening: Code Review Fixes
- `[2026-03-10] [BUG] [TEST] — voice-input.test.ts: "should report isSupported as false" title misleading — renamed to "detects absence of SpeechRecognition API in test environment"`
- `[2026-03-10] [BUG] [CHAT] — useChatStore: Date.now() IDs can collide on rapid inserts → added module-level _msgIdCounter, generateMsgId(prefix) produces unique IDs`
- `[2026-03-10] [BUG] [VOICE] — useVoiceInput: onTranscript called inside setTranscript updater → React may invoke updaters twice in Strict/concurrent mode → added transcriptRef, moved callback outside updater`
- `[2026-03-10] [INFO] [TEST] — Full suite after hardening: extension 111, backend 65, MCP bridge 18 = 194 total, 0 failures`
