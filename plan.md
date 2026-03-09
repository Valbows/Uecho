# U:Echo — Living Project Plan

## Current Phase: Phase 0 — Architecture & Planning

### Status
- [x] Clone repo and init project structure
- [ ] Create architecture diagram
- [ ] Define Chrome message protocol types
- [ ] Define prompt schema types (FR-10)
- [ ] Threat model
- [ ] DevOps strategy

### Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-09 | Monorepo structure (extension + backend + mcp-bridge) | Single repo for hackathon velocity |
| 2026-03-09 | Vite + CRXJS for extension build | Best HMR support for Chrome extensions |
| 2026-03-09 | FastAPI for backend | Lightweight, async, good ADK compatibility |
| 2026-03-09 | React 18 + TailwindCSS for side panel | Matches Stitch design system, fast iteration |
