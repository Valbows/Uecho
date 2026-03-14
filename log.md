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

### Phase 7: IDE/MCP Bridge & Export
- `[2026-03-10] [INFO] [ADAPTER] — IDE adapters: Windsurf (markdown/Cascade), Cursor (markdown/@workspace), VS Code (JSON/Copilot), Antigravity (plain text), generic fallback`
- `[2026-03-10] [INFO] [QUEUE] — In-memory prompt queue: queued→delivered|failed lifecycle, enqueue/markDelivered/markFailed/listPrompts/getPrompt`
- `[2026-03-10] [INFO] [MCP] — MCP bridge v0.2.0: POST /prompt routes through IDE adapter + queue, returns delivered=true with format`
- `[2026-03-10] [INFO] [MCP] — GET /prompts history endpoint with ?status, ?ide_target, ?limit filters; GET /prompts/:id detail with formatted prompt`
- `[2026-03-10] [INFO] [MCP] — GET /events SSE endpoint: broadcasts prompt_delivered events to connected clients`
- `[2026-03-10] [INFO] [MCP] — Health extended: supported_ides list, queue_size counter`
- `[2026-03-10] [INFO] [BACKEND] — /api/send-to-ide wired to MCP bridge via httpx.AsyncClient; returns 502 on bridge error, 503 on ConnectError`
- `[2026-03-10] [INFO] [TEST] — Backend send-to-ide tests: mocked httpx, added 503 bridge-down test (66 total)`
- `[2026-03-10] [INFO] [TEST] — MCP bridge: 34 tests (adapters 7, queue 4, detail 2, SSE 1, health-ext 2, existing 18)`
- `[2026-03-10] [INFO] [TEST] — Full suite: extension 111, backend 66, MCP bridge 34 = 211 total, 0 failures`

### Phase 7 Hardening: Code Review Fixes
- `[2026-03-10] [BUG] [MCP] — SSE /events route lacked authMiddleware → added authMiddleware to protect SSE endpoint`
- `[2026-03-10] [BUG] [MCP] — broadcastSSE could throw on dead sockets → added writableEnded/writableFinished check, try/catch with destroy, res.on('error') cleanup listener`
- `[2026-03-10] [BUG] [MCP] — POST /prompt returned delivered:true immediately without IDE confirmation → changed to accepted:true, delivered:false, queued:true; broadcast prompt_queued instead of prompt_delivered; removed premature markDelivered call`
- `[2026-03-10] [BUG] [MCP] — GET /prompts query params (status, ide_target, limit) unsafely cast → added whitelist validation for status, type check for ide_target, NaN/negative/max clamp for limit`
- `[2026-03-10] [BUG] [TEST] — Filter tests used .every() which vacuously passes on empty arrays → added Array.isArray + length > 0 assertions before .every()`
- `[2026-03-10] [BUG] [TEST] — SSE test lacked error handling, could hang on failure → rewrote with async/await + try/catch/finally, guaranteed server.close in error paths`
- `[2026-03-10] [BUG] [QUEUE] — In-memory queue grew unbounded → added MAX_QUEUE_SIZE=500, _evictTerminal LRU eviction, purgeTerminal TTL cleanup (30min default)`
- `[2026-03-10] [BUG] [QUEUE] — enqueue silently overwrote duplicate prompt_id → added _queue.has() guard, throws Error on duplicate`
- `[2026-03-10] [BUG] [QUEUE] — _evictTerminal only removed terminal entries, queue could exceed MAX_QUEUE_SIZE if all queued → added fallback to evict oldest queued entries`
- `[2026-03-10] [INFO] [TEST] — Full suite after hardening: extension 111, backend 66, MCP bridge 34 = 211 total, 0 failures`
- `[2026-03-10] [FIX] [EXT] — BACKEND_URL in service-worker.ts was 8080 → corrected to 8000 (uvicorn port)`
- `[2026-03-10] [FIX] [EXT] — Created placeholder icon PNGs (16/48/128) and copied content-style.css to public/ for CRXJS build`

