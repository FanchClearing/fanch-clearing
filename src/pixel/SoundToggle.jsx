import { useEffect, useState } from 'react';
import { getSoundState, setMuted, subscribeSound } from '../lib/sound.js';

// 우측 상단 소리 버튼. 브라우저가 자동 재생을 막았을 때는 "소리 켜기"로 눌러 달라고 알려 준다.
export default function SoundToggle() {
  const [state, setState] = useState(getSoundState());
  useEffect(() => subscribeSound(setState), []);

  // 막혀 있을 때는 화면을 한 번 터치하라는 뜻이다. 브라우저는 터치 전에는 소리와 진동을 모두 막는다.
  const label = state.muted ? '소리 꺼짐' : state.blocked ? '터치해서 소리·진동 켜기' : '소리 켜짐';
  return (
    <button
      className={'sound-toggle' + (state.blocked && !state.muted ? ' attn' : '')}
      onClick={() => setMuted(!state.muted)}
    >
      {label}
    </button>
  );
}
