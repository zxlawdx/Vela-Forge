import {getPreferences, updatePreferences} from "../api.js";

const STORAGE_KEY =
    "vela-forge-workspace";


let config = null;
let restoring = false;
let saveQueue = Promise.resolve();


export async function setupWorkspace() {
    const preferences = await getPreferences();
    config = {...preferences.workspace};

    const legacy = localStorage.getItem(STORAGE_KEY);

    if (legacy) {
        try {
            const migrated = await updatePreferences({workspace: {...config, ...JSON.parse(legacy)}});
            config = migrated.workspace;
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.warn("Legacy workspace not migrated:", error.message);
        }
    }

    createInspectorResizer();
    setupSidebarResize();

    document.addEventListener("forge:bottom-tab-change", (event) => {
        if (config.activeBottomTab !== event.detail.tab) {
            config.activeBottomTab = event.detail.tab;
            saveConfig();
        }
    });

    document.addEventListener("forge:workspace-change", (event) => {
        config = {...config, ...event.detail};
        restoreWorkspace();
        saveConfig();
    });

    document.addEventListener("forge:workspace-restore", (event) => {
        config = {...event.detail};
        restoreWorkspace();
    });

    document.addEventListener("forge:workspace-save", saveConfig);
    window.addEventListener("resize", applyInspectorState);

    setupModeTabs();

    setupPreviewResize();

    setupBottomResize();

    setupBottomCollapse();

    setupInspectorResize();

    setupInspectorTabs();

    restoreWorkspace();
}


/* =========================================================
   MODE TABS
   Animation Scene / Event Manager
   ========================================================= */

function setupModeTabs() {
    const buttons =
        document.querySelectorAll(
            ".vf-mode-tabs [data-mode]"
        );

    buttons.forEach((button) => {
        button.addEventListener(
            "click",
            () => {
                setMode(
                    button.dataset.mode
                );
            }
        );
    });
}


function setMode(mode) {
    config.mode = mode;

    document
        .querySelectorAll(
            ".vf-mode-tabs [data-mode]"
        )
        .forEach((button) => {
            button.classList.toggle(
                "active",
                button.dataset.mode === mode
            );
        });


    document
        .querySelectorAll(
            "[data-mode-view]"
        )
        .forEach((view) => {
            view.classList.toggle(
                "active",
                view.dataset.modeView === mode
            );
        });


    saveConfig();
}


/* =========================================================
   PREVIEW ↔ GRAPH
   ========================================================= */

function setupPreviewResize() {
    const splitter =
        document.querySelector(
            "#vf-preview-resizer"
        );

    const workspace =
        document.querySelector(
            "#vf-animation-workspace"
        );


    if (!splitter || !workspace) {
        return;
    }


    splitter.addEventListener(
        "pointerdown",
        (event) => {
            event.preventDefault();

            splitter.classList.add(
                "is-dragging"
            );

            splitter.setPointerCapture(
                event.pointerId
            );
        }
    );


    splitter.addEventListener(
        "pointermove",
        (event) => {
            if (
                !splitter.hasPointerCapture(
                    event.pointerId
                )
            ) {
                return;
            }


            const rect =
                workspace.getBoundingClientRect();


            const x =
                event.clientX -
                rect.left;


            let percentage =
                (
                    x /
                    rect.width
                ) * 100;


            percentage =
                clamp(
                    percentage,
                    15,
                    75
                );


            config.previewWidth =
                percentage;


            workspace.style.setProperty(
                "--vf-preview-width",
                `${percentage}%`
            );
        }
    );


    splitter.addEventListener(
        "pointerup",
        (event) => {
            finishPointer(
                splitter,
                event
            );

            saveConfig();
        }
    );
}


/* =========================================================
   BOTTOM PANEL ↕
   Problems / Generated / IR / Console...
   ========================================================= */

function setupBottomResize() {
    const splitter =
        document.querySelector(
            "#vf-bottom-resizer"
        );

    const main =
        document.querySelector(
            ".vf-main-pane"
        );


    if (!splitter || !main) {
        return;
    }


    splitter.addEventListener(
        "pointerdown",
        (event) => {
            event.preventDefault();

            config.bottomCollapsed =
                false;

            main.classList.remove(
                "bottom-collapsed"
            );

            splitter.classList.add(
                "is-dragging"
            );

            splitter.setPointerCapture(
                event.pointerId
            );
        }
    );


    splitter.addEventListener(
        "pointermove",
        (event) => {
            if (
                !splitter.hasPointerCapture(
                    event.pointerId
                )
            ) {
                return;
            }


            const rect =
                main.getBoundingClientRect();


            let height = config.bottomPosition === "top"
                ? event.clientY - rect.top
                : rect.bottom - event.clientY;


            height =
                clamp(
                    height,
                    70,
                    Math.min(800, rect.height * 0.8)
                );


            config.bottomHeight =
                height;


            main.style.setProperty(
                "--vf-bottom-height",
                `${height}px`
            );
        }
    );


    splitter.addEventListener(
        "pointerup",
        (event) => {
            finishPointer(
                splitter,
                event
            );

            saveConfig();
        }
    );


    /*
      Duplo clique na divisória
      recolhe / restaura
    */

    splitter.addEventListener(
        "dblclick",
        () => {
            config.bottomCollapsed =
                !config.bottomCollapsed;

            applyBottomState();

            saveConfig();
        }
    );
}