### Phase 8: Verification, Guardrails & Security Hardening

#### 8a — Verification Engine Hardening
- `[2026-03-10] [SEC] [VERIFY] — Added 9 XSS/injection regex patterns (script tags, event handlers, javascript: URIs, iframes, data:text/html, expression(), etc.)`
- `[2026-03-10] [SEC] [VERIFY] — Added MAX_PROMPT_TEXT_LENGTH=5000 and MAX_SELECTOR_LENGTH=200 limits`
- `[2026-03-10] [SEC] [VERIFY] — Added MAX_SELECTOR_DEPTH=10 combinator limit to prevent overly complex selectors`

#### 8b — Comprehensive Verification Tests
- `[2026-03-10] [TEST] [VERIFY] — Added 12 new tests: XSS script/event/javascript/iframe, prompt length, selector length, selector depth, consistency warnings, drift edge cases, all blocked keywords, multiple schema errors`
- `[2026-03-10] [INFO] [TEST] — Verification tests: 21 total (was 9), all passing`

#### 8c — Backend Security
- `[2026-03-10] [SEC] [API] — Added slowapi rate limiting: process-gesture 30/min, enhance-text 30/min, upload-screenshot 10/min, send-to-ide 20/min`
- `[2026-03-10] [SEC] [API] — Tightened CORS allow_methods from wildcard to ["GET", "POST", "OPTIONS"]`
- `[2026-03-10] [SEC] [API] — Added Pydantic field constraints: GestureEvent.type max_length=50, selector max_length=500, page_url max_length=2000, viewport ge=0/le=10000, TextEnhanceRequest.text max_length=5000`
- `[2026-03-10] [SEC] [API] — Added ide_target field_validator: whitelist {windsurf, cursor, vscode, antigravity, generic}`
- `[2026-03-10] [FIX] [API] — Updated send-to-ide response to use bridge "accepted" field (was "delivered") to match Phase 7 response contract`

#### 8d — Extension Security
- `[2026-03-10] [SEC] [EXT] — Created message-validator.ts with runtime message validation (compile-time types are not enough)`
- `[2026-03-10] [SEC] [EXT] — validateMessage: checks type field exists, type is known, CS messages have tab context, sender matches extension ID`
- `[2026-03-10] [SEC] [EXT] — validateSubmitText: non-empty text, max 5000 chars`
- `[2026-03-10] [SEC] [EXT] — validateConfirmPrompt: required prompt fields, ide_target whitelist`
- `[2026-03-10] [SEC] [EXT] — validateActivateAgent: overlay mode whitelist {grid, divbox, off}`
- `[2026-03-10] [SEC] [EXT] — sanitizeString: strips control characters, trims, enforces max length`
- `[2026-03-10] [SEC] [EXT] — Integrated validators into service-worker.ts handleMessage for SP_ACTIVATE_AGENT, SP_SUBMIT_TEXT, SP_CONFIRM_PROMPT`

#### 8e — Integration Tests
- `[2026-03-10] [TEST] [API] — Added 9 input validation integration tests: type/selector/url length limits, negative viewport, empty/long text, invalid ide_target, valid targets accepted, XSS in pipeline`
- `[2026-03-10] [INFO] [TEST] — Full suite after Phase 8: extension 111, backend 87, MCP bridge 34 = 232 total, 0 failures`

