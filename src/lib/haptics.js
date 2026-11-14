// 진동: navigator.vibrate (안드로이드 크롬 등). iOS Safari는 진동 API가 없어서 아무 일도 일어나지 않는다.
export const HAPTIC = {
  shake: 30, // 흔들 때마다 짧게 "웅"
  start: [250, 120, 250, 120, 250], // 시작: 세 번
  end: 900, // 종료: 한 번 크게
};

export function vibrate(pattern) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch (e) {
    console.error('진동 실패', e);
  }
}
