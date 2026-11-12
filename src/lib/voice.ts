import { fetch } from 'expo/fetch';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';

import { config } from './api';
import { ssml } from './azure';

/** Whose English the coach speaks: an Azure neural voice plus how people there tend to phrase things. */
export type Accent = { id: string; label: string; name: string; voice: string; style: string };

// ponytail: Japan/China/Korea use a native-language voice reading English, which gives the accent but is not a true
// "English as spoken in X" voice (Azure has none). Swap in a better voice here if one ships.
export const ACCENTS: Accent[] = [
  { id: 'us', label: '🇺🇸 US', name: 'Emily', voice: 'en-US-AvaNeural', style: 'American vocabulary and idioms' },
  { id: 'uk', label: '🇬🇧 UK', name: 'Sophie', voice: 'en-GB-SoniaNeural', style: "British vocabulary and idioms such as 'reckon', 'brilliant', 'cheers', 'quite'" },
  { id: 'au', label: '🇦🇺 Australia', name: 'Chloe', voice: 'en-AU-NatashaNeural', style: "Australian expressions such as 'no worries', 'reckon', 'arvo', and a laid-back tone" },
  { id: 'in', label: '🇮🇳 India', name: 'Priya', voice: 'en-IN-NeerjaNeural', style: "Indian English phrasing such as 'isn't it?', 'only' for emphasis, 'kindly', 'do one thing', 'I am having'" },
  { id: 'sg', label: '🇸🇬 Singapore', name: 'Mei Ling', voice: 'en-SG-LunaNeural', style: "Singapore English: short, quick sentences, particles like 'lah', 'leh', 'lor', 'can', 'already', and questions like 'Can or not?'" },
  { id: 'ph', label: '🇵🇭 Philippines', name: 'Maria', voice: 'en-PH-RosaNeural', style: "Philippine English: warm and polite, expressions like 'for a while' (meaning wait), 'already', 'Oh my gosh'" },
  { id: 'hk', label: '🇭🇰 Hong Kong', name: 'Karen', voice: 'en-HK-YanNeural', style: "Hong Kong English: concise, with the occasional sentence-final 'la' or 'ah'" },
  { id: 'ng', label: '🇳🇬 Nigeria', name: 'Ngozi', voice: 'en-NG-EzinneNeural', style: "Nigerian English: expressions like 'How far?', 'I'm coming' (meaning wait), 'well done' as a greeting" },
  { id: 'za', label: '🇿🇦 South Africa', name: 'Thandi', voice: 'en-ZA-LeahNeural', style: "South African English: 'just now', 'now now', 'lekker', 'is it?' as a reply" },
  { id: 'jp', label: '🇯🇵 Japan', name: 'Yuki', voice: 'ja-JP-NanamiNeural', style: "a Japanese professional speaking English: polite, simple sentence structures, fillers like 'ano...' or 'eto...'" },
  { id: 'cn', label: '🇨🇳 China', name: 'Li Na', voice: 'zh-CN-XiaoxiaoNeural', style: "a Chinese professional speaking English: direct, simple grammar, few articles" },
  { id: 'kr', label: '🇰🇷 Korea', name: 'Ji-woo', voice: 'ko-KR-SunHiNeural', style: 'a Korean professional speaking English: polite, simple structures' },
];

export const SPEEDS = [
  { label: 'Slow', rate: -20 },
  { label: 'Normal', rate: 0 },
  { label: 'Fast', rate: 20 },
];

export type VoicePref = { accent: string; speed: number };
const prefFile = new File(Paths.document, 'voice.json');

export async function loadVoicePref(): Promise<VoicePref> {
  try {
    return { accent: 'us', speed: 1, ...JSON.parse(await prefFile.text()) };
  } catch {
    return { accent: 'us', speed: 1 };
  }
}
export const saveVoicePref = (p: VoicePref) => prefFile.write(JSON.stringify(p));

let current: { player?: AudioPlayer; done: () => void } | null = null;

/** Stops whatever the coach is saying (or is about to say) and reports it done. */
export function stopSpeaking() {
  const c = current;
  current = null;
  Speech.stop();
  c?.player?.remove();
  c?.done();
}

/** Speaks `text` in the chosen accent; `done` runs once when it ends, fails or is stopped. */
export async function speak(text: string, accent: Accent, rate: number, done: () => void) {
  stopSpeaking();
  const me: NonNullable<typeof current> = { done };
  current = me;
  try {
    const res = await fetch(`https://${config.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.azureKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      },
      body: ssml(text, accent.voice, rate),
    });
    if (!res.ok) throw new Error(`Azure TTS HTTP ${res.status}`);
    const file = new File(Paths.cache, 'coach.mp3');
    await file.write(new Uint8Array(await res.arrayBuffer()));
    if (current !== me) return; // interrupted while downloading
    me.player = createAudioPlayer({ uri: file.uri });
    me.player.addListener('playbackStatusUpdate', (s) => s.didJustFinish && current === me && stopSpeaking());
    me.player.play();
  } catch {
    if (current !== me) return;
    // No Azure voice (offline, missing key): the phone's own voice still talks, in the closest locale it has.
    Speech.speak(text, { language: accent.voice.slice(0, 5), rate: 1 + rate / 100, onDone: done, onError: done });
  }
}