### GCP Services Activation
- `[2026-03-10] [INFO] [GCP] — gcloud CLI authenticated as valery.rene@pursuit.org, project set to user-echo-ui-navigator`
- `[2026-03-10] [INFO] [GCP] — ADC credentials configured with quota project user-echo-ui-navigator`
- `[2026-03-10] [INFO] [GCP] — Billing enabled on project 11807439487`
- `[2026-03-10] [INFO] [GCP] — 6 APIs enabled: aiplatform, firestore, storage, firebase, run, cloudbuild`
- `[2026-03-10] [INFO] [GCP] — Firestore database created: Native mode, nam5 multi-region, free tier`
- `[2026-03-10] [INFO] [GCP] — Cloud Storage bucket created: user-echo-ui-navigator-screenshots (us-central1, STANDARD, uniform IAM)`
- `[2026-03-10] [INFO] [GCP] — Switched from Vertex AI to Google AI Studio for LLM/embedding access (API key auth)`
- `[2026-03-10] [INFO] [GCP] — LLM model: gemini-3.1-flash-lite-preview (AI Studio) — verified working`
- `[2026-03-10] [INFO] [GCP] — Embedding model: gemini-embedding-2-preview (AI Studio, multimodal: text+image+video+audio+PDF) — 3072-dim vectors`
- `[2026-03-10] [INFO] [GCP] — .env created with GEMINI_API_KEY, GEMINI_MODEL, GEMINI_EMBEDDING_MODEL, bucket config`
- `[2026-03-10] [DECISION] [GCP] — Vector store dimension changed: 1408 (multimodalembedding@001) → 3072 (gemini-embedding-2-preview). Update pending for Phase 9`
- `[2026-03-10] [DECISION] [GCP] — SDK: google-genai with api_key param (not deprecated vertexai SDK)`

### Verification Engine Fix
- `[2026-03-10] [BUG] [VERIFY] — Non-greedy regex re.sub(r'\[.*?\]', '[]', selector) failed for attribute values with brackets inside quotes (e.g. [data="a]b"], [title='[icon]']) → replaced with iterative scanner tracking bracket depth and quote state (single/double), handles escaped characters`
- `[2026-03-10] [INFO] [TEST] — Full suite after fix: extension 111, backend 87, MCP bridge 34 = 232 total, 0 failures`

### Permission Rollout Strategy (Phase 9)
- **Current:** localhost-only (`http://localhost/*`, `http://127.0.0.1/*`) — S.A.F.E. compliant for dev testing
- **After Phase 8 guardrails pass:** Add explicit staging/production domains to `host_permissions` and `content_scripts.matches`
- **Full support (optional):** Switch to `https://*/*` or use Chrome optional permissions API (`chrome.permissions.request`) for on-demand site access — avoids permission escalation prompts for existing users
- **Files to update:** `extension/manifest.json` (host_permissions, content_scripts.matches), rebuild + redeploy
- **Note:** Permission escalation after Chrome Web Store deployment triggers re-approval prompt for users

