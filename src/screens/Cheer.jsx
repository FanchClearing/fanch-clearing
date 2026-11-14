import PushBar from '../pixel/PushBar.jsx';
import { CheerParticles, ShakeBox } from '../pixel/Effects.jsx';
import './cheer.css';

const safe = (c) => (c === '#131230' ? '#ffffff' : c);

// 평소 응원 화면 (경기 진행 중, 배틀이 아닐 때).
// 야구장 배경이 잘 보이도록 위(점수 바)와 아래(이의 있음)만 패널로 쓰고 가운데는 비워 둔다.
// 흔들거나 누를 때마다 하트·야구공·응원봉이 떠오른다. 인원수는 보여주지 않는다.
export default function Cheer({ game, team, totals, myCount, sensorOk, onTap, objection }) {
  const [aId, bId] = Object.keys(game.teams);
  const A = game.teams[aId];
  const B = game.teams[bId];
  const a = totals[aId] || 0;
  const b = totals[bId] || 0;
  const myColor = game.teams[team].color;

  return (
    <>
      <ShakeBox hit={myCount} growing className="cheer-box">
        <div className="cheer">
          <div className="cheer-top">
            <div className="cheer-badge">응원 중</div>
            <PushBar scoreA={a} scoreB={b} colorA={A.color} colorB={B.color} height={28} />
            <div className="cheer-totals">
              <span style={{ color: safe(A.color) }}>
                A {A.name} {a}
                {team === aId && <em className="my">MY</em>}
              </span>
              <span style={{ color: safe(B.color) }}>
                {b} {B.name} B{team === bId && <em className="my">MY</em>}
              </span>
            </div>
          </div>

          {/* 가운데는 비워서 야구장이 보이게 한다. 내 점수는 패널 없이 글자만 */}
          <div className="cheer-mid">
            <div className="cheer-mine">
              <small>내 응원 점수</small>
              <strong>{myCount}</strong>
              <span>{sensorOk ? '흔들어라!' : '눌러라!'}</span>
            </div>
          </div>

          <div className="cheer-bottom">
            {!sensorOk && (
              <button className="px-btn cheer-tap" onPointerDown={onTap}>
                응원!
              </button>
            )}
            {objection}
          </div>
        </div>
      </ShakeBox>
      <CheerParticles hit={myCount} color={myColor} />
    </>
  );
}
