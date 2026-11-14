// 빌드 정보와 "새 버전이 배포됐는지" 확인. 개발 서버에서는 동작하지 않는다.
/* global __BUILD_ID__, __BUILD_LABEL__ */
export const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
export const BUILD_LABEL = typeof __BUILD_LABEL__ !== 'undefined' ? __BUILD_LABEL__ : '개발';

/** 서버의 최신 빌드 id를 가져온다. 실패하면 null (네트워크 문제로 앱이 죽지 않게) */
export async function fetchLatestBuildId() {
  if (BUILD_ID === 'dev') return null;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id || null;
  } catch {
    return null;
  }
}
