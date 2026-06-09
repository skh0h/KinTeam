import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useLocalUser } from "@/lib/LocalUserContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { signIn, localUser } = useLocalUser();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

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
    signIn(member);
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-4xl">🏠</span>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-3">All-Hands</h1>
          <p className="text-muted-foreground mt-1">Who are you?</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-muted-foreground">No family members set up yet.</p>
            <a href="/members" className="inline-block px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Add Members →
            </a>
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