### Runtime Integration and Voice Recovery
- `[2026-03-14] [FIX] [EXT] — Added offscreen → service worker message support for VOICE_STATUS and VOICE_TRANSCRIPT in shared message types, message validator, and service-worker forwarding`
- `[2026-03-14] [FIX] [EXT] — Added microphone permission support in extension manifest and introduced explicit mic-permission recovery UX`
- `[2026-03-14] [FIX] [EXT] — Added dedicated mic permission helper page (src/mic-permission/mic-permission.html/.ts) and packaged it in the Vite build so blocked side-panel permission requests can recover in a normal extension page`
- `[2026-03-14] [FIX] [VOICE] — Switched primary speech runtime from offscreen SpeechRecognition to visible side-panel SpeechRecognition; retained offscreen path only as fallback for unsupported contexts`
- `[2026-03-14] [FIX] [VOICE] — Confirmed new runtime bundle loaded in Chrome (sidepanel-DNC_NlaL.js) and eliminated the previous repeated offscreen not-allowed loop`
- `[2026-03-14] [FIX] [EXT] — Set Vite base to relative paths so offscreen and sidepanel HTML load bundled assets correctly in Chrome extension context`
- `[2026-03-14] [FIX] [HISTORY] — Reworked History screen to fetch real MCP bridge prompt data, refresh from bridge state, and show live queued/delivered counts`
- `[2026-03-14] [FIX] [MCP] — Added Windsurf/Cascade-compatible MCP stdio server (mcp-bridge/src/mcp-stdio-server.ts) and bridge delivery endpoints so U:Echo prompts can be retrieved through MCP tools instead of a pseudo bridge only`
- `[2026-03-14] [DECISION] [MCP] — Clarified current handoff semantics: extension action queues prompts into the local U:Echo bridge for MCP retrieval; it does not inject prompts directly into an existing Windsurf chat thread`
- `[2026-03-14] [FIX] [TEST] — Added Playwright B6 mic transcription coverage using mocked side-panel SpeechRecognition to validate real transcript plumbing, not just click-without-crash behavior`
- `[2026-03-14] [FIX] [TEST] — Updated stale extension unit assertions to match current 1px grid behavior (DEFAULT_GRID_CELL_SIZE and overlay backgroundSize)`
- `[2026-03-14] [FIX] [BACKEND] — Replaced synchronous LLM calls with async (await model.generate_content_async) in enhance_text and generate_prompt routes to prevent event loop blocking`
- `[2026-03-14] [FIX] [BACKEND] — Fixed generate_prompt fallback response to return status="fallback" with explicit verification=None for consistent client handling`
- `[2026-03-14] [FIX] [EXT] — Fixed offscreen document creation guard in ensureOffscreenDocument to reset offscreenCreating to null in finally block, preventing permanently rejected promise leaks`
- `[2026-03-14] [FIX] [EXT] — Added ensureOffscreenDocument() guard to SP_VOICE_STOP handler to match SP_VOICE_START pattern, preventing messages to non-existent offscreen doc`
- `[2026-03-14] [FIX] [EXT] — Removed invalid "microphone" permission from manifest.json (Chrome MV3 doesn't support it; mic access handled via getUserMedia at runtime)`
- `[2026-03-14] [FIX] [EXT] — Removed overly-broad "<all_urls>" from host_permissions, scoped to localhost only with activeTab for temporary access`
- `[2026-03-14] [FIX] [EXT] — Added AbortController to HistoryScreen fetchHistory to prevent state updates after unmount`
- `[2026-03-14] [FIX] [EXT] — Added loading state display in HistoryScreen when prompts.length === 0 && isLoading`
- `[2026-03-14] [FIX] [EXT] — Fixed App.tsx pushStatus timeout leak with useRef cleanup and race prevention`
- `[2026-03-14] [FIX] [EXT] — Disabled VerifyScreen push button during 'success' state to prevent duplicate submissions`
- `[2026-03-14] [FIX] [EXT] — Added error handling to useChatStore chrome.storage.local.get with .catch/.finally ensuring isLoadedRef always set`
- `[2026-03-14] [FIX] [MCP] — Fixed mcp-stdio-server.ts deliver endpoint: corrected comment (POST not PATCH), checked response, gated "marked as delivered" message on success`
- `[2026-03-14] [FIX] [MCP] — Fixed server.ts fail endpoint to use normalized finalError in markFailed, log, and broadcastSSE for consistency`
- `[2026-03-14] [FIX] [TEST] — Fixed offscreen.html corruption from accidental paste, verified Vite handles .ts references correctly`
- `[2026-03-14] [FIX] [TEST] — Strengthened E2E MCP bridge queue assertion to always verify request success with expect(queueRes.ok()).toBeTruthy()`
- `[2026-03-14] [INFO] [DOCS] — Added Permissions & Site Access section to README.md documenting activeTab, host_permissions, and expansion strategies`
- `[2026-03-14] [FIX] [TEST] — Updated E2E generate-prompt assertion to accept all valid statuses (success|needs_review|error|fallback)`
- `[2026-03-14] [BUG] [EXT] — BACKEND_URL hardcoded to port 8000 in service-worker.ts and E2E spec; backend runs on 8080 → fixed both to localhost:8080`
- `[2026-03-14] [BUG] [EXT] — chrome.tabs.captureVisibleTab failed with "activeTab permission required" because gesture-triggered screenshots fire asynchronously after activeTab grant expires → restored <all_urls> in host_permissions`
- `[2026-03-14] [FIX] [DOCS] — Updated README Permissions section to document why <all_urls> is required for captureVisibleTab`
- `[2026-03-14] [FIX] [EXT] — Fixed HistoryScreen onClick={fetchHistory} type error — wrapped in arrow function to avoid passing MouseEvent as AbortSignal`
- `[2026-03-14] [INFO] [TEST] — Full suite run: Extension Jest 111/111, MCP Bridge Jest 34/34, Backend pytest 87/87, Playwright E2E 33 passed/3 skipped`

