import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';

// Azure's pronunciation-assessment docs say REST audio "should be no more than 30 seconds".
// ponytail: 60 s as specified; drop to 30 if long answers come back with errors or poor scores.
export const MAX_SECONDS = 60;

/** Records 16 kHz mono 16-bit PCM WAV on iOS (resampled by AVAudioConverter) and Android (AudioRecord). */
export function useWavRecorder() {
  const { stream } = useAudioStream({ sampleRate: 16000, channels: 1, encoding: 'int16' });

  async function start() {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) throw new Error('Microphone permission is needed to record. Enable it in system settings.');
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
