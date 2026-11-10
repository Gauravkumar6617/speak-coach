import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';

import { parseAzure, pronunciationHeader, type Pronunciation } from './azure';
import { buildPrompt, parseFeedback, SYSTEM_PROMPT, type Feedback } from './claude';
import { computeMetrics } from './metrics';
import type { Session } from './stats';
import type { Topic } from './topics';

// EXPO_PUBLIC_* vars are inlined at build time, so they must be read with literal names.
export const config = {
  anthropicKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '',
  anthropicModel: process.env.EXPO_PUBLIC_ANTHROPIC_MODEL || 'claude-sonnet-5-5',
  azureKey: process.env.EXPO_PUBLIC_AZURE_SPEECH_KEY ?? '',
  azureRegion: process.env.EXPO_PUBLIC_AZURE_SPEECH_REGION ?? '',
  azureLocale: process.env.EXPO_PUBLIC_AZURE_SPEECH_LOCALE || 'en-US',
};

export const missingKeys = () =>
  [
    !config.azureKey && 'EXPO_PUBLIC_AZURE_SPEECH_KEY',
    !config.azureRegion && 'EXPO_PUBLIC_AZURE_SPEECH_REGION',
    !config.anthropicKey && 'EXPO_PUBLIC_ANTHROPIC_API_KEY',
  ].filter(Boolean) as string[];

export const canTranscribe = () => !!(config.azureKey && config.azureRegion);

/** Transcribes + scores a WAV, then deletes it. */
export async function assess(wavUri: string): Promise<Pronunciation> {
  try {
    return await postToAzure(wavUri);
  } finally {
    new File(wavUri).delete();
  }
}

async function postToAzure(wavUri: string): Promise<Pronunciation> {
  const url =
    `https://${config.azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1` +
    `?language=${encodeURIComponent(config.azureLocale)}&format=detailed`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': config.azureKey,
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      Accept: 'application/json',
      'Pronunciation-Assessment': pronunciationHeader(),
    },
    body: await new File(wavUri).bytes(),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Azure rejected the audio (HTTP ${res.status}). ${body.slice(0, 200)}`);
  return parseAzure(JSON.parse(body));
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

async function callClaude(system: string, messages: ChatMessage[], maxTokens = 16000): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Claude error (HTTP ${res.status}): ${data?.error?.message ?? 'unknown'}`);
  if (data?.stop_reason === 'refusal') throw new Error('Claude declined to answer.');
  return (data?.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
}

const coach = async (prompt: string) => parseFeedback(await callClaude(SYSTEM_PROMPT, [{ role: 'user', content: prompt }]));

/** Next spoken reply in a free conversation. `opener` is the coach's first line (not sent as a message). */
export const chatReply = (opener: string, history: ChatMessage[]) =>
  callClaude(
    `You are a friendly English conversation partner helping a learner practise speaking. You opened the conversation by saying: "${opener}". ` +
      'Your replies are read aloud by text-to-speech, so write plain spoken English: no markdown, lists or emoji. ' +
      'Keep each reply to 1-3 short sentences and usually end with a question that keeps the learner talking. ' +
      'If the learner makes a clear grammar mistake, briefly model the correct phrase in passing, without lecturing. ' +
      'The learner\'s turns come from speech recognition, so ignore punctuation and small recognition errors.',
    history,
    4000,
  );

/** Azure first (Claude needs its transcript), then local metrics and Claude. Only Azure failures throw. */
export async function analyze(wavUri: string, topic: Topic): Promise<Session> {
  const pron = await assess(wavUri);
  if (!pron.words.length && !pron.transcript.trim()) throw new Error('No speech was recognized.');
  const metrics = computeMetrics(pron.words, pron.lexical);
  let feedback: Feedback | null = null;
  let feedbackError: string | undefined;
  if (!config.anthropicKey) feedbackError = 'EXPO_PUBLIC_ANTHROPIC_API_KEY is not set, so there is no grammar feedback.';
  else
    try {
      feedback = await coach(buildPrompt(topic.text, pron, metrics));
    } catch (e) {
      feedbackError = `Grammar feedback unavailable: ${(e as Error).message}`;
    }
  const { words, lexical, ...pronSummary } = pron;
  return {
    id: Date.now().toString(36),
    createdAt: new Date().toISOString(),
    topic: topic.text,
    category: topic.category,
    pron: pronSummary,
    metrics,
    feedback,
    feedbackError,
  };
}
