import { cn } from '@/lib/utils';

export default function MemberAvatar({ emoji, name, size = 'md', showName = true }) {
  const sizeClasses = size === 'sm' ? 'w-7 h-7 text-sm' : size === 'lg' ? 'w-12 h-12 text-2xl' : 'w-9 h-9 text-lg';

  return (
    <div className="flex items-center gap-2">
      <div className={cn('rounded-full bg-secondary flex items-center justify-center', sizeClasses)}>
        {emoji || '👤'}
      </div>
      {showName && <span className="text-sm font-medium">{name}</span>}
    </div>
  );
}