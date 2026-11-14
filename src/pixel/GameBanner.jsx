import { useEffect, useRef, useState } from 'react';
import './gamebanner.css';

const SHOW_MS = 1900;

/**
 * 경기 상태가 바뀌는 순간만 배너를 띄운다: 시작 전/종료 → 진행 중 = "경기 시작!", 진행 중 → 종료 = "경기 종료!".
 * ready: 서버의 첫 값이 도착했는지. 도착 전 기본값 때문에 이미 진행 중인 경기에서 "경기 시작!"이 뜨지 않게,
 * 첫 값은 기준으로만 삼고 그 뒤의 "변화"에만 반응한다.
 */
export function useGameBanner(gameState, ready) {
  const prev = useRef(null);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    if (!ready) return;
    if (prev.current === null) {
      prev.current = gameState;
      return;
    }
    const before = prev.current;
    prev.current = gameState;

    let text = null;
    if (gameState === 'live' && before !== 'live') text = '경기 시작!';
    else if (gameState === 'end' && before === 'live') text = '경기 종료!';
    if (!text) return;

    const id = Date.now();
    setBanner({ id, text, kind: gameState === 'live' ? 'start' : 'end' });
    // 취소하지 않는다 (리렌더로 deps가 바뀌어도 끝나면 반드시 사라진다)
    setTimeout(() => setBanner((b) => (b && b.id === id ? null : b)), SHOW_MS);
  }, [gameState, ready]);

  return banner;
}

export default function GameBanner({ banner }) {
  if (!banner) return null;
  return (
    <div className="game-banner" key={banner.id}>
      <span className={'game-banner-text ' + banner.kind}>{banner.text}</span>
    </div>
  );
}
