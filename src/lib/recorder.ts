import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';
import { useRef } from 'react';

import { rms } from './metrics';

// Azure's pronunciation-assessment docs say REST audio "should be no more than 30 seconds".
// ponytail: 60 s as specified; drop to 30 if long answers come back with errors or poor scores.
export const MAX_SECONDS = 60;

/** With `onSilence`, recording ends this long after the learner stops talking. */
export const SILENCE_SECONDS = 4;
// ponytail: fixed loudness gate. Raise it if a noisy room never auto-stops; lower it if quiet speakers get cut off.
const SPEECH_RMS = 600;

/** Records 16 kHz mono 16-bit PCM WAV on iOS (resampled by AVAudioConverter) and Android (AudioRecord). */
export function useWavRecorder(onSilence?: () => void) {
  const heard = useRef({ speech: false, last: 0, fired: false });
  const { stream } = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: 'int16',
    // Only counts silence after some speech, so thinking before the first word never ends the turn.
    onBuffer:
      onSilence &&
      ((b) => {
        const h = heard.current;
        if (rms(b.data) > SPEECH_RMS) Object.assign(h, { speech: true, last: b.timestamp });
        else if (h.speech && !h.fired && b.timestamp - h.last > SILENCE_SECONDS) {
          h.fired = true;
          onSilence();
        }
      }),
  });

  async function start() {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) throw new Error('Microphone permission is needed to record. Enable it in system settings.');
    heard.current = { speech: false, last: 0, fired: false };
    await stream.start();
    await stream.startFileRecordingAsync({ format: 'wav' });
  }

  async function stop(): Promise<string> {
    const r = await stream.stopFileRecordingAsync();
    stream.stop();
    // The stream leaves iOS in a record-only session, which would mute text-to-speech.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (r.sampleRate !== 16000 || r.channels !== 1 || r.encoding !== 'int16')
      throw new Error(`Recorder produced ${r.sampleRate} Hz, ${r.channels} ch, ${r.encoding}; Azure needs 16 kHz mono int16.`);
    return r.uri;
  }

  return { start, stop };
}
