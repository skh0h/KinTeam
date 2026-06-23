import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import FamilyPetCard from '@/components/family/FamilyPetCard';
import ShoutOutWall from '@/components/family/ShoutOutWall';
import KudosPanel from '@/components/family/KudosPanel';
import BadgeShelf from '@/components/family/BadgeShelf';

export default function Family() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-3xl font-bold tracking-tight">Family</h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/wrapped">✨ View Family Wrapped</Link>
        </Button>
      </div>

      {/* Family pet */}
      <FamilyPetCard />

      {/* Shout-out wall */}
      <ShoutOutWall />

      {/* Kudos / high-fives */}
      <KudosPanel />

      {/* Badge shelf */}
      <BadgeShelf />
    </div>
  );
}
