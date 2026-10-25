import json
import math


RUNNER = '''using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public partial class ForgeRunner : MonoBehaviour
{
    public event Action<string, string> DialogueRequested;
    public event Action<string[]> ChoiceRequested;
    public event Action<string, string> EventEmitted;
    public event Action FlowFinished;

    private readonly Dictionary<string, object> variables = new Dictionary<string, object>();
    private NodeData waiting;
    private bool finished;
    private string flowError;

    private sealed class NodeData
    {
        public string Id;
        public string Type;
        public Dictionary<string, object> Properties;

        public NodeData(string id, string type, Dictionary<string, object> properties)
        {
            Id = id;
            Type = type;
            Properties = properties;
        }
    }

    private sealed class ConnectionData
    {
        public string Source;
        public string Port;
        public string Target;

        public ConnectionData(string source, string port, string target)
        {
            Source = source;
            Port = port;
            Target = target;
        }
    }

    private void Start()
    {
        foreach (NodeData node in nodes.Values)
        {
            if (node.Type == "start")
            {
                RunNode(node.Id);
                return;
            }
        }
    }

    private string Next(string nodeId, string port)
    {
        foreach (ConnectionData connection in connections)
        {
            if (connection.Source == nodeId && connection.Port == port)
                return connection.Target;
        }
        return "";
    }

    private static string Text(NodeData node, string key)
    {
        object value;
        return node.Properties.TryGetValue(key, out value) ? Convert.ToString(value) : "";
    }

    private static bool Truthy(object value)
    {
        if (value == null) return false;
        if (value is bool) return (bool)value;
        if (value is string) return ((string)value).Length > 0;
        if (value is ICollection) return ((ICollection)value).Count > 0;
        return Convert.ToDouble(value) != 0;
    }

    private bool ConditionMatches(NodeData node)
    {
        var condition = (Dictionary<string, object>)node.Properties["condition"];
        object left;
        variables.TryGetValue((string)condition["variable"], out left);
        object right = condition["value"];
        string operation = (string)condition["operator"];
        if (operation == "truthy") return Truthy(left);
        if (operation == "falsy") return !Truthy(left);
        if (operation == "equals") return Equals(left, right);
        if (operation == "not_equals") return !Equals(left, right);
        if (!(left is double) || !(right is double)) return false;
        double a = (double)left;
        double b = (double)right;
        switch (operation)
        {
            case "greater_than": return a > b;
            case "less_than": return a < b;
            case "greater_or_equal": return a >= b;
            case "less_or_equal": return a <= b;
        }
        return false;
    }

    public void Choose(int index)
    {
        if (waiting == null || waiting.Type != "choice") return;
        object[] choices = (object[])waiting.Properties["choices"];
        if (index < 0 || index >= choices.Length) return;
        RunNode(Next(waiting.Id, "choice_" + index));
    }

    public void ContinueDialogue()
    {
        if (waiting != null && waiting.Type == "dialogue")
            RunNode(Next(waiting.Id, "out"));
    }

    private void RunNode(string nodeId)
    {
        waiting = null;
        finished = false;
        int steps = 0;
        while (!String.IsNullOrEmpty(nodeId))
        {
            if (++steps > 256)
            {
                flowError = "Forge flow exceeded 256 automatic steps; check for cycles";
                Debug.LogError(flowError);
                return;
            }
            NodeData node = nodes[nodeId];
            string port = "out";
            switch (node.Type)
            {
                case "dialogue":
                    waiting = node;
                    DialogueRequested?.Invoke(Text(node, "actor"), Text(node, "text"));
                    return;
                case "choice":
                    waiting = node;
                    object[] options = (object[])node.Properties["choices"];
                    string[] labels = Array.ConvertAll(options, item => Convert.ToString(item));
                    ChoiceRequested?.Invoke(labels);
                    return;
                case "branch":
                    port = ConditionMatches(node) ? "true" : "false";
                    break;
                case "set-variable":
                    variables[Text(node, "variable")] = node.Properties["value"];
                    break;
                case "event":
                    string eventId = Text(node, "event");
                    string eventName;
                    if (eventNames.TryGetValue(eventId, out eventName))
                    {
                        EventEmitted?.Invoke(eventId, eventName);
                        Debug.Log("Forge event: " + eventName);
                    }
                    break;
                case "end":
                    FinishFlow();
                    return;
            }
            nodeId = Next(node.Id, port);
        }
        FinishFlow();
    }

    private void FinishFlow()
    {
        waiting = null;
        finished = true;
        FlowFinished?.Invoke();
    }

    private void OnGUI()
    {
        GUILayout.BeginArea(new Rect(32, 32, 650, 450));
        if (flowError != null) GUILayout.Label(flowError);
        else if (finished) GUILayout.Label("End");
        else if (waiting != null && waiting.Type == "dialogue")
        {
            GUILayout.Label(Text(waiting, "actor") + ": " + Text(waiting, "text"));
            if (GUILayout.Button("Continue")) ContinueDialogue();
        }
        else if (waiting != null && waiting.Type == "choice")
        {
            object[] options = (object[])waiting.Properties["choices"];
            for (int index = 0; index < options.Length; index++)
            {
                if (GUILayout.Button(Convert.ToString(options[index])))
                {
                    Choose(index);
                    break;
                }
            }
        }
        GUILayout.EndArea();
    }
}
'''


