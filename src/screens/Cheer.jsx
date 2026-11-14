import PushBar from '../pixel/PushBar.jsx';
import { CheerParticles, ShakeBox } from '../pixel/Effects.jsx';
import './cheer.css';

const safe = (c) => (c === '#131230' ? '#ffffff' : c);

// 평소 응원 화면 (경기 진행 중, 배틀이 아닐 때).
// 야구장 배경이 잘 보이도록 위(점수 바)와 아래(이의 있음)만 패널로 쓰고 가운데는 비워 둔다.
// 흔들거나 누를 때마다 하트·야구공·응원봉이 떠오른다. 참여 인원(운영자 가감 반영)을 ● LIVE로 보여 준다.
export default function Cheer({
  game,
  team,
  totals,
  counts = {},
  myCount,
  sensorOk,
  onTap,
  objection,
  hitMine = myCount, // 내 팀 파티클 신호: 내가 누른 것 + 같은 팀 다른 사람이 누른 것
  hitOpp = 0, // 상대 팀 파티클 신호: 상대 팀 전체가 누른 것
  oppColor = '#ffffff',
}) {
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
            <div className="cheer-people">
              <span className="live-dot" />
              <b>LIVE</b>
              <span>팬 {counts.total || 0}명 참여</span>
              <span className="cheer-people-teams">
                A {counts[aId] || 0} · B {counts[bId] || 0}
              </span>
            </div>
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
      {/* 참여한 모두의 응원이 파티클로 뜬다: 내 팀(같은 팀 포함)은 오른쪽, 상대 팀은 왼쪽에서 */}
      <CheerParticles hit={hitMine} color={myColor} />
      <CheerParticles hit={hitOpp} color={oppColor} xRange={[8, 32]} />
    </>
  );
}
