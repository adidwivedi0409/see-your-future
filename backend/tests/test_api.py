from fastapi.testclient import TestClient

from app.main import app
from app.models import FutureGraph

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok" and "demo_mode" in body and "brain_mode" in body


def test_demo_load_and_future():
    r = client.post("/api/demo/load")
    assert r.status_code == 200
    r = client.get("/api/future")
    assert r.status_code == 200
    g = FutureGraph.model_validate(r.json())
    assert len(g.nodes) >= 12


def test_simulate_and_plan():
    client.post("/api/demo/load")
    g = client.get("/api/future").json()
    r = client.post("/api/future/simulate", json={"graph": None, "change": {"node_id": "d_interview", "change_type": "increase_time", "value": 3, "note": None}})
    assert r.status_code == 200
    body = r.json()
    assert body["schedule_pressure_after"] == "High" and body["changed_nodes"]
    r = client.post("/api/plan/generate", json={"graph": g, "path_node_ids": ["today", "d_interview", "o_interview_ready"]})
    assert r.status_code == 200
    plan = r.json()
    assert len(plan["next_actions"]) == 3 and plan["requires_confirmation"] is True


def test_validation_errors():
    client.post("/api/demo/load")
    r = client.post("/api/future/simulate", json={"change": {"node_id": "nope", "change_type": "choose"}})
    assert r.status_code == 422
    r = client.post("/api/brain/ingest", data={})
    assert r.status_code == 400
    r = client.post("/api/brain/ingest", files={"files": ("bad.exe", b"x", "application/octet-stream")})
    assert r.status_code == 400
    r = client.post("/api/brain/ingest", files={"files": ("note.md", b"# hi\ninterview prep", "text/markdown")}, data={"notes": "extra"})
    assert r.status_code == 200 and r.json()["total_sources"] >= 2
    r = client.post("/api/brain/search", json={"query": "interview"})
    assert r.status_code == 200 and r.json()["results"]
