import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { AlertTriangle, CircleDot, GitBranch, Sparkles, Target } from 'lucide-react';
import type { FutureNode } from '../types';
import ScoreBadge from './ScoreBadge';

export const CATEGORY_COLORS: Record<FutureNode['category'], string> = {
  present: 'var(--cyan)',
  decision: 'var(--blue)',
  opportunity: 'var(--violet)',
  outcome: 'var(--green)',
  risk: 'var(--coral)',
};

const ICONS: Record<FutureNode['category'], typeof Target> = {
  present: CircleDot,
  decision: GitBranch,
  opportunity: Sparkles,
  outcome: Target,
  risk: AlertTriangle,
};

export type FutureFlowNode = Node<{ node: FutureNode; changed: boolean; selected: boolean; chosen: boolean; dimmed: boolean }, 'future'>;

function FutureNodeCard({ data }: NodeProps<FutureFlowNode>) {
  const { node, changed, selected, chosen, dimmed } = data;
  const color = CATEGORY_COLORS[node.category];
  const Icon = ICONS[node.category];
  const isDecision = node.category === 'decision';
  return (
    <div
      className={`glass w-[230px] cursor-pointer p-3 transition-all duration-300 ${changed ? 'node-changed' : ''} ${
        selected ? 'ring-2 ring-white/60' : ''
      }`}
      style={{
        borderColor: selected || changed ? color : 'var(--border)',
        boxShadow: selected ? `0 0 28px ${color}55` : changed ? `0 0 24px ${color}66` : undefined,
        opacity: dimmed ? 0.3 : 1,
        background: `linear-gradient(160deg, ${color}1a, rgba(255,255,255,0.03))`,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <div className="mb-1.5 flex items-center justify-between">
        <span className="chip" style={{ borderColor: `${color}66`, color }}>
          <Icon size={11} /> {node.category}
        </span>
        <span className="chip">{node.time_horizon}</span>
      </div>
      <div className="mb-2 text-[13px] font-semibold leading-snug">{node.title}</div>
      <div className="flex items-end justify-between">
        <ScoreBadge score={node.scenario_score} size="sm" />
        {isDecision && (
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: chosen ? 'var(--green)' : 'var(--blue)' }}>
            {chosen ? 'Chosen' : 'Explore →'}
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(FutureNodeCard);
