from .forge import forge_view


def register_routes(router):
    router.add(
        "/forge",
        forge_view,
        name="forge",
        title="Vela Forge",
        layout="blank",
        show_in_sidebar=False,
    )