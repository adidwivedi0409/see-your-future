from __future__ import annotations

import re

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.agents.future_navigator import STRANDS_AVAILABLE, get_agent
from app.api.state import state
from app.config import settings
from app.demo.loader import demo_documents, load_demo, load_demo_calendar, load_demo_opportunities, load_demo_profile, load_demo_sources
from app.models import (
    ActionPlan, AgentTrace, BrainGraphEdge, BrainGraphNode, BrainGraphResponse, BuildResponse, DecisionChange, FutureGenerateResponse,
    FutureGraph, Opportunity, OpportunitySearchRequest, PersonalProfile, PlanRequest, SearchRequest, SimulateRequest, SimulationResult,
)
from app.scoring import engine
from app.scoring.schedule import analyze_schedule
from app.services.bright_data_service import get_bright_data_service
from app.services.cognee_service import BUILD_STEPS, COGNEE_AVAILABLE, get_brain_service

router = APIRouter(prefix="/api")
ALLOWED_EXT = {".txt", ".md", ".pdf", ".json", ".ics"}
_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


def sanitize_filename(name: str) -> str:
    base = (name or "upload").split("/")[-1].split("\\")[-1]
    base = _SAFE.sub("_", base).strip("._") or "upload"
    return base[:120]


def _load_demo_into_state() -> None:
    state.reset()
    state.profile = load_demo_profile()
    state.calendar = load_demo_calendar()
    state.sources = load_demo_sources()
    state.opportunities = load_demo_opportunities()
    brain = get_brain_service()
    brain.reset()
    brain.ingest_documents(demo_documents())
    brain.build_brain()
    state.brain_built = True
    state.graph = get_agent().run_pipeline(state.profile)
    state.trace = get_agent().trace
    state.demo_loaded = True


@router.get("/health")
def health():
    brain = get_brain_service()
    return {
        "status": "ok",
        "demo_mode": settings.DEMO_MODE,
        "brain_mode": brain.mode,
        "strands_available": STRANDS_AVAILABLE,
        "bright_data_mode": get_bright_data_service().mode,
        "cognee_mode": "cognee" if (brain.mode == "cognee") else ("available" if COGNEE_AVAILABLE else "demo"),
        "version": settings.VERSION,
    }


# ---------------- brain
@router.post("/brain/ingest")
async def brain_ingest(files: list[UploadFile] = File(default=[]), notes: str | None = Form(default=None)):
    if not files and not (notes and notes.strip()):
        raise HTTPException(status_code=400, detail="Provide at least one file (.txt .md .pdf .json .ics) or a notes field.")
    brain = get_brain_service()
    max_bytes = settings.UPLOAD_MAX_MB * 1024 * 1024
    ingested = []
    for f in files:
        name = sanitize_filename(f.filename or "upload")
        ext = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
        if ext not in ALLOWED_EXT:
            raise HTTPException(status_code=400, detail=f"File '{name}' has unsupported type '{ext or 'none'}'. Allowed: {', '.join(sorted(ALLOWED_EXT))}.")
        content = await f.read()
        if len(content) > max_bytes:
            raise HTTPException(status_code=400, detail=f"File '{name}' exceeds the {settings.UPLOAD_MAX_MB} MB limit.")
        src = brain.ingest_file(name, content)
        state.sources.append(src)
        ingested.append(src)
    if notes and notes.strip():
        src = brain.ingest_text(notes.strip(), name="notes", source_type="note")
        state.sources.append(src)
        state.notes.append(notes.strip())
        ingested.append(src)
    state.brain_built = False
    return {"status": "ingested", "sources": [s.model_dump() for s in ingested], "total_sources": len(state.sources), "privacy": "Your data is used only to build your personal scenario map."}


@router.post("/brain/build", response_model=BuildResponse)
def brain_build():
    brain = get_brain_service()
    if not brain.docs:
        brain.ingest_documents(demo_documents())
        if not state.sources:
            state.sources = load_demo_sources()
    out = brain.build_brain()
    state.brain_built = True
    return BuildResponse(status=out.get("status", "ready"), steps=BUILD_STEPS, brain_mode="cognee" if out.get("mode") == "cognee" else "demo", ingested_sources=len(brain.docs))


