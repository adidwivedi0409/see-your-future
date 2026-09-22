"""Deterministic scenario scoring + simulation.

Must stay identical to frontend/src/utils/scoring.ts.
Scores are "scenario likelihood" estimates, never predictions.
"""
from __future__ import annotations

import copy
from collections import deque
from datetime import datetime, timezone
from typing import Iterable

from app.models import (
    ChangedNode,
    DecisionChange,
    FutureGraph,
    FutureNode,
    ScoreFactor,
    SimulationResult,
)

FACTOR_NAMES: list[str] = [
    "interest_alignment",
    "goal_alignment",
    "available_time",
    "existing_preparation",
    "deadline_feasibility",
    "opportunity_relevance",
    "user_commitment",
    "schedule_conflict_penalty",
    "workload_penalty",
]

DEFAULT_WEIGHTS: dict[str, float] = {
    "interest_alignment": 0.20,
    "goal_alignment": 0.20,
    "available_time": 0.15,
    "existing_preparation": 0.15,
    "deadline_feasibility": 0.10,
    "opportunity_relevance": 0.10,
    "user_commitment": 0.10,
    "schedule_conflict_penalty": -0.10,
    "workload_penalty": -0.10,
}

COURSEWORK_KEYWORDS = ("coursework", "hw", "assignment")


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def round_half_up(x: float) -> int:
    """JS Math.round semantics (round half toward +inf) so TS and Python agree."""
    import math

    return int(math.floor(x + 0.5 + 1e-9))  # epsilon guards 42.4999999 float noise (matches TS)


def compute_score(
    values: dict[str, float],
    weights: dict[str, float] | None = None,
    assumptions: Iterable[str] | None = None,
) -> dict:
    """Return {score, components, weights, assumptions, explanation}."""
    w = dict(DEFAULT_WEIGHTS)
    if weights:
        w.update(weights)
    components = []
    raw = 0.0
    for name in FACTOR_NAMES:
        value = float(values.get(name, 0.0))
        contribution = w[name] * value
        raw += contribution
        components.append({"name": name, "value": value, "weight": w[name], "contribution": round(contribution, 4)})
    score = int(clamp(round_half_up(raw * 100), 0, 100))
    positives = sorted((c for c in components if c["weight"] > 0), key=lambda c: -c["contribution"])[:2]
    penalties = [c for c in components if c["weight"] < 0 and c["value"] > 0]
    expl = (
        f"Scenario likelihood {score}/100. Strongest support: "
        + ", ".join(f"{c['name'].replace('_', ' ')} ({c['value']:.2f})" for c in positives)
    )
    if penalties:
        expl += "; held back by " + ", ".join(
            f"{c['name'].replace('_', ' ')} ({c['value']:.2f})" for c in penalties
        )
    expl += ". This is an estimate based on the assumptions shown, not a prediction."
    return {
        "score": score,
        "components": components,
        "weights": w,
        "assumptions": list(assumptions or []),
        "explanation": expl,
    }


def factors_to_values(factors: list[ScoreFactor]) -> dict[str, float]:
    return {f.name: f.value for f in factors}


def score_node(node: FutureNode) -> FutureNode:
    values = factors_to_values(node.score_factors)
    weights = {f.name: f.weight for f in node.score_factors} or None
    result = compute_score(values, weights, node.assumptions)
    node.scenario_score = result["score"]
    if not node.explanation or node.explanation.startswith("Scenario likelihood"):
        node.explanation = result["explanation"]
    return node


def _factor_value(node: FutureNode, name: str) -> float:
    for f in node.score_factors:
        if f.name == name:
            return f.value
    return 0.0


def schedule_pressure(nodes: list[FutureNode]) -> str:
    pool = [n for n in nodes if n.category != "present"] or nodes
    if not pool:
        return "Low"
    avg = sum(_factor_value(n, "workload_penalty") for n in pool) / len(pool)
    if avg < 0.35:
        return "Low"
    if avg < 0.6:
        return "Medium"
    return "High"


def rescore_graph(graph: FutureGraph) -> FutureGraph:
    for n in graph.nodes:
        if n.category == "present":
            n.scenario_score = 100
            continue
        score_node(n)
    graph.schedule_pressure = schedule_pressure(graph.nodes)  # type: ignore[assignment]
    return graph


def descendants(graph: FutureGraph, node_id: str) -> list[str]:
    adj: dict[str, list[str]] = {}
    for e in graph.edges:
        adj.setdefault(e.source, []).append(e.target)
    seen: list[str] = []
    q = deque(adj.get(node_id, []))
    while q:
        cur = q.popleft()
        if cur in seen or cur == node_id:
            continue
        seen.append(cur)
        q.extend(adj.get(cur, []))
    return seen


def is_coursework(node: FutureNode) -> bool:
    t = node.title.lower()
    return any(k in t for k in COURSEWORK_KEYWORDS)


