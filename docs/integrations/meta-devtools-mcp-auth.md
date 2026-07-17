# Meta DevTools MCP Auth

Bestie uses Cursor's `meta-devtools` MCP server for Meta documentation, API health,
and webhook work:

```json
"meta-devtools": {
  "type": "http",
  "url": "https://mcp.facebook.com/devtools"
}
```

Cursor owns the OAuth callback listener for this remote MCP server. On desktop,
Cursor uses the fixed loopback callback `http://localhost:8787/callback` or
`http://127.0.0.1:8787/callback` while the Connect flow is active.

## Before Connecting

Run:

```sh
npm run meta:mcp-auth-check
```

The preflight checks that:

- `meta-devtools` is configured in the user Cursor MCP config.
- `127.0.0.1:8787` is free for Cursor to bind during OAuth.
- The last Meta OAuth attempt was not started from Cursor's `empty-window` surface.

The script intentionally does not start a listener and does not handle callback
URLs or OAuth codes. A fake local listener would capture sensitive OAuth material
and would also prevent Cursor from binding the port.

## Connect Flow

1. Keep the `bestie.mx` Cursor project window open and focused.
2. In that same window, open Cursor Settings -> Tools & MCP.
3. Use `meta-devtools` -> Connect.
4. Complete the Meta OAuth flow in the browser.
5. If the browser redirects to `127.0.0.1:8787` and fails, replace only the host
   with `localhost` while keeping `/callback` and the query string unchanged.
6. Do not paste OAuth callback URLs or authorization codes into chat, tickets, or
   docs.

## Cursor Limitation

There is currently no supported Cursor setting, `mcp.json` field, environment
variable, or CLI flag that keeps the MCP OAuth callback listener alive ahead of
time or changes the callback port. The listener is an ephemeral Cursor-owned
process created during the Connect flow.

If `npm run meta:mcp-auth-check` passes but Connect still redirects to an
unbound port, restart Cursor, close empty Cursor windows, reopen `bestie.mx`, and
start Connect again from the project window. If the OAuth attempt keeps recording
`owner.workspaceId` as `empty-window`, treat it as a Cursor product issue and
include Cursor's MCP output logs when reporting it.
