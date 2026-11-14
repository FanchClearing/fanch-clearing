import { useEffect, useState } from 'react';
import { BUILD_ID, BUILD_LABEL, fetchLatestBuildId } from '../lib/version.js';

const RELOADED_KEY = 'objection.reloadedFor';

// 1) 화면 왼쪽 아래에 이 화면의 빌드 시각을 작게 보여 준다 (어느 버전을 보고 있는지 확인용)
// 2) 앱을 처음 열 때 서버에 더 새 버전이 있으면 자동으로 한 번 새로고침한다
// 3) 쓰는 도중에 새 버전이 나오면 "새로고침" 안내만 띄운다 (배틀 중에 갑자기 새로고침하지 않는다)
export default function UpdateGuard() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (BUILD_ID === 'dev') return undefined;
    let first = true;
    const check = async () => {
      const latest = await fetchLatestBuildId();
      if (!latest || latest === BUILD_ID) return;
      if (first) {
        // 처음 열 때: 같은 새 버전으로는 한 번만 자동 새로고침 (무한 반복 방지)
        let done = null;
        try {
          done = sessionStorage.getItem(RELOADED_KEY);
        } catch {
          /* 무시 */
        }
        if (done !== latest) {
          try {
            sessionStorage.setItem(RELOADED_KEY, latest);
          } catch {
            /* 무시 */
          }
          window.location.reload();
          return;
        }
      }
      setStale(true);
    };
    check().finally(() => {
      first = false;
    });
    const t = setInterval(check, 60000);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <>
      <div className="build-tag">빌드 {BUILD_LABEL}</div>
      {stale && (
        <button className="update-banner" onClick={() => window.location.reload()}>
          새 버전이 나왔어요 · 눌러서 새로고침
        </button>
      )}
    </>
  );
}
