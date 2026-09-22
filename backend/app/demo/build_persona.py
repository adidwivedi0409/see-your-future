"""Deterministic builder for the demo persona: Aditya Dwivedi (real user data).

Reads Aditya's real tracker files (read-only, skipping any that are missing),
extracts short excerpts, and rewrites demo_data.json + opportunities.json.

The FutureGraph node ids, edges, categories, time horizons and every
score_factors value are preserved exactly from the existing demo_data.json;
only the human-readable text (titles, descriptions, effects, tradeoffs,
assumptions, evidence/opportunity links, recommended actions) is replaced.

Run:  python3 backend/app/demo/build_persona.py
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
HOME = Path.home()
CLAUDE = HOME / "claude"
MEM = HOME / ".claude/projects/-Users-adityadwivedi-claude/memory"
DL = HOME / "Downloads"

TODAY = "2026-09-21"
DISCLAIMER = (
    "An estimate derived from your current commitments, preferences, available "
    "opportunities, and the assumptions shown here. This is not a prediction or guarantee."
)
BD = "Bright Data (demo cache — from Aditya's trackers)"


def read(path: Path, limit: int = 200_000) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")[:limit]
    except Exception:
        return ""


def pdf_text(path: Path, pages: int = 1) -> str:
    try:
        from pypdf import PdfReader  # type: ignore

        r = PdfReader(str(path))
        return "\n".join((r.pages[i].extract_text() or "") for i in range(min(pages, len(r.pages))))
    except Exception:
        return ""


def excerpt(text: str, pattern: str, fallback: str, n: int = 200) -> str:
    """First line matching pattern (regex, case-insensitive), trimmed to n chars."""
    for line in text.splitlines():
        if re.search(pattern, line, re.I):
            line = re.sub(r"\s+", " ", line.replace("|", " ").replace("*", "")).strip()
            return line[:n]
    return fallback[:n]


def first_line(text: str, fallback: str, n: int = 200) -> str:
    for line in text.splitlines():
        s = line.strip("# ").strip()
        if s:
            return s[:n]
    return fallback[:n]


def pdf_present(name: str) -> bool:
    return (DL / name).exists()


# ---------------------------------------------------------------- sources
events = read(CLAUDE / "events/README.md")
sf_hacks = read(CLAUDE / "events/research/03-sf-hackathons.md")
sf_net = read(CLAUDE / "events/research/05-sf-startup-networking.md")
intern = read(CLAUDE / "internships/README.md")
intern_log = read(CLAUDE / "internships/log.md")
clubs = read(CLAUDE / "clubs/README.md")
clubs_log = read(CLAUDE / "clubs/log.md")
startups = read(CLAUDE / "startups/README.md")
research = read(CLAUDE / "research/berkeley-phd-targets.md")
reading = read(CLAUDE / "productivity/reading-list.md")
prod = read(CLAUDE / "productivity/README.md")
mem_intern = read(MEM / "internship-and-club-search-project.md")
mem_research = read(MEM / "berkeley-research-outreach.md")
mem_prod = read(MEM / "productivity-improvement-project.md")
resume = pdf_text(DL / "adidwivedi_resume1 (2).pdf")
mt1_guide = pdf_text(DL / "61a-mt1-study-guide (3).pdf")

n_companies = re.search(r"(\d+) companies", startups)
n_companies = int(n_companies.group(1)) if n_companies else 145
tier1 = re.search(r"Tier 1[^\n]*\((\d+)\)", startups)
tier1 = int(tier1.group(1)) if tier1 else 30
n_targets = len(re.findall(r"^### ", research, re.M)) or 20
n_readings = len(re.findall(r"^- \[[ x]\] \d{4}-\d{2}-\d{2}", reading, re.M)) or 60

sources = [
    {"id": "src_events", "name": "events/README.md (Bay Area events tracker)", "type": "note", "date": "2026-09-16",
     "excerpt": excerpt(events, r"Battle of the Personal Brains", "Mon 9/21 SF: SPC fireside \"-1 to Waymo\" (Dmitri Dolgov) · Battle of the Personal Brains hack, 4 PM"), "record_id": "events_readme"},
    {"id": "src_sf_hacks", "name": "events/research/03-sf-hackathons.md", "type": "note", "date": "2026-09-16",
     "excerpt": excerpt(sf_hacks, r"Battle of the Personal Brains", "Battle of the Personal Brains Hackathon, Mon Sep 21, 4-9pm, Bright Data Web Data Loft, 625 2nd St; cognee/AWS Strands/Docker"), "record_id": "events_sf_hackathons"},
    {"id": "src_internships", "name": "internships/README.md + log.md (internship tracker)", "type": "note", "date": "2026-09-21",
     "excerpt": excerpt(intern, r"Eligibility rule", "Eligibility rule: graduation year 2030. Most Summer 2027 SWE postings gate on grad year 2027/2028."), "record_id": "internship_tracker"},
    {"id": "src_clubs", "name": "clubs/README.md + log.md (club tracker)", "type": "note", "date": "2026-09-21",
     "excerpt": excerpt(clubs, r"first-year club application blitz", "First-year club application blitz; fall 2026 window roughly Aug 26 - Sep 15, 2026."), "record_id": "club_tracker"},
    {"id": "src_startups", "name": "startups/README.md (SF startup outreach list)", "type": "note", "date": "2026-08-26",
     "excerpt": f"{n_companies} companies (SkyDeck + YC), tiered; Tier 1 bullseye = {tier1} agent-eval / AI-safety / interpretability companies.", "record_id": "startups_outreach_list"},
    {"id": "src_research", "name": "research/berkeley-phd-targets.md (research outreach)", "type": "note", "date": "2026-09-11",
     "excerpt": f"{n_targets} Berkeley AI-safety / interpretability PhD students and postdocs, tiered (interp-first; safety/alignment; CHAI postdocs).", "record_id": "berkeley_research_targets"},
    {"id": "src_reading", "name": "productivity/reading-list.md", "type": "note", "date": TODAY,
     "excerpt": excerpt(prod, r"Two new articles", f"Two new articles land here every morning at 8 AM; {n_readings} readings logged."), "record_id": "productivity_reading_list"},
    {"id": "src_resume", "name": "adidwivedi_resume1.pdf", "type": "document", "date": "2026-09-01",
     "excerpt": excerpt(resume, r"sycophan", "Co-authored research on LLM interpretability and alignment: detection and mitigation of sycophantic behavior; NeurIPS CogInterp and ReliableML workshops."), "record_id": "resume_pdf"},
    {"id": "src_61a_guide", "name": "61a-mt1-study-guide.pdf", "type": "document", "date": "2026-09-20",
     "excerpt": first_line(mt1_guide, "CS 61A Midterm 1 study guide (plus 12 past MT1 exams + solutions downloaded)"), "record_id": "cs61a_mt1_guide"},
    {"id": "src_course_files", "name": "Downloads: Linear HW2.pdf, Cox Italian Renaissance Ch.1-2.pdf, yocum-2025-feature-fields.pdf", "type": "document", "date": "2026-09-20",
     "excerpt": "Linear HW2.pdf; Cox Italian Renaissance Chapters 1 & 2.pdf; yocum-2025-feature-fields.pdf; 2404.02258v1.pdf; Neural Manifold Geometry.pdf", "record_id": "downloads_course_files"},
    {"id": "src_memory", "name": "Claude memory notes (projects)", "type": "note", "date": "2026-09-11",
     "excerpt": excerpt(mem_research, r"cold-emailing", "Cold-emailing PhD students to get into an AI safety / interpretability lab as a freshman; hook is the NeurIPS sycophancy paper."), "record_id": "memory_projects"},
    {"id": "src_scheduled", "name": "Scheduled tasks (daily-internship-finder, daily-berkeley-clubs, daily-productivity-articles)", "type": "note", "date": "2026-08-24",
     "excerpt": "daily-internship-finder 8:00am; daily-berkeley-clubs 8:15am; daily-productivity-articles 8:00am.", "record_id": "scheduled_tasks"},
]

evidence = [
    {"id": "e_hackathon", "text": "Battle of the Personal Brains hackathon tonight, Mon Sep 21 16:00-21:00, Bright Data Web Data Loft, 625 2nd St SF (cognee / AWS Strands / Docker)", "source_id": "src_sf_hacks", "date": TODAY},
    {"id": "e_agent_notes", "text": "ProxyClaw AI research intern since July 2026: agent usage-log analysis, LLM-as-a-judge and safety evals", "source_id": "src_resume", "date": "2026-07-01"},
    {"id": "e_cs_courses", "text": "Current coursework evidenced by files: CS 61A (MT1 study guide + 12 past exams), Linear Algebra HW2, Italian Renaissance (Cox ch.1-2)", "source_id": "src_course_files", "date": "2026-09-20"},
    {"id": "e_hackathon_before_hw3", "text": "Hackathon ends 21:00 Monday; Linear HW2 and the Renaissance reading are both due this week", "source_id": "src_events", "date": TODAY},
    {"id": "e_late_nights", "text": "Four campaigns run in parallel: internships (daily 8:00), clubs (daily 8:15), 145-company startup list, 20-person research outreach", "source_id": "src_scheduled", "date": "2026-09-11"},
    {"id": "e_three_deadlines", "text": "This week: Linear HW2, Renaissance reading, research cold-email batch, TechCrunch volunteer app (Sep 22), BCS Summit free-registration cutoff (Sep 25)", "source_id": "src_events", "date": TODAY},
    {"id": "e_midweek", "text": "Renaissance reading due Thu; Linear HW2 due Fri 23:59 (assumed); CS 61A MT1 in ~2 weeks", "source_id": "src_course_files", "date": "2026-09-25"},
    {"id": "e_prep_zero", "text": "CS 61A MT1 study guide and past exams downloaded; no study blocks on the calendar yet", "source_id": "src_61a_guide", "date": "2026-09-20"},
    {"id": "e_interp", "text": "NeurIPS CogInterp + ReliableML workshop co-author: SAEs and linear probes on Gemma 2B/9B; gradient-masked finetuning to reduce sycophancy", "source_id": "src_resume", "date": "2025-08-01"},
    {"id": "e_goal_internship", "text": "Goal: AI/ML internship summer 2027; Jane Street FTTP already applied; grad year 2030 gates most postings", "source_id": "src_internships", "date": "2026-08-24"},
    {"id": "e_goal_project", "text": "Personal-brain agent is tonight's hackathon project; SprinklSmart shipped to 100+ users", "source_id": "src_resume", "date": TODAY},
    {"id": "e_goal_gpa", "text": "First semester at Berkeley (CDSS, class of 2030); 4.0 GPA in high school", "source_id": "src_resume", "date": "2026-08-26"},
    {"id": "e_overcommitted", "text": "Startup outreach list: 145 companies, Tier 1 = 30 agent-eval / interp companies", "source_id": "src_startups", "date": "2026-08-26"},
    {"id": "e_research_targets", "text": "Berkeley research outreach: 20 PhD/postdoc targets, top matches in feature fields, RLHF, HypotheSAEs, ICL heads", "source_id": "src_research", "date": "2026-09-11"},
    {"id": "e_reading_habit", "text": "Two curated articles (productivity + learning) every morning at 8 AM since Aug 5, 2026", "source_id": "src_reading", "date": TODAY},
    {"id": "e_grad_year", "text": "Discover Citadel, SIG, HRT Explore, Databricks: NOT ELIGIBLE as posted (grad-year 2027-2029 windows)", "source_id": "src_internships", "date": "2026-08-24"},
    {"id": "e_interp_reading", "text": "Reading yocum-2025-feature-fields.pdf, 2404.02258 and Neural Manifold Geometry alongside coursework", "source_id": "src_course_files", "date": "2026-09-20"},
    {"id": "e_spc", "text": "SPC fireside \"-1 to Waymo\" (Dmitri Dolgov) also tonight in SF, Luma approval", "source_id": "src_events", "date": TODAY},
]

attributes = [
    {"id": "attr_ai_interest", "kind": "strength", "label": "Agent evaluation experience", "confidence": 0.88,
     "evidence_ids": ["e_agent_notes", "e_hackathon", "e_goal_project"], "source_ids": ["src_resume", "src_sf_hacks"]},
    {"id": "attr_overlap", "kind": "habit", "label": "Runs several parallel outreach campaigns", "confidence": 0.9,
     "evidence_ids": ["e_late_nights", "e_overcommitted", "e_research_targets"], "source_ids": ["src_scheduled", "src_startups", "src_research"]},
    {"id": "attr_midweek", "kind": "constraint", "label": "Graduation year 2030 disqualifies many 2027 internship postings", "confidence": 0.95,
     "evidence_ids": ["e_grad_year", "e_goal_internship"], "source_ids": ["src_internships"]},
    {"id": "attr_interview_prep", "kind": "growth", "label": "Limited evidence of protected deep-work blocks for coursework", "confidence": 0.7,
     "evidence_ids": ["e_prep_zero", "e_hackathon_before_hw3", "e_midweek"], "source_ids": ["src_61a_guide", "src_events"]},
    {"id": "attr_interp", "kind": "interest", "label": "LLM interpretability & AI safety research", "confidence": 0.92,
     "evidence_ids": ["e_interp", "e_research_targets", "e_interp_reading"], "source_ids": ["src_resume", "src_research", "src_course_files"]},
    {"id": "attr_internship", "kind": "goal", "label": "AI/ML internship summer 2027 (Jane Street FTTP already applied)", "confidence": 0.9,
     "evidence_ids": ["e_goal_internship"], "source_ids": ["src_internships", "src_memory"]},
    {"id": "attr_lab_goal", "kind": "goal", "label": "Join a Berkeley AI-safety/interp lab as a first-year", "confidence": 0.88,
     "evidence_ids": ["e_research_targets", "e_interp"], "source_ids": ["src_research", "src_memory"]},
    {"id": "attr_reading", "kind": "commitment", "label": "Daily productivity + learning reading (2 articles/day)", "confidence": 0.8,
     "evidence_ids": ["e_reading_habit"], "source_ids": ["src_reading"]},
]
for a in attributes:
    a["disclaimer"] = DISCLAIMER

# ---------------------------------------------------------------- calendar
def ev(id_, title, start, end, kind, location=None, source_id="src_events"):
    return {"id": id_, "title": title, "start": start, "end": end, "kind": kind, "location": location, "source_id": source_id}

calendar = [
    ev("ev_tracker_mon", "Daily internship tracker (8:00) + club tracker (8:15)", "2026-09-21T08:00:00", "2026-09-21T08:30:00", "personal", "Scheduled tasks", "src_scheduled"),
    ev("ev_cs61a_mon", "CS 61A Lecture (assumed MWF 10-11)", "2026-09-21T10:00:00", "2026-09-21T11:00:00", "class", "Campus", "src_61a_guide"),
    ev("ev_hackathon", "Battle of the Personal Brains AI-agent hackathon", "2026-09-21T16:00:00", "2026-09-21T21:00:00", "event", "Bright Data Web Data Loft, 625 2nd St, SF", "src_sf_hacks"),
    ev("ev_spc", "SPC fireside: -1 to Waymo (Dmitri Dolgov) — conflicts with hackathon", "2026-09-21T18:00:00", "2026-09-21T19:30:00", "event", "South Park Commons, SF"),
    ev("ev_tc_volunteer", "TechCrunch Disrupt volunteer application due", "2026-09-22T23:59:00", "2026-09-22T23:59:00", "deadline", None),
    ev("ev_reading_tue", "Daily reading: 2 articles (productivity + learning)", "2026-09-22T08:00:00", "2026-09-22T08:45:00", "personal", None, "src_reading"),
    ev("ev_ai_risk_talk", "AI Risk Speaker Series: John Sherman", "2026-09-22T16:00:00", "2026-09-22T17:00:00", "event", "621 Soda-Dai"),
    ev("ev_cs61a_wed", "CS 61A Lecture (assumed MWF 10-11)", "2026-09-23T10:00:00", "2026-09-23T11:00:00", "class", "Campus", "src_61a_guide"),
    ev("ev_hw3", "Italian Renaissance reading due (Cox ch.1-2)", "2026-09-24T12:00:00", "2026-09-24T12:00:00", "deadline", None, "src_course_files"),
    ev("ev_interview", "Research cold-email batch (Berkeley interp/safety PhD targets)", "2026-09-24T16:00:00", "2026-09-24T18:00:00", "event", "Home", "src_research"),
    ev("ev_cs61a_fri", "CS 61A Lecture (assumed MWF 10-11)", "2026-09-25T10:00:00", "2026-09-25T11:00:00", "class", "Campus", "src_61a_guide"),
    ev("ev_bcs_reg", "BCS AI + Recruiting Summit free-registration cutoff", "2026-09-25T23:59:00", "2026-09-25T23:59:00", "deadline", None),
    ev("ev_hw2", "Linear Algebra HW2 due (assumed Fri 23:59)", "2026-09-25T23:59:00", "2026-09-25T23:59:00", "deadline", None, "src_course_files"),
    ev("ev_mlab_app", "EA Global NYC application deadline (students free)", "2026-09-27T23:59:00", "2026-09-27T23:59:00", "deadline", None),
    ev("ev_xr_app", "XR@Berkeley application (latest club deadline, ~Sep 21)", "2026-09-21T23:59:00", "2026-09-21T23:59:00", "deadline", None, "src_clubs"),
    ev("ev_mt1", "CS 61A Midterm 1 (assumed: first week of October — verify on course calendar)", "2026-10-05T19:00:00", "2026-10-05T21:00:00", "deadline", "Campus", "src_61a_guide"),
]
calendar.sort(key=lambda e: e["start"])

profile = {
    "user_id": "aditya",
    "summary": (
        "Aditya Dwivedi is a first-year CS student at UC Berkeley (CDSS, class of 2030) doing LLM "
        "interpretability and agent-evaluation work. This week: the Battle of the Personal Brains hackathon "
        "tonight, a Linear Algebra problem set and Renaissance reading, a research cold-email batch, four "
        "parallel outreach campaigns, and CS 61A Midterm 1 in about two weeks. Commitments total about 42 hours."
    ),
    "weekly_commitment_hours": 42,
    "time_allocation": [
        {"category": "Classes", "hours": 11},
        {"category": "Assignments", "hours": 10},
        {"category": "Midterm prep", "hours": 0},
        {"category": "Hackathon", "hours": 5},
        {"category": "Outreach campaigns", "hours": 7},
        {"category": "Research reading", "hours": 3},
        {"category": "Personal", "hours": 6},
    ],
    "upcoming_deadlines": [e for e in calendar if e["kind"] in ("deadline", "interview")],
    "attributes": attributes,
    "evidence": evidence,
    "sources": sources,
    "overload_warnings": [
        "Hackathon tonight until 21:00 plus four active outreach/application campaigns and CS 61A Midterm 1 in ~2 weeks",
        "Linear algebra HW2 and Italian Renaissance reading due the same week",
    ],
    "brain_mode": "demo",
}

# ---------------------------------------------------------------- opportunities
opportunities = [
    {"id": "opp_calhacks", "title": "Cal Hacks 13.0", "type": "hackathon", "organization": "Cal Hacks",
     "description": "Largest collegiate hackathon, $100K prizes, 2,000+ hackers. Regular apps closed Sep 20; Hack Month team-formation socials Oct 2, 9, 16.",
     "location": "Palace of Fine Arts, SF", "start_date": "2026-10-23", "deadline": "2026-09-20", "url": "https://www.calhacks.io/",
     "relevance_score": 86, "relevance_reasons": ["Matches agent-evaluation strength", "Ship the personal-brain agent further", "Free bus from BART"]},
    {"id": "opp_chai", "title": "CHAI Research Internship (Summer 2027) ❓", "type": "research", "organization": "Center for Human-Compatible AI, UC Berkeley",
     "description": "Paid AI-safety research internship, undergrads eligible. Apps expected ~Oct-Nov 2026 (❓ date not yet posted, per tracker).",
     "location": "Berkeley, CA", "start_date": "2027-06-01", "deadline": "2026-11-01", "url": "https://humancompatible.ai",
     "relevance_score": 94, "relevance_reasons": ["Directly matches interpretability & AI-safety interest", "Supports goal: join a Berkeley lab as a first-year", "No grad-year gate; on campus"]},
    {"id": "opp_step", "title": "Google STEP Internship Summer 2027", "type": "internship", "organization": "Google",
     "description": "First/second-year SWE internship. Tracker: BS early window closed Jul 24; fall cycle reopens — WATCH.",
     "location": "Mountain View, CA", "start_date": "2027-06-01", "deadline": "2026-10-15", "url": "https://buildyourfuture.withgoogle.com/programs/step",
     "relevance_score": 78, "relevance_reasons": ["One of the few programs open to a 2030 grad", "Supports goal: AI/ML internship summer 2027", "Jane Street FTTP already applied — second option"]},
    {"id": "opp_treehacks", "title": "TreeHacks 2027", "type": "hackathon", "organization": "Stanford",
     "description": "Feb 12-14, 2027; applications open ~Sep 19; flights/food/lodging covered for any enrolled college student.",
     "location": "Stanford, CA", "start_date": "2027-02-12", "deadline": "2026-11-15", "url": "https://www.treehacks.com",
     "relevance_score": 80, "relevance_reasons": ["Apply early per tracker", "Builds on tonight's agent project", "Team from o_collaborator"]},
    {"id": "opp_techweek", "title": "SF Tech Week (a16z), Oct 5-11", "type": "event", "organization": "a16z",
     "description": "Hackathons & Demos track incl. Hack Alcatraz (Cloudflare) and AI Heist Challenge (Modal x LangChain, Tue Oct 6). Popular events fill 1-2 weeks out.",
     "location": "San Francisco, CA", "start_date": "2026-10-05", "deadline": "2026-09-28", "url": "https://www.tech-week.com/calendar/sf",
     "relevance_score": 72, "relevance_reasons": ["Overlaps 145-company startup outreach list", "Same week as CS 61A Midterm 1 — limit to 1-2 events", "Apply per event"]},
    {"id": "opp_simons", "title": "Simons Institute: Trustworthy AI workshop", "type": "event", "organization": "Simons Institute, UC Berkeley",
     "description": "Oct 5-9, Calvin Lab, on campus, free, first-come seats. Hallucinations & reliable autonomy.",
     "location": "Berkeley, CA", "start_date": "2026-10-05", "deadline": "2026-10-04", "url": "https://simons.berkeley.edu/workshops/trustworthy-ai-hallucinations-reliable-autonomy",
     "relevance_score": 84, "relevance_reasons": ["Matches interpretability/safety interest", "Where Berkeley research targets will be", "Collides with Midterm 1 week"]},
    {"id": "opp_goodfire", "title": "Goodfire (interpretability lab) happy hour", "type": "event", "organization": "Goodfire",
     "description": "Wed Oct 7, 7-10 PM, SF. Interp networking; Luma approval.",
     "location": "San Francisco, CA", "start_date": "2026-10-07", "deadline": "2026-10-05", "url": "https://luma.com",
     "relevance_score": 82, "relevance_reasons": ["Tier-1 interp company on startup list", "NeurIPS sycophancy paper is the hook", "Evening after Midterm 1"]},
    {"id": "opp_neurips", "title": "NeurIPS 2026", "type": "event", "organization": "NeurIPS Foundation",
     "description": "Premier ML conference with interpretability workshops; Aditya is a 2025 CogInterp/ReliableML workshop co-author.",
     "location": "San Diego, CA", "start_date": "2026-12-06", "deadline": None, "url": "https://neurips.cc",
     "relevance_score": 66, "relevance_reasons": ["Prior workshop paper", "Requires travel funding", "After finals"]},
    {"id": "opp_anthropic_fellowship", "title": "Anthropic AI Safety Fellowship", "type": "research", "organization": "Anthropic",
     "description": "Mentored alignment research fellowship; sycophancy and interpretability topics. Listed as a standing source in internship tracker.",
     "location": "Remote / Bay Area", "start_date": "2027-01-10", "deadline": "2026-10-30", "url": "https://alignment.anthropic.com",
     "relevance_score": 76, "relevance_reasons": ["Matches sycophancy work", "No class-year gate", "Competitive; ProxyClaw evals help"]},
    {"id": "opp_mlab_info", "title": "Berkeley club recruiting: XR@Berkeley / late-window clubs", "type": "event", "organization": "Berkeley RSOs",
     "description": "Fall recruiting wall was Sep 3-15; XR@Berkeley (~Sep 21) is the last open window. ML@B, BASIS and Traders reopen in spring.",
     "location": "Berkeley, CA", "start_date": "2026-09-21", "deadline": "2026-09-21", "url": "https://berkeleygoggles.org/",
     "relevance_score": 60, "relevance_reasons": ["Club campaign already tracked daily", "Most target clubs closed; low remaining effort", "BASIS is a warmer research channel"]},
]
for o in opportunities:
    o["source"] = BD
    o["is_demo"] = True

# ---------------------------------------------------------------- graph (keep numbers)
existing = json.loads(read(HERE / "demo_data.json") or "{}")
graph = existing.get("graph")
if not graph:
    raise SystemExit("demo_data.json graph missing; cannot preserve tuned factors")

TEXT = {
    "today": dict(title="Today", description="Monday, Sep 21, 2026. Aditya's real commitments: hackathon tonight, coursework, four outreach campaigns, Midterm 1 in ~2 weeks.",
                  positive_effects=[], tradeoffs=[], assumptions=["Trackers, Downloads and memory notes are up to date", "CS 61A meets MWF 10-11 (assumed)"],
                  evidence_ids=["e_cs_courses", "e_three_deadlines", "e_late_nights"], opportunity_ids=[], recommended_action="Review the scenario map and pick a path to explore."),
    "d_hackathon": dict(title="Attend the Battle of the Personal Brains hackathon tonight", description="16:00-21:00 at Bright Data Web Data Loft, 625 2nd St SF. cognee / AWS Strands / Docker; build the personal-brain agent.",
                        positive_effects=["Hands-on agent building matches ProxyClaw eval work", "Ships the personal-brain agent (this project)"], tradeoffs=["5 hours the week Linear HW2 and the Renaissance reading are due", "Commute to SF; misses the SPC Waymo fireside"],
                        assumptions=["Hackathon ends at 21:00 as scheduled", "Linear HW2 needs about 4 more hours"], evidence_ids=["e_hackathon", "e_agent_notes", "e_goal_project", "e_spc"], opportunity_ids=["opp_calhacks", "opp_treehacks"],
                        recommended_action="Go, set a hard stop at 21:00, and block Tue 19:00-22:00 for Linear HW2."),
    "d_interview": dict(title="Prepare for CS 61A Midterm 1", description="Study guide and 12 past MT1 exams are downloaded; 0 study hours scheduled. Assumed exam: first week of October.",
                        positive_effects=["Directly protects first-semester grades", "Reduces exam-week uncertainty"], tradeoffs=["Takes time from Linear HW2 and outreach batches"],
                        assumptions=["Midterm 1 is in the first week of October (verify on the course calendar)", "3 focused hours of past exams is enough for a first pass"], evidence_ids=["e_prep_zero", "e_goal_gpa"], opportunity_ids=[],
                        recommended_action="Schedule two 90-minute past-exam blocks (fa25 + sp25 MT1) on Tue and Wed."),
    "d_research": dict(title="Send the Berkeley interpretability research cold emails", description="20 tiered PhD/postdoc targets (feature fields, RLHF, HypotheSAEs, ICL heads); hook is the NeurIPS sycophancy paper.",
                       positive_effects=["Matches interpretability & AI-safety interest", "Concrete step toward a first-year lab position"], tradeoffs=["Each personalized email takes ~20 min", "Competes with coursework this week"],
                       assumptions=["Targets' own sites are current (lab rosters are stale)", "5-6 emails per batch is sustainable"], evidence_ids=["e_research_targets", "e_interp"], opportunity_ids=["opp_chai", "opp_anthropic_fellowship", "opp_simons"],
                       recommended_action="Send the Tier-1 batch Thursday 16:00-18:00; mention the Gemma 2B/9B sycophancy paper in each."),
    "d_coursework": dict(title="Protect time for CS 61A and Linear Algebra", description="Reserve fixed blocks for Linear HW2, the Renaissance reading and Midterm 1 prep.",
                         positive_effects=["Keeps first-semester grades on track", "Turns downloaded study material into scheduled work"], tradeoffs=["Less flexibility for SF events this week"],
                         assumptions=["Linear HW2 needs about 4-5 hours", "Renaissance reading takes ~2 hours"], evidence_ids=["e_midweek", "e_prep_zero"], opportunity_ids=[],
                         recommended_action="Block Tue 19:00-22:00 (Linear HW2) and Wed 19:00-21:00 (Cox ch.1-2 + MT1 past exam)."),
    "d_continue": dict(title="Continue current schedule without changes", description="Keep all four outreach campaigns, the hackathon and coursework as they stand.",
                       positive_effects=["No new commitments"], tradeoffs=["No protected study time before Midterm 1", "Outreach volume stays at four campaigns"],
                       assumptions=["Current campaign volume continues"], evidence_ids=["e_late_nights", "e_overcommitted"], opportunity_ids=[],
                       recommended_action="Consider at least one change from the other branches."),
    "o_agent_project": dict(title="Ship the personal-brain agent (this project)", description="Tonight's build becomes a public portfolio piece for lab and internship applications.",
                            positive_effects=["Portfolio piece for internship + research applications", "Agent-eval experience made visible"], tradeoffs=["Needs 2-3 follow-up sessions"],
                            assumptions=["You keep working on the project after the event"], evidence_ids=["e_goal_project", "e_agent_notes"], opportunity_ids=["opp_calhacks", "opp_treehacks"],
                            recommended_action="Push the repo public within a week of the hackathon."),
    "o_collaborator": dict(title="Meet collaborators / mentors from Cognee, AWS, Bright Data", description="Sponsor engineers and 400+ builders in the room tonight.",
                           positive_effects=["Team for Cal Hacks 13.0 / TreeHacks", "Warm intros for the startup outreach list"], tradeoffs=["Depends on who attends"],
                           assumptions=["Attendees include sponsor engineers and student builders"], evidence_ids=["e_hackathon", "e_overcommitted"], opportunity_ids=["opp_calhacks", "opp_techweek"],
                           recommended_action="Exchange contacts with one team and one sponsor engineer."),
    "r_late_night": dict(title="Late return the night before a full week", description="Back in Berkeley after 22:00 with Linear HW2 and the Renaissance reading untouched.",
                         positive_effects=[], tradeoffs=["Compresses HW2 into Tue-Fri"], assumptions=["Commute back to Berkeley takes about an hour"], evidence_ids=["e_hackathon_before_hw3"], opportunity_ids=[],
                         recommended_action="Leave by 21:00 and start Linear HW2 Tuesday evening at the latest."),
    "o_interview_ready": dict(title="Midterm readiness improves", description="Structured past-exam practice before Midterm 1 raises confidence.",
                              positive_effects=["Higher expected Midterm 1 score"], tradeoffs=["Practice time is not free this week"], assumptions=["0 of ~3 planned hours completed so far", "Midterm 1 is in the first week of October"], evidence_ids=["e_prep_zero"], opportunity_ids=[],
                              recommended_action="Do one timed past MT1 (fa25) Tuesday evening."),
    "r_hw3_time": dict(title="Less time for Linear HW2 this week", description="Midterm prep draws from the same Tue/Wed evenings as HW2.",
                       positive_effects=[], tradeoffs=["Could push Linear HW2 close to Friday 23:59"], assumptions=["HW2 needs about 4 hours", "HW2 due Fri 23:59 (assumed)"], evidence_ids=["e_midweek"], opportunity_ids=[],
                       recommended_action="Start HW2 before exam practice, not after."),
    "o_research_lab": dict(title="Land a first-year research position", description="Cold emails plus CHAI / BASIS / URAP channels open a path into an interp or safety lab.",
                           positive_effects=["Path into a Berkeley lab", "Aligns with interpretability & AI-safety interest"], tradeoffs=["Long lead time; results in months"],
                           assumptions=["CHAI internship apps open ~Oct-Nov as expected (unverified)"], evidence_ids=["e_research_targets", "e_interp"], opportunity_ids=["opp_chai", "opp_anthropic_fellowship", "opp_goodfire"],
                           recommended_action="Follow up each email after one week; attend the Simons Trustworthy AI workshop."),
    "r_deadline_pressure": dict(title="Outreach volume crowds coursework", description="Internships, clubs, 145 startups and 20 research targets all run in parallel with Midterm 1 approaching.",
                                positive_effects=[], tradeoffs=["Stacked October deadlines (CHAI, STEP, Tech Week, Simons)"], assumptions=["All four campaigns are kept active"], evidence_ids=["e_late_nights", "e_three_deadlines"], opportunity_ids=["opp_step", "opp_chai", "opp_techweek"],
                                recommended_action="Stagger: research emails this week, STEP watch next week, CHAI in October."),
    "o_stable": dict(title="Coursework stability", description="Fixed blocks keep Linear HW2, the reading and Midterm 1 prep on time.",
                     positive_effects=["Fewer last-minute submissions", "Midterm 1 prep actually happens"], tradeoffs=["Less room for extra SF events"], assumptions=["Blocked time is actually used for coursework"], evidence_ids=["e_goal_gpa", "e_cs_courses"], opportunity_ids=[],
                     recommended_action="Keep the two coursework blocks fixed."),
    "r_missed_deadline": dict(title="Miss a homework or application deadline", description="With no changes, Linear HW2, the reading or an application (TechCrunch Sep 22, BCS Sep 25) slips.",
                              positive_effects=[], tradeoffs=["A late problem set affects first-semester grades"], assumptions=["No new time blocks are added"], evidence_ids=["e_three_deadlines", "e_midweek"], opportunity_ids=[],
                              recommended_action="Add at least one protected coursework block."),
    "r_burnout": dict(title="Rising schedule pressure", description="Hackathon + four campaigns + midterm prep in the same two weeks.",
                      positive_effects=[], tradeoffs=["Lower output on every goal"], assumptions=["Campaign volume continues unchanged"], evidence_ids=["e_late_nights", "e_overcommitted"], opportunity_ids=[],
                      recommended_action="Pause one campaign (clubs are mostly closed) until after Midterm 1."),
}

for node in graph["nodes"]:
    t = TEXT.get(node["id"])
    if t:
        node.update(t)
        node["explanation"] = ""
graph["id"] = "graph_demo_aditya"
graph["assumptions"] = [
    "Trackers, Downloads and memory notes reflect this week accurately",
    "CS 61A lectures MWF 10-11 and Midterm 1 in the first week of October are assumptions — verify on the course calendar",
    "Linear HW2 due Fri 23:59 is an assumption",
    "Scores are estimates, not predictions",
]

data = {
    "persona": "Aditya Dwivedi",
    "today": TODAY,
    "profile": profile,
    "calendar": calendar,
    "sources": sources,
    "evidence": evidence,
    "attributes": attributes,
    "opportunities": opportunities,
    "graph": graph,
}

(HERE / "demo_data.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
(HERE / "opportunities.json").write_text(json.dumps(opportunities, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote demo_data.json ({len(calendar)} events, {len(sources)} sources, {len(evidence)} evidence, {len(attributes)} attrs) and opportunities.json ({len(opportunities)})")
