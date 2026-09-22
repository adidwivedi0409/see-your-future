"""Personal brain: Cognee (real) or an in-memory demo brain with identical interface."""
from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from typing import Any

from app.config import settings
from app.models import CalendarEvent, PersonalSource

COGNEE_AVAILABLE = False
cognee = None  # type: ignore
SearchType = None  # type: ignore
if not settings.DEMO_MODE:  # importing cognee is slow; skip entirely in demo mode
    try:  # optional dependency
        import cognee  # type: ignore
        from cognee.modules.search.types import SearchType  # type: ignore

        COGNEE_AVAILABLE = True
    except Exception:  # pragma: no cover - depends on env
        COGNEE_AVAILABLE = False

try:
    import httpx
except Exception:  # pragma: no cover
    httpx = None  # type: ignore

BUILD_STEPS = [
    "Reading personal data",
    "Identifying commitments",
    "Connecting goals and interests",
    "Building knowledge graph",
    "Brain ready",
]

_WORD = re.compile(r"[a-z0-9@]+")


def _tokens(text: str) -> set[str]:
    return set(_WORD.findall(text.lower()))


def _run(coro):
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    if loop and loop.is_running():  # pragma: no cover
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor(1) as ex:
            return ex.submit(asyncio.run, coro).result()
    return asyncio.run(coro)


class DemoBrainService:
    """In-memory store + keyword search over ingested sources."""

    mode = "demo"

    def __init__(self, user_id: str = "demo_user") -> None:
        self.user_id = user_id
        self.docs: list[dict[str, Any]] = []
        self.feedback: list[dict[str, Any]] = []
        self.built = False
        self.built_at: str | None = None

    # -- ingestion --
    def ingest_text(self, text: str, name: str = "note", source_type: str = "note", date: str | None = None) -> PersonalSource:
        idx = len(self.docs) + 1
        sid = f"src_{source_type}_{idx}"
        doc = {"id": sid, "name": name, "type": source_type, "text": text, "date": date}
        self.docs.append(doc)
        self.built = False
        return PersonalSource(id=sid, name=name, type=source_type if source_type in ("calendar", "note", "document", "upload", "demo") else "upload", date=date, excerpt=text[:200], record_id=f"rec_{idx}")

    def ingest_file(self, filename: str, content: bytes) -> PersonalSource:
        text = extract_text(filename, content)
        return self.ingest_text(text, name=filename, source_type="upload")

    def ingest_calendar(self, events: list[CalendarEvent]) -> PersonalSource:
        lines = [f"{e.title} | {e.start} -> {e.end} | {e.kind} | {e.location or ''}" for e in events]
        return self.ingest_text("\n".join(lines), name="calendar", source_type="calendar")

    def ingest_documents(self, docs: list[dict]) -> int:
        for d in docs:
            self.docs.append(dict(d))
        self.built = False
        return len(docs)

    # -- build / search --
    def build_brain(self) -> dict:
        self.built = True
        self.built_at = datetime.now(timezone.utc).isoformat()
        return {"status": "ready", "steps": BUILD_STEPS, "documents": len(self.docs), "mode": self.mode}

    def search_brain(self, query: str, top_k: int = 8) -> list[dict]:
        q = _tokens(query)
        scored = []
        for d in self.docs:
            t = _tokens(d.get("text", "") + " " + d.get("name", ""))
            overlap = len(q & t)
            if overlap:
                scored.append((overlap / (len(q) or 1), d))
        scored.sort(key=lambda x: -x[0])
        if not scored:
            # No keyword overlap: fall back to the most recent documents so broad queries still surface context.
            recent = sorted(self.docs, key=lambda d: str(d.get("date") or ""), reverse=True)
            scored = [(0.1, d) for d in recent[:top_k]]
        return [
            {"id": d["id"], "name": d.get("name"), "type": d.get("type"), "text": d.get("text", ""), "date": d.get("date"), "score": round(s, 3)}
            for s, d in scored[:top_k]
        ]

    def remember_feedback(self, text: str, node_id: str | None = None) -> dict:
        item = {"text": text, "node_id": node_id, "at": datetime.now(timezone.utc).isoformat()}
        self.feedback.append(item)
        self.docs.append({"id": f"fb_{len(self.feedback)}", "name": "user feedback", "type": "note", "text": text, "date": item["at"][:10]})
        return item

    def health_check(self) -> dict:
        return {"mode": self.mode, "available": True, "documents": len(self.docs), "built": self.built, "built_at": self.built_at}

    def reset(self) -> None:
        self.docs.clear()
        self.feedback.clear()
        self.built = False
        self.built_at = None


