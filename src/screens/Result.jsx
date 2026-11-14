import { RESULT_MS } from '../lib/room.js';
import './result.css';

const VERDICTS = [
  (w) => `오심 인정! ${w} 팬 승리`,
  (w) => `원심 번복! ${w} 팬심 압승`,
  (w) => `판정은 바뀌지 않지만 ${w} 팬은 이겼다`,
];

// 배틀 id로 문구를 정해서 모든 폰·호스트에서 같은 판정문이 나오게 한다.
function hashIndex(str, mod) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % mod;
}

// Room 내부에서 쓰는 결과 패널. (Host에서도 재사용 예정)
export default function Result({ game, team, battle, now, totals, list, myCount }) {
  const ids = Object.keys(game.teams);
  const [aId, bId] = ids;
  const a = totals[aId] || 0;
  const b = totals[bId] || 0;
  const tie = a === b;
  const winId = a > b ? aId : bId;
  const winName = game.teams[winId].name;
  const verdict = tie
    ? '판정 보류! 재경기 요청'
    : VERDICTS[hashIndex(battle.id || '', VERDICTS.length)](winName);
  const left = Math.max(0, Math.ceil((battle.endAt + RESULT_MS - now) / 1000));
  const top3 = list.filter((p) => (p.count || 0) > 0).slice(0, 3);

  return (
    <div className="result">
      <div className="stamp">팬심 판정</div>
      <p className="verdict" style={{ color: tie ? 'var(--fg)' : game.teams[winId].color }}>
        {verdict}
      </p>

      <div className="scores">
        {ids.map((id) => (
          <div key={id} className="score" style={{ background: game.teams[id].color }}>
            <span>{game.teams[id].name}</span>
            <strong>{totals[id] || 0}</strong>
          </div>
        ))}
      </div>

      {team && (
        <p className="mine">
          내 기록 ({game.teams[team].name}): <strong>{myCount}</strong>번
        </p>
      )}

      <h3 className="mvp-title">MVP 흔들러 TOP 3</h3>
      <ol className="mvp">
        {top3.length === 0 && <li>기록 없음</li>}
        {top3.map((p) => (
          <li key={p.uid}>
            <span className="dot" style={{ background: game.teams[p.team]?.color }} />
            {p.nickname} <em>{p.count}</em>
          </li>
        ))}
      </ol>

      <p className="countdown">{left}초 뒤 대기실로 돌아갑니다</p>
      <p className="disclaimer">실제 판정은 바뀌지 않습니다 :)</p>
    </div>
  );
}
