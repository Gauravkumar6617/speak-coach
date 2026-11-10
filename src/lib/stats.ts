import type { Pronunciation } from './azure';
import type { Feedback } from './claude';
import type { Metrics } from './metrics';

export type Session = {
  id: string;
  createdAt: string; // ISO
  topic: string;
  category: string;
  pron: Omit<Pronunciation, 'words' | 'lexical'>;
  metrics: Metrics;
  feedback: Feedback | null;
  feedbackError?: string;
};

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Consecutive practice days ending today (or yesterday, so the streak survives until tonight). */
export function dayStreak(sessions: Pick<Session, 'createdAt'>[], now = new Date()): number {
  const days = new Set(sessions.map((s) => dayKey(new Date(s.createdAt))));
  const d = new Date(now);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** Bands in chronological order, skipping sessions without Claude feedback. */
export const bandSeries = (sessions: Session[]) =>
  sessions
    .filter((s) => s.feedback?.overallBand != null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((s) => s.feedback!.overallBand as number);

export function averageBand(sessions: Session[]): number | null {
  const b = bandSeries(sessions);
  return b.length ? Math.round((b.reduce((x, y) => x + y, 0) / b.length) * 10) / 10 : null;
}

export function mistakeTypes(sessions: Session[], top = 6): { type: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const s of sessions)
    for (const i of s.feedback?.issues ?? []) {
      const t = i.type.trim().toLowerCase() || 'other';
      counts[t] = (counts[t] ?? 0) + 1;
    }
  return Object.entries(counts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top);
}
