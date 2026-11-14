import Stadium from '../pixel/Stadium.jsx';
import PushBar from '../pixel/PushBar.jsx';
import {
  CLASH_KINDS,
  CheerParticles,
  Fists,
  HitTexts,
  OpponentCrowd,
  ShakeBox,
  SpeedLines,
} from '../pixel/Effects.jsx';
import './battle.css';

// 폰 전체를 덮는 1인칭 배틀 화면 (Room 내부에서 사용)
// 게이지는 A(첫 번째 팀)가 항상 왼쪽, B가 오른쪽. 내 팀에는 MY 표시.
export default function Battle({
  game,
  team,
  battle,
  now,
  myCount,
  totals,
  sensorOk,
  onTap,
  hitMine = myCount, // 내 팀 파티클 신호: 내가 누른 것 + 같은 팀 다른 사람이 누른 것
  hitOpp = 0, // 상대 팀 파티클 신호: 상대 팀 전체가 누른 것
}) {
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
    // 화면 어디를 눌러도(연타해도) 1회로 센다. 센서가 되는 폰도 흔들기와 함께 연타할 수 있다.
    <div className="battle-overlay" onPointerDown={onTap}>
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
        {/* 안내 문구: 아래쪽의 글러브(주먹)를 가리지 않게 점수판 아래에 작게 두고, 몇 번 누르면 사라진다 */}
        {myCount < 3 && (
          <div className="tap-hint">{sensorOk ? '흔들거나 화면을 연타!' : '화면을 연타!'}</div>
        )}
      </ShakeBox>
      {/* 벤치클리어링 중 파티클: 주먹·별·충돌 표시가 올라온다. 참여한 모두의 것이 뜬다 (내 팀은 오른쪽, 상대 팀은 왼쪽) */}
      <CheerParticles hit={hitMine} color={myColor} kinds={CLASH_KINDS} scale={1.25} inline />
      <CheerParticles
        hit={hitOpp}
        color={oppColor}
        kinds={CLASH_KINDS}
        scale={1.25}
        inline
        xRange={[8, 32]}
      />
    </div>
  );
}
