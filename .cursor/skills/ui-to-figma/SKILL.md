---
name: ui-to-figma
description: >-
  Pushes a running web UI (Vite/React SPA) into an existing Figma file via Figma MCP
  generate_figma_design (HTML-to-design capture): env-gated capture script, correct script
  order to avoid empty frames, hash URL with delay and #root selector, polling, and optional
  page nodeId targeting. Pulls design back with get_design_context. Use when the user wants
  to publish, export, or capture a page or screen to Figma, sync UI to Figma, code-to-canvas,
  HTML-to-design, figmacapture, or wireframes from localhost into a Figma file.
disable-model-invocation: false
---

# UI → Figma (capture live pages)

## Preconditions

- **Figma MCP** is connected and authenticated (`whoami` on server `user-figma` succeeds).
- **`create_new_file`** / **`generate_figma_design`** / **`use_figma`** tool schemas are read from the MCP descriptor folder before calling.
- For **local** URLs: the app must be served over **http** (not `file://`). Follow Figma MCP rules: **script-tag path for localhost**, not Playwright-injected capture on external sites.

## 1. Vite (or similar): inject capture script without racing React

Empty white frames in Figma almost always mean the DOM was captured **before** React mounted.

**Do:**

- Gate injection on an env var (e.g. `VITE_FIGMA_CAPTURE=1`).
- Inject **after** the app entry module tag, with **`defer`** (not `async` at the end of `body`).

**Pattern (this repo):** `vite.config.ts` — `transformIndexHtml` replaces

`<script type="module" src="/src/main.tsx"></script>`

with the same line **plus** on the next line:

`<script defer src="https://mcp.figma.com/mcp/html-to-design/capture.js"></script>`

**Do not:** append the capture script with **`async`** after the module; it can run before paint.

See also: `docs/figma/README.md` in this repository.

## 2. Start dev server with capture enabled

```bash
# Windows PowerShell
$env:VITE_FIGMA_CAPTURE='1'; npm run dev

# macOS / Linux
VITE_FIGMA_CAPTURE=1 npm run dev
```

Confirm port (e.g. Vite default **5173**) and that the home/route loads in a normal browser tab.

## 3. Reserve a capture and target file

1. If the user has no file yet: **`create_new_file`** with `editorType: "design"` and `planKey` from **`whoami`** (`key` on the chosen plan).
2. If adding to an existing file: use **`fileKey`** from `figma.com/design/{fileKey}/...`.

**Optional `nodeId`:** Figma **page** id (e.g. `2:4` for a page named `02 · Home`). Obtain via **`use_figma`** code such as:

`figma.root.children.map((p) => p.name + '=' + p.id).join('|')`

Pass `nodeId` as `"2:4"` (colon form) into **`generate_figma_design`**.

3. Call **`generate_figma_design`** with `outputMode: "existingFile"`, `fileKey`, and optional `nodeId`. Save the returned **`captureId`** and endpoint instructions.

## 4. Open the capture URL (local / script-tag path)

Build a **single-page** URL:

- Base: `http://localhost:<port>/<path>` (must match the screen to capture).
- Hash (encode `figmaendpoint` as required by the tool output), include:
  - `figmacapture=<captureId>`
  - `figmaendpoint=<https-encoded submit URL>`
  - `figmadelay=8000` (or higher on slow machines)
  - `figmaselector=%23root` to scope to the React root (reduces empty captures)

Open in the user’s **desktop browser** (Chrome/Edge). Embedded IDE browsers may not complete submit reliably.

## 5. Poll until completed

Call **`generate_figma_design`** with `{ captureId }` every ~5s. Do not mint a new `captureId` while polling. Treat **`completed`** as success; if still pending after many polls, verify the tab actually loaded the **hash URL** and that `VITE_FIGMA_CAPTURE=1` was set when Vite started.

## 6. Verify in Figma (avoid false success)

Use **`use_figma`** on the new frame id from the completed response:

- `const n = await figma.getNodeByIdAsync("<id>"); return n.children.length`

**`count=0`** ⇒ capture was still empty; fix script order / delay / selector and re-capture with a **new** `captureId`.

## 7. Cleanup and handoff

- Remove obsolete placeholder frames on the same page if confusing.
- Leave **`VITE_FIGMA_CAPTURE`** unset for day-to-day dev so production HTML never depends on the capture script.

**Design → code:** use **`get_design_context`** (and screenshots if needed) on the Figma node URL the user shares; map output to this project’s tokens and components (do not paste Figma’s raw Tailwind verbatim if the repo uses design tokens).

## Quick checklist

- [ ] Capture script **`defer`** immediately after app **`type="module"`** entry
- [ ] Dev server started with **`VITE_FIGMA_CAPTURE=1`**
- [ ] New **`generate_figma_design`** capture id + **`existingFile`** + **`fileKey`** (+ optional **`nodeId`**)
- [ ] Browser opened with **hash** URL, **`figmadelay`** ≥ 8000, **`figmaselector=%23root`**
- [ ] Polled to **`completed`**
- [ ] Verified **`children.length > 0`** on the resulting frame

## Extra reference

MCP tool names, polling rules, and Playwright vs local: [reference.md](reference.md)
