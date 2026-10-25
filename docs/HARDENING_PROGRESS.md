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
