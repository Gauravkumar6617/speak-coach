import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';

import { parseAzure, pronunciationHeader, type Pronunciation } from './azure';
import { buildPrompt, FACE_MARK, GOAL_PROMPT, parseFeedback, parseGoalTask, splitReply, SYSTEM_PROMPT, TIPS_MARK, type Feedback } from './claude';
import { computeMetrics } from './metrics';
import type { Session } from './stats';
import type { Topic } from './topics';

// EXPO_PUBLIC_* vars are inlined at build time, so they must be read with literal names.
export const config = {
  anthropicKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '',
  // Feedback is the judgement-heavy call, so it gets the stronger model.
  anthropicModel: process.env.EXPO_PUBLIC_ANTHROPIC_MODEL || 'claude-sonnet-5-5',
  // Talk replies and goal tasks are short and frequent, so they go to the cheap model.
  anthropicFastModel: process.env.EXPO_PUBLIC_ANTHROPIC_FAST_MODEL || 'claude-haiku-5-5',
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

type Effort = 'low' | 'medium' | 'high';

// Effort sets how much Claude thinks before answering. Thinking is billed as output, so it is the main cost and speed lever.
async function callClaude(model: string, system: string, messages: { role: string; content: unknown }[], effort: Effort, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      output_config: { effort },
      system,
      messages,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Claude error (HTTP ${res.status}): ${data?.error?.message ?? 'unknown'}`);
  if (data?.stop_reason === 'refusal') throw new Error('Claude declined to answer.');
  return (data?.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
}

const coach = async (prompt: string) => parseFeedback(await callClaude(config.anthropicModel, SYSTEM_PROMPT, [{ role: 'user', content: prompt }], 'medium', 8000));

/** A practice task written around what the learner wants to get better at. `previous` avoids repeating the last task. */
export const goalTopic = async (goal: string, previous?: string): Promise<Topic> =>
  parseGoalTask(
    await callClaude(
      config.anthropicFastModel,
      GOAL_PROMPT,
      [{ role: 'user', content: `What I want to practise: ${goal}` + (previous ? `\nGive me a different task from this one: ${previous}` : '') }],
      'low',
      2000,
    ),
    goal,
  );

/** Only the latest turns are sent, so a long chat does not cost more with every reply. */
const MAX_TURNS = 12;

const SPOKEN =
  'Your replies are read aloud by text-to-speech, so write plain spoken English: no markdown, lists or emoji. ' +
  "The learner's turns come from speech recognition, so ignore punctuation and small recognition errors.";

const chatSystem = (opener: string) =>
  `You are a friendly English conversation partner helping a learner practise speaking. You opened the conversation by saying: "${opener}". ${SPOKEN} ` +
  'Keep each reply to 1-3 short sentences and usually end with a question that keeps the learner talking. ' +
  'If the learner makes a clear grammar mistake, briefly model the correct phrase in passing, without lecturing.';

const approachSystem = (scene: string) =>
  `You are role-playing a woman the learner does not know, so they can practise starting a conversation with a stranger. The situation, described to the learner: "${scene}" ` +
  'Stay in character and react as a real person would: warmer when the learner is friendly, genuine and respectful; brief or cooler when a line is pushy, generic or awkward; and if she would realistically want to end the chat, have her do so politely. ' +
  `${SPOKEN} Keep each in-character reply to 1-2 short sentences. ` +
  `After the reply, add a new line starting with "${TIPS_MARK}" for the screen (not read aloud): one short sentence on how the learner's last line came across, then two natural lines they could say next to keep the conversation going, each on its own line starting with "- ". ` +
  'Suggestions must be genuine and respectful: curiosity about her, the shared situation, light humour. No scripted pick-up lines, put-downs or pressure, and when she seems uninterested, suggest a graceful way to end the chat instead.';

/** Appended to a learner turn that a panelist cut off mid-answer. */
export const CUT = '[interrupted]';

export type Panelist = { name: string; role: string; style: string };

const interviewSystem = (opener: string, panel: Panelist[]) =>
  `You are a realistic job-interview panel helping a learner practise. The panel: ${panel.map((p) => `${p.name}, the ${p.role}, whose English has ${p.style}`).join('; ')}. ` +
  `${panel[0].name} opened by saying: "${opener}". ${SPOKEN} ` +
  'Start every reply with the speaking panelist\'s name and a colon, for example "Priya: ...". One panelist speaks per turn; rotate like a real panel, each from their angle ' +
  '(HR: motivation, culture, behaviour; hiring manager: experience, impact, judgement; technical lead: depth, trade-offs, specifics). Each speaks in their own style of English. ' +
  'Keep each turn to 1-2 short sentences with one question. Probe vague answers ("Why do you say that?", "What exactly did you do?", "What do you mean by that?") and ask for concrete examples and numbers. ' +
  'Be professional and neutral, sometimes sceptical, never rude. ' +
  `If the learner's last turn ends with "${CUT}", a panelist cut them off mid-answer: react to something specific they just said with a short challenge or clarifying question, the way people interrupt in real meetings. ` +
  `After the spoken turn, add a new line starting with "${TIPS_MARK}" for the screen (not read aloud): one short sentence on how their last answer came across to the panel, and one concrete way to make it stronger.`;

const FACE_NOTE = ` The latest turn includes a photo of the learner taken as they finished speaking. After everything else, add a new line starting with "${FACE_MARK}" and one or two short sentences for the screen (not read aloud): say whether their expression looks confident and engaged (eye contact with the camera, smile, tension in the face, head position) and give one thing to adjust. Comment only on expression and posture, never on appearance. If no face is clearly visible, say so in that line.`;

/**
 * Next spoken reply. `opener` is the first line on screen (not sent as a message): the coach's question in 'chat' mode,
 * the scene in 'approach' mode, where `tips` holds suggested next lines.
 * `style` describes whose English to speak (see ACCENTS); in 'interview' mode each of `panel` has their own. `photo` is a base64 JPEG of the learner taken as they finished speaking; with it, `face` is a note on their expression.
 */
export async function chatReply(
  mode: 'chat' | 'approach' | 'interview',
  opener: string,
  history: ChatMessage[],
  { photo, style, panel }: { photo?: string; style?: string; panel?: Panelist[] } = {},
) {
  const turns: { role: string; content: unknown }[] = history.slice(-MAX_TURNS); // an even count, so the window still starts on a user turn
  if (photo)
    turns[turns.length - 1] = {
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photo } },
        { type: 'text', text: history[history.length - 1].content },
      ],
    };
  const system =
    (mode === 'interview' && panel ? interviewSystem(opener, panel) : mode === 'approach' ? approachSystem(opener) : chatSystem(opener)) +
    (style && mode !== 'interview' ? ` Phrase every reply the way this speaker naturally talks, so the learner gets used to it: ${style}. Keep it natural and respectful, never a caricature.` : '') +
    (photo ? FACE_NOTE : '');
  return splitReply(await callClaude(config.anthropicFastModel, system, turns, 'low', 2000));
}

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
      feedback = await coach(buildPrompt(topic.text, pron, metrics, topic.goal));
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
