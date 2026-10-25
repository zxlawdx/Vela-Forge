const STORAGE_KEY =
    "vela-forge-workspace";


const defaults = {
    mode: "animation",

    previewWidth: 34,

    bottomHeight: 210,
    bottomCollapsed: false,

    inspectorWidth: 292,
    inspectorCollapsed: false,
};


let config = loadConfig();


export function setupWorkspace() {
    createInspectorResizer();

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


            let height =
                rect.bottom -
                event.clientY;


            height =
                clamp(
                    height,
                    70,
                    rect.height * 0.8
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


    if (!config.bottomCollapsed) {
        main.style.setProperty(
            "--vf-bottom-height",
            `${config.bottomHeight}px`
        );
    }


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


            let width =
                appRect.right -
                event.clientX;


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


            splitter.style.right =
                `${width}px`;
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
    const app =
        document.querySelector(
            ".vf-app"
        );

    const splitter =
        document.querySelector(
            "#vf-right-resizer"
        );


    if (!app) {
        return;
    }


    app.classList.toggle(
        "inspector-collapsed",
        config.inspectorCollapsed
    );


    if (
        config.inspectorCollapsed
    ) {
        app.style.setProperty(
            "--vf-right-width",
            "0px"
        );

        if (splitter) {
            splitter.style.right =
                "0px";
        }

        return;
    }


    app.style.setProperty(
        "--vf-right-width",
        `${config.inspectorWidth}px`
    );


    if (splitter) {
        splitter.style.right =
            `${config.inspectorWidth}px`;
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
}


/* =========================================================
   STORAGE
   ========================================================= */

function loadConfig() {
    try {
        const stored =
            localStorage.getItem(
                STORAGE_KEY
            );


        if (!stored) {
            return {
                ...defaults,
            };
        }


        return {
            ...defaults,
            ...JSON.parse(stored),
        };
    } catch {
        return {
            ...defaults,
        };
    }
}


function saveConfig() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(config)
        );
    } catch {
        /* optional */
    }
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