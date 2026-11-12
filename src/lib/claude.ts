// Pure Claude helpers: prompt building + lenient JSON parsing. No network here.
import type { Pronunciation } from './azure';
import type { Metrics } from './metrics';
import type { Topic } from './topics';

export type Issue = { type: string; wrong: string; right: string; why: string };
export type Upgrade = { original: string; better: string; example: string };
export type Rephrase = { said: string; sayInstead: string; why: string };
export type Feedback = {
  overallBand: number | null;
  grammarScore: number | null;
  vocabularyScore: number | null;
  coherenceScore: number | null;
  summary: string;
  corrected: string;
  issues: Issue[];
  vocabularyUpgrades: Upgrade[];
  /** Hesitant or weak phrasing and a more confident way to say it. Missing on sessions saved before this field existed. */
  confidentPhrases?: Rephrase[];
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
 "confidentPhrases": [{"said": "exact words from the transcript that sound hesitant, apologetic, vague or flat", "sayInstead": "a more confident, natural way to say the same thing", "why": "one-sentence reason it sounds more confident"}],
 "tips": ["short actionable tip"]}

Give up to 4 confidentPhrases, fewer if the answer already sounds confident. Look for hedging ("I think maybe", "kind of", "I am not sure but"), apologies, trailing endings and weak openers.`;

export const GOAL_PROMPT = `You are an English speaking coach. The learner tells you a speaking skill they want to build, such as starting conversations with new people or sounding more confident. Write one realistic practice task they will answer alone, out loud, in under 60 seconds, so it must work for a single speaker. For example: "You meet a new colleague at the coffee machine. Introduce yourself and ask two questions that keep the conversation going." Also give one short, practical tip for doing the task well; it can cover phrases to use, tone, eye contact or posture.

Reply with JSON only, no markdown: {"task": "the task, addressed to the learner, 1-2 sentences", "tip": "one sentence"}`;

const extractJson = (text: string) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Claude did not return JSON.');
  return JSON.parse(text.slice(start, end + 1));
};

export function parseGoalTask(text: string, goal: string): Topic {
  const j = extractJson(text);
  const task = str(j.task).trim();
  if (!task) throw new Error('Claude did not return a task.');
  return { category: 'Your goal', text: task, goal, tip: str(j.tip).trim() || undefined };
}

export function buildPrompt(topic: string, pron: Pronunciation, m: Metrics, goal?: string): string {
  const fillers = Object.entries(m.fillers).map(([f, n]) => `${f} x${n}`).join(', ') || 'none detected';
  return [
    `Speaking prompt: ${topic}`,
    ...(goal
      ? [`Learner's goal: ${goal}. Besides grammar, judge how well the answer serves this goal (engaging, confident, natural) and aim the summary and tips at it.`]
      : []),
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
  const j = extractJson(text);
  return {
    overallBand: num(j.overallBand),
    grammarScore: num(j.grammarScore),
    vocabularyScore: num(j.vocabularyScore),
    coherenceScore: num(j.coherenceScore),
    summary: str(j.summary),
    corrected: str(j.corrected),
    issues: list<Issue>(j.issues, ['type', 'wrong', 'right', 'why']).filter((i) => i.wrong || i.right),
    vocabularyUpgrades: list<Upgrade>(j.vocabularyUpgrades, ['original', 'better', 'example']).filter((u) => u.better),
    confidentPhrases: list<Rephrase>(j.confidentPhrases, ['said', 'sayInstead', 'why']).filter((r) => r.sayInstead),
    tips: (Array.isArray(j.tips) ? j.tips : []).filter((t: unknown) => typeof t === 'string'),
  };
}

export const FACE_MARK = 'FACE:';
export const TIPS_MARK = 'TIPS:';

/** Splits a Talk reply into the spoken part and the on-screen notes that follow the FACE: and TIPS: markers, in either order. */
export function splitReply(text: string): { reply: string; face?: string; tips?: string } {
  const part = (mark: string, other: string) => {
    const i = text.indexOf(mark);
    if (i < 0) return undefined;
    const rest = text.slice(i + mark.length);
    const j = rest.indexOf(other);
    return (j < 0 ? rest : rest.slice(0, j)).trim() || undefined;
  };
  const cut = [text.indexOf(FACE_MARK), text.indexOf(TIPS_MARK)].filter((i) => i >= 0);
  return {
    reply: text.slice(0, cut.length ? Math.min(...cut) : undefined).trim(),
    face: part(FACE_MARK, TIPS_MARK),
    tips: part(TIPS_MARK, FACE_MARK),
  };
}
