export const SHAKE_THRESHOLD = 15; // m/s², 가속도 변화량 합
export const SHAKE_COOLDOWN_MS = 120;
const NO_SENSOR_MS = 3000;

/**
 * 센서 권한 요청. iOS는 반드시 버튼 클릭 핸들러 안에서 호출해야 한다.
 * 반환: 'granted' | 'denied' | 'unsupported'
 */
export async function requestShakePermission() {
  if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') {
    return 'unsupported';
  }
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const res = await DeviceMotionEvent.requestPermission();
      return res === 'granted' ? 'granted' : 'denied';
    } catch (e) {
      console.error('모션 권한 요청 실패', e);
      return 'denied';
    }
  }
  return 'granted';
}

/**
 * 흔들기 감지 시작. onShake()는 흔들 때마다 호출된다.
 * 3초 동안 devicemotion 이벤트가 하나도 안 오면 onNoSensor()를 호출한다.
 * 반환: 해제 함수
 */
export function startShake(onShake, onNoSensor) {
  let last = null;
  let lastShakeAt = 0;
  let gotEvent = false;

  const handler = (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    gotEvent = true;
    const cur = { x: a.x, y: a.y, z: a.z };
    if (last) {
      const delta =
        Math.abs(cur.x - last.x) + Math.abs(cur.y - last.y) + Math.abs(cur.z - last.z);
      const t = performance.now();
      if (delta > SHAKE_THRESHOLD && t - lastShakeAt > SHAKE_COOLDOWN_MS) {
        lastShakeAt = t;
        onShake();
      }
    }
    last = cur;
  };

  window.addEventListener('devicemotion', handler);
  const timer = setTimeout(() => {
    if (!gotEvent && onNoSensor) onNoSensor();
  }, NO_SENSOR_MS);

  return () => {
    clearTimeout(timer);
    window.removeEventListener('devicemotion', handler);
  };
}
