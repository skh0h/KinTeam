import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { startOfWeek, format } from 'date-fns';

// --- helpers ----------------------------------------------------------------

function currentWeekMonday() {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

function superlatives(stats) {
  if (!stats || stats.length === 0) return [];
  const sorted = [...stats].sort((a, b) => b.chores_done - a.chores_done);
  const byStreak = [...stats].sort((a, b) => (b.streak ?? 0) - (a.streak ?? 0));

  const results = [];
  if (sorted[0]) {
    results.push({ emoji: '🧹', label: 'Most Chores Done', name: sorted[0].name, value: `${sorted[0].chores_done} chores` });
  }
  if (byStreak[0] && (byStreak[0].streak ?? 0) > 0) {
    results.push({ emoji: '🔥', label: 'Best Streak', name: byStreak[0].name, value: `${byStreak[0].streak} days` });
  }
  // Star leader (already sorted by stars in the parent)
  const byStar = [...stats].sort((a, b) => b.stars - a.stars);
  if (byStar[0]) {
    results.push({ emoji: '⭐', label: 'Star Leader', name: byStar[0].name, value: `${byStar[0].stars} stars` });
  }
  return results;
}

// --- slide variants ---------------------------------------------------------

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
};

const transition = { type: 'spring', stiffness: 280, damping: 30 };

// --- slide components -------------------------------------------------------

function SlideWrapper({ children, slideKey, dir }) {
  return (
    <motion.div
      key={slideKey}
      custom={dir}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={transition}
      className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
    >
      {children}
    </motion.div>
  );
}

function MVPSlide({ recap, dir }) {
  return (
    <SlideWrapper slideKey="mvp" dir={dir}>
      <motion.span
        className="text-8xl mb-4"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
      >
        🏆
      </motion.span>
      <motion.p
        className="text-muted-foreground text-sm font-medium uppercase tracking-widest mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        This week's MVP
      </motion.p>
      <motion.h2
        className="font-display text-4xl font-bold"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {recap.mvp_name || 'The whole family!'}
      </motion.h2>
    </SlideWrapper>
  );
}

function StarsSlide({ stats, dir }) {
  const sorted = [...stats].sort((a, b) => b.stars - a.stars);
  return (
    <SlideWrapper slideKey="stars" dir={dir}>
      <h2 className="font-display text-2xl font-bold mb-6">⭐ Star Tallies</h2>
      <ul className="w-full max-w-sm space-y-2">
        {sorted.map((s, i) => {
          const rate = s.chores_total > 0 ? Math.round((s.chores_done / s.chores_total) * 100) : 0;
          return (
            <motion.li
              key={s.member_id ?? i}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/60 text-sm"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
            >
              <span className="text-xl">{s.emoji || '👤'}</span>
              <span className="flex-1 font-medium text-left">{s.name}</span>
              <span className="text-xs text-muted-foreground">{rate}%</span>
              <span className="font-bold text-amber-600">⭐ {s.stars}</span>
            </motion.li>
          );
        })}
      </ul>
    </SlideWrapper>
  );
}

function SuperlativesSlide({ stats, dir }) {
  const items = superlatives(stats);
  return (
    <SlideWrapper slideKey="superlatives" dir={dir}>
      <h2 className="font-display text-2xl font-bold mb-6">🎖 Awards</h2>
      <ul className="w-full max-w-sm space-y-3">
        {items.map((item, i) => (
          <motion.li
            key={item.label}
            className="flex items-center gap-3 p-4 rounded-xl bg-muted/60"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.12, type: 'spring' }}
          >
            <span className="text-3xl">{item.emoji}</span>
            <div className="text-left">
              <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
              <p className="font-bold">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.value}</p>
            </div>
          </motion.li>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">Not enough data yet — complete more chores!</p>
        )}
      </ul>
    </SlideWrapper>
  );
}

// --- main component ---------------------------------------------------------

export default function Wrapped() {
  const [slideIndex, setSlideIndex] = useState(0);
  const [dir, setDir] = useState(1);

  const { data: recaps = [], isLoading } = useQuery({
    queryKey: ['weekly-recap'],
    queryFn: () => base44.entities.WeeklyRecap.list('-created_date', 5),
  });

  const monday = currentWeekMonday();
  const recap = recaps.find(r => r.week_of < monday) ?? null;
  const stats = recap?.stats ?? [];

  // Build slide list dynamically
  const slides = recap
    ? [
        { id: 'mvp',           component: (d) => <MVPSlide recap={recap} dir={d} /> },
        { id: 'stars',         component: (d) => <StarsSlide stats={stats} dir={d} /> },
        { id: 'superlatives',  component: (d) => <SuperlativesSlide stats={stats} dir={d} /> },
      ]
    : [];

  const goTo = (next) => {
    setDir(next > slideIndex ? 1 : -1);
    setSlideIndex(next);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground text-sm">
        Unwrapping the week…
      </div>
    );
  }

  if (!recap) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 min-h-[60vh] text-center">
        <span className="text-6xl">📭</span>
        <h1 className="font-display text-2xl font-bold">No Wrapped Yet</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          Family Wrapped appears after your first week is complete. Check back on Monday!
        </p>
        <Button asChild variant="outline">
          <Link to="/family">← Back to Family</Link>
        </Button>
      </div>
    );
  }

  const current = slides[slideIndex];
  const isLast = slideIndex === slides.length - 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">✨ Family Wrapped</h1>
        <Button asChild variant="ghost" size="sm">
          <Link to="/family">← Family</Link>
        </Button>
      </div>

      {/* Slide stage */}
      <div className="relative bg-gradient-to-br from-violet-50 via-background to-amber-50 rounded-2xl overflow-hidden"
           style={{ minHeight: '380px' }}>
        <AnimatePresence custom={dir} mode="wait">
          {current && current.component(dir)}
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(i)}
            className={`w-2 h-2 rounded-full transition-all ${
              i === slideIndex ? 'bg-primary w-4' : 'bg-muted-foreground/30'
            }`}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {slideIndex > 0 && (
          <Button variant="outline" className="flex-1" onClick={() => goTo(slideIndex - 1)}>
            ← Back
          </Button>
        )}
        {!isLast ? (
          <Button className="flex-1" onClick={() => goTo(slideIndex + 1)}>
            Next →
          </Button>
        ) : (
          <Button asChild className="flex-1">
            <Link to="/family">Done ✓</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
