"""Opportunity discovery via Bright Data SERP API, or the bundled demo cache."""
from __future__ import annotations

import hashlib
import json
import re
import time
from typing import Any

from app.config import settings
from app.demo.loader import load_demo_opportunities
from app.models import Opportunity, PersonalProfile

try:
    import httpx
except Exception:  # pragma: no cover
    httpx = None  # type: ignore

BRIGHT_DATA_ENDPOINT = "https://api.brightdata.com/request"


def _profile_terms(profile: PersonalProfile | None) -> list[str]:
    if not profile:
        return ["AI", "research", "internship"]
    terms = [a.label for a in profile.attributes if a.kind in ("interest", "goal", "strength")]
    return terms or ["AI", "research", "internship"]


def score_relevance(opp: Opportunity, profile: PersonalProfile | None) -> Opportunity:
    if profile is None:
        return opp
    text = f"{opp.title} {opp.description} {opp.organization}".lower()
    reasons: list[str] = []
    hits = 0
    for a in profile.attributes:
        words = [w for w in re.findall(r"[a-z]+", a.label.lower()) if len(w) > 3]
        if any(w in text for w in words):
            hits += 1
            reasons.append(f"Matches {a.kind}: {a.label}")
    if not opp.is_demo:
        opp.relevance_score = float(min(100, 40 + hits * 15))
        opp.relevance_reasons = reasons or ["General match to your profile"]
    return opp


class DemoBrightDataService:
    mode = "demo"

    def __init__(self) -> None:
        self._cache: dict[str, tuple[float, list[Opportunity]]] = {}

    def search_opportunities(self, profile: PersonalProfile | None = None, location: str | None = None, date_range: str | None = None) -> list[Opportunity]:
        opps = load_demo_opportunities()
        if location:
            loc = location.lower()
            filtered = [o for o in opps if loc in o.location.lower() or "remote" in o.location.lower()]
            opps = filtered or opps
        return sorted(opps, key=lambda o: -o.relevance_score)

    def health_check(self) -> dict:
        return {"mode": self.mode, "available": True}


class BrightDataService(DemoBrightDataService):
    mode = "bright_data"

    def __init__(self) -> None:
        super().__init__()
        self.api_key = settings.BRIGHT_DATA_API_KEY
        self.zone = settings.BRIGHT_DATA_DATASET_ID or "serp_api"
        self.ttl = 600

    def _query(self, profile: PersonalProfile | None, location: str | None, date_range: str | None) -> str:
        terms = " OR ".join(f'"{t}"' for t in _profile_terms(profile)[:3])
        q = f"({terms}) (hackathon OR internship OR research program OR fellowship) students"
        if location:
            q += f" {location}"
        if date_range:
            q += f" {date_range}"
        return q

    def _classify(self, title: str, snippet: str) -> str:
        t = f"{title} {snippet}".lower()
        for kind in ("hackathon", "internship", "research", "scholarship", "course"):
            if kind in t:
                return kind
        return "event"

    def search_opportunities(self, profile: PersonalProfile | None = None, location: str | None = None, date_range: str | None = None) -> list[Opportunity]:
        if not self.api_key or httpx is None:
            return super().search_opportunities(profile, location, date_range)
        q = self._query(profile, location, date_range)
        key = hashlib.sha1(q.encode()).hexdigest()
        cached = self._cache.get(key)
        if cached and time.time() - cached[0] < self.ttl:
            return cached[1]
        try:
            url = "https://www.google.com/search?q=" + httpx.QueryParams({"q": q})["q"].replace(" ", "+") + "&brd_json=1"
            r = httpx.post(
                BRIGHT_DATA_ENDPOINT,
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json={"zone": self.zone, "url": url, "format": "raw"},
                timeout=45,
            )
            r.raise_for_status()
            data: Any = r.json() if r.headers.get("content-type", "").startswith("application/json") else json.loads(r.text)
            organic = data.get("organic", []) if isinstance(data, dict) else []
            opps: list[Opportunity] = []
            for i, item in enumerate(organic[:12]):
                title = item.get("title") or "Untitled"
                snippet = item.get("description") or item.get("snippet") or ""
                opp = Opportunity(
                    id=f"bd_{key[:6]}_{i}", title=title, type=self._classify(title, snippet),
                    organization=item.get("display_link") or item.get("source") or "", description=snippet,
                    location=location or "", start_date=None, deadline=None, url=item.get("link") or "",
                    source="Bright Data SERP", relevance_score=0, relevance_reasons=[], is_demo=False,
                )
                opps.append(score_relevance(opp, profile))
            if not opps:
                return super().search_opportunities(profile, location, date_range)
            opps.sort(key=lambda o: -o.relevance_score)
            self._cache[key] = (time.time(), opps)
            return opps
        except Exception:
            return super().search_opportunities(profile, location, date_range)

    def health_check(self) -> dict:
        return {"mode": self.mode, "available": bool(self.api_key), "zone": self.zone}


_svc: DemoBrightDataService | None = None


def get_bright_data_service() -> DemoBrightDataService:
    global _svc
    if _svc is None:
        _svc = BrightDataService() if (settings.BRIGHT_DATA_API_KEY and not settings.DEMO_MODE) else DemoBrightDataService()
    return _svc
