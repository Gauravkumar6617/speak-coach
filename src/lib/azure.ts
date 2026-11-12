// Pure Azure helpers: request header + defensive response parsing. No network here.

export type Word = { word: string; offset: number; duration: number; accuracy: number | null };

export type Pronunciation = {
  transcript: string;
  lexical: string;
  words: Word[];
  accuracy: number | null;
  fluency: number | null;
  completeness: number | null;
  overall: number | null;
  weakWords: { word: string; accuracy: number }[];
};

const TICKS_PER_SECOND = 10_000_000;

export const pronunciationHeader = () =>
  btoa(
    JSON.stringify({
      ReferenceText: '',
      GradingSystem: 'HundredMark',
      Granularity: 'Word',
      Dimension: 'Comprehensive',
    }),
  );

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
// Scores sit either directly on the object or under "PronunciationAssessment".
const scores = (o: any) => o?.PronunciationAssessment ?? o ?? {};

export function parseAzure(json: any): Pronunciation {
  const status = json?.RecognitionStatus;
  if (status !== 'Success' && status !== 0) {
    throw new Error(
      status === 'NoMatch' || status === 'InitialSilenceTimeout'
        ? 'No speech was recognized. Speak a bit louder and closer to the mic.'
        : `Azure could not transcribe the audio (${status ?? 'unknown status'}).`,
    );
  }
  const best = Array.isArray(json.NBest) ? json.NBest[0] : undefined;
  const s = scores(best);
  const words: Word[] = (Array.isArray(best?.Words) ? best.Words : [])
    .filter((w: any) => typeof w?.Word === 'string')
    .map((w: any) => ({
      word: w.Word,
      offset: (num(w.Offset) ?? 0) / TICKS_PER_SECOND,
      duration: (num(w.Duration) ?? 0) / TICKS_PER_SECOND,
      accuracy: num(scores(w).AccuracyScore),
    }));
  return {
    transcript: String(best?.Display ?? json.DisplayText ?? ''),
    lexical: String(best?.Lexical ?? json.DisplayText ?? ''),
    words,
    accuracy: num(s.AccuracyScore),
    fluency: num(s.FluencyScore),
    completeness: num(s.CompletenessScore),
    overall: num(s.PronScore),
    weakWords: words
      .filter((w): w is Word & { accuracy: number } => w.accuracy !== null && w.accuracy < 70)
      .sort((a, b) => a.accuracy - b.accuracy)
      .map(({ word, accuracy }) => ({ word, accuracy })),
  };
}

const xml = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** SSML for Azure text-to-speech. `rate` is a percent change, e.g. -20 or 15. */
export const ssml = (text: string, voice: string, rate: number) =>
  `<speak version="1.0" xml:lang="${voice.slice(0, 5)}"><voice name="${voice}">` +
  `<prosody rate="${rate >= 0 ? '+' : ''}${rate}%">${xml(text)}</prosody></voice></speak>`;
