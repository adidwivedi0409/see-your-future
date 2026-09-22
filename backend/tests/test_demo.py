from app.demo.loader import load_demo_graph, load_demo_opportunities, load_demo_profile
from app.models import FutureGraph


def test_demo_graph_valid():
    g = load_demo_graph()
    assert isinstance(g, FutureGraph)
    assert len(g.nodes) >= 12
    assert sum(1 for n in g.nodes if n.category == "decision") >= 3
    assert any(n.id == g.root_id for n in g.nodes)
    ids = {n.id for n in g.nodes}
    assert all(e.source in ids and e.target in ids for e in g.edges)
    assert g.schedule_pressure == "Medium"
    for n in g.nodes:
        assert 0 <= n.scenario_score <= 100 and len(n.score_factors) == 9 or n.category == "present"


def test_demo_profile_and_opps():
    p = load_demo_profile()
    assert p.user_id == "aditya" and len(p.attributes) == 8 and p.weekly_commitment_hours == 42
    opps = load_demo_opportunities()
    assert len(opps) >= 6 and all(o.is_demo for o in opps)
