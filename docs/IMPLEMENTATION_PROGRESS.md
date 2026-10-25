# Vela Forge — incremental implementation

Base: `main` at `4dcc987`. Work branch: `feat/forge-mvp`.

## Issue #2 — visual connection lifecycle

The initial code already sent connection requests through editor.js and api.js,
stored connections in the shared service, and drew permanent wires from GET graph.
Those paths were preserved. Graph.connect now rejects missing nodes, self-links,
and directions other than out → in. Rejected operations leave the graph intact.
Pointer events from unrelated pointers are ignored during a connection drag.
Refreshing the graph cancels the preview and releases capture; Escape and pointer
cancellation also release capture. Existing permanent wires follow moving nodes.

## Issue #1 — node positions

Node.position is serialized with the IR. Initial positions are assigned by the
service. PATCH updates validate both coordinates before changing the node.
The frontend cache is rebuilt from GET graph. Movement is written only after a
completed drag; selection clicks and cancelled drags do not write positions.
A failed write is logged and followed by a graph refresh to restore backend state.

## Issue #3 — Inspector

The Inspector now uses the actual `vf-inspector` element. It renders selected
properties and offers Save and Delete. Save sends a partial properties PATCH;
strings use text values and existing non-string values use JSON. The backend
merges properties and returns the updated node. The Inspector, IR, canvas and
counts refresh from GET graph. Delete goes through ForgeService; Graph removes
all connections attached to the deleted node.

## Validation

Install the project's runtime dependency and pytest:

```sh
python -m pip install -r requirements.txt
python -m pip install pytest
python -m pytest -q
```

25 tests passed with Vela Framework 0.2.2 at commit
`44a6df91fc96a21c323e520abe50141878c4bf99`, Python 3.12 on Linux.
Tests include domain/service state assertions and real HTTP route binding via the
Vela WSGI application. The pre-existing create-node test used an obsolete service
signature; it was updated to assert the current returned Node and stored graph.
Existing tests were retained, including completing the previously assertion-free
connect test. Modified JS files also pass `node --check`.

The browser regression test exercises preview, target feedback, persisted wires,
movement, reload, Inspector save and deletion against the real Vela API and Forge
view. In a second terminal, with Node and Playwright installed:

```sh
python tests/browser/server.py
# Leave this process running; press Enter to stop it.
```

```sh
npm install --no-save playwright
npx playwright install chromium
node tests/browser/editor.cjs
```

Start a fresh test server for each test run. This harness uses the actual Forge
view and assets, without opening a desktop window. It does not exercise the
pywebview desktop shell.

## Open verification and limitations

- Browser execution is **unverified** in this environment: no Chromium binary is
  installed and the download returns invalid ZIP content. The browser test has
  been added but has not passed here. Check it before treating the visual
  acceptance criteria as fully verified.
- Native Windows/pywebview interaction still needs a manual smoke test.
- No Vela framework source was changed; PATCH uses its public Request.json and
  Request.path_params contracts. Its handlers accept one argument.
- Positions survive frontend reload while the backend is running. Project files
  and survival across backend restarts remain Issue #5.
- Ports remain the MVP out/in pair pending Issue #4.
- The Inspector supports editing existing property keys. Registry-defined
  properties, typed validation and specialized controls remain future work.
- Concurrent editing and multi-user sessions are outside this MVP.

## Remaining backlog, in requested order

Next: **#4**, after verifying the browser acceptance criteria for this increment.
Then #11, #12, #5, #6, #7, #8, #13, #9, #10 and #14.
These issues have not been implemented in this increment. No placeholder
exporters, persistence layer or event system was introduced.

## Issue #4 — registry and typed ports

Definitions now live in domain/registry.py. The service applies independent
copies of defaults and rejects unknown types. Graph serializes derived flow
ports for the canvas. Start has no input, End has no output, Branch exposes
true/false, and Choice derives one choice_N output per option. Removing an option
with an attached connection is rejected until that connection is removed.
The frontend no longer declares default properties or hardcodes in/out sockets.

## Issue #11 — connection selection and deletion

Wires can be selected and removed with Delete/Backspace. Text editing does not
trigger graph deletion. Selection retains the stable connection ID as the basis
for future source/target reconnection; endpoint dragging is intentionally future
scope in Issue #11. DELETE passes through the shared service to Graph.disconnect.

## Issue #12 — library drag/drop

Library items now send a Forge-specific drag payload. Only the workspace handles
the drop, converts screen coordinates through its existing pan/zoom transform,
and dispatches to editor.js. The create-node POST accepts position atomically;
invalid coordinates leave no new node behind. Double-click remains available.
