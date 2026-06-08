import { Card, CardContent } from '@/components/ui/card';
import ZoneIcon from '@/components/shared/ZoneIcon';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';

export default function ZoneLeadCards({ zones }) {
  return (
    <div>
      <h3 className="font-display text-lg font-semibold mb-3">Zone Leaders</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {zones.map((zone, i) => (
          <motion.div
            key={zone.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link to="/zones">
              <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <ZoneIcon icon={zone.icon} color={zone.color} size="sm" />
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <p className="font-medium text-sm group-hover:text-primary transition-colors">{zone.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Lead: {zone.current_lead_name || '—'}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}