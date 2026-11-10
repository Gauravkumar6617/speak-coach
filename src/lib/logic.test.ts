/// <reference types="jest" />
import { parseAzure, pronunciationHeader } from './azure';
import { buildPrompt, parseFeedback } from './claude';
import { computeMetrics, countFillers } from './metrics';
import { averageBand, bandSeries, dayStreak, mistakeTypes, type Session } from './stats';
import { TOPICS } from './topics';

const sec = (s: number) => s * 10_000_000;

describe('azure', () => {
  it('builds an unscripted HundredMark header', () => {
    expect(JSON.parse(atob(pronunciationHeader()))).toEqual({
      ReferenceText: '',
      GradingSystem: 'HundredMark',
      Granularity: 'Word',
      Dimension: 'Comprehensive',
    });
  });

  it('parses flat scores (REST docs shape)', () => {
    const r = parseAzure({
      RecognitionStatus: 'Success',
      NBest: [
        {
          Lexical: 'good morning',
          Display: 'Good morning.',
          AccuracyScore: 90,
          FluencyScore: 80,
          CompletenessScore: 100,
          PronScore: 85,
          Words: [
            { Word: 'good', Offset: sec(1), Duration: sec(0.5), AccuracyScore: 95 },
            { Word: 'morning', Offset: sec(1.6), Duration: sec(0.4), AccuracyScore: 40 },
          ],
        },
      ],
    });
    expect(r).toMatchObject({ transcript: 'Good morning.', accuracy: 90, fluency: 80, completeness: 100, overall: 85 });
    expect(r.words[1]).toEqual({ word: 'morning', offset: 1.6, duration: 0.4, accuracy: 40 });
    expect(r.weakWords).toEqual([{ word: 'morning', accuracy: 40 }]);
  });

  it('parses scores nested under PronunciationAssessment', () => {
    const r = parseAzure({
      RecognitionStatus: 'Success',
      DisplayText: 'Hello.',
      NBest: [
        {
          PronunciationAssessment: { AccuracyScore: 60, FluencyScore: 70, PronScore: 65 },
          Words: [{ Word: 'hello', Offset: 0, Duration: sec(1), PronunciationAssessment: { AccuracyScore: 69 } }],
        },
      ],
    });
    expect(r).toMatchObject({ transcript: 'Hello.', accuracy: 60, completeness: null, overall: 65 });
    expect(r.weakWords).toEqual([{ word: 'hello', accuracy: 69 }]);
  });

  it('survives missing NBest and rejects failed recognition', () => {
    expect(parseAzure({ RecognitionStatus: 'Success', DisplayText: 'Hi.' }).words).toEqual([]);
    expect(() => parseAzure({ RecognitionStatus: 'NoMatch' })).toThrow(/No speech/);
    expect(() => parseAzure(null)).toThrow();
  });
});

describe('metrics', () => {
  it('computes wpm, pauses and longest pause', () => {
    // 4 words over 6 seconds; gaps: 0.2, 1.0, 2.5
    const w = [
      { word: 'a', offset: 0, duration: 0.5, accuracy: null },
      { word: 'b', offset: 0.7, duration: 0.3, accuracy: null },
      { word: 'c', offset: 2, duration: 0.5, accuracy: null },
      { word: 'd', offset: 5, duration: 1, accuracy: null },
    ];
    expect(computeMetrics(w, 'a b c d')).toMatchObject({ wordCount: 4, wpm: 40, pauseCount: 2, longestPause: 2.5 });
  });

  it('handles no words', () => {
    expect(computeMetrics([], '')).toMatchObject({ wpm: 0, pauseCount: 0, fillerTotal: 0 });
  });

  it('counts single and two-word fillers', () => {
    expect(countFillers('Um, I mean, it was like, you know, uh like fine. Hmm.')).toEqual({
      um: 1, 'i mean': 1, like: 2, 'you know': 1, uh: 1, hmm: 1,
    });
  });
});

describe('claude', () => {
  it('builds a prompt with transcript and metrics', () => {
    const p = buildPrompt(
      'Tell me about yourself.',
      { transcript: 'I am engineer.', lexical: '', words: [], accuracy: 80, fluency: null, completeness: null, overall: 75, weakWords: [] },
      { wordCount: 3, wpm: 120, pauseCount: 1, longestPause: 0.8, fillers: { um: 2 }, fillerTotal: 2 },
    );
    expect(p).toContain('I am engineer.');
    expect(p).toContain('120 words per minute');
    expect(p).toContain('um x2');
    expect(p).toContain('fluency n/a');
  });

  it('parses JSON wrapped in prose / code fences', () => {
    const f = parseFeedback('Sure!\n```json\n{"overallBand": "6.5", "summary": "Good", "issues": [{"type": "article", "wrong": "am engineer", "right": "am an engineer", "why": "Use an."}], "tips": ["Slow down", 3]}\n```');
    expect(f.overallBand).toBe(6.5);
    expect(f.summary).toBe('Good');
    expect(f.issues).toHaveLength(1);
    expect(f.tips).toEqual(['Slow down']);
  });

  it('fills missing fields with defaults', () => {
    expect(parseFeedback('{"issues": "oops", "vocabularyUpgrades": [null, {"better": "x"}]}')).toEqual({
      overallBand: null, grammarScore: null, vocabularyScore: null, coherenceScore: null,
      summary: '', corrected: '', issues: [],
      vocabularyUpgrades: [{ original: '', better: 'x', example: '' }], tips: [],
    });
  });

  it('throws when there is no JSON at all', () => {
    expect(() => parseFeedback('I cannot help with that.')).toThrow();
  });
});

describe('stats', () => {
  const at = (iso: string, band: number | null, types: string[] = []) =>
    ({
      createdAt: iso,
      feedback: band === null ? null : { overallBand: band, issues: types.map((type) => ({ type, wrong: '', right: '', why: '' })) },
    }) as unknown as Session;

  it('counts the day streak, alive until the end of the next day', () => {
    const now = new Date(2026, 10, 10, 20);
    const day = (d: number) => new Date(2026, 10, d, 9).toISOString();
    expect(dayStreak([{ createdAt: day(10) }, { createdAt: day(9) }, { createdAt: day(9) }, { createdAt: day(7) }], now)).toBe(2);
    expect(dayStreak([{ createdAt: day(9) }, { createdAt: day(8) }], now)).toBe(2);
    expect(dayStreak([{ createdAt: day(8) }], now)).toBe(0);
    expect(dayStreak([], now)).toBe(0);
  });

  it('averages bands chronologically and ranks mistake types', () => {
    const s = [at('2026-11-02', 7, ['Article', 'tense']), at('2026-11-01', 5, ['article']), at('2026-11-03', null)];
    expect(bandSeries(s)).toEqual([5, 7]);
    expect(averageBand(s)).toBe(6);
    expect(averageBand([])).toBeNull();
    expect(mistakeTypes(s)).toEqual([{ type: 'article', count: 2 }, { type: 'tense', count: 1 }]);
  });
});

it('has 40 topics across 5 categories', () => {
  expect(TOPICS).toHaveLength(40);
  expect(new Set(TOPICS.map((t) => t.category)).size).toBe(5);
});