### MCP Prompt Delivery Feature
- `[2026-03-14] [FIX] [MCP] — Replaced tsc build with tsup bundler to fix ESM module resolution (ERR_MODULE_NOT_FOUND on compiled imports)`
- `[2026-03-14] [FEAT] [MCP] — Added MCP Prompt registration (uecho_apply) in stdio server — prompts appear in Cascade's prompt picker and return developer-ready instructions`
- `[2026-03-14] [FEAT] [MCP] — Added SSE bridge listener in stdio server — connects to /events endpoint, calls sendPromptListChanged() on prompt_queued/delivered/failed for real-time Cascade notification`
- `[2026-03-14] [FEAT] [MCP] — SSE reconnect with 3s backoff if bridge connection drops`
- `[2026-03-14] [INFO] [DOCS] — Documented Windsurf MCP integration in README: mcp_config.json setup (tsx and compiled), tool/prompt reference, real-time notification`
- `[2026-03-14] [INFO] [TEST] — Added 4 delivery lifecycle integration tests: queue→detail→deliver, queue→fail, 404 on unknown deliver/fail`
- `[2026-03-14] [FIX] [MCP] — Added proper SSE cleanup: AbortController for fetch, reader.cancel() on abort, shutdownSSE() wired to SIGINT/SIGTERM/exit for graceful resource disposal and reconnect control`

### Codebase Cleanup & Refactoring
- `[2026-03-14] [CLEANUP] — Deleted backend/.venv (680MB duplicate of backend/venv)`
- `[2026-03-14] [CLEANUP] — Removed 7 empty directories: backend/seed, agents/action-recorder, agents/prompt-builder, agents/verification, extension/src/popup, sidepanel/stores, tests/integration`
- `[2026-03-14] [CLEANUP] — Deleted extension/jest.config.ts.bak (superseded by jest.config.js)`
- `[2026-03-14] [CLEANUP] — Confirmed extension/public/src/content/content-style.css is required by Vite build (copies to dist/ for manifest reference) — retained`
- `[2026-03-14] [CLEANUP] — Deleted stale plan.md (Phase 0 artifact, never updated)`
- `[2026-03-14] [REFACTOR] [EXT] — Added BACKEND_URL to shared/constants.ts; service-worker.ts now imports BACKEND_URL and MCP_BRIDGE_URL from constants instead of hardcoding`
- `[2026-03-14] [FIX] [EXT] — Updated EMBEDDING_DIMENSIONS from 1408 (multimodalembedding@001) to 3072 (gemini-embedding-2-preview); updated corresponding unit test`
- `[2026-03-14] [REFACTOR] [DOCS] — Rewrote docs/architecture.md: replaced Vertex AI/Firestore/Firebase Auth references with AI Studio/local backend/MCP stdio server; updated embedding model and dimensions`
- `[2026-03-14] [INFO] [TEST] — Post-cleanup full suite: Extension Jest 111/111, MCP Bridge Jest 38/38, Backend pytest 87/87, Playwright E2E 33 passed/3 skipped — all green`
- `[2026-03-14] [FIX] [DOCS] — Fixed inconsistent Gemini model names in architecture.md: standardised to gemini-3.1-flash-lite-preview everywhere`
- `[2026-03-14] [FIX] [MCP] — Removed duplicate shebang in compiled mcp-stdio-server.js: source had #!/usr/bin/env node AND tsup banner added another, causing SyntaxError; removed shebang from source, let tsup handle it`
- `[2026-03-14] [FIX] [MCP] — Switched mcp_config.json from "npx tsx src/mcp-stdio-server.ts" to "node dist/mcp-stdio-server.js" — npx broke stdio pipe forwarding needed by MCP transport`
- `[2026-03-14] [INFO] [MCP] — Manual E2E verified: extension → bridge queue → MCP stdio server → Cascade prompt retrieval (3 prompts received including "Increase container box size", "Update header font size", "Card Resize")`

