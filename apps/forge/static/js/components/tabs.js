export function setupTabs() {
    const tabBar =
        document.querySelector(
            "#vf-bottom-tabs"
        );

    if (!tabBar) {
        console.warn(
            "[Forge] Bottom tabs não encontradas."
        );

        return;
    }


    const tabs = [
        ...tabBar.querySelectorAll(
            "[data-tab]"
        ),
    ];


    const panels = [
        ...document.querySelectorAll(
            ".vf-tab-panel[data-panel]"
        ),
    ];


    if (!tabs.length) {
        return;
    }


    /*
     * Click normal
     */
    tabs.forEach((tab, index) => {
        tab.setAttribute(
            "role",
            "tab"
        );

        tab.setAttribute(
            "tabindex",
            tab.classList.contains("active")
                ? "0"
                : "-1"
        );


        tab.addEventListener(
            "click",
            () => {
                activateTab(
                    tab.dataset.tab
                );
            }
        );


        /*
         * Navegação pelo teclado
         *
         * ← →
         * Home
         * End
         */
        tab.addEventListener(
            "keydown",
            (event) => {
                let nextIndex = index;


                if (
                    event.key ===
                    "ArrowRight"
                ) {
                    nextIndex =
                        (
                            index + 1
                        ) % tabs.length;
                }

                else if (
                    event.key ===
                    "ArrowLeft"
                ) {
                    nextIndex =
                        (
                            index -
                            1 +
                            tabs.length
                        ) % tabs.length;
                }

                else if (
                    event.key === "Home"
                ) {
                    nextIndex = 0;
                }

                else if (
                    event.key === "End"
                ) {
                    nextIndex =
                        tabs.length - 1;
                }

                else {
                    return;
                }


                event.preventDefault();


                const nextTab =
                    tabs[nextIndex];


                activateTab(
                    nextTab.dataset.tab
                );


                nextTab.focus();
            }
        );
    });


    /*
     * Garante um estado inicial.
     */
    const active =
        tabs.find(
            (tab) =>
                tab.classList.contains(
                    "active"
                )
        ) ?? tabs[0];


    activateTab(
        active.dataset.tab
    );


    function activateTab(name) {
        /*
         * Tabs
         */
        tabs.forEach((tab) => {
            const active =
                tab.dataset.tab === name;


            tab.classList.toggle(
                "active",
                active
            );


            tab.setAttribute(
                "aria-selected",
                active
                    ? "true"
                    : "false"
            );


            tab.setAttribute(
                "tabindex",
                active
                    ? "0"
                    : "-1"
            );
        });


        /*
         * Conteúdo
         */
        panels.forEach((panel) => {
            const active =
                panel.dataset.panel ===
                name;


            panel.classList.toggle(
                "active",
                active
            );


            panel.hidden =
                !active;
        });


        /*
         * Evento útil para outros
         * componentes futuramente.
         */
        document.dispatchEvent(
            new CustomEvent(
                "forge:bottom-tab-change",
                {
                    detail: {
                        tab: name,
                    },
                }
            )
        );
    }
}