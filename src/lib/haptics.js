// 진동: navigator.vibrate (안드로이드 크롬 등). iOS Safari는 진동 API가 없어서 아무 일도 일어나지 않는다.
export const HAPTIC = {
  shake: 30, // 흔들 때마다 짧게 "웅"
  start: [250, 120, 250, 120, 250], // 시작: 세 번
  end: 900, // 종료: 한 번 크게
};

/** 아이폰/아이패드 여부 (아이패드는 맥으로 위장하므로 터치 지원 여부도 본다) */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function vibrate(pattern) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch (e) {
    console.error('진동 실패', e);
  }
}
