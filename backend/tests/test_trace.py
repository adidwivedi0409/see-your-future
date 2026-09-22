import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
os.environ.setdefault("DEMO_MODE", "true")
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
EXPECTED = {"recall_personal_context", "analyze_schedule", "find_opportunities", "generate_future_paths"}


def test_generate_returns_trace():
    r = client.post("/api/future/generate")
    assert r.status_code == 200
    body = r.json()
    assert len(body["nodes"]) >= 12
    steps = body["trace"]
    assert len(steps) >= 4
    tools = [s["tool"] for s in steps]
    assert EXPECTED.issubset(set(tools))
    assert tools.index("recall_personal_context") < tools.index("generate_future_paths")
    for s in steps:
        assert s["mode"] in ("demo", "strands") and s["duration_ms"] >= 1 and s["output_summary"]


def test_agent_trace_endpoint_and_simulate_step():
    client.post("/api/future/generate")
    r = client.get("/api/agent/trace")
    assert r.status_code == 200
    t = r.json()
    assert t["agent"] == "FutureNavigatorAgent" and t["framework"] == "AWS Strands Agents"
    assert len(t["tools"]) == 7 and "simulate_decision" in t["tools"] and "remember_user_feedback" in t["tools"]
    assert len(t["steps"]) >= 4
    r = client.post("/api/future/simulate", json={"change": {"node_id": "d_interview", "change_type": "increase_time", "value": 3}})
    assert r.status_code == 200
    t = client.get("/api/agent/trace").json()
    assert t["steps"][-1]["tool"] == "simulate_decision" and "scenarios changed" in t["steps"][-1]["output_summary"]


def test_brain_graph():
    r = client.get("/api/brain/graph")
    assert r.status_code == 200
    g = r.json()
    assert g["mode"] in ("demo", "cognee")
    assert len(g["nodes"]) >= 20 and len(g["edges"]) >= 25
    ids = {n["id"] for n in g["nodes"]}
    assert all(e["source"] in ids and e["target"] in ids for e in g["edges"])
    kinds = {n["kind"] for n in g["nodes"]}
    assert {"source", "event", "goal", "opportunity"}.issubset(kinds)