@router.post("/brain/search")
def brain_search(req: SearchRequest):
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="query must not be empty")
    return {"query": req.query, "results": get_brain_service().search_brain(req.query)}


@router.get("/brain/status")
def brain_status():
    h = get_brain_service().health_check()
    h.update({"sources": len(state.sources), "built": state.brain_built or h.get("built", False)})
    return h


def build_brain_graph() -> BrainGraphResponse:
    """Knowledge-graph view of the personal brain: sources -> attributes, calendar -> deadline cluster, goals <-> opportunities."""
    d = load_demo()
    profile = state.profile or load_demo_profile()
    sources = state.sources or load_demo_sources()
    calendar = state.calendar or load_demo_calendar()
    opps = state.opportunities or load_demo_opportunities()
    evidence = {e["id"]: e for e in d.get("evidence", [])}
    nodes: list[BrainGraphNode] = [BrainGraphNode(id="me", label=d.get("persona", "You"), kind="attribute")]
    edges: list[BrainGraphEdge] = []
    seen = {"me"}

    def add(n: BrainGraphNode) -> None:
        if n.id not in seen:
            seen.add(n.id)
            nodes.append(n)

    for s in sources:
        add(BrainGraphNode(id=s.id, label=s.name, kind="source"))
    for a in profile.attributes:
        kind = "goal" if a.kind == "goal" else "interest" if a.kind in ("interest", "strength") else "attribute"
        add(BrainGraphNode(id=a.id, label=a.label, kind=kind))
        edges.append(BrainGraphEdge(source="me", target=a.id, relation=a.kind))
        for sid in a.source_ids:
            if sid in seen:
                edges.append(BrainGraphEdge(source=sid, target=a.id, relation="evidence"))
        for eid in a.evidence_ids:
            ev = evidence.get(eid)
            if ev and ev.get("source_id") in seen and ev["source_id"] not in a.source_ids:
                edges.append(BrainGraphEdge(source=ev["source_id"], target=a.id, relation="evidence"))
    cluster_added = False
    for ev in calendar:
        if ev.kind in ("deadline", "interview", "event"):
            add(BrainGraphNode(id=ev.id, label=ev.title, kind="event"))
            if ev.source_id in seen:
                edges.append(BrainGraphEdge(source=ev.source_id, target=ev.id, relation="recorded_in"))
            if ev.kind in ("deadline", "interview"):
                if not cluster_added:
                    add(BrainGraphNode(id="cluster_week", label="Deadline cluster · this week", kind="event"))
                    cluster_added = True
                edges.append(BrainGraphEdge(source=ev.id, target="cluster_week", relation="clusters"))
    if cluster_added:
        for a in profile.attributes:
            if a.kind in ("constraint", "habit", "overload"):
                edges.append(BrainGraphEdge(source="cluster_week", target=a.id, relation="supports"))
    goal_ids = [a.id for a in profile.attributes if a.kind == "goal"]
    interest_ids = [a.id for a in profile.attributes if a.kind in ("interest", "strength")]
    for o in opps:
        add(BrainGraphNode(id=o.id, label=o.title, kind="opportunity"))
        targets = interest_ids if o.type in ("research", "event", "hackathon") else goal_ids
        for t in (targets or goal_ids)[:2]:
            edges.append(BrainGraphEdge(source=t, target=o.id, relation=f"relevance {o.relevance_score:.0f}"))
        if o.deadline and any(e.title.lower().startswith(o.organization.lower()[:6]) for e in calendar):
            for e in calendar:
                if e.title.lower().startswith(o.organization.lower()[:6]) and e.id in seen:
                    edges.append(BrainGraphEdge(source=e.id, target=o.id, relation="deadline"))
    return BrainGraphResponse(mode="cognee" if get_brain_service().mode == "cognee" else "demo", nodes=nodes, edges=edges)


@router.get("/brain/graph", response_model=BrainGraphResponse)
def brain_graph():
    return build_brain_graph()


