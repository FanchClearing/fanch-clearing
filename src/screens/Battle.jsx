import Stadium from '../pixel/Stadium.jsx';
import PushBar from '../pixel/PushBar.jsx';
import { Fists, HitTexts, OpponentCrowd, ShakeBox, SpeedLines } from '../pixel/Effects.jsx';
import './battle.css';

// 폰 전체를 덮는 1인칭 배틀 화면 (Room 내부에서 사용)
// 게이지는 A(첫 번째 팀)가 항상 왼쪽, B가 오른쪽. 내 팀에는 MY 표시.
export default function Battle({ game, team, battle, now, myCount, totals, sensorOk, onTap }) {
  const [aId, bId] = Object.keys(game.teams);
  const A = game.teams[aId];
  const B = game.teams[bId];
  const a = totals[aId] || 0;
  const b = totals[bId] || 0;
  const left = Math.max(0, Math.ceil((battle.endAt - now) / 1000));
  const myColor = game.teams[team].color;
  const oppId = team === aId ? bId : aId;
  const oppColor = game.teams[oppId].color;
  const safe = (c) => (c === '#131230' ? '#ffffff' : c); // 너무 어두운 색은 글자로 쓸 때 밝게

  return (
    <div className="battle-overlay">
      <Stadium dim={0.2} />
      <ShakeBox hit={myCount}>
        <SpeedLines />
        <OpponentCrowd color={oppColor} />
        <HitTexts hit={myCount} />

        <div className="hud">
          <div className="timer">{left}</div>
          <PushBar
            scoreA={a}
            scoreB={b}
            colorA={A.color}
            colorB={B.color}
            labelA="A"
            labelB="B"
            height={32}
          />
          <div className="totals">
            <span style={{ color: safe(A.color) }}>
              A {A.name} {a}
              {team === aId && <em className="my">MY</em>}
            </span>
            <span style={{ color: safe(B.color) }}>
              {b} {B.name} B{team === bId && <em className="my">MY</em>}
            </span>
          </div>
        </div>

        <div className="my-count">{myCount}</div>
        <Fists hit={myCount} color={myColor} />
        {!sensorOk && (
          <button className="px-btn tap-btn" onPointerDown={onTap}>
            연타!
          </button>
        )}
      </ShakeBox>
    </div>
  );
}
