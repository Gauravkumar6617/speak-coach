// Pure Claude helpers: prompt building + lenient JSON parsing. No network here.
import type { Pronunciation } from './azure';
import type { Metrics } from './metrics';

export type Issue = { type: string; wrong: string; right: string; why: string };
export type Upgrade = { original: string; better: string; example: string };
export type Feedback = {
  overallBand: number | null;
  grammarScore: number | null;
  vocabularyScore: number | null;
  coherenceScore: number | null;
  summary: string;
  corrected: string;
  issues: Issue[];
  vocabularyUpgrades: Upgrade[];
  tips: string[];
};

export const SYSTEM_PROMPT = `You are an English speaking coach. The learner answered a speaking prompt out loud; you get a speech-recognition transcript plus measured metrics. Judge grammar, vocabulary and coherence like an IELTS speaking examiner. Ignore punctuation and capitalisation, which come from speech recognition.

Reply with JSON only, no markdown, matching exactly:
{"overallBand": number 0-9 (half bands allowed),
 "grammarScore": number 0-9, "vocabularyScore": number 0-9, "coherenceScore": number 0-9,
 "summary": "2-3 sentences of overall feedback",
 "corrected": "the full answer rewritten in natural, correct English, keeping the learner's ideas",
 "issues": [{"type": "short category, e.g. verb tense, article, preposition, word choice, word order", "wrong": "exact words from the transcript", "right": "corrected words", "why": "one-sentence reason"}],
 "vocabularyUpgrades": [{"original": "plain word or phrase used", "better": "stronger alternative", "example": "example sentence"}],
 "tips": ["short actionable tip"]}`;

export function buildPrompt(topic: string, pron: Pronunciation, m: Metrics): string {
  const fillers = Object.entries(m.fillers).map(([f, n]) => `${f} x${n}`).join(', ') || 'none detected';
  return [
    `Speaking prompt: ${topic}`,
    `Transcript: """${pron.transcript}"""`,
    `Metrics: ${m.wordCount} words, ${m.wpm} words per minute, ${m.pauseCount} pauses of 0.6s or more (longest ${m.longestPause}s), fillers: ${fillers} (approximate).`,
    `Azure pronunciation (0-100): accuracy ${pron.accuracy ?? 'n/a'}, fluency ${pron.fluency ?? 'n/a'}, overall ${pron.overall ?? 'n/a'}.`,
  ].join('\n');
}

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const list = <T>(v: unknown, keys: (keyof T)[]): T[] =>
  (Array.isArray(v) ? v : [])
    .filter((x) => x && typeof x === 'object')
    .map((x) => Object.fromEntries(keys.map((k) => [k, str(x[k])])) as T);

/** Throws only if no JSON object can be found at all; every field is optional. */
export function parseFeedback(text: string): Feedback {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Claude did not return JSON.');
  const j = JSON.parse(text.slice(start, end + 1));
  return {
    overallBand: num(j.overallBand),
    grammarScore: num(j.grammarScore),
    vocabularyScore: num(j.vocabularyScore),
    coherenceScore: num(j.coherenceScore),
    summary: str(j.summary),
    corrected: str(j.corrected),
    issues: list<Issue>(j.issues, ['type', 'wrong', 'right', 'why']).filter((i) => i.wrong || i.right),
    vocabularyUpgrades: list<Upgrade>(j.vocabularyUpgrades, ['original', 'better', 'example']).filter((u) => u.better),
    tips: (Array.isArray(j.tips) ? j.tips : []).filter((t: unknown) => typeof t === 'string'),
  };
}
