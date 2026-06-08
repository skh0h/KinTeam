import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';

export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link to="/zones">
        <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-1.5 rounded-xl">
          <Plus className="w-5 h-5 text-primary" />
          <span className="text-xs font-medium">Add Chore</span>
        </Button>
      </Link>
      <Link to="/team-lift">
        <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-1.5 rounded-xl">
          <Users className="w-5 h-5 text-blue-600" />
          <span className="text-xs font-medium">Team Lift</span>
        </Button>
      </Link>
    </div>
  );
}