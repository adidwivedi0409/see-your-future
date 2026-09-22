from app.demo.loader import load_demo_calendar
from app.models import CalendarEvent
from app.scoring.schedule import analyze_schedule, deadline_clusters, find_overlaps


def ev(i, title, s, e, kind="event"):
    return CalendarEvent(id=i, title=title, start=s, end=e, kind=kind, location=None, source_id="src")


def test_overlap_detection():
    a = ev("a", "A", "2026-09-22T10:00:00", "2026-09-22T11:00:00")
    b = ev("b", "B", "2026-09-22T10:30:00", "2026-09-22T12:00:00")
    c = ev("c", "C", "2026-09-22T12:00:00", "2026-09-22T13:00:00")
    ov = find_overlaps([a, b, c])
    assert len(ov) == 1 and {ov[0]["a"], ov[0]["b"]} == {"a", "b"}


def test_deadline_cluster_demo():
    clusters = deadline_clusters(load_demo_calendar())
    assert clusters and clusters[0]["count"] >= 3


def test_analyze_schedule_warnings():
    out = analyze_schedule(load_demo_calendar())
    assert out["schedule_pressure"] in ("Low", "Medium", "High")
    assert any("within 5 days" in w for w in out["warnings"])
    assert any("21:00" in w for w in out["warnings"])
