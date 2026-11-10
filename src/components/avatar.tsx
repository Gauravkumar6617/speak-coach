import { useEffect, useState } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

type Mood = 'idle' | 'speaking' | 'listening' | 'thinking';

// ponytail: illustrated avatar with random mouth flaps, not real lip-sync. Upgrade path: a
// streaming video-avatar API (D-ID / HeyGen / Simli) driven by Claude's reply text.
export function CoachAvatar({ mood, size = 160 }: { mood: Mood; size?: number }) {
  const theme = useTheme();
  const [mouth, setMouth] = useState(0); // 0 = closed .. 1 = wide open
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (mood !== 'speaking') return;
    const id = setInterval(() => setMouth(Math.random()), 110);
    return () => {
      clearInterval(id);
      setMouth(0);
    };
  }, [mood]);

  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3600);
    return () => clearInterval(id);
  }, []);

  const skin = '#F2C7A5';
  const hair = '#2E2340';
  const lookUp = mood === 'thinking' ? -3 : 0;
  const eyeRy = blink ? 0.6 : mood === 'listening' ? 6 : 5;

  return (
    <Svg width={size} height={size} viewBox="0 0 160 160" accessibilityLabel="Coach">
      <Defs>
        <ClipPath id="coach-circle">
          <Circle cx={80} cy={80} r={78} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#coach-circle)">
      <Circle cx={80} cy={80} r={78} fill={mood === 'listening' ? theme.primarySoft : theme.backgroundSelected} />
      {/* shoulders */}
      <Path d="M28 160 C32 124 56 112 80 112 C104 112 128 124 132 160 Z" fill={theme.primary} />
      <Rect x={70} y={98} width={20} height={20} rx={6} fill={skin} />
      {/* head */}
      <Ellipse cx={80} cy={70} rx={36} ry={40} fill={skin} />
      {/* hair */}
      <Path d="M43 66 C40 34 62 22 82 24 C104 25 122 40 117 68 C112 52 100 44 84 44 C66 44 52 50 43 66 Z" fill={hair} />
      <G>
        <Ellipse cx={66} cy={70 + lookUp} rx={4.5} ry={eyeRy} fill={hair} />
        <Ellipse cx={94} cy={70 + lookUp} rx={4.5} ry={eyeRy} fill={hair} />
        <Path d={`M58 ${60 + lookUp} Q66 ${56 + lookUp} 73 ${60 + lookUp}`} stroke={hair} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Path d={`M87 ${60 + lookUp} Q94 ${56 + lookUp} 102 ${60 + lookUp}`} stroke={hair} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      </G>
      <Circle cx={57} cy={84} r={5} fill="#F09A8A" opacity={0.45} />
      <Circle cx={103} cy={84} r={5} fill="#F09A8A" opacity={0.45} />
      {mood === 'speaking' ? (
        <Ellipse cx={80} cy={91} rx={9 + mouth * 2} ry={1.5 + mouth * 6} fill="#7A2E3A" />
      ) : (
        <Path d="M69 89 Q80 98 91 89" stroke="#7A2E3A" strokeWidth={3} fill="none" strokeLinecap="round" />
      )}
      </G>
    </Svg>
  );
}
