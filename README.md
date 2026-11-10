# Speak Coach

A personal English speaking-practice app for iOS and Android, built from one Expo (React Native, TypeScript) codebase. You get a random topic, answer it out loud for up to 60 seconds, and see:

- Azure pronunciation scores, the transcript and your weakest words
- your pace, pauses and filler words, computed on the phone
- grammar and vocabulary feedback from Claude

The **Talk** tab is a spoken back-and-forth conversation. The coach speaks using the phone's built-in voice, and you tap the mic to answer. Azure turns your answer into text, and Claude replies, which the phone reads aloud. Tap a coach bubble to hear it again.

There is no backend and no account. Sessions are saved to `sessions.json` on the phone.

## How it works

- **Recording**: `expo-audio`'s `useAudioStream` writes a 16 kHz, mono, 16-bit PCM WAV on both platforms. iOS resamples the mic with AVAudioConverter, and Android records with AudioRecord at 16 kHz. If a device ever produces a different format, the app refuses to send it and shows the format it got (`src/lib/recorder.ts`).
- **Azure**: the app sends one POST to the Speech-to-text REST API for short audio (`format=detailed`) with an unscripted `Pronunciation-Assessment` header.
- **Claude**: the transcript and metrics go to the Messages API, which returns JSON feedback. If Claude fails, the feedback screen still shows the transcript, pronunciation and metrics, with a short note.
- **Pure logic, unit-tested**: everything in `src/lib/` except `api.ts`, `store.ts` and `recorder.ts`.

## Setup

Requires Node 20+.

```bash
npm install
cp .env.example .env
```

Fill in `.env`. It is git-ignored, so never commit real keys.

| Variable | Notes |
|---|---|
| `EXPO_PUBLIC_AZURE_SPEECH_KEY` | Required for transcription. Find it in the Azure portal: your Speech resource → Keys and Endpoint. |
| `EXPO_PUBLIC_AZURE_SPEECH_REGION` | Required, for example `eastus`. |
| `EXPO_PUBLIC_AZURE_SPEECH_LOCALE` | Optional. Defaults to `en-US`. |
| `EXPO_PUBLIC_ANTHROPIC_API_KEY` | Optional. Without it you get no grammar or vocabulary feedback. |
| `EXPO_PUBLIC_ANTHROPIC_MODEL` | Optional. Defaults to `claude-sonnet-5-5`. |

The app also starts with no keys. It tells you which keys are missing, and it disables the mic until the Azure key and region are set.

> `EXPO_PUBLIC_*` values are baked into the app bundle at build time. After you edit `.env`, restart Metro or rebuild. Anyone with the APK or IPA can extract the keys, so keep builds to yourself.

Run the tests:

```bash
npm test
```

## Android phone

You need Android Studio (for the SDK) and JDK 17.

1. On the phone, enable **Developer options → USB debugging**, then connect it by USB. `adb devices` should list it.
2. Build, install and start the app:

   ```bash
   npx expo run:android --device
   ```

   The first run generates the `android/` folder, which is git-ignored and regenerated from `app.json`.

### Installable APK

```bash
npx expo prebuild --platform android   # skip if android/ already exists
cd android
./gradlew assembleRelease
```

The APK is at `android/app/build/outputs/apk/release/app-release.apk`. The generated project signs release builds with the debug key, which is fine for installing on your own phone. Copy it to the phone, or run `adb install app/build/outputs/apk/release/app-release.apk`.

## iPhone

You need a Mac with Xcode, and CocoaPods is installed automatically.

1. In `app.json`, change `ios.bundleIdentifier` (`com.yourname.speakcoach`) to something unique, for example `com.<yourname>.speakcoach`.
2. Connect the iPhone by USB, trust the computer, and turn on **Settings → Privacy & Security → Developer Mode**.
3. Generate the project:

   ```bash
   npx expo run:ios --device
   ```

4. If signing fails, open `ios/SpeakCoach.xcworkspace` in Xcode. Select the **SpeakCoach** target, go to **Signing & Capabilities**, check *Automatically manage signing*, and pick your **Team** (a free Apple ID works). Then run `npx expo run:ios --device` again.
5. The first time, the phone may block the app. Trust it in **Settings → General → VPN & Device Management**. Builds signed with a free Apple ID stop working after 7 days, so rebuild when that happens.

## Checking the audio on a new device

1. Record a 10-second answer. If the feedback screen shows a transcript, the WAV recorded correctly and Azure accepted it.
2. If you see "Recorder produced X Hz…", the device could not deliver 16 kHz mono int16.
3. If you see "Azure rejected the audio (HTTP 4xx)", the message includes Azure's reason.

## Project layout

```
src/app/(tabs)/index.tsx     Practice: topic, mic, countdown ring
src/app/(tabs)/talk.tsx      Talk: spoken conversation with the coach
src/app/(tabs)/report.tsx    Report: stats, band chart, mistake bars, swipe-to-delete list
src/app/(tabs)/settings.tsx  Settings: key status, export, delete all
src/app/session/[id].tsx     Feedback screen
src/lib/                     topics, azure, metrics, claude, stats (pure + logic.test.ts), api, store, recorder
```
