import copy

from app.demo.loader import load_demo_graph
from app.models import DecisionChange
from app.scoring.engine import simulate


def _score(g, nid):
    return next(n.scenario_score for n in g.nodes if n.id == nid)


def test_increase_time_interview():
    g = load_demo_graph()
    snapshot = copy.deepcopy(g.model_dump())
    res = simulate(g, DecisionChange(node_id="d_interview", change_type="increase_time", value=3))
    assert _score(res.before, "o_interview_ready") == 54
    assert _score(res.after, "o_interview_ready") > _score(res.before, "o_interview_ready")
    assert abs(_score(res.after, "o_interview_ready") - 72) <= 3
    assert _score(res.after, "o_stable") < _score(res.before, "o_stable")
    assert abs(_score(res.after, "o_stable") - 77) <= 3
    assert res.schedule_pressure_before == "Medium" and res.schedule_pressure_after == "High"
    assert g.model_dump() == snapshot  # input graph untouched
    ch = next(c for c in res.changed_nodes if c.node_id == "o_interview_ready")
    assert "existing preparation" in ch.explanation and "->" in ch.explanation


def test_choose_and_reject():
    g = load_demo_graph()
    r = simulate(g, DecisionChange(node_id="d_hackathon", change_type="choose"))
    assert _score(r.after, "d_hackathon") >= _score(r.before, "d_hackathon")
    assert _score(r.after, "o_agent_project") > _score(r.before, "o_agent_project")
    r2 = simulate(g, DecisionChange(node_id="d_hackathon", change_type="reject"))
    assert _score(r2.after, "o_agent_project") < _score(r2.before, "o_agent_project")


def test_unknown_node():
    import pytest

    with pytest.raises(ValueError):
        simulate(load_demo_graph(), DecisionChange(node_id="nope", change_type="choose"))