/* =========================================================
   BOTTOM COLLAPSE BUTTON
   ========================================================= */

function setupBottomCollapse() {
    const button =
        document.querySelector(
            "#vf-collapse-workspace"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        () => {
            config.bottomCollapsed =
                !config.bottomCollapsed;

            applyBottomState();

            saveConfig();
        }
    );
}


function applyBottomState() {
    const main =
        document.querySelector(
            ".vf-main-pane"
        );


    if (!main) {
        return;
    }


    main.classList.toggle(
        "bottom-collapsed",
        config.bottomCollapsed
    );


    main.style.setProperty(
        "--vf-bottom-height",
        `${config.bottomCollapsed ? 0 : config.bottomHeight}px`
    );


    const button =
        document.querySelector(
            "#vf-collapse-workspace"
        );


    if (button) {
        button.textContent =
            config.bottomCollapsed
                ? "↓"
                : "↑";
    }
}


/* =========================================================
   RIGHT INSPECTOR ↔
   ========================================================= */

function createInspectorResizer() {
    const app =
        document.querySelector(
            ".vf-app"
        );

    const inspector =
        document.querySelector(
            ".vf-right-pane"
        );


    if (
        !app ||
        !inspector ||
        document.querySelector(
            "#vf-right-resizer"
        )
    ) {
        return;
    }


    const splitter =
        document.createElement(
            "div"
        );


    splitter.id =
        "vf-right-resizer";

    splitter.className =
        "vf-right-resizer";

    splitter.title =
        "Drag to resize inspector • Double click to collapse";


    document.body.appendChild(
        splitter
    );
}


function setupInspectorResize() {
    const splitter =
        document.querySelector(
            "#vf-right-resizer"
        );

    const app =
        document.querySelector(
            ".vf-app"
        );


    if (!splitter || !app) {
        return;
    }


    splitter.addEventListener(
        "pointerdown",
        (event) => {
            event.preventDefault();


            if (
                config.inspectorCollapsed
            ) {
                config.inspectorCollapsed =
                    false;

                app.classList.remove(
                    "inspector-collapsed"
                );
            }


            splitter.classList.add(
                "is-dragging"
            );


            splitter.setPointerCapture(
                event.pointerId
            );
        }
    );


    splitter.addEventListener(
        "pointermove",
        (event) => {
            if (
                !splitter.hasPointerCapture(
                    event.pointerId
                )
            ) {
                return;
            }


            const appRect =
                app.getBoundingClientRect();


            let width = config.inspectorSide === "left"
                ? event.clientX - appRect.left - config.leftWidth
                : appRect.right - event.clientX;


            width =
                clamp(
                    width,
                    180,
                    Math.min(
                        600,
                        appRect.width * 0.5
                    )
                );


            config.inspectorWidth =
                width;


            app.style.setProperty(
                "--vf-right-width",
                `${width}px`
            );


            applyInspectorState();
        }
    );


    splitter.addEventListener(
        "pointerup",
        (event) => {
            finishPointer(
                splitter,
                event
            );

            saveConfig();
        }
    );


    splitter.addEventListener(
        "dblclick",
        () => {
            config.inspectorCollapsed =
                !config.inspectorCollapsed;


            applyInspectorState();

            saveConfig();
        }
    );
}


function applyInspectorState() {
    const app = document.querySelector(".vf-app");
    const splitter = document.querySelector("#vf-right-resizer");
    const width = config.inspectorCollapsed ? 0 : config.inspectorWidth;
    app.classList.toggle("inspector-collapsed", config.inspectorCollapsed);
    app.classList.toggle("inspector-left", config.inspectorSide === "left");
    app.style.setProperty("--vf-right-width", `${width}px`);

    if (splitter) {
        if (config.inspectorSide === "left") {
            splitter.style.left = `${app.getBoundingClientRect().left + config.leftWidth + width}px`;
            splitter.style.right = "auto";
        } else {
            splitter.style.left = "auto";
            splitter.style.right = `${width}px`;
        }
    }
}


