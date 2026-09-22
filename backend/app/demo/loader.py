"""Loads the bundled demo persona (Aditya Dwivedi, built by build_persona.py)."""
from __future__ import annotations

import copy
import json
import os
from functools import lru_cache

from app.models import CalendarEvent, FutureGraph, Opportunity, PersonalProfile, PersonalSource
from app.scoring.engine import rescore_graph

DEMO_DIR = os.path.dirname(os.path.abspath(__file__))
DEMO_PATH = os.path.join(DEMO_DIR, "demo_data.json")
OPPS_PATH = os.path.join(DEMO_DIR, "opportunities.json")


@lru_cache(maxsize=1)
def _raw() -> dict:
    with open(DEMO_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_demo() -> dict:
    return copy.deepcopy(_raw())


def load_demo_profile() -> PersonalProfile:
    return PersonalProfile.model_validate(load_demo()["profile"])


def load_demo_calendar() -> list[CalendarEvent]:
    return [CalendarEvent.model_validate(e) for e in load_demo()["calendar"]]


def load_demo_sources() -> list[PersonalSource]:
    return [PersonalSource.model_validate(s) for s in load_demo()["sources"]]


def load_demo_graph() -> FutureGraph:
    g = FutureGraph.model_validate(load_demo()["graph"])
    return rescore_graph(g)


def load_demo_opportunities() -> list[Opportunity]:
    with open(OPPS_PATH, "r", encoding="utf-8") as f:
        return [Opportunity.model_validate(o) for o in json.load(f)]


def demo_documents() -> list[dict]:
    """Text documents (notes + calendar summary) for the demo brain."""
    d = load_demo()
    docs = []
    for s in d["sources"]:
        docs.append({"id": s["id"], "name": s["name"], "type": s["type"], "text": s["excerpt"], "date": s.get("date")})
    for e in d["evidence"]:
        docs.append({"id": e["id"], "name": e["source_id"], "type": "evidence", "text": e["text"], "date": e.get("date")})
    for ev in d["calendar"]:
        docs.append({"id": ev["id"], "name": "calendar", "type": "calendar", "text": f"{ev['title']} {ev['start']} to {ev['end']} ({ev['kind']})", "date": ev["start"][:10]})
    return docs
