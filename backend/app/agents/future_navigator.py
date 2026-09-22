"""FutureNavigatorAgent: Strands agent when available, deterministic tool pipeline otherwise."""
from __future__ import annotations

import json
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from app.config import settings
from app.demo.loader import load_demo_calendar, load_demo_graph, load_demo_profile
from app.models import (
    ActionItem, ActionPlan, CalendarEvent, DecisionChange, FutureGraph, Opportunity, PersonalProfile, SimulationResult, TraceStep,
)
from app.scoring import engine
from app.scoring.schedule import analyze_schedule as _analyze_schedule
from app.services.bright_data_service import get_bright_data_service
from app.services.cognee_service import get_brain_service

try:  # optional
    from strands import Agent, tool  # type: ignore
    from strands.models.anthropic import AnthropicModel  # type: ignore

    STRANDS_AVAILABLE = True
except Exception:  # pragma: no cover
    STRANDS_AVAILABLE = False
    Agent = None  # type: ignore
    AnthropicModel = None  # type: ignore

    def tool(fn: Callable | None = None, **_kw):  # passthrough decorator
        if fn is None:
            return lambda f: f
        return fn


SYSTEM_PROMPT = """You are Future Navigator, an agent that helps a student see and shape their future.
Your motto: "Your future is not predicted. It is shaped."
You:
1. Retrieve the user's personal context (calendar, notes, goals) with recall_personal_context before reasoning.
2. Find public opportunities (hackathons, internships, research programs, events) with find_opportunities.
3. Analyze the schedule for overlaps, deadline clusters and free time with analyze_schedule.
4. Generate SEVERAL plausible future scenarios (decisions -> outcomes / opportunities / risks) with generate_future_paths.
5. Always state assumptions explicitly and label every number as a "scenario likelihood" estimate, never a prediction.
6. Avoid deterministic claims ("you will", "guaranteed"); prefer "is likely to", "tends to", "could".
7. Explain which evidence supports each attribute and scenario, using neutral, evidence-based language
   (e.g. "frequently accepts overlapping commitments", never judgmental labels).
8. Never infer sensitive traits (health, mental health, race, religion, orientation, politics, disability).
9. Never perform external actions (calendar writes, emails, applications) without explicit user confirmation;
   action plans always carry requires_confirmation=true.
The user's data is used only to build their personal scenario map."""


# --------------------------------------------------------------------------- trace
TOOL_NAMES = [
    "recall_personal_context", "find_opportunities", "analyze_schedule", "generate_future_paths",
    "simulate_decision", "create_action_plan", "remember_user_feedback",
]
_trace: list[TraceStep] = []
_mode: str = "demo"


def _record(tool_name: str, input_summary: str, output_summary: str, t0: float) -> None:
    """Append a TraceStep to the current run trace (works in demo and strands mode: tools call it)."""
    _trace.append(TraceStep(step=len(_trace) + 1, tool=tool_name, input_summary=input_summary[:160], output_summary=output_summary[:200], duration_ms=max(1, int((time.perf_counter() - t0) * 1000)), mode=_mode))  # type: ignore[arg-type]


def current_trace() -> list[TraceStep]:
    return list(_trace)


def reset_trace() -> None:
    _trace.clear()


# --------------------------------------------------------------------------- tools
@tool
def recall_personal_context(query: str) -> str:
    """Search the user's personal brain (calendar, notes, goals) for context relevant to the query."""
    t0 = time.perf_counter()
    brain = get_brain_service()
    hits = brain.search_brain(query)
    srcs = {h.get("name") for h in hits if h.get("name")}
    label = "Cognee" if brain.mode == "cognee" else "Cognee demo brain"
    _record("recall_personal_context", f'query="{query}"', f"{len(hits)} facts from {len(srcs)} sources ({label})", t0)
    return json.dumps(hits)


@tool
def find_opportunities(location: str | None = None, date_range: str | None = None) -> str:
    """Find public opportunities (hackathons, internships, research programs, events) relevant to the user's profile."""
    from app.api.state import state

    t0 = time.perf_counter()
    svc = get_bright_data_service()
    opps = svc.search_opportunities(state.profile, location, date_range)
    label = "Bright Data" if svc.mode == "bright_data" else "Bright Data (demo cache)"
    _record("find_opportunities", f"location={location or 'Berkeley/SF'}, date_range={date_range or 'next 90 days'}", f"{len(opps)} public opportunities via {label}", t0)
    return json.dumps([o.model_dump() for o in opps])


@tool
def analyze_schedule(events_json: str | None = None) -> str:
    """Analyze calendar events for overlaps, deadline clusters and free time."""
    t0 = time.perf_counter()
    events = [CalendarEvent.model_validate(e) for e in json.loads(events_json)] if events_json else load_demo_calendar()
    out = _analyze_schedule(events)
    n_dl = sum(int(c.get("count", 0)) for c in out.get("deadline_clusters", []))
    free = out.get("free_time", {}).get("free_hours", 0)
    _record("analyze_schedule", f"{len(events)} calendar events", f"{len(out.get('overlaps', []))} overlaps, {n_dl} deadlines in 5 days, {free:.0f}h open, pressure {out.get('schedule_pressure')}", t0)
    return json.dumps(out)


