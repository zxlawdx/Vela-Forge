extends SceneTree

func _initialize():
    call_deferred("run_smoke")

func check(value, message):
    if not value:
        push_error(message)
        quit(1)
        return false
    return true

func run_smoke():
    for flag in [false, true]:
        var scene = load("res://main.tscn").instantiate()
        var messages = []
        var finished = []
        var events = []
        scene.variables["has_key"] = flag
        scene.dialogue_requested.connect(func(_actor, text): messages.append(text))
        scene.flow_finished.connect(func(): finished.append(true))
        scene.event_emitted.connect(func(id, name): events.append([id, name]))
        root.add_child(scene)
        if not check(messages == ["intro"], "Initial dialogue did not match Forge IR"):
            return
        scene.choose("intro", "out")
        if flag:
            if not check(messages == ["intro", "allowed"], "True branch did not reach allowed dialogue"):
                return
            scene.choose("allowed", "out")
            if not check(events == [["smoke_done", "smoke_done"]], "Event signal mismatch"):
                return
        else:
            if not check(messages == ["intro"] and events.is_empty(), "False branch emitted unexpected dialogue/event"):
                return
        if not check(finished == [true], "Flow did not finish exactly once"):
            return
        root.remove_child(scene)
        scene.free()
    print("FORGE_GODOT_SMOKE_PASSED")
    quit(0)
