"""In-memory application state singleton."""
from __future__ import annotations

from app.models import CalendarEvent, FutureGraph, Opportunity, PersonalProfile, PersonalSource, TraceStep


class AppState:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.profile: PersonalProfile | None = None
        self.graph: FutureGraph | None = None
        self.opportunities: list[Opportunity] = []
        self.calendar: list[CalendarEvent] = []
        self.sources: list[PersonalSource] = []
        self.notes: list[str] = []
        self.brain_built: bool = False
        self.demo_loaded: bool = False
        self.trace: list[TraceStep] = []


state = AppState()
