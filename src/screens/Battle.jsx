import Stadium from '../pixel/Stadium.jsx';
import { Fists, HitTexts, OpponentCrowd, ShakeBox, SpeedLines } from '../pixel/Effects.jsx';
import './battle.css';

// 폰 전체를 덮는 1인칭 배틀 화면 (Room 내부에서 사용)
export default function Battle({ game, team, battle, now, myCount, totals, sensorOk, onTap }) {
  const ids = Object.keys(game.teams);
  const oppId = ids.find((id) => id !== team);
  const mine = totals[team] || 0;
  const opp = totals[oppId] || 0;
  const sum = mine + opp;
  const ratio = sum === 0 ? 50 : (mine / sum) * 100;
  const left = Math.max(0, Math.ceil((battle.endAt - now) / 1000));
  const myColor = game.teams[team].color;
  const oppColor = game.teams[oppId].color;

  return (
    <div className="battle-overlay">
      <Stadium dim={0.2} />
      <ShakeBox hit={myCount}>
        <SpeedLines />
        <OpponentCrowd color={oppColor} />
        <HitTexts hit={myCount} />

        <div className="hud">
          <div className="timer">{left}</div>
          <div className="tug">
            <div className="tug-mine" style={{ width: `${ratio}%`, background: myColor }} />
            <div className="tug-opp" style={{ background: oppColor }} />
          </div>
          <div className="totals">
            <span style={{ color: myColor === '#131230' ? '#fff' : myColor }}>
              {game.teams[team].name} {mine}
            </span>
            <span>
              {opp} {game.teams[oppId].name}
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
