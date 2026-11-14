import './battle.css';

// Room 내부에서 쓰는 배틀 패널. (이펙트는 T10에서 추가)
export default function Battle({ game, team, battle, now, myCount, totals, sensorOk, onTap }) {
  const ids = Object.keys(game.teams);
  const oppId = ids.find((id) => id !== team);
  const mine = totals[team] || 0;
  const opp = totals[oppId] || 0;
  const sum = mine + opp;
  const ratio = sum === 0 ? 50 : (mine / sum) * 100;
  const left = Math.max(0, Math.ceil((battle.endAt - now) / 1000));

  return (
    <div className="battle">
      <div className="timer">{left}</div>
      <div className="tug">
        <div className="tug-mine" style={{ width: `${ratio}%`, background: game.teams[team].color }} />
        <div className="tug-opp" style={{ background: game.teams[oppId].color }} />
      </div>
      <div className="totals">
        <span>{game.teams[team].name} {mine}</span>
        <span>{opp} {game.teams[oppId].name}</span>
      </div>
      <div className="my-count">{myCount}</div>
      {!sensorOk && (
        <button className="px-btn tap-btn" onPointerDown={onTap}>
          연타!
        </button>
      )}
    </div>
  );
}