### Phase 9: Cloud Integration & Production Deployment

#### 9a — Real Gemini Embeddings
- `[2026-03-14] [FEAT] [EMBED] — Replaced hash-based stub with real Gemini embedding API (gemini-embedding-2-preview, 3072-dim)`
- `[2026-03-14] [FEAT] [EMBED] — Migrated from deprecated google.generativeai to google.genai SDK with native async (client.aio.models.embed_content)`
- `[2026-03-14] [FEAT] [EMBED] — embed_gesture, embed_text, embed_query now async; hash fallback when GEMINI_API_KEY not set`
- `[2026-03-14] [FIX] [ROUTES] — Converted vector store init to async lifespan; await embed_gesture in process_gesture`
- `[2026-03-14] [FIX] [TEST] — conftest unsets GEMINI_API_KEY to force hash fallback (tests: 0.77s vs 37s with real API)`

#### 9b — Persistent Vector Store (ChromaDB)
- `[2026-03-14] [FEAT] [VECTOR] — Replaced in-memory VectorStore with ChromaDB-backed persistent store (data/chroma/)`
- `[2026-03-14] [FEAT] [VECTOR] — Ephemeral mode for tests, persistent for production; upsert to avoid duplicate seeds on restart`
- `[2026-03-14] [FIX] [VECTOR] — ChromaDB rejects empty metadata dicts — conditionally pass metadatas only when non-empty`
- `[2026-03-14] [FEAT] [STORE] — create_seeded_store skips re-embedding if collection already populated`

#### 9c — Cloud Storage (GCS)
- `[2026-03-14] [FEAT] [UPLOAD] — upload-screenshot endpoint: real GCS upload via google-cloud-storage SDK`
- `[2026-03-14] [FEAT] [UPLOAD] — Returns public_url + gs_uri, 10MB file size limit, content-type detection`
- `[2026-03-14] [INFO] [GCS] — Bucket: user-echo-ui-navigator-screenshots (us-central1)`

#### 9d — Firestore Persistent Storage
- `[2026-03-14] [FEAT] [FIRESTORE] — firestore_client.py: async Firestore client with in-memory fallback for tests`
- `[2026-03-14] [FEAT] [FIRESTORE] — Session CRUD: create_session, get_session, update_session`
- `[2026-03-14] [FEAT] [FIRESTORE] — Request history: save_request, get_request, list_requests, count_requests`
- `[2026-03-14] [FEAT] [ROUTES] — process_gesture persists request to Firestore (fire-and-forget)`
- `[2026-03-14] [FEAT] [ROUTES] — export-csv now queries Firestore and generates real CSV output`
- `[2026-03-14] [FIX] [FIRESTORE] — Updated deprecated where() positional args to FieldFilter keyword syntax`

#### 9e — Firebase Authentication
- `[2026-03-14] [FEAT] [AUTH] — firebase_auth.py: Firebase Admin SDK token verification middleware`
- `[2026-03-14] [FEAT] [AUTH] — Graceful fallback: auth disabled when Firebase Admin not configured (local dev/tests)`
- `[2026-03-14] [FEAT] [AUTH] — verify_token dependency on protected routes: process-gesture, enhance-text, upload-screenshot, send-to-ide`
- `[2026-03-14] [FEAT] [EXT] — Added identity permission and oauth2 config placeholder to manifest.json`

