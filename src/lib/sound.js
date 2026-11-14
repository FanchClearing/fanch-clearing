import { useEffect } from 'react';

// 장면별 음악 (public/sound 의 AAC 파일). 각 약 30초, 장면이 이어지는 동안 무한 반복한다.
const FILES = {
  start: '/sound/start.m4a',
  battle: '/sound/battle.m4a',
  end: '/sound/end.m4a',
};
const VOLUME = 0.7;
const MUTE_KEY = 'objection.muted';

/**
 * 지금 화면 상태 → 어떤 음악을 틀지 정하는 표. 바꾸고 싶으면 여기만 고친다.
 *  - start : 경기 시작 전 + 평소 응원 중
 *  - battle: 벤치클리어링 컷신 + 배틀
 *  - end   : 판정 결과 발표 + 경기 종료
 */
export function sceneFor(gameState, phase) {
  if (gameState === 'wait') return 'start';
  if (gameState === 'end') return 'end';
  if (gameState === 'live') {
    if (phase === 'idle') return 'start';
    if (phase === 'cutscene' || phase === 'battle') return 'battle';
    if (phase === 'result') return 'end';
  }
  return null;
}

const audios = {};
let current = null; // 지금 틀려고 하는 장면
let blocked = false; // 브라우저가 자동 재생을 막은 상태 (화면을 한 번 눌러야 풀림)
let muted = false;
const listeners = new Set();

try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  /* 저장소가 막혀 있으면 기본값 */
}

const notify = () => listeners.forEach((l) => l({ blocked, muted }));

function getAudio(name) {
  if (!audios[name]) {
    const a = new Audio(FILES[name]);
    a.loop = true; // 끝나면 바로 다시 시작
    a.preload = 'auto';
    a.volume = VOLUME;
    audios[name] = a;
  }
  return audios[name];
}

function tryPlay() {
  if (!current || muted) return;
  const a = getAudio(current);
  const p = a.play();
  if (p && typeof p.then === 'function') {
    p.then(() => {
      if (blocked) {
        blocked = false;
        notify();
      }
    }).catch((e) => {
      // 자동 재생이 막힌 경우: 다음 터치에서 다시 시도한다
      if (!blocked) {
        blocked = true;
        notify();
      }
      console.error('음악 재생 대기 (화면을 한 번 눌러야 합니다)', e && e.name);
    });
  }
}

/** 화면을 처음 누르는 순간 막혀 있던 음악을 재생한다 */
function unlock() {
  if (blocked || current) tryPlay();
}
if (typeof window !== 'undefined') {
  ['pointerdown', 'touchend', 'keydown'].forEach((ev) =>
    window.addEventListener(ev, unlock, { passive: true })
  );
}

/** 장면 음악 전환. 같은 장면이면 이어서 틀고, null이면 멈춘다 */
export function playScene(scene) {
  if (scene === current) return;
  if (current && audios[current]) {
    audios[current].pause();
    audios[current].currentTime = 0;
  }
  current = scene;
  if (scene) tryPlay();
}

export function stopSound() {
  playScene(null);
}

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    /* 무시 */
  }
  if (muted) {
    if (current && audios[current]) audios[current].pause();
  } else {
    tryPlay();
  }
  notify();
}

export function getSoundState() {
  return { blocked, muted };
}

export function subscribeSound(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** 장면이 바뀔 때마다 음악을 맞춰 틀고, 화면을 떠나면 멈추는 훅 */
export function useSceneSound(scene) {
  useEffect(() => {
    playScene(scene);
  }, [scene]);
  useEffect(() => () => stopSound(), []);
}
