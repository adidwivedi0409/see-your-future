"""Shared data contract (mirrors frontend/src/types/index.ts, snake_case everywhere)."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

SourceType = Literal["calendar", "note", "document", "upload", "demo"]
EventKind = Literal["class", "deadline", "interview", "event", "personal", "study"]
AttributeKind = Literal["commitment", "goal", "interest", "strength", "habit", "constraint", "overload", "growth"]
OpportunityType = Literal["hackathon", "internship", "research", "scholarship", "event", "course"]
NodeCategory = Literal["present", "decision", "opportunity", "outcome", "risk"]
TimeHorizon = Literal["now", "days", "weeks", "months", "years"]
EdgeKind = Literal["leads_to", "enables", "risks"]
SchedulePressure = Literal["Low", "Medium", "High"]
ChangeType = Literal[
    "choose", "reject", "increase_time", "decrease_time", "move_event",
    "add_prep_task", "change_priority", "mark_assumption_incorrect",
]
ActionKind = Literal["action", "calendar_block", "risk", "opportunity"]
BrainMode = Literal["cognee", "demo"]

SCENARIO_DISCLAIMER = (
    "An estimate derived from your current commitments, preferences, available opportunities, "
    "and the assumptions shown here. This is not a prediction or guarantee."
)


class PersonalSource(BaseModel):
    id: str
    name: str
    type: SourceType
    date: Optional[str] = None
    excerpt: str = ""
    record_id: str


class CalendarEvent(BaseModel):
    id: str
    title: str
    start: str
    end: str
    kind: EventKind
    location: Optional[str] = None
    source_id: str


class PersonalEvidence(BaseModel):
    id: str
    text: str
    source_id: str
    date: Optional[str] = None


class ProfileAttribute(BaseModel):
    id: str
    kind: AttributeKind
    label: str
    confidence: float = Field(ge=0, le=1)
    evidence_ids: list[str] = []
    source_ids: list[str] = []
    disclaimer: str = SCENARIO_DISCLAIMER


class TimeAllocation(BaseModel):
    category: str
    hours: float


class PersonalProfile(BaseModel):
    user_id: str
    summary: str
    weekly_commitment_hours: float
    time_allocation: list[TimeAllocation] = []
    upcoming_deadlines: list[CalendarEvent] = []
    attributes: list[ProfileAttribute] = []
    evidence: list[PersonalEvidence] = []
    sources: list[PersonalSource] = []
    overload_warnings: list[str] = []
    brain_mode: BrainMode = "demo"


class Opportunity(BaseModel):
    id: str
    title: str
    type: OpportunityType
    organization: str
    description: str = ""
    location: str = ""
    start_date: Optional[str] = None
    deadline: Optional[str] = None
    url: str = ""
    source: str = ""
    relevance_score: float = Field(default=0, ge=0, le=100)
    relevance_reasons: list[str] = []
    is_demo: bool = False


class ScoreFactor(BaseModel):
    name: str
    value: float = Field(ge=0, le=1)
    weight: float = Field(ge=-1, le=1)
    reason: str = ""


class FutureNode(BaseModel):
    id: str
    title: str
    description: str = ""
    category: NodeCategory
    time_horizon: TimeHorizon
    scenario_score: float = Field(default=0, ge=0, le=100)
    score_factors: list[ScoreFactor] = []
    positive_effects: list[str] = []
    tradeoffs: list[str] = []
    assumptions: list[str] = []
    evidence_ids: list[str] = []
    opportunity_ids: list[str] = []
    recommended_action: str = ""
    explanation: str = ""


class FutureEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None
    kind: EdgeKind = "leads_to"


class FutureGraph(BaseModel):
    id: str
    generated_at: str
    root_id: str
    nodes: list[FutureNode]
    edges: list[FutureEdge]
    schedule_pressure: SchedulePressure = "Medium"
    assumptions: list[str] = []


class DecisionChange(BaseModel):
    node_id: str
    change_type: ChangeType
    value: Optional[float | str] = None
    note: Optional[str] = None


class ChangedNode(BaseModel):
    node_id: str
    title: str
    before_score: float
    after_score: float
    explanation: str


class SimulationResult(BaseModel):
    before: FutureGraph
    after: FutureGraph
    changed_nodes: list[ChangedNode] = []
    schedule_pressure_before: SchedulePressure
    schedule_pressure_after: SchedulePressure
    explanation: str = ""


class ActionItem(BaseModel):
    id: str
    title: str
    description: str = ""
    when: str
    duration_minutes: int = 0
    kind: ActionKind = "action"


class ActionPlan(BaseModel):
    path_node_ids: list[str]
    next_actions: list[ActionItem] = Field(min_length=3, max_length=3)
    calendar_blocks: list[ActionItem] = []
    risk: ActionItem
    opportunity: ActionItem
    explanation: str = ""
    requires_confirmation: Literal[True] = True


# ---- request/response helpers ----
class SearchRequest(BaseModel):
    query: str


class OpportunitySearchRequest(BaseModel):
    location: Optional[str] = None
    date_range: Optional[str] = None


class SimulateRequest(BaseModel):
    graph: Optional[FutureGraph] = None
    change: DecisionChange


class PlanRequest(BaseModel):
    graph: FutureGraph
    path_node_ids: list[str] = []


class BuildResponse(BaseModel):
    status: str
    steps: list[str]
    brain_mode: BrainMode
    ingested_sources: int = 0


# ---- agent trace + brain graph (appended) ----
TraceMode = Literal["demo", "strands"]
BrainNodeKind = Literal["source", "event", "goal", "interest", "attribute", "opportunity"]


class TraceStep(BaseModel):
    step: int
    tool: str
    input_summary: str = ""
    output_summary: str = ""
    duration_ms: int = 0
    mode: TraceMode = "demo"


class AgentTrace(BaseModel):
    agent: str = "FutureNavigatorAgent"
    framework: str = "AWS Strands Agents"
    model: str = "demo"
    tools: list[str] = []
    steps: list[TraceStep] = []


class FutureGenerateResponse(FutureGraph):
    trace: list[TraceStep] = []


class BrainGraphNode(BaseModel):
    id: str
    label: str
    kind: BrainNodeKind


class BrainGraphEdge(BaseModel):
    source: str
    target: str
    relation: str = "related_to"


class BrainGraphResponse(BaseModel):
    mode: BrainMode = "demo"
    nodes: list[BrainGraphNode] = []
    edges: list[BrainGraphEdge] = []