/* =========================================================
   INSPECTOR / GRAPH TABS
   ========================================================= */

function setupInspectorTabs() {
    const buttons =
        document.querySelectorAll(
            ".vf-inspector-tabs button"
        );


    buttons.forEach(
        (button, index) => {
            button.addEventListener(
                "click",
                () => {
                    buttons.forEach(
                        (item) => {
                            item.classList.remove(
                                "active"
                            );
                        }
                    );


                    button.classList.add(
                        "active"
                    );


                    if (index === 0) {
                        showNodeInspector();
                    } else {
                        showGraphInspector();
                    }
                }
            );
        }
    );
}


function showNodeInspector() {
    const inspector =
        document.querySelector(
            ".vf-inspector"
        );


    if (!inspector) {
        return;
    }


    /*
      O inspector normal já existe.
      Só reexibe os elementos.
    */

    inspector
        .querySelectorAll(
            "[data-graph-only]"
        )
        .forEach(
            (element) => {
                element.style.display =
                    "none";
            }
        );


    inspector
        .querySelectorAll(
            "[data-node-only]"
        )
        .forEach(
            (element) => {
                element.style.display =
                    "";
            }
        );
}


function showGraphInspector() {
    /*
      Por enquanto não destruo teu inspector.

      Depois podemos colocar propriedades
      específicas do Graph aqui.
    */

    const consoleOutput =
        document.querySelector(
            "#vf-console"
        );


    if (consoleOutput) {
        consoleOutput.textContent +=
            "\nGraph inspector selected.";
    }
}


/* =========================================================
   RESTORE
   ========================================================= */

function restoreWorkspace() {
    restoring = true;
    const app = document.querySelector(".vf-app");
    app.style.setProperty("--vf-left-width", `${config.leftWidth}px`);
    document.querySelector(".vf-main-pane").classList.toggle("bottom-top", config.bottomPosition === "top");

    for (const tab of document.querySelectorAll("[data-tab]")) {
        tab.classList.toggle("active", tab.dataset.tab === config.activeBottomTab);
    }

    document.querySelector(`[data-tab="${config.activeBottomTab}"]`)?.click();
    setMode(
        config.mode
    );


    const animationWorkspace =
        document.querySelector(
            "#vf-animation-workspace"
        );


    animationWorkspace
        ?.style
        .setProperty(
            "--vf-preview-width",
            `${config.previewWidth}%`
        );


    const main =
        document.querySelector(
            ".vf-main-pane"
        );


    main
        ?.style
        .setProperty(
            "--vf-bottom-height",
            `${config.bottomHeight}px`
        );


    applyBottomState();

    applyInspectorState();
    const sidebarResizer = document.querySelector("#vf-left-resizer");
    sidebarResizer.style.left = `${app.getBoundingClientRect().left + config.leftWidth}px`;
    restoring = false;
}


/* =========================================================
   STORAGE
   ========================================================= */

function saveConfig() {
    if (restoring) {
        return;
    }

    const workspace = {...config};
    saveQueue = saveQueue.then(() => updatePreferences({workspace})).catch((error) => {
        document.dispatchEvent(new CustomEvent("forge:error", {detail: `Erro ao salvar layout: ${error.message}`}));
    });
}


function setupSidebarResize() {
    const app = document.querySelector(".vf-app");
    const splitter = document.createElement("div");
    splitter.id = "vf-left-resizer";
    splitter.className = "vf-right-resizer";
    splitter.title = "Resize sidebar";
    splitter.style.right = "auto";
    document.body.appendChild(splitter);
    splitter.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        splitter.setPointerCapture(event.pointerId);
    });
    splitter.addEventListener("pointermove", (event) => {
        if (!splitter.hasPointerCapture(event.pointerId)) {
            return;
        }

        config.leftWidth = clamp(event.clientX - app.getBoundingClientRect().left, 160, 360);
        app.style.setProperty("--vf-left-width", `${config.leftWidth}px`);
        splitter.style.left = `${app.getBoundingClientRect().left + config.leftWidth}px`;
        applyInspectorState();
    });
    splitter.addEventListener("pointerup", (event) => {
        finishPointer(splitter, event);
        saveConfig();
    });
}


/* =========================================================
   HELPERS
   ========================================================= */

function finishPointer(
    element,
    event
) {
    element.classList.remove(
        "is-dragging"
    );


    if (
        element.hasPointerCapture(
            event.pointerId
        )
    ) {
        element.releasePointerCapture(
            event.pointerId
        );
    }
}


function clamp(
    value,
    min,
    max
) {
    return Math.min(
        max,
        Math.max(
            min,
            value
        )
    );
}