#### 9f — Docker & Cloud Run
- `[2026-03-14] [FEAT] [DOCKER] — Backend Dockerfile: Python 3.14-slim, non-root user, health check, ChromaDB volume`
- `[2026-03-14] [FEAT] [DOCKER] — MCP bridge Dockerfile: Node 20-slim, health check`
- `[2026-03-14] [FEAT] [DOCKER] — docker-compose.yml: backend + mcp-bridge services with shared .env`
- `[2026-03-14] [FEAT] [DEPLOY] — cloudbuild.yaml: build → push → deploy to Cloud Run (us-central1, 512Mi, 0-3 instances)`

#### 9g — CI/CD Pipeline
- `[2026-03-14] [FEAT] [CI] — .github/workflows/ci.yml: test-backend → lint-extension → lint-mcp-bridge → deploy-backend`
- `[2026-03-14] [FEAT] [CI] — Deploy job: Workload Identity Federation auth, GCR push, Cloud Run deploy (main branch only)`

#### 9h — Permission Rollout & Chrome Web Store Prep
- `[2026-03-14] [FEAT] [EXT] — Added identity permission for Google Sign-In via chrome.identity API`
- `[2026-03-14] [FEAT] [EXT] — Added oauth2 config with scopes (openid, email, profile) and CWS key placeholder`

#### Phase 9 Summary
- `[2026-03-14] [INFO] [TEST] — Full suite after Phase 9: backend 87/87, all green in 0.77s`
- `[2026-03-14] [INFO] [DEPS] — New dependencies: google-genai>=1.0.0, chromadb>=1.0.0`
- `[2026-03-14] [INFO] [DEPS] — Removed: google-generativeai (deprecated)`

### Security Hardening (Post Phase 9)
- `[2026-03-14] [FIX] [AUTH] — Added Depends(verify_token) to export_csv endpoint (was the only unprotected mutation route)`
- `[2026-03-14] [FIX] [UPLOAD] — Replaced blob.make_public() with generate_signed_url (1-hour expiry) to prevent permanent public exposure of screenshots`
- `[2026-03-14] [FIX] [UPLOAD] — Replaced single file.read() with chunked 64KB streaming; raises 413 before full memory allocation on oversized uploads`
- `[2026-03-14] [FIX] [ROUTES] — Replaced assert _vector_store with explicit RuntimeError raise (cannot be stripped by python -O)`
- `[2026-03-14] [FIX] [FIRESTORE] — Fixed data override vulnerability in create_session and save_request: system fields now placed after **data spread so they always win`
- `[2026-03-14] [FIX] [FIRESTORE] — Fixed update_session in-memory branch to create new session when missing, matching Firestore set(merge=True) behavior`
- `[2026-03-14] [FIX] [AUTH] — Swapped exception handler order: catch ExpiredIdTokenError before InvalidIdTokenError (subclass-first)`
- `[2026-03-14] [FIX] [AUTH] — Firebase init failure now raises RuntimeError when FIREBASE_AUTH_REQUIRED is set, instead of silently disabling auth`
- `[2026-03-14] [FIX] [EMBED] — Added try/except in _gemini_embed with hash fallback on network/rate-limit/empty-response errors`
- `[2026-03-14] [FIX] [DEPLOY] — Removed redundant images: section from cloudbuild.yaml (explicit push steps already handle pre-deploy push)`
- `[2026-03-14] [FIX] [EXT] — Removed unused "identity" permission from manifest.json (no chrome.identity calls in codebase)`
- `[2026-03-14] [INFO] [TEST] — Full suite after hardening: backend 87/87, extension 111/111, MCP bridge 38/38, Playwright E2E 33/33 (3 skipped)`