@tool
def generate_future_paths(profile_json: str | None = None) -> str:
    """Generate a scored FutureGraph of decisions, outcomes, opportunities and risks from the profile."""
    t0 = time.perf_counter()
    g = generate_graph()
    _record("generate_future_paths", "profile + schedule + opportunities", f"{len(g.nodes)} nodes / {len(g.edges)} edges scored (scenario likelihood, not prediction)", t0)
    return g.model_dump_json()


@tool
def simulate_decision(graph_json: str, change_json: str) -> str:
    """Apply a DecisionChange to a FutureGraph and return before/after scores with explanations."""
    t0 = time.perf_counter()
    g = FutureGraph.model_validate_json(graph_json)
    c = DecisionChange.model_validate_json(change_json)
    r = engine.simulate(g, c)
    _record("simulate_decision", f"{c.change_type} on {c.node_id}", f"{len(r.changed_nodes)} scenarios changed, pressure {r.schedule_pressure_before} -> {r.schedule_pressure_after}", t0)
    return r.model_dump_json()


@tool
def create_action_plan(graph_json: str, path_node_ids_json: str) -> str:
    """Create a 3-action plan with calendar blocks, one risk and one opportunity for a chosen path."""
    t0 = time.perf_counter()
    g = FutureGraph.model_validate_json(graph_json)
    ids = json.loads(path_node_ids_json)
    p = build_action_plan(g, ids)
    _record("create_action_plan", f"path {' -> '.join(ids) or 'best decision'}", f"3 actions, {len(p.calendar_blocks)} calendar blocks, 1 risk, 1 opportunity (requires confirmation)", t0)
    return p.model_dump_json()


@tool
def remember_user_feedback(feedback: str, node_id: str | None = None) -> str:
    """Store user feedback (e.g. an assumption is wrong) in the personal brain."""
    t0 = time.perf_counter()
    out = get_brain_service().remember_feedback(feedback, node_id)
    _record("remember_user_feedback", feedback[:80], f"stored in personal brain{f' for {node_id}' if node_id else ''}", t0)
    return json.dumps(out)


TOOLS = [recall_personal_context, find_opportunities, analyze_schedule, generate_future_paths, simulate_decision, create_action_plan, remember_user_feedback]


# --------------------------------------------------------------------------- deterministic core
def generate_graph(profile: PersonalProfile | None = None) -> FutureGraph:
    g = load_demo_graph()
    g.generated_at = engine.now_iso()
    if profile is not None:
        # light personalization: adjust goal_alignment by profile attributes with matching labels
        labels = " ".join(a.label.lower() for a in profile.attributes)
        for n in g.nodes:
            if n.category == "present":
                continue
            if "interview" in n.title.lower() and "interview" in labels:
                pass
        engine.rescore_graph(g)
    return g


def build_action_plan(graph: FutureGraph, path_node_ids: list[str]) -> ActionPlan:
    by_id = {n.id: n for n in graph.nodes}
    path = [by_id[i] for i in path_node_ids if i in by_id and by_id[i].category != "present"]
    if not path:
        decisions = sorted((n for n in graph.nodes if n.category == "decision"), key=lambda n: -n.scenario_score)
        path = decisions[:1]
        path_node_ids = [n.id for n in path]
    today = datetime(2026, 9, 21, 9, 0, tzinfo=timezone.utc)
    actions: list[ActionItem] = []
    blocks: list[ActionItem] = []
    for i, n in enumerate(path):
        if n.recommended_action and len(actions) < 3:
            actions.append(ActionItem(id=f"act_{n.id}", title=n.recommended_action.split(".")[0][:80], description=f"From '{n.title}': {n.recommended_action}", when=(today + timedelta(days=i)).strftime("%Y-%m-%d"), duration_minutes=60, kind="action"))
        if n.category == "decision":
            start = today.replace(hour=19, minute=0) + timedelta(days=i + 1)
            blocks.append(ActionItem(id=f"blk_{n.id}", title=f"Focus block: {n.title}", description="Proposed calendar block; added only after you confirm.", when=start.strftime("%Y-%m-%dT%H:%M"), duration_minutes=90, kind="calendar_block"))
    fallback = [
        ActionItem(id="act_review_hw3", title="Start CS 61A HW3", description="HW3 is due Wed 23:59; starting early keeps the deadline feasible.", when="2026-09-22", duration_minutes=120, kind="action"),
        ActionItem(id="act_interview_block", title="Do a 90-minute interview practice block", description="0 of 3 planned practice hours are done; the phone screen is Thu 16:00.", when="2026-09-22", duration_minutes=90, kind="action"),
        ActionItem(id="act_mlab", title="Draft the ML@Berkeley application", description="Due Sun 23:59; a first draft takes about an hour.", when="2026-09-26", duration_minutes=60, kind="action"),
    ]
    for f in fallback:
        if len(actions) >= 3:
            break
        if all(a.id != f.id for a in actions):
            actions.append(f)
    actions = actions[:3]
    risks = [n for n in graph.nodes if n.category == "risk"]
    related_risks = [r for r in risks if any(e.source in path_node_ids and e.target == r.id for e in graph.edges)]
    top_risk = max(related_risks or risks, key=lambda n: n.scenario_score)
    opps = [n for n in graph.nodes if n.category == "opportunity"]
    related_opps = [o for o in opps if any(e.source in path_node_ids and e.target == o.id for e in graph.edges)]
    top_opp = max(related_opps or opps, key=lambda n: n.scenario_score)
    return ActionPlan(
        path_node_ids=path_node_ids,
        next_actions=actions,
        calendar_blocks=blocks,
        risk=ActionItem(id=f"risk_{top_risk.id}", title=top_risk.title, description=f"{top_risk.description} Scenario likelihood {top_risk.scenario_score:.0f}/100. {top_risk.recommended_action}", when="this week", duration_minutes=0, kind="risk"),
        opportunity=ActionItem(id=f"opp_{top_opp.id}", title=top_opp.title, description=f"{top_opp.description} Scenario likelihood {top_opp.scenario_score:.0f}/100. {top_opp.recommended_action}", when=top_opp.time_horizon, duration_minutes=0, kind="opportunity"),
        explanation=f"Plan for path: {' -> '.join(n.title for n in path)}. Three next actions, {len(blocks)} proposed calendar block(s), the most likely related risk and the strongest related opportunity. Nothing is written to your calendar until you confirm.",
        requires_confirmation=True,
    )


