import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, Sparkles, Loader2 } from 'lucide-react';

export default function AiProjectBuilder({ onBuilt }) {
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef(null);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzing(true);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const response = await base44.functions.invoke('analyzeTeamLiftPhoto', { file_url });
    const result = response.data;

    const toPhase = (p) => ({
      title: p?.title || '',
      assigned_to: '',
      notes: p?.notes || '',
      steps: (p?.steps || []).map(text => ({ id: crypto.randomUUID(), text, assigned_to: '', done: false })),
    });

    onBuilt({
      projectName: result.project_name,
      phases: {
        prep: toPhase(result.prep),
        execution: toPhase(result.execution),
        verification: toPhase(result.verification),
      },
    });
    setAnalyzing(false);
    e.target.value = '';
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 p-3">
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={analyzing}
        className="w-full flex items-center gap-3 text-left disabled:opacity-70"
      >
        <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
          {analyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            {analyzing ? 'AI is planning your project…' : 'Snap a photo, AI plans the project'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {analyzing ? 'Analyzing the photo and filling in the phases' : 'Take a picture of the big job — AI fills in phases and steps'}
          </p>
        </div>
      </button>
    </div>
  );
}