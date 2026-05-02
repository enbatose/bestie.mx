# UI → Figma — MCP reference

## Servers and tools

| Goal | Server (typical) | Tool |
|------|------------------|------|
| Auth / plan | `user-figma` | `whoami` |
| New empty file | `user-figma` | `create_new_file` |
| Start capture / poll | `user-figma` | `generate_figma_design` |
| Plugin API (pages, delete, plugin data) | `user-figma` | `use_figma` |
| Design → code | `user-figma` | `get_design_context`, `get_screenshot`, `get_metadata` |

Always read each tool’s JSON descriptor under the workspace `mcps/` folder before the first call in a session.

## `generate_figma_design` notes

- **Local:** inject `https://mcp.figma.com/mcp/html-to-design/capture.js` into the app HTML; open the **hash** URL from the tool output. Do not rely on `open https://example.com#figmacapture=...` for **external** sites without Playwright (Figma MCP rules).
- **Polling:** reuse the same `captureId` until status is terminal; do not parallel a second capture on the same id.
- **`nodeId`:** optional; targets a **page** or node in an **existing** file. Omitting may add a new page—confirm with the user.

## Figma URL → `nodeId`

From `?node-id=13-34` use **`13:34`** (replace `-` with `:`).

## Repo-specific paths

- Flow specs: `docs/figma/flows/`
- Board SVG: `docs/figma/bestie-user-flows.svg`
- Capture env + Vite hook: `vite.config.ts`, `docs/figma/README.md`
