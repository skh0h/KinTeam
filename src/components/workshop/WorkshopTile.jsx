import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function WorkshopTile({ icon: Icon, title, filled, children, className }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={className}>
      <Card className={cn('h-full transition-all', filled ? 'border-primary/40 bg-primary/5' : 'border-dashed')}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', filled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="font-medium text-sm">{title}</span>
          </div>
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}