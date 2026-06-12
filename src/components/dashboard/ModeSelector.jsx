import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MODES } from '@/lib/modes';

export default function ModeSelector({ mode, setMode, isSaving }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg">Household Mode</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(MODES).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              disabled={isSaving}
              className={`p-3 rounded-xl border text-center transition-all ${
                mode === key
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : 'border-border bg-muted/40 hover:bg-muted'
              }`}
            >
              <span className="text-2xl block mb-1">{cfg.emoji}</span>
              <span className="text-sm font-medium block">{cfg.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          {MODES[mode]?.description}
        </p>
      </CardContent>
    </Card>
  );
}