# ---------------- profile
@router.post("/profile/analyze", response_model=PersonalProfile)
def profile_analyze():
    brain = get_brain_service()
    if state.profile is None or not state.demo_loaded:
        _load_demo_into_state()
    profile = state.profile
    assert profile is not None
    profile.brain_mode = "cognee" if brain.mode == "cognee" else "demo"
    analysis = analyze_schedule(state.calendar or load_demo_calendar())
    for w in analysis["warnings"]:
        if w not in profile.overload_warnings and len(profile.overload_warnings) < 4:
            profile.overload_warnings.append(w)
    if state.notes:
        profile.summary += f" {len(state.notes)} additional note(s) were ingested and are included in the personal brain."
    return profile


@router.get("/profile", response_model=PersonalProfile)
def profile_get():
    if state.profile is None:
        raise HTTPException(status_code=404, detail="No profile yet. Call POST /api/profile/analyze or POST /api/demo/load.")
    return state.profile


# ---------------- opportunities
@router.post("/opportunities/search", response_model=list[Opportunity])
def opportunities_search(req: OpportunitySearchRequest | None = None):
    req = req or OpportunitySearchRequest()
    opps = get_bright_data_service().search_opportunities(state.profile, req.location, req.date_range)
    state.opportunities = opps
    return opps


@router.get("/opportunities", response_model=list[Opportunity])
def opportunities_get():
    if not state.opportunities:
        state.opportunities = get_bright_data_service().search_opportunities(state.profile)
    return state.opportunities


# ---------------- future
@router.post("/future/generate", response_model=FutureGenerateResponse)
def future_generate():
    if state.profile is None:
        _load_demo_into_state()
    agent = get_agent()
    state.graph = agent.run_pipeline(state.profile)
    state.trace = agent.trace
    return FutureGenerateResponse(**state.graph.model_dump(), trace=state.trace)


@router.get("/agent/trace", response_model=AgentTrace)
def agent_trace():
    agent = get_agent()
    steps = agent.trace or state.trace
    return AgentTrace(agent="FutureNavigatorAgent", framework="AWS Strands Agents", model=agent.model_id, tools=list(agent.trace_payload()["tools"]), steps=steps)


@router.get("/future", response_model=FutureGraph)
def future_get():
    if state.graph is None:
        raise HTTPException(status_code=404, detail="No scenario map yet. Call POST /api/future/generate or POST /api/demo/load.")
    return state.graph


@router.post("/future/simulate", response_model=SimulationResult)
def future_simulate(req: SimulateRequest):
    graph = req.graph or state.graph
    if graph is None:
        raise HTTPException(status_code=400, detail="No graph provided and none generated yet. Call POST /api/future/generate first.")
    if req.change.change_type in ("increase_time", "decrease_time"):
        try:
            h = float(req.change.value) if req.change.value is not None else 1.0
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="value must be a number of hours for increase_time/decrease_time")
        if h < 0 or h > 40:
            raise HTTPException(status_code=422, detail="hours must be between 0 and 40")
    if req.change.change_type == "change_priority" and str(req.change.value).lower() not in ("high", "low"):
        raise HTTPException(status_code=422, detail="value must be 'high' or 'low' for change_priority")
    try:
        out = get_agent().simulate(graph, req.change)
        state.trace = get_agent().trace
        return out
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ---------------- plan
@router.post("/plan/generate", response_model=ActionPlan)
def plan_generate(req: PlanRequest):
    by_id = {n.id for n in req.graph.nodes}
    unknown = [i for i in req.path_node_ids if i not in by_id]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown node ids in path: {unknown}")
    plan = get_agent().plan(req.graph, req.path_node_ids)
    state.trace = get_agent().trace
    return plan


# ---------------- demo
@router.get("/demo/reset")
def demo_reset():
    state.reset()
    get_brain_service().reset()
    return {"status": "reset", "demo_mode": settings.DEMO_MODE}


@router.post("/demo/load")
def demo_load():
    _load_demo_into_state()
    assert state.graph is not None and state.profile is not None
    return {
        "status": "loaded",
        "persona": state.profile.summary.split(" is ")[0] if state.profile and state.profile.summary else "Aditya Dwivedi",
        "profile": state.profile.model_dump(),
        "graph": state.graph.model_dump(),
        "opportunities": [o.model_dump() for o in state.opportunities],
        "calendar": [e.model_dump() for e in state.calendar],
        "brain_mode": get_brain_service().mode,
    }
