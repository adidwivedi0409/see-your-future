"""Calendar analysis: overlaps, deadline clusters, free time."""
from __future__ import annotations

from datetime import datetime, timedelta

from app.models import CalendarEvent


def _parse(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)


def find_overlaps(events: list[CalendarEvent]) -> list[dict]:
    timed = [e for e in events if e.kind != "deadline"]
    out = []
    for i in range(len(timed)):
        for j in range(i + 1, len(timed)):
            a, b = timed[i], timed[j]
            if _parse(a.start) < _parse(b.end) and _parse(b.start) < _parse(a.end):
                out.append({"a": a.id, "b": b.id, "titles": [a.title, b.title], "start": max(a.start, b.start)})
    return out


def deadline_clusters(events: list[CalendarEvent], window_days: int = 5) -> list[dict]:
    dls = sorted((e for e in events if e.kind in ("deadline", "interview")), key=lambda e: e.start)
    clusters: list[dict] = []
    for i, e in enumerate(dls):
        start = _parse(e.start)
        group = [x for x in dls[i:] if _parse(x.start) - start <= timedelta(days=window_days)]
        if len(group) >= 2 and (not clusters or set(x.id for x in group) != set(clusters[-1]["event_ids"])):
            if clusters and set(x.id for x in group) <= set(clusters[-1]["event_ids"]):
                continue
            clusters.append(
                {
                    "event_ids": [x.id for x in group],
                    "titles": [x.title for x in group],
                    "window_start": group[0].start,
                    "window_end": group[-1].start,
                    "count": len(group),
                }
            )
    return clusters


def committed_hours(events: list[CalendarEvent]) -> float:
    total = 0.0
    for e in events:
        if e.kind == "deadline":
            continue
        total += (_parse(e.end) - _parse(e.start)).total_seconds() / 3600
    return round(total, 2)


def free_time(events: list[CalendarEvent], waking_hours_per_day: float = 14, days: int = 7) -> dict:
    committed = committed_hours(events)
    available = max(0.0, waking_hours_per_day * days - committed)
    return {"committed_hours": committed, "free_hours": round(available, 1), "days": days}


def analyze_schedule(events: list[CalendarEvent]) -> dict:
    overlaps = find_overlaps(events)
    clusters = deadline_clusters(events)
    ft = free_time(events)
    warnings: list[str] = []
    for c in clusters:
        warnings.append(f"{c['count']} deadlines/interviews fall within 5 days ({c['window_start'][:10]} to {c['window_end'][:10]})")
    for o in overlaps:
        warnings.append(f"Overlapping commitments: {o['titles'][0]} and {o['titles'][1]}")
    # Late event immediately before a deadline
    dls = [e for e in events if e.kind == "deadline"]
    for e in events:
        if e.kind == "event" and _parse(e.end).hour >= 21:
            for dl in dls:
                gap = _parse(dl.start) - _parse(e.end)
                if timedelta(0) < gap <= timedelta(days=3):
                    warnings.append(f"{e.title} runs until {_parse(e.end).strftime('%H:%M')} shortly before {dl.title}")
    pressure = "Low"
    if clusters and (overlaps or ft["free_hours"] < 50):
        pressure = "High"
    elif clusters or overlaps:
        pressure = "Medium"
    return {
        "overlaps": overlaps,
        "deadline_clusters": clusters,
        "free_time": ft,
        "warnings": warnings,
        "schedule_pressure": pressure,
    }
