# Vela Forge — implementation and verification

Base: main at f37be82 (merged PR #15). Branch: feat/forge-project-workflow.
The earlier #2/#1/#3 implementation is preserved, with a browser-discovered
Inspector delete binding corrected in this increment. No Vela framework source
was changed. Python domain/service/API and Vanilla ES modules remain in place.

## Implemented scope, in requested order

| Issue | Result |
|---|---|
| #4 | Typed node registry |
| #11 | Connection selection/deletion |
| #12 | Spatial node creation by drag/drop |
| #5 | Versioned .vforge save/load |
| #6 | Validator and Problems panel |
| #7 | Persistent Event Manager |
| #8 | Image import and Scene Preview |
| #13 | Bounded service command history |
| #9 | Godot 4 exporter |
| #10 | Unity exporter |
| #14 | Recent projects and editor preferences |

### Registry, connections and creation

Definitions live in domain/registry.py. Start has no input; End has no output;
Branch exposes true/false; Choice derives choice_N outputs from its options.
Ports are serialized from the backend and rendered by the canvas. Defaults are
not duplicated in JavaScript. Unknown types and invalid connections are rejected.
Removing a connected Choice output is rejected until its wire is removed.
Set Variable uses a JSON editor so booleans/numbers/null retain their types.

Wires are selectable and deletable with Delete/Backspace. Text editing keeps its
native keyboard behavior. Stable selected connection IDs prepare future endpoint
reconnection, which is explicitly future scope in #11. Library drag/drop uses the
existing pan/zoom conversion and a single create-node POST with its final position.
Double-click remains available. No request is sent for each pixel of node movement.

### Project content and validation

.vforge version 1 contains metadata, nodes, positions, properties, connections,
events and assets. Derived ports are regenerated. Loading reconstructs a separate
Graph before swapping the active state; malformed files preserve the current
project. Native save uses a temporary file and atomic replacement. Native open/save
use public pywebview dialogs in the application's bridge. Browser fallback uses
file upload/download. Maximum project size is 16 MiB.

The separate validator reports structured severity/code/message/node/connection
records. It checks IDs, endpoints, ports, Start count, required properties, missing
event references, ambiguous outputs and reachability. Missing End, unreachable
nodes and unused outputs are warnings. Problems supports locating a node. Fatal
validation errors block export and the Preview action.

Events have stable IDs/names and separate storage/view from Graph. The Inspector
selects existing events; Event Manager lists usages and allows deletion. Deleted
references remain visible and are reported as validation errors.

Assets initially support PNG/JPEG/GIF/WebP. Metadata and base64 content are embedded
for portable save/load. Limits are 2 MiB per image and 8 MiB total. MIME/signature,
base64 and sizes are checked; missing data or decoder failures are shown clearly.
No fixed character or engine dependency is part of Scene Preview.

### History and exporters

CommandHistory records before/after project snapshots for 50 successful changes.
Failed operations and no-ops are excluded. Undo/redo restores IDs, deleted nodes,
attached connections, positions and properties, and also supports event/asset
changes. Valid New/Open clears history; invalid Open preserves it. UI buttons and
Ctrl/Cmd+Z, Ctrl+Y, Ctrl+Shift+Z use the same API. Text fields keep native text undo.

Exporter contract: export_project(project) returns relative-path/UTF-8-text files.
Godot output contains project.godot, main.tscn, a GDScript runner and serialized IR.
Unity output contains a MonoBehaviour runner, generated C# data and the same IR.
Both cover Start/Dialogue/Choice/Branch/Set Variable/Emit Event/End. Dialogue/Choice
wait for buttons; events expose engine-native signals/C# events. Branch.condition
is a variable name, not a code expression. Automatic loops stop after 256 steps per
interaction. ZIP/file output is deterministic and does not mutate the source
project or history. Generated Code displays the files. Native export uses a chosen
directory; browser fallback downloads ZIP. Follow the generated README to run.

### Local editor state

Vela SQLiteStore stores only recent file paths/names/timestamps and preferences:
last target, preview grid, last project path. Successful native Open/Save records
at most 20 recents. Listing does not scan/read project files. Missing recent files
produce a clear error and preserve current content. Reset does not touch .vforge
or the active project. Browser upload/download cannot retain an authorized OS
path, so it does not create reopenable recent entries. Existing workspace layout
behavior is preserved; centralized full layout persistence remains future scope.

## Verification

- 71 Python tests passed on Python 3.12 with Vela Framework 0.2.2 at
  44a6df91fc96a21c323e520abe50141878c4bf99.
- Tests assert domain/service state, real Vela HTTP route binding, file round trips,
  invalid-load preservation, event/asset references, history, deterministic ZIP and
  directory output, SQLite restart/reset behavior and generated language syntax.
- GDScript parsed with gdtoolkit; generated C# parsed with tree-sitter-c-sharp.
  Parsing is not equivalent to engine compilation/execution.
- All JavaScript modules pass node --check; git diff --check passes.
- Playwright/Chromium regression passed at 1600x1000 and 1366x768 with no page errors:
  connection preview/feedback/POST/GET, moving wires, persisted node position,
  Inspector save/delete, typed sockets, library drop with pan/zoom, undo/redo,
  events/references, image preview, .vforge download/upload, wire deletion/undo,
  both export downloads and preferences after reload.
- The earlier Chromium download blocker was overcome using an alternate Chromium
  package for this environment. Native Windows/pywebview dialogs and Godot/Unity
  editor execution have not been smoke-tested here.

### Reproduce

```sh
python -m pip install -r requirements.txt -r requirements-dev.txt
python -m pytest -q
npm install --no-save playwright
npx playwright install chromium
python tests/browser/run.py
```

run.py starts/stops an isolated test API/view host. To use an existing Chromium,
set FORGE_CHROMIUM_PATH. FORGE_VIEWPORT_WIDTH and FORGE_VIEWPORT_HEIGHT select the
test resolution. The harness exercises the real Forge view/API, without opening
the pywebview shell. It stores editor test state in a temporary directory.

## Remaining limits and next work

- No currently failing test remains. Engine-native and Windows desktop smoke tests
  are the next validation step before treating exports/dialogs as release-verified.
- #11 endpoint dragging/reconnection is future work; its initial selection/delete
  scope is implemented.
- #8 3D/model renderers, sprite timelines and automatic asset scene placement are
  future work. Embedded assets are included in exported IR, not placed automatically.
- #14 full centralized docking/workspace layout storage remains future work.
- Branch supports variable truthiness only. Unity output is a starter to import into
  an existing Unity project, not a complete Unity Editor installation/project.
- Undo/redo is session-only and bounded to 50 commands. Multi-user/concurrent editing
  is outside this standalone MVP. Export directory writes may leave partial output
  on an OS write error; the source .vforge is not modified.
- Original placeholder actions such as Models, Generate Animation, Variables/Datas,
  Profile and Event Settings remain outside the implemented issue scopes.
- All requested initial issue scopes are implemented. A follow-up on #11 can add
  endpoint reconnection after the native/engine smoke tests.

## Commits

One initial feature commit per issue, in the requested order, followed by scoped
corrections and workflow verification. The PR commit list contains published SHAs.

- feat(nodes): add typed node registry
- feat(graph): select and delete existing connections
- feat(editor): create nodes by canvas drop
- feat(project): save and load versioned vforge files
- feat(validation): add graph validator and Problems panel
- feat(events): implement persistent Event Manager workspace
- feat(assets): import portable images and bind Scene Preview
- feat(editor): add bounded undo and redo command history
- feat(export): generate runnable Godot 4 projects
- feat(export): add isolated Unity target for Forge IR
- feat(app): persist recent projects and editor preferences
- fix(nodes): preserve JSON value types in property editing
- fix(project): reject malformed records before replacing active state
- fix(assets): reject invalid media type payloads
- fix(nodes): dispatch Inspector deletion through editor controller
- fix(app): validate persisted target preference types
- test(forge): exercise project workflow and generated language syntax

## Changed files

- `apps/forge/api/__init__.py`
- `apps/forge/api/assets.py`
- `apps/forge/api/connections.py`
- `apps/forge/api/events.py`
- `apps/forge/api/exports.py`
- `apps/forge/api/graph.py`
- `apps/forge/api/history.py`
- `apps/forge/api/nodes.py`
- `apps/forge/api/preferences.py`
- `apps/forge/api/project.py`
- `apps/forge/domain/assets.py`
- `apps/forge/domain/events.py`
- `apps/forge/domain/graph.py`
- `apps/forge/domain/project.py`
- `apps/forge/domain/registry.py`
- `apps/forge/exporters/__init__.py`
- `apps/forge/exporters/godot.py`
- `apps/forge/exporters/unity.py`
- `apps/forge/services/editor_state.py`
- `apps/forge/services/forge_service.py`
- `apps/forge/services/history.py`
- `apps/forge/services/validator.py`
- `apps/forge/static/css/editor.css`
- `apps/forge/static/js/api.js`
- `apps/forge/static/js/components/assets.js`
- `apps/forge/static/js/components/canvas.js`
- `apps/forge/static/js/components/events.js`
- `apps/forge/static/js/components/export.js`
- `apps/forge/static/js/components/history.js`
- `apps/forge/static/js/components/inspector.js`
- `apps/forge/static/js/components/preferences.js`
- `apps/forge/static/js/components/problems.js`
- `apps/forge/static/js/components/project.js`
- `apps/forge/static/js/editor.js`
- `apps/forge/static/js/state.js`
- `apps/forge/templates/components/bottom_panel.html`
- `apps/forge/templates/components/commandbars.html`
- `apps/forge/templates/components/sidebar.html`
- `apps/forge/templates/forge.html`
- `config/bridge.py`
- `config/settings.py`
- `docs/IMPLEMENTATION_PROGRESS.md`
- `requirements-dev.txt`
- `tests/browser/editor.cjs`
- `tests/browser/run.py`
- `tests/browser/server.py`
- `tests/conftest.py`
- `tests/forge/test_api.py`
- `tests/forge/test_assets.py`
- `tests/forge/test_editor_state.py`
- `tests/forge/test_events.py`
- `tests/forge/test_exporters.py`
- `tests/forge/test_forge_service.py`
- `tests/forge/test_history.py`
- `tests/forge/test_project.py`
- `tests/forge/test_registry.py`
- `tests/forge/test_validator.py`
