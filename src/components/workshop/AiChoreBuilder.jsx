import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AiChoreBuilder({ onBuilt }) {
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef(null);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzing(true);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const response = await base44.functions.invoke('analyzeChorePhoto', { file_url });
    const result = response.data;

    onBuilt({
      title: result.title,
      occurrence: result.occurrence,
      stars: Math.min(5, Math.max(1, Math.round(result.stars))),
      notes: result.notes,
      photo_url: file_url,
    });
    setAnalyzing(false);
    e.target.value = '';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30">
        <CardContent className="p-4">
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={analyzing}
            className="w-full flex items-center gap-3 text-left disabled:opacity-70"
          >
            <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              {analyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                {analyzing ? 'AI is building your chore…' : 'Snap a photo, AI builds the chore'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {analyzing ? 'Analyzing the photo and filling in the tiles' : 'Take a picture of the mess — AI fills in name, stars, notes and more'}
              </p>
            </div>
          </button>
        </CardContent>
      </Card>
    </motion.div>
  );
}