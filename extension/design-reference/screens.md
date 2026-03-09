# U:Echo — Stitch Design Reference

## Screen Mapping (Phase A–E)

| Phase | Screen | Stitch ID | Key UI Components |
|-------|--------|-----------|-------------------|
| A | Welcome & Connect | `7a9da6bc64c648b982c5c244eff2beaa` | Logo, tagline, connectivity status rows (Ext/API/IDE), CTA button, docs/release/support links |
| B | Live Workspace (Idle) | `dc26c3b2285b4f3da55e7e802d3af97d` | Echo Panel header, live session badge, page index, recent suggestions cards, "how to start" section |
| C | Active Selection Mode | `b61cc22652754b42990f521003768e6c` | Selection detail panel, CSS class display, computed styles (padding/margin), element info |
| C | AI Agent Panel | `d539ae6e2693428685da630eb3801376` | Chat bubbles (System/Assistant), gesture translation display, selector badge, version badge |
| D | Verify & Handoff | `a57728d73ff841c08abef0526019089c` | JSON prompt viewer, confidence score, destination IDE selector, history/prompts/verification tabs |
| E | History & Logs | `c38975d519ec47e3b2f355c4f5e6b2d0` | Stats cards (requests/verified/avg turnaround), request list with selectors, request detail timeline |

## Design Tokens (extracted)
- **Primary:** #1392ec (blue)
- **Background:** #f8fafc (light gray)
- **Surface:** #ffffff
- **Border:** #e2e8f0
- **Text:** #0f172a
- **Text Secondary:** #64748b
- **Text Muted:** #94a3b8
- **Success:** #22c55e
- **Warning:** #f59e0b
- **Error:** #ef4444
- **Code BG:** #f1f5f9
- **Font:** Space Grotesk (headings), JetBrains Mono (code)
- **Border Radius:** 8px default, 12px cards, 16px large panels
