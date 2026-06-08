import { cn } from '@/lib/utils';
import { ClipboardList, Zap, CheckSquare } from 'lucide-react';

const phaseConfig = {
  prep: { label: 'Prep', icon: ClipboardList, classes: 'bg-blue-100 text-blue-700' },
  execution: { label: 'Execute', icon: Zap, classes: 'bg-amber-100 text-amber-700' },
  verification: { label: 'Verify', icon: CheckSquare, classes: 'bg-emerald-100 text-emerald-700' },
};

export default function PhaseBadge({ phase }) {
  if (!phase || phase === 'none') return null;
  const c = phaseConfig[phase];
  if (!c) return null;
  const Icon = c.icon;

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', c.classes)}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}