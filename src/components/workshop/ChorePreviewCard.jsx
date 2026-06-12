import { Card, CardContent } from '@/components/ui/card';
import { User, UserX, Pin } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ChorePreviewCard({ form, members }) {
  const memberMap = Object.fromEntries((members || []).map(m => [m.id, m]));
  const memberLabel = (id) => {
    const m = memberMap[id];
    return m ? `${m.avatar_emoji ? m.avatar_emoji + ' ' : ''}${m.display_name || m.name}` : null;
  };

  return (
    <motion.div layout>
      <Card className="border-2 border-primary/30 shadow-lg">
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-primary font-semibold mb-2">Preview</p>
          <div className="flex items-start gap-3">
            {form.photo_url && (
              <img src={form.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                {form.title || <span className="text-muted-foreground italic">Untitled chore…</span>}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  ⭐ {form.stars}
                </span>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize">
                  {form.occurrence === 'fortnightly' ? 'Every 2 wks' : form.occurrence === 'as_needed' ? 'As needed' : form.occurrence}
                </span>
                {form.due_day !== 'any' && (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize">
                    {form.due_day}
                  </span>
                )}
                {form.permanent_assigned_to ? (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Pin className="w-3 h-3" /> {memberLabel(form.permanent_assigned_to)}
                  </span>
                ) : form.assigned_to ? (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                    <User className="w-3 h-3" /> {memberLabel(form.assigned_to)}
                  </span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <UserX className="w-3 h-3" /> Unassigned
                  </span>
                )}
              </div>
              {form.notes && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{form.notes}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}