class _Delta:
    """Records factor changes per node for explanations."""

    def __init__(self) -> None:
        self.changes: dict[str, dict[str, tuple[float, float]]] = {}

    def apply(self, node: FutureNode, name: str, delta: float | None = None, set_to: float | None = None) -> None:
        for f in node.score_factors:
            if f.name == name:
                before = f.value
                new = set_to if set_to is not None else before + (delta or 0.0)
                f.value = clamp(new, 0.0, 1.0)
                if abs(f.value - before) > 1e-9:
                    self.changes.setdefault(node.id, {})[name] = (before, f.value)
                return
        # factor missing: create it
        before = 0.0
        new = set_to if set_to is not None else (delta or 0.0)
        node.score_factors.append(ScoreFactor(name=name, value=clamp(new, 0, 1), weight=DEFAULT_WEIGHTS[name]))
        if abs(node.score_factors[-1].value - before) > 1e-9:
            self.changes.setdefault(node.id, {})[name] = (before, node.score_factors[-1].value)


def _hours(change: DecisionChange) -> float:
    try:
        return float(change.value) if change.value is not None else 1.0
    except (TypeError, ValueError):
        return 1.0


def simulate(graph: FutureGraph, change: DecisionChange) -> SimulationResult:
    before = copy.deepcopy(graph)
    rescore_graph(before)
    after = copy.deepcopy(before)
    by_id = {n.id: n for n in after.nodes}
    if change.node_id not in by_id:
        raise ValueError(f"Unknown node_id '{change.node_id}'")
    target = by_id[change.node_id]
    desc_ids = descendants(after, target.id)
    desc = [by_id[i] for i in desc_ids if i in by_id]
    d = _Delta()
    ct = change.change_type

    if ct == "choose":
        d.apply(target, "user_commitment", set_to=1.0)
        for n in desc:
            d.apply(n, "user_commitment", delta=0.15)
    elif ct == "reject":
        d.apply(target, "user_commitment", set_to=0.0)
        for n in desc:
            d.apply(n, "user_commitment", delta=-0.3)
    elif ct in ("increase_time", "decrease_time"):
        h = _hours(change)
        sign = 1.0 if ct == "increase_time" else -1.0
        d.apply(target, "existing_preparation", delta=sign * 0.06 * h)
        d.apply(target, "available_time", delta=-sign * 0.04 * h)
        d.apply(target, "workload_penalty", delta=sign * 0.05 * h)
        # Time invested in a decision flows into its outcomes/risks.
        for n in desc:
            d.apply(n, "existing_preparation", delta=sign * 0.20 * h)
            d.apply(n, "user_commitment", delta=sign * 0.20 * h)
            d.apply(n, "deadline_feasibility", delta=sign * 0.10 * h)
        # Sibling coursework nodes lose that time.
        excluded = {target.id, *desc_ids}
        for n in after.nodes:
            if n.id in excluded or n.category == "present" or not is_coursework(n):
                continue
            d.apply(n, "available_time", delta=-sign * 0.02 * h)
            d.apply(n, "workload_penalty", delta=sign * 0.05 * h)
            d.apply(n, "deadline_feasibility", delta=-sign * 0.05 * h)
    elif ct == "add_prep_task":
        d.apply(target, "existing_preparation", delta=0.15)
    elif ct == "change_priority":
        v = str(change.value or "high").lower()
        d.apply(target, "goal_alignment", delta=0.15 if v == "high" else -0.15)
    elif ct == "mark_assumption_incorrect":
        v = str(change.value or "")
        target.assumptions = [a for a in target.assumptions if a != v]
        after.assumptions = [a for a in after.assumptions if a != v]
        d.apply(target, "deadline_feasibility", delta=-0.1)
    elif ct == "move_event":
        d.apply(target, "schedule_conflict_penalty", set_to=0.0)
    else:  # pragma: no cover
        raise ValueError(f"Unsupported change_type '{ct}'")

    rescore_graph(after)
    before_by_id = {n.id: n for n in before.nodes}
    changed: list[ChangedNode] = []
    for n in after.nodes:
        b = before_by_id[n.id]
        moved = d.changes.get(n.id, {})
        if b.scenario_score == n.scenario_score and not moved:
            continue
        parts = [f"{k.replace('_', ' ')} {v0:.2f} -> {v1:.2f} ({v1 - v0:+.2f})" for k, (v0, v1) in moved.items()]
        changed.append(
            ChangedNode(
                node_id=n.id,
                title=n.title,
                before_score=b.scenario_score,
                after_score=n.scenario_score,
                explanation=(
                    f"Scenario likelihood {b.scenario_score:.0f} -> {n.scenario_score:.0f}. Factors moved: "
                    + ("; ".join(parts) if parts else "none")
                    + "."
                ),
            )
        )
    verb = {
        "choose": "choosing", "reject": "rejecting", "increase_time": f"adding {_hours(change):g}h to",
        "decrease_time": f"removing {_hours(change):g}h from", "move_event": "moving the event for",
        "add_prep_task": "adding a prep task to", "change_priority": "changing priority of",
        "mark_assumption_incorrect": "correcting an assumption on",
    }[ct]
    summary = (
        f"Simulated {verb} '{target.title}': {len(changed)} node(s) changed; schedule pressure "
        f"{before.schedule_pressure} -> {after.schedule_pressure}. Estimates only, not predictions."
    )
    return SimulationResult(
        before=before,
        after=after,
        changed_nodes=changed,
        schedule_pressure_before=before.schedule_pressure,
        schedule_pressure_after=after.schedule_pressure,
        explanation=summary,
    )


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