class CogneeService(DemoBrainService):
    """Real Cognee path (local library or REST via COGNEE_BASE_URL); falls back to the demo store on error."""

    mode = "cognee"

    def __init__(self, user_id: str = "demo_user") -> None:
        super().__init__(user_id)
        self.base_url = (settings.COGNEE_BASE_URL or "").rstrip("/")
        self.api_key = settings.COGNEE_API_KEY
        self.use_rest = bool(self.base_url and httpx is not None)

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}

    def ingest_text(self, text: str, name: str = "note", source_type: str = "note", date: str | None = None) -> PersonalSource:
        src = super().ingest_text(text, name, source_type, date)
        try:
            if COGNEE_AVAILABLE and not self.use_rest:
                _run(cognee.add(text, dataset_name=self.user_id))
            elif self.use_rest:
                httpx.post(f"{self.base_url}/api/v1/add", headers=self._headers(), json={"data": text, "datasetName": self.user_id}, timeout=30)
        except Exception:  # keep demo store as fallback
            pass
        return src

    def build_brain(self) -> dict:
        out = super().build_brain()
        try:
            if COGNEE_AVAILABLE and not self.use_rest:
                _run(cognee.cognify(datasets=[self.user_id]))
            elif self.use_rest:
                httpx.post(f"{self.base_url}/api/v1/cognify", headers=self._headers(), json={"datasets": [self.user_id]}, timeout=120)
            out["mode"] = "cognee"
        except Exception as exc:
            out["mode"] = "demo"
            out["warning"] = f"cognee unavailable, using local store: {exc}"
        return out

    def search_brain(self, query: str, top_k: int = 8) -> list[dict]:
        try:
            if COGNEE_AVAILABLE and not self.use_rest:
                results = _run(cognee.search(query_text=query, query_type=SearchType.GRAPH_COMPLETION, datasets=[self.user_id]))
                return [{"id": f"cognee_{i}", "name": "cognee", "type": "graph", "text": str(r), "date": None, "score": 1.0} for i, r in enumerate(results)][:top_k]
            if self.use_rest:
                r = httpx.post(f"{self.base_url}/api/v1/search", headers=self._headers(), json={"query": query, "searchType": "GRAPH_COMPLETION", "datasets": [self.user_id]}, timeout=60)
                r.raise_for_status()
                data = r.json()
                items = data if isinstance(data, list) else data.get("results", [])
                return [{"id": f"cognee_{i}", "name": "cognee", "type": "graph", "text": str(x), "date": None, "score": 1.0} for i, x in enumerate(items)][:top_k]
        except Exception:
            pass
        return super().search_brain(query, top_k)

    def health_check(self) -> dict:
        h = super().health_check()
        h.update({"mode": "cognee", "library": COGNEE_AVAILABLE, "rest": self.use_rest})
        return h


def extract_text(filename: str, content: bytes) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        try:
            import io

            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(content))
            return "\n".join((p.extract_text() or "") for p in reader.pages)
        except Exception as exc:
            return f"[could not extract PDF text: {exc}]"
    if name.endswith(".ics"):
        try:
            from icalendar import Calendar

            cal = Calendar.from_ical(content)
            lines = []
            for comp in cal.walk("VEVENT"):
                lines.append(f"{comp.get('summary')} | {comp.get('dtstart').dt} -> {comp.get('dtend').dt if comp.get('dtend') else ''}")
            return "\n".join(lines)
        except Exception as exc:
            return f"[could not parse ICS: {exc}]"
    return content.decode("utf-8", errors="replace")


_brain: DemoBrainService | None = None


def get_brain_service() -> DemoBrainService:
    global _brain
    if _brain is None:
        real_possible = (COGNEE_AVAILABLE or bool(settings.COGNEE_BASE_URL)) and not settings.DEMO_MODE
        _brain = CogneeService() if real_possible else DemoBrainService()
    return _brain