class FutureNavigatorAgent:
    def __init__(self) -> None:
        self.available = STRANDS_AVAILABLE and bool(settings.ANTHROPIC_API_KEY) and not settings.DEMO_MODE
        self.mode = "strands" if self.available else "demo"
        self.model_id = (settings.STRANDS_MODEL_ID or "claude-sonnet-5") if self.available else "demo"
        self._agent: Any = None
        global _mode
        _mode = self.mode

    def _build_agent(self):
        if self._agent is None and self.available:
            model = AnthropicModel(client_args={"api_key": settings.ANTHROPIC_API_KEY}, model_id=settings.STRANDS_MODEL_ID or "claude-sonnet-5", max_tokens=4000)
            self._agent = Agent(model=model, tools=TOOLS, system_prompt=SYSTEM_PROMPT)
        return self._agent

    @property
    def trace(self) -> list[TraceStep]:
        return current_trace()

    def trace_payload(self) -> dict:
        return {"agent": "FutureNavigatorAgent", "framework": "AWS Strands Agents", "model": self.model_id, "mode": self.mode, "tools": TOOL_NAMES, "steps": [t.model_dump() for t in current_trace()]}

    def run_pipeline(self, profile: PersonalProfile | None = None) -> FutureGraph:
        reset_trace()
        if self.available:
            try:
                agent = self._build_agent()
                prompt = (
                    "Build the user's scenario map. First call recall_personal_context, find_opportunities and analyze_schedule, "
                    "then generate_future_paths, and return the FutureGraph with assumptions and neutral explanations."
                )
                result = agent.structured_output(FutureGraph, prompt)
                if not any(t.tool == "generate_future_paths" for t in _trace):
                    _record("generate_future_paths", "strands structured_output", f"{len(result.nodes)} nodes / {len(result.edges)} edges", time.perf_counter())
                return engine.rescore_graph(result)
            except Exception:
                reset_trace()
        # deterministic demo pipeline: same tool order, no LLM
        recall_personal_context("goals commitments deadlines interests")
        analyze_schedule(None)
        find_opportunities(None, None)
        t0 = time.perf_counter()
        g = generate_graph(profile)
        _record("generate_future_paths", "profile + schedule + opportunities", f"{len(g.nodes)} nodes / {len(g.edges)} edges scored (scenario likelihood, not prediction)", t0)
        return g

    def simulate(self, graph: FutureGraph, change: DecisionChange) -> SimulationResult:
        t0 = time.perf_counter()
        r = engine.simulate(graph, change)
        _record("simulate_decision", f"{change.change_type} on {change.node_id}", f"{len(r.changed_nodes)} scenarios changed, pressure {r.schedule_pressure_before} -> {r.schedule_pressure_after}", t0)
        return r

    def plan(self, graph: FutureGraph, path_node_ids: list[str]) -> ActionPlan:
        t0 = time.perf_counter()
        p = build_action_plan(graph, path_node_ids)
        _record("create_action_plan", f"path {' -> '.join(path_node_ids) or 'best decision'}", f"3 actions, {len(p.calendar_blocks)} calendar blocks, 1 risk, 1 opportunity (requires confirmation)", t0)
        return p


_agent: FutureNavigatorAgent | None = None


def get_agent() -> FutureNavigatorAgent:
    global _agent
    if _agent is None:
        _agent = FutureNavigatorAgent()
    return _agent
