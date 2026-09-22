import type { ActionItem, ActionPlan, FutureGraph, Opportunity } from '../types';

export function buildLocalPlan(graph: FutureGraph, chosenIds: string[], opportunities: Opportunity[]): ActionPlan {
  const decisions = graph.nodes.filter((n) => n.category === 'decision');
  const chosen = decisions.filter((d) => chosenIds.includes(d.id));
  const ranked = [...decisions].sort((a, b) => b.scenario_score - a.scenario_score);
  const path = (chosen.length ? chosen : ranked.slice(0, 3)).map((d) => d.id);
  const pathNodes = path.map((id) => graph.nodes.find((n) => n.id === id)!).filter(Boolean);

  const actionsPool: ActionItem[] = [
    { id: 'act_hw3', title: 'Start HW3 before the hackathon', description: 'Spend 60 minutes on CS 61A HW3 problems 1–2 before leaving for SF so Tuesday is not a scramble.', when: 'Mon 21 Sep, 13:00', duration_minutes: 60, kind: 'action' },
    { id: 'act_prep1', title: 'Interview practice block 1', description: 'Arrays and hashing: two timed problems, then review.', when: 'Tue 22 Sep, 16:00', duration_minutes: 60, kind: 'action' },
    { id: 'act_mlab', title: 'Draft ML@Berkeley application answers', description: 'Write the two short-answer responses; due Sunday 23:59.', when: 'Sat 26 Sep, 11:00', duration_minutes: 45, kind: 'action' },
    { id: 'act_chai', title: 'Outline CHAI interest statement', description: 'One-page outline linking interpretability interest to the reading group.', when: 'Sun 27 Sep, 15:00', duration_minutes: 45, kind: 'action' },
  ];
  const pick = (ids: string[]) => actionsPool.filter((a) => ids.includes(a.id));
  let next_actions: ActionItem[];
  if (path.includes('d_research') && !path.includes('d_hackathon')) next_actions = pick(['act_prep1', 'act_mlab', 'act_chai']);
  else next_actions = pick(['act_hw3', 'act_prep1', 'act_mlab']);
  next_actions = next_actions.slice(0, 3);

  const calendar_blocks: ActionItem[] = [
    { id: 'blk_hw3', title: 'HW3 focus block', description: 'Protected time for CS 61A HW3 (due Wed 23:59).', when: 'Tue 22 Sep, 19:00–22:00', duration_minutes: 180, kind: 'calendar_block' },
    { id: 'blk_prep2', title: 'Interview practice block 2', description: 'Probability and expected value; one mock question aloud.', when: 'Wed 23 Sep, 15:00–16:00', duration_minutes: 60, kind: 'calendar_block' },
    { id: 'blk_prep3', title: 'Interview practice block 3', description: 'Warm-up problems, then rest before the 16:00 call.', when: 'Thu 24 Sep, 13:00–14:00', duration_minutes: 60, kind: 'calendar_block' },
    { id: 'blk_hw2', title: 'HW2 focus block', description: 'Protected time for CS 70 HW2 (due Fri 23:59).', when: 'Thu 24 Sep, 19:00–22:00', duration_minutes: 180, kind: 'calendar_block' },
  ];

  const riskNode = [...graph.nodes].filter((n) => n.category === 'risk').sort((a, b) => b.scenario_score - a.scenario_score)[0];
  const risk: ActionItem = {
    id: 'risk_main',
    title: riskNode ? riskNode.title : 'Overlapping commitments',
    description: riskNode ? `${riskNode.description} Recommended: ${riskNode.recommended_action}` : 'Three deadlines and an interview within five days.',
    when: 'This week',
    duration_minutes: 0,
    kind: 'risk',
  };
  const topOpp = [...opportunities].sort((a, b) => b.relevance_score - a.relevance_score)[0];
  const opportunity: ActionItem = {
    id: 'opp_main',
    title: topOpp ? topOpp.title : 'Explore opportunities',
    description: topOpp ? `${topOpp.description} ${topOpp.deadline ? `Deadline ${topOpp.deadline}.` : ''}` : '',
    when: topOpp?.deadline ? `Deadline ${topOpp.deadline}` : 'Upcoming',
    duration_minutes: 30,
    kind: 'opportunity',
  };
  const explanation =
    `This plan follows ${pathNodes.map((n) => `"${n.title}"`).join(', ')}. ` +
    'It protects coursework blocks before each deadline, converts the planned interview practice into three concrete sessions, and keeps personal time intact. ' +
    `Schedule pressure is ${graph.schedule_pressure}. Nothing is written to your calendar until you confirm.`;
  return { path_node_ids: [graph.root_id, ...path], next_actions, calendar_blocks, risk, opportunity, explanation, requires_confirmation: true };
}
