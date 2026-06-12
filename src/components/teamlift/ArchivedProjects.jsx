import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Archive, ChevronDown, ArchiveRestore } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function ArchivedProjects({ projects, onRestore }) {
  const [open, setOpen] = useState(false);
  if (projects.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Archive className="w-4 h-4" />
        Archived ({projects.length})
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="space-y-2 mt-3">
              {projects.map(project => (
                <Card key={project.id} className="opacity-70">
                  <CardContent className="p-3 flex items-center justify-between">
                    <span className="text-sm font-medium">{project.title}</span>
                    <Button variant="outline" size="sm" onClick={() => onRestore(project)}>
                      <ArchiveRestore className="w-4 h-4 mr-1" /> Restore
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}