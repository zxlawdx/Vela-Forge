from vela.template_engine import (
    mark_safe,
    render_template,
)


COMPONENT_ROOT = (
    "apps/forge/templates/components"
)


def render_component(
    name: str,
    params: dict,
):
    html = render_template(
        f"{COMPONENT_ROOT}/{name}.html",
        context={},
        router=params["router"],
    )

    return mark_safe(html)


def forge_view(
    params: dict,
) -> str:
    context = {
        "topbar": render_component(
            "topbar",
            params,
        ),

        "commandbars": render_component(
            "commandbars",
            params,
        ),

        "sidebar": render_component(
            "sidebar",
            params,
        ),

        "mode_tabs": render_component(
            "mode_tabs",
            params,
        ),

        "scene_preview": render_component(
            "scene_preview",
            params,
        ),

        "graph_canvas": render_component(
            "graph_canvas",
            params,
        ),

        "bottom_panel": render_component(
            "bottom_panel",
            params,
        ),

        "inspector": render_component(
            "inspector",
            params,
        ),

        "statusbar": render_component(
            "statusbar",
            params,
        ),
    }

    return render_template(
        "apps/forge/templates/forge.html",
        context=context,
        router=params["router"],
    )