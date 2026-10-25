# Forge hardening

Base: main at 202fd57 (PR #16 merged). Branch: feat/forge-hardening.

## Initial audit

- Read the current main and IMPLEMENTATION_PROGRESS.md before editing.
- Initial `python -m pytest -v`: 71 passed.
- All existing JS syntax checks, git diff --check and the full Playwright
  regression passed on the initial main.
- Environment: Linux/Python 3.12. Windows desktop, Godot and Unity executables
  were not initially installed. Mocked dialog contracts do not validate native
  window behavior; generated-language parsing does not validate an engine runtime.

## Native project workflow

Real gaps found: Save always opened a Save As dialog; there was no Save As action;
the frontend renamed the project before a native save dialog could be cancelled.
Save now reuses the active file, Save As chooses a new path, and cancellation
preserves project metadata, history and the current path. Paths are editor session
state, not fields in the Forge IR or project command history.

Automated tests call the actual consumer bridge with the public pywebview dialog
boundary replaced, and perform real file I/O. Covered: new/open/save/save-as,
Unicode/spaces, string/tuple dialog results, cancellation, missing/invalid files,
overwrite, atomic-save permission failure/cleanup, both native export directory
contracts and recents recording. Image import remains the WebView's file input
and is covered by the real browser regression. Added Windows/Linux CI for these
contracts; a CI job is not a claim of an interactive Windows smoke test.

## Connection endpoint reconnection

Selected wires expose source/target handles. Dragging a handle previews a new
wire; valid release calls PATCH through editor.js/api.js/service/Graph. Graph
validates a candidate with the same typed-port rules before touching the existing
Connection. ID and object identity are preserved. One command records a successful
reconnection. Cancel/Escape/invalid direction/self-drop leave backend and history
unchanged. Domain, service, HTTP and real browser tests cover both endpoints,
invalid changes, cancellation, ID stability and undo/redo.

## Engine smoke verification

Added examples/engine_smoke.vforge with stable IDs and a runnable Godot smoke
script. Downloaded the official Godot 4.5 stable Linux binary and ran real headless
editor import plus main-scene execution. Both false/true paths passed, including
dialogue_requested, event_emitted and flow_finished signal assertions.

Reproduce with `FORGE_GODOT=/path/to/godot python -m pytest -v tests/engines`.
The Unity test requires FORGE_CSC and FORGE_UNITY_MANAGED_DIR with actual Unity
CoreModule/IMGUIModule DLLs; it never substitutes fake Unity stubs. Unity compiler,
reference assemblies and Play Mode are unavailable here, so that test is skipped.
The existing syntax checks remain separate from engine execution claims.

## Export robustness

Export validates every generated relative path before writing any file, including
Windows drive/ADS/backslash forms, parent traversal and existing symlink escapes.
Each output file uses atomic replacement; an OS failure cannot truncate an old
file. A later-file failure may still leave a partially updated export directory;
project content is not changed. The existing simple exporter function contract
and deterministic archive generation were preserved.

## Preview renderer selection

Scene Preview now dispatches through a small MIME-to-renderer registry. The image
renderer owns cleanup/error handling, preventing an old image callback from
replacing a newer preview. PNG/JPEG/GIF/WebP continue to work in the browser.
Missing data and unsupported renderer types are explicit; GLB/glTF are not yet
accepted or advertised because no actual model renderer has been added.

## Central workspace state

Workspace dimensions, collapsed states, active mode/tab and placements now share
one validated SQLite preference record. Legacy localStorage is migrated once.
Added sidebar resize, Inspector left/right, results panel top/bottom, save layout
and restore defaults. Saves are serialized and occur after resize, not per pixel.
No second project history or full docking framework was introduced. Fixed an
existing collapse bug where an inline height overrode the collapsed CSS value.
Browser checks verify placement, resize, reload persistence and default restore;
backend tests reject invalid dimensions/enums and verify restart/reset behavior.

## Structured Branch conditions

Branch now stores variable/operator/scalar-value conditions. The eight operators
are declared centrally and presented in the Inspector; no eval is used. Legacy
string conditions normalize to truthy conditions on load. Malformed operators,
missing values and non-numeric ordered comparisons are rejected atomically.
Editing integrates the existing history. Both exporters consume the same condition.
All comparison operators passed actual Godot execution against true/false cases;
Unity output passed syntax parsing, not engine compilation. Browser editing and
undo/redo passed. Equality distinguishes booleans from numeric values.

## Typed project variables

Project declarations now define string/number/boolean variables and initial values.
Items > Variables creates/deletes them; Set Variable and Branch use project
selectors. The validator reports missing references and incompatible assignments/
comparisons, blocking export. Deletion keeps references visible and is undoable.
Declarations survive .vforge round trips; legacy files without declarations infer
them from Set Variable first, then Branch, and save the explicit model thereafter.
Both runners initialize declared defaults. Browser create/select/delete/undo and
HTTP/domain/history/malformed-file checks passed, as did real Godot comparisons.

## Event Manager follow-up

Events can be renamed without changing IDs or node references. Duplicate/invalid
names are rejected; cancellation leaves state untouched. Rename uses the existing
history and is reversible. Existing usage navigation and delete-reference warnings
were retained; no runtime event bus was added.

## Final verification and regression findings

- Final command with FORGE_GODOT pointing to the official Godot 4.5 executable:
  `python -m pytest -v` — **132 passed, 1 skipped**. The skip is the Unity compiler
  test because the compiler/actual Unity reference assemblies are unavailable.
- All application JS modules passed node --check; git diff --check passed.
- Full original + hardening Playwright suites passed at 1600x1000, and again at
  1366x768, without JavaScript page errors. New checks include both reconnection
  endpoints, cancellation, invalid drops, undo/redo, workspace collapse/reload/
  restore, Branch editing, typed variable create/delete/reference selection and
  stable-ID event rename.
- Five dialog-contract tests passed with real Linux filesystem operations and a
  replaced pywebview dialog boundary. This is **not an interactive Windows run**.
- Eight real Godot tests passed: editor import, scene startup, dialogue/event/end
  signals, both branch paths and every comparison operator.
- Unity generated files passed syntax parsing. **Unity compilation and Play Mode
  were not executed**; the test requires actual engine references, never stubs.
- Windows/Linux unit/native-contract CI and a real Godot/browser CI job are added.
  Consult PR checks for their execution status; adding CI is not itself a pass.

Concrete audit findings fixed: Save vs Save As/cancelled metadata changes; collapse
height being overridden by inline CSS; missing Branch condition causing an
exception rather than a Problem; non-finite metadata/overflowing coordinates;
unsafe exporter path forms and non-atomic output writes.

## Reproduce and external smoke checklist

```sh
python -m pip install -r requirements.txt -r requirements-dev.txt
FORGE_GODOT=/path/to/godot4 python -m pytest -v
npm install --no-save playwright
npx playwright install chromium
python tests/browser/run.py
```

On Windows, set `$env:FORGE_GODOT` in PowerShell instead of the POSIX environment
prefix. Run `python -m pytest -v tests/native` for equivalent public-dialog/file
contracts. Then run the real app with `python manage.py runapp` and manually test
New/Open/Save/Save As, import, both exports and Recents. Include a Unicode/spaced
folder, cancel each dialog, overwrite, missing files and a non-writable directory.
These interactive OS/backend checks remain outstanding.

For actual Unity compilation, set FORGE_CSC to a usable C# compiler and
FORGE_UNITY_MANAGED_DIR to the Unity Editor Data/Managed directory containing
UnityEngine/CoreModule and IMGUIModule DLLs, then run the Unity test in tests/engines.
It expects the real UnityEngine.CoreModule.dll and UnityEngine.IMGUIModule.dll
filenames. Independently import the generated Assets/Forge into Unity, attach
ForgeRunner and exercise the fixture in Play Mode; a compiler pass alone would
still not validate Play Mode.

## Remaining scope and limitations

- No interactive Windows/pywebview smoke or Unity engine execution is claimed.
- No 3D renderer is advertised. GLB/glTF need a real renderer before acceptance.
- Layout placement is deliberately limited to Inspector left/right and results
  top/bottom. Floating/free docking is not implemented. Layout preferences do not
  enter project undo history; graph/project mutations use the original history.
- Variable declaration editing/renaming is future work. Legacy declarations are
  inferred once; legacy object/array assignments are retained but require adapting
  to supported scalar types before export. Missing references stay visible as
  Problems rather than being silently deleted.
- Export replaces each file atomically but is not an all-directory transaction.
- No framework source changes, frontend framework, eval language or second command
  history were introduced. No new GitHub issue was needed; remaining external
  validation steps are recorded here and in the draft PR.

## Commits in this round

- fix(runtime): distinguish Save As and preserve cancelled dialog state
- feat(graph): reconnect existing connection endpoints atomically
- test(export): run real Godot branch and signal smoke fixture
- fix(export): constrain output paths and replace files atomically
- feat(preview): select asset renderers through a small registry
- feat(workspace): persist unified layout and panel placements
- feat(branch): support validated structured comparisons
- feat(project): add persistent typed variables and reference selectors
- feat(events): rename events while preserving stable references
- fix(project): reject non-finite metadata and overflowing coordinates
- fix(validation): report missing Branch condition as a problem
- test(hardening): cover workspace collapse, variables and event editing

## Changed files

- `.github/workflows/tests.yml`
- `apps/forge/api/__init__.py`
- `apps/forge/api/connections.py`
- `apps/forge/api/events.py`
- `apps/forge/api/variables.py`
- `apps/forge/domain/conditions.py`
- `apps/forge/domain/graph.py`
- `apps/forge/domain/project.py`
- `apps/forge/domain/registry.py`
- `apps/forge/domain/variables.py`
- `apps/forge/exporters/godot.py`
- `apps/forge/exporters/unity.py`
- `apps/forge/services/editor_state.py`
- `apps/forge/services/forge_service.py`
- `apps/forge/services/validator.py`
- `apps/forge/services/workspace.py`
- `apps/forge/static/css/editor.css`
- `apps/forge/static/js/api.js`
- `apps/forge/static/js/components/assets.js`
- `apps/forge/static/js/components/canvas.js`
- `apps/forge/static/js/components/events.js`
- `apps/forge/static/js/components/inspector.js`
- `apps/forge/static/js/components/preferences.js`
- `apps/forge/static/js/components/preview.js`
- `apps/forge/static/js/components/project.js`
- `apps/forge/static/js/components/variables.js`
- `apps/forge/static/js/components/workspace.js`
- `apps/forge/static/js/editor.js`
- `apps/forge/static/js/state.js`
- `apps/forge/templates/components/commandbars.html`
- `apps/forge/templates/components/sidebar.html`
- `config/bridge.py`
- `docs/HARDENING_PROGRESS.md`
- `docs/IMPLEMENTATION_PROGRESS.md`
- `examples/engine_smoke.vforge`
- `tests/browser/hardening.cjs`
- `tests/browser/run.py`
- `tests/engines/godot_smoke.gd`
- `tests/engines/test_engine_runtime.py`
- `tests/forge/test_api.py`
- `tests/forge/test_conditions.py`
- `tests/forge/test_editor_state.py`
- `tests/forge/test_events.py`
- `tests/forge/test_export_paths.py`
- `tests/forge/test_exporters.py`
- `tests/forge/test_project.py`
- `tests/forge/test_reconnection.py`
- `tests/forge/test_validator.py`
- `tests/forge/test_variables.py`
- `tests/forge/test_workspace.py`
- `tests/native/test_native_dialogs.py`
