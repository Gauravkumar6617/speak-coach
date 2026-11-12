import type { Word } from './azure';

export type Metrics = {
  wordCount: number;
  wpm: number;
  pauseCount: number;
  longestPause: number;
  fillers: Record<string, number>;
  fillerTotal: number;
};

export const PAUSE_SECONDS = 0.6;
const SINGLE_FILLERS = new Set(['um', 'uh', 'er', 'hmm', 'like']);
const DOUBLE_FILLERS = new Set(['you know', 'i mean']);

// Fillers are approximate: speech recognition often drops "um"/"uh" from the transcript.
export function countFillers(text: string): Record<string, number> {
  const tokens = text.toLowerCase().match(/[a-z']+/g) ?? [];
  const out: Record<string, number> = {};
  const add = (f: string) => (out[f] = (out[f] ?? 0) + 1);
  for (let i = 0; i < tokens.length; i++) {
    const pair = `${tokens[i]} ${tokens[i + 1]}`;
    if (DOUBLE_FILLERS.has(pair)) {
      add(pair);
      i++;
    } else if (SINGLE_FILLERS.has(tokens[i])) add(tokens[i]);
  }
  return out;
}

export function computeMetrics(words: Word[], text: string): Metrics {
  const w = [...words].sort((a, b) => a.offset - b.offset);
  let pauseCount = 0;
  let longestPause = 0;
  for (let i = 1; i < w.length; i++) {
    const gap = w[i].offset - (w[i - 1].offset + w[i - 1].duration);
    if (gap >= PAUSE_SECONDS) {
      pauseCount++;
      longestPause = Math.max(longestPause, gap);
    }
  }
  const span = w.length ? w[w.length - 1].offset + w[w.length - 1].duration - w[0].offset : 0;
  const fillers = countFillers(text);
  return {
    wordCount: w.length,
    wpm: span > 0 ? Math.round((w.length / span) * 60) : 0,
    pauseCount,
    longestPause: Math.round(longestPause * 10) / 10,
    fillers,
    fillerTotal: Object.values(fillers).reduce((a, b) => a + b, 0),
  };
}

/** Root-mean-square loudness of little-endian 16-bit PCM (0 to 32768). */
export function rms(pcm: ArrayBuffer) {
  const samples = new Int16Array(pcm, 0, pcm.byteLength >> 1);
  let sum = 0;
  for (const x of samples) sum += x * x;
  return samples.length ? Math.sqrt(sum / samples.length) : 0;
}
