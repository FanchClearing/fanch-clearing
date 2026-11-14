// 어디서든 showToast('메시지')로 픽셀 토스트를 띄운다. (화면은 pixel/Toast.jsx)
const EVENT = 'app-toast';
const lastShown = {};

export function showToast(message) {
  const now = Date.now();
  if (lastShown[message] && now - lastShown[message] < 3000) return; // 같은 메시지 도배 방지
  lastShown[message] = now;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
}

export function subscribeToast(cb) {
  const handler = (e) => cb(e.detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