def csharp_value(value) -> str:
    if value is None:
        return "null"

    if isinstance(value, bool):
        return "true" if value else "false"

    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=True)

    if isinstance(value, (int, float)):
        number = float(value)

        if not math.isfinite(number):
            raise ValueError("Unity exporter requer valores numéricos finitos")

        return repr(number) + "d"

    if isinstance(value, list):
        values = ", ".join(csharp_value(item) for item in value)

        return "new object[] {" + values + "}"

    if isinstance(value, dict):
        values = ", ".join(
            "{" + csharp_value(key) + ", " + csharp_value(item) + "}"
            for key, item in sorted(value.items())
        )

        return "new Dictionary<string, object> {" + values + "}"

    raise ValueError("Valor não suportado pelo Unity exporter")


def export_project(project: dict) -> dict[str, str]:
    node_lines = []

    for node in sorted(project["graph"]["nodes"], key=lambda item: item["id"]):
        node_id = csharp_value(node["id"])
        node_type = csharp_value(node["type"])
        properties = csharp_value(node["properties"])
        node_lines.append(f"        {{{node_id}, new NodeData({node_id}, {node_type}, {properties})}}")

    connection_lines = []

    for connection in sorted(project["graph"]["connections"], key=lambda item: item["id"]):
        source = csharp_value(connection["source_node_id"])
        port = csharp_value(connection["source_port"])
        target = csharp_value(connection["target_node_id"])
        connection_lines.append(f"        new ConnectionData({source}, {port}, {target})")

    event_lines = [
        "        {" + csharp_value(event["id"]) + ", " + csharp_value(event["name"]) + "}"
        for event in sorted(project.get("events", []), key=lambda item: item["id"])
    ]
    data = (
        "using System.Collections.Generic;\n\npublic partial class ForgeRunner\n{\n"
        "    private readonly Dictionary<string, NodeData> nodes = new Dictionary<string, NodeData>\n    {\n"
        + ",\n".join(node_lines) + "\n    };\n\n"
        "    private readonly ConnectionData[] connections = new ConnectionData[]\n    {\n"
        + ",\n".join(connection_lines) + "\n    };\n\n"
        "    private readonly Dictionary<string, string> eventNames = new Dictionary<string, string>\n    {\n"
        + ",\n".join(event_lines) + "\n    };\n}\n"
    )
    files = {
        "Assets/Forge/ForgeRunner.cs": RUNNER,
        "Assets/Forge/ForgeRunner.Data.cs": data,
        "Assets/Forge/forge_project.json": json.dumps(project, ensure_ascii=False, indent=2, sort_keys=True),
        "README.md": (
            "# Forge export — Unity\n\nCopy Assets/Forge into a Unity 2021.3+ project.\n"
            "Create an empty GameObject and add the ForgeRunner component. Enter Play Mode.\n"
            "The starter displays dialogue/choice buttons with IMGUI and exposes C# events.\n"
            "Branch.condition uses structured comparisons; Set Variable stores JSON values.\n"
            "Cycles are limited to 256 automatic steps per interaction.\n"
            "Assets remain embedded project data; automatic scene placement is future scope.\n"
        ),
    }

    return files
