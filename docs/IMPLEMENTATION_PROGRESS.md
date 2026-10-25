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

## Issue #5 — .vforge persistence

Versioned project JSON stores metadata, stable IDs, properties, positions and
connections; derived ports are regenerated from the registry. Loading builds and
validates a separate Graph before replacing the active project. Native open/save
use pywebview's public file dialogs through the consumer bridge; files are written
with atomic replacement. Browser testing uses upload/download as a fallback.
Save, Open and New actions are connected. Invalid files preserve the current graph.

## Issue #6 — validator and Problems

A separate validator returns severity/code/message/node/connection records. It
checks duplicate IDs, endpoints, registry ports, Start count, required fields,
ambiguous outputs and reachability. Missing End, unreachable nodes and dangling
outputs are warnings. Problems is refreshed from the API, supports selecting a
related node and gates the Preview action on fatal errors. Exporters consume the
same validator when implemented. Traversal terminates even for cyclic graphs.

## Issue #7 — Event Manager

Events have stable IDs/names, separate storage from Graph and a dedicated view.
Create/list/delete and node usage links are implemented. Emit Event uses a select
of existing project events. Deleted references remain visible and are reported by
the validator. Event definitions survive .vforge save/load; no runtime bus added.

## Issue #8 — asset import and Scene Preview

PNG/JPEG/GIF/WebP can be imported, listed under Items > Assets and selected for
Scene Preview. Metadata and base64 content are embedded in .vforge for portable
save/load. Limits: 2 MiB per image, 8 MiB total; HTTP body limit is 16 MiB. The
backend checks MIME/signature, base64 and sizes. Missing data yields a Problems
warning and an explicit preview message. Other renderers and 3D are future scope;
no fixed character or engine dependency was introduced.

## Issue #13 — undo/redo

A bounded, in-memory command history stores before/after project snapshots in the
service (50 commands). Successful changes record commands; failed changes and
no-ops do not. Create/delete/move/property/connection operations, events and asset
imports are reversible, including attached connections. New/Open clears history
only after a valid load. Undo/Redo buttons and Ctrl/Cmd+Z, Ctrl+Y, Ctrl+Shift+Z call
the same API; focused text fields retain native text undo. No DOM reversal logic.

## Issue #9 — Godot exporter

The exporter contract is a plain export_project(project) -> {relative path: text}
function. Godot output includes project.godot, main.tscn, a GDScript runner, the
serialized project and instructions. Start/Dialogue/Choice/Branch/Set Variable/
Emit Event/End are interpreted by the generated runner, with buttons and signals.
Branch.condition means a variable key, not arbitrary code. Export is deterministic,
validator-gated and leaves .vforge/history untouched. Generated Code shows all
files; native export writes a chosen directory, browser fallback downloads a ZIP.
Godot execution still needs a smoke test in an installed Godot 4 editor. Assets
are included as project data but automatic placement in scenes is future scope.

## Issue #10 — Unity exporter

The same validated project can target Unity. Output includes an isolated C#
MonoBehaviour runner, deterministic generated data, the original serialized IR
and setup instructions. Import Assets/Forge into Unity and attach ForgeRunner to
an empty GameObject. Dialogue/Choice use IMGUI; flow events expose C# events.
Properties are escaped C# literals, never executable user code. Native Unity
compilation/Play Mode verification remains pending because no Unity editor is
installed. Domain entities contain no engine-specific fields or imports.

## Issue #14 — recents and preferences

Vela SQLiteStore holds only recent file paths/names/timestamps and editor
preferences (last target, preview grid, last project path). Native successful
open/save records a bounded list of 20 recents. Listing recents never scans or
opens project files; opening one validates it before replacing the current graph.
Configuration supports reset without touching .vforge or active content. Browser
upload/download cannot retain an authorized OS path and therefore does not add a
reopenable recent entry. Full workspace docking/layout persistence remains future
scope, as specified in the issue. SQLite never stores Graph/project content.
