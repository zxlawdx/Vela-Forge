import json


RUNNER = '''extends Control

signal dialogue_requested(actor, text)
signal choice_requested(choices)
signal event_emitted(event_id, event_name)
signal flow_finished

var project = {}
var nodes = {}
var variables = {}
var panel = VBoxContainer.new()

func _ready():
    project = JSON.parse_string(FileAccess.get_file_as_string("res://forge_project.json"))
    if not project is Dictionary:
        push_error("Invalid Forge project JSON")
        return
    panel.position = Vector2(32, 32)
    panel.custom_minimum_size = Vector2(600, 300)
    add_child(panel)
    for item in project.graph.nodes:
        nodes[item.id] = item
    for item in project.graph.nodes:
        if item.type == "start":
            run_node(item.id)
            return

func clear_panel():
    for child in panel.get_children():
        panel.remove_child(child)
        child.queue_free()

func next_node(node_id, port):
    for connection in project.graph.connections:
        if connection.source_node_id == node_id and connection.source_port == port:
            return connection.target_node_id
    return ""

func finish_flow():
    clear_panel()
    var label = Label.new()
    label.text = "End"
    panel.add_child(label)
    flow_finished.emit()

func choose(node_id, port):
    run_node(next_node(node_id, port))

func truthy(value):
    if value == null:
        return false
    if value is bool:
        return value
    if value is int or value is float:
        return value != 0
    if value is String or value is Array or value is Dictionary:
        return not value.is_empty()
    return true

func run_node(node_id):
    clear_panel()
    var steps = 0
    while node_id != "":
        steps += 1
        if steps > 256:
            push_error("Forge flow exceeded 256 automatic steps; check for cycles")
            return
        var item = nodes[node_id]
        var props = item.properties
        var port = "out"
        match item.type:
            "dialogue":
                var label = Label.new()
                label.text = str(props.get("actor", "")) + ": " + str(props.get("text", ""))
                label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
                panel.add_child(label)
                var button = Button.new()
                button.text = "Continue"
                button.pressed.connect(choose.bind(item.id, "out"))
                panel.add_child(button)
                dialogue_requested.emit(props.get("actor", ""), props.get("text", ""))
                return
            "choice":
                var choices = props.choices
                for index in range(choices.size()):
                    var button = Button.new()
                    button.text = choices[index]
                    button.pressed.connect(choose.bind(item.id, "choice_%d" % index))
                    panel.add_child(button)
                choice_requested.emit(choices)
                return
            "branch":
                port = "true" if truthy(variables.get(props.condition, false)) else "false"
            "set-variable":
                variables[props.variable] = props.get("value", "")
            "event":
                for event in project.get("events", []):
                    if event.id == props.event:
                        event_emitted.emit(event.id, event.name)
                        print("Forge event: ", event.name)
            "end":
                finish_flow()
                return
        node_id = next_node(item.id, port)
    finish_flow()
'''


def export_project(project: dict) -> dict[str, str]:
    files = {
        "project.godot": (
            'config_version=5\n\n[application]\n'
            'config/name="Forge Export"\nrun/main_scene="res://main.tscn"\n\n'
            '[display]\nwindow/size/viewport_width=960\nwindow/size/viewport_height=540\n\n'
            '[rendering]\nrenderer/rendering_method="gl_compatibility"\n'
        ),
        "main.tscn": (
            '[gd_scene load_steps=2 format=3]\n\n'
            '[ext_resource type="Script" path="res://forge_runner.gd" id="1"]\n\n'
            '[node name="ForgeRunner" type="Control"]\n'
            'layout_mode=3\nanchors_preset=15\nanchor_right=1.0\nanchor_bottom=1.0\n'
            'grow_horizontal=2\ngrow_vertical=2\nscript=ExtResource("1")\n'
        ),
        "forge_runner.gd": RUNNER,
        "forge_project.json": json.dumps(project, ensure_ascii=False, indent=2, sort_keys=True),
        "README.md": (
            "# Forge export — Godot 4\n\nOpen project.godot in Godot 4 and run the main scene.\n"
            "Dialogue and Choice wait for button input. Start runs on scene ready.\n"
            "Branch.condition is a variable name, not an expression. Missing variables are false.\n"
            "Set Variable stores JSON values. Events emit event_emitted(id, name).\n"
            "Cycles are limited to 256 automatic steps per interaction.\n"
            "Assets are included in forge_project.json; this starter does not place them in a scene.\n"
            "For a packaged Godot build, include *.json in the export preset non-resource filters.\n"
        ),
    }

    return files
