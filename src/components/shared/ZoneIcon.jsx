import { UtensilsCrossed, Car, Wrench, Sparkles, Heart, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap = {
  UtensilsCrossed,
  Car,
  Wrench,
  Sparkles,
  Heart,
};

const colorMap = {
  primary: 'bg-primary/10 text-primary',
  'chart-2': 'bg-emerald-100 text-emerald-700',
  'chart-3': 'bg-blue-100 text-blue-700',
  'chart-4': 'bg-amber-100 text-amber-700',
  'chart-5': 'bg-rose-100 text-rose-700',
};

export default function ZoneIcon({ icon, color, size = 'md' }) {
  const Icon = iconMap[icon] || HelpCircle;
  const sizeClasses = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10';
  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-7 h-7' : 'w-5 h-5';

  return (
    <div className={cn('rounded-xl flex items-center justify-center', sizeClasses, colorMap[color] || 'bg-muted text-muted-foreground')}>
      <Icon className={iconSize} />
    </div>
  );
}