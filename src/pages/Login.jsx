import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useLocalUser } from "@/lib/LocalUserContext";
import { useNavigate, Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

const ADMIN_PIN = '1234';

export default function Login() {
  const { signIn, localUser } = useLocalUser();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pinTarget, setPinTarget] = useState(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (localUser) navigate("/");
  }, [localUser]);

  useEffect(() => {
    base44.entities.FamilyMember.list().then((data) => {
      setMembers(data);
      setLoading(false);
    });
  }, []);

  const handlePick = (member) => {
    if (member.role === 'admin') {
      setPinTarget(member);
      setPin('');
      setPinError('');
    } else {
      signIn(member);
      window.location.href = "/";
    }
  };

  const handlePinSubmit = () => {
    if (pin === ADMIN_PIN) {
      signIn(pinTarget);
      window.location.href = "/";
    } else {
      setPinError('Incorrect PIN. Try again.');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-4xl">🏠</span>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-3">All-Hands</h1>
          <p className="text-muted-foreground mt-1">Who are you?</p>
        </div>

        {pinTarget ? (
          <div className="space-y-3 p-5 rounded-2xl border border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Shield className="w-4 h-4" /> Admin PIN Required
            </div>
            <p className="text-sm text-muted-foreground">
              Enter the PIN to sign in as <strong>{pinTarget.display_name || pinTarget.name}</strong>.
            </p>
            <Input
              type="password"
              placeholder="PIN"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setPinError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              autoFocus
            />
            {pinError && <p className="text-xs text-destructive">{pinError}</p>}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handlePinSubmit}>Confirm</Button>
              <Button variant="outline" className="flex-1" onClick={() => setPinTarget(null)}>Back</Button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-muted-foreground">No family members set up yet.</p>
            <Link to="/setup" className="inline-block px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Add Members →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => handlePick(member)}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl border bg-card hover:bg-muted/50 hover:border-primary/40 transition-all active:scale-95"
              >
                <span className="text-4xl">{member.avatar_emoji || "👤"}</span>
                <span className="font-medium text-sm">{member.display_name || member.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}