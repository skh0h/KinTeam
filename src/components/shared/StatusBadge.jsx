import { cn } from '@/lib/utils';

const config = {
  pending: { label: 'Pending', classes: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In Progress', classes: 'bg-primary/10 text-primary' },
  done: { label: 'Done', classes: 'bg-emerald-100 text-emerald-700' },
};

export default function StatusBadge({ status }) {
  const c = config[status] || config.pending;
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', c.classes)}>
      {c.label}
    </span>
  );
}