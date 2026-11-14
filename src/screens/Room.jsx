import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { getGame } from '../data/games.js';
import { getNickname, getTeam, getUid } from '../lib/identity.js';
import { serverNow } from '../lib/serverTime.js';
import { requestShakePermission, startShake } from '../lib/shake.js';
import { showToast } from '../lib/toast.js';
import { HAPTIC, vibrate } from '../lib/haptics.js';
import { sceneFor, useSceneSound } from '../lib/sound.js';
import SoundToggle from '../pixel/SoundToggle.jsx';
import {
  OBJECTION_WINDOW_MS,
  SCORE_FLUSH_MS,
  addObjection,
  joinRoom,
  setMyCheer,
  setMyTaunt,
  usePresenceCounts,
  setMyShake,
  useBattlePhase,
  useCheerScores,
  useShakeScores,
  useTauntScores,
} from '../lib/room.js';
import Stadium from '../pixel/Stadium.jsx';
import PushBar from '../pixel/PushBar.jsx';
import { CheerParticles, TAUNT_KINDS } from '../pixel/Effects.jsx';
import Cutscene from '../pixel/Cutscene.jsx';
import Battle from './Battle.jsx';
import Cheer from './Cheer.jsx';
import Result from './Result.jsx';
import './room.css';
import './cheer.css';

const SENSOR_LABEL = {
  off: '흔들기 준비',
  ready: '준비 완료 ✓',
  denied: '권한 거부됨 (연타로 참여)',
  none: '센서 없음 (연타로 참여)',
};

export default function Room() {
  const { gameId } = useParams();
  const game = getGame(gameId);
  const team = getTeam();
  const { phase, battle, now, objectionCount, objectionLeftMs, threshold, gameState, runId } =
    useBattlePhase(gameId);
  const battleId = battle && battle.state === 'cutscene' ? battle.id : null;
  const { totals, list } = useShakeScores(gameId, battleId); // 배틀 점수
  const { totals: cheerTotals, list: cheerList } = useCheerScores(gameId, runId); // 평소 응원 점수
  const counts = usePresenceCounts(gameId); // 참여 인원 (운영자 가감 반영)
  const { others: tauntOthers } = useTauntScores(gameId, battleId, getUid()); // 다른 사람들이 놀린 횟수

  const [sensor, setSensor] = useState('off'); // off | ready | denied | none
  const [myCount, setMyCount] = useState(0); // 내 배틀 점수
  const [myCheerCount, setMyCheerCount] = useState(0); // 내 응원 점수
  const [myTauntCount, setMyTauntCount] = useState(0); // 내가 놀린(메롱) 횟수

  const countRef = useRef(0);
  const sentRef = useRef(-1);
  const cheerRef = useRef(0);
  const cheerSentRef = useRef(-1);
  const tauntRef = useRef(0);
  const tauntSentRef = useRef(-1);
  const battleRef = useRef(null);
  const modeRef = useRef({});
  battleRef.current = battle;

  // 벤치클리어링에서 이긴 팀(동점이면 없음): 이긴 팀만 결과 화면에서 상대를 놀릴 수 있다
  const [tA, tB] = game ? Object.keys(game.teams) : [];
  const winId =
    game && (totals[tA] || 0) !== (totals[tB] || 0)
      ? (totals[tA] || 0) > (totals[tB] || 0)
        ? tA
        : tB
      : null;
  const isWinner = Boolean(winId && winId === team);
  modeRef.current = { gameState, phase, runId, isWinner };

  const valid = Boolean(game && team && game.teams[team]);

  // 장면에 맞는 음악 (시작·응원: start / 컷신·배틀: battle / 결과·종료: end), 끝나면 반복
  useSceneSound(valid ? sceneFor(gameState, phase) : null);

  useEffect(() => {
    if (!valid) return undefined;
    return joinRoom(gameId, { uid: getUid(), team, nickname: getNickname() });
  }, [gameId, team, valid]);

  // 새 배틀이 시작되면 내 배틀 카운트 초기화
  useEffect(() => {
    countRef.current = 0;
    sentRef.current = -1;
    setMyCount(0);
    tauntRef.current = 0;
    tauntSentRef.current = -1;
    setMyTauntCount(0);
  }, [battleId]);

  // 새 경기가 시작되면 내 응원 카운트 초기화
  useEffect(() => {
    cheerRef.current = 0;
    cheerSentRef.current = -1;
    setMyCheerCount(0);
  }, [runId]);

  // 새로고침/재입장하면 서버에 저장된 내 점수에서 이어간다 (배틀·응원 모두)
  useEffect(() => {
    if (!battleId) return;
    const me = list.find((p) => p.uid === getUid());
    if (me && (me.count || 0) > countRef.current) {
      countRef.current = me.count;
      sentRef.current = me.count;
      setMyCount(me.count);
    }
  }, [list, battleId]);

  useEffect(() => {
    if (!runId) return;
    const me = cheerList.find((p) => p.uid === getUid());
    if (me && (me.count || 0) > cheerRef.current) {
      cheerRef.current = me.count;
      cheerSentRef.current = me.count;
      setMyCheerCount(me.count);
    }
  }, [cheerList, runId]);

  // 안드로이드 등 권한 팝업이 없는 기기는 자동으로 준비 (iOS는 버튼을 눌러야 한다)
  useEffect(() => {
    if (typeof DeviceMotionEvent === 'undefined') setSensor('none');
    else if (typeof DeviceMotionEvent.requestPermission !== 'function') setSensor('ready');
  }, []);

  // 흔들기/연타 1회 = +1.
  // 배틀 시간(startAt~endAt)이면 배틀 점수, 경기 진행 중이고 배틀이 아니면 응원 점수 (서버 시각 기준)
  const addShake = useCallback(() => {
    const b = battleRef.current;
    const m = modeRef.current;
    const t = serverNow();
    if (b && b.state === 'cutscene' && t >= b.startAt && t < b.endAt) {
      countRef.current += 1;
      setMyCount(countRef.current);
      vibrate(HAPTIC.shake); // 흔들 때마다 짧게 "웅"
    } else if (m.gameState === 'live' && m.phase === 'idle' && m.runId) {
      cheerRef.current += 1;
      setMyCheerCount(cheerRef.current);
      vibrate(HAPTIC.shake);
    }
  }, []);

  // 메롱 1번 = +1 (결과 화면에서 이긴 팀만)
  const addTaunt = useCallback(() => {
    const m = modeRef.current;
    if (m.gameState !== 'live' || m.phase !== 'result' || !m.isWinner) return;
    tauntRef.current += 1;
    setMyTauntCount(tauntRef.current);
    vibrate(HAPTIC.shake);
  }, []);

  // 배틀이 끝나 결과로 넘어가는 순간 크게 한 번 (중간에 들어온 폰은 울리지 않는다)
  const prevPhase = useRef(phase);
  useEffect(() => {
    if (prevPhase.current === 'battle' && phase === 'result') vibrate(HAPTIC.end);
    prevPhase.current = phase;
  }, [phase]);

  // 센서 감지
  useEffect(() => {
    if (sensor !== 'ready') return undefined;
    return startShake(addShake, () => setSensor('none'));
  }, [sensor, addShake]);

  // 배틀 중 300ms마다 내 배틀 점수 저장, 끝날 때 마지막으로 한 번 더 저장
  useEffect(() => {
    if (phase !== 'battle' || !battleId || !valid) return undefined;
    const flush = () => {
      if (countRef.current === sentRef.current) return;
      sentRef.current = countRef.current;
      setMyShake(gameId, battleId, getUid(), {
        team,
        nickname: getNickname(),
        count: countRef.current,
      }).catch((e) => {
        console.error('점수 저장 실패', e);
        showToast('점수 저장 실패! 계속 흔들어요');
        sentRef.current = -1;
      });
    };
    const t = setInterval(flush, SCORE_FLUSH_MS);
    return () => {
      clearInterval(t);
      flush();
    };
  }, [phase, battleId, gameId, team, valid]);

  // 결과 화면에서 놀리는 동안 300ms마다 내 횟수 저장 (바뀐 때만), 끝날 때 마지막으로 한 번 더
  useEffect(() => {
    if (phase !== 'result' || !battleId || !isWinner || !valid) return undefined;
    const flush = () => {
      if (tauntRef.current === tauntSentRef.current) return;
      tauntSentRef.current = tauntRef.current;
      setMyTaunt(gameId, battleId, getUid(), { team, count: tauntRef.current }).catch((e) => {
        console.error('메롱 저장 실패', e);
        tauntSentRef.current = -1;
      });
    };
    const t = setInterval(flush, SCORE_FLUSH_MS);
    return () => {
      clearInterval(t);
      flush();
    };
  }, [phase, battleId, isWinner, gameId, team, valid]);

  // 경기 진행 중에는 300ms마다 내 응원 점수 저장 (바뀐 때만)
  useEffect(() => {
    if (gameState !== 'live' || !runId || !valid) return undefined;
    const flush = () => {
      if (cheerRef.current === cheerSentRef.current) return;
      cheerSentRef.current = cheerRef.current;
      setMyCheer(gameId, runId, getUid(), {
        team,
        nickname: getNickname(),
        count: cheerRef.current,
      }).catch((e) => {
        console.error('응원 점수 저장 실패', e);
        showToast('점수 저장 실패! 계속 응원해요');
        cheerSentRef.current = -1;
      });
    };
    const t = setInterval(flush, SCORE_FLUSH_MS);
    return () => {
      clearInterval(t);
      flush();
    };
  }, [gameState, runId, gameId, team, valid]);

  // 팀을 아직 안 골랐거나 없는 경기면 팀 선택으로 보낸다.
  if (!valid) return <Navigate to={game ? `/game/${gameId}` : '/sports'} replace />;

  const entries = Object.entries(game.teams);
  const [aId, bId] = Object.keys(game.teams);
  const myTeam = game.teams[team];
  const otherId = team === aId ? bId : aId;

  const objection = () => {
    addObjection(gameId, getUid(), team).catch((e) => {
      console.error('이의 있음 실패', e);
      showToast('연결 실패! 다시 눌러주세요');
    });
  };

  // iOS 권한 팝업은 버튼 클릭 핸들러 안에서 요청해야 한다
  const prepareShake = async () => {
    const res = await requestShakePermission();
    setSensor(res === 'granted' ? 'ready' : res === 'denied' ? 'denied' : 'none');
  };

  // 이의 있음: 평소 응원 화면 아래에 붙는 작은 패널. 여기에만 인원수(n / 기준)가 나온다.
  const objectionPanel = (
    <div className="objection-panel">
      <button className="px-btn objection-btn small" onClick={objection}>
        이의 있음!
      </button>
      <p className="gauge-text">
        이의 있음 {Math.min(objectionCount, threshold)} / {threshold}
      </p>
      <div className="timebar">
        <div
          className="timebar-fill"
          style={{ width: `${(objectionLeftMs / OBJECTION_WINDOW_MS) * 100}%` }}
        />
      </div>
    </div>
  );

  // 경기 종료: 응원 점수로 승패
  const mine = cheerTotals[team] || 0;
  const other = cheerTotals[otherId] || 0;
  const res = mine > other ? 'win' : mine < other ? 'lose' : 'draw';
  const resText = { win: '승리!', lose: '패배…', draw: '무승부' }[res];

  return (
    <div className="screen">
      <SoundToggle />
      <Stadium tint={myTeam.color} dim={0.06} />
      <h2 className="room-title">{entries.map(([, t]) => t.name).join(' vs ')}</h2>

      {gameState === 'wait' && (
        <div className="state-card">
          <h2>곧 시작합니다</h2>
          <p>응원할 준비를 해주세요!</p>
        </div>
      )}

      {gameState === 'end' && (
        <div className={`state-card ${res}`}>
          <h2>경기 종료</h2>
          <div className="state-big">{resText}</div>
          <PushBar
            scoreA={cheerTotals[aId] || 0}
            scoreB={cheerTotals[bId] || 0}
            colorA={game.teams[aId].color}
            colorB={game.teams[bId].color}
            height={32}
          />
          <p>
            A {game.teams[aId].name} {cheerTotals[aId] || 0} : {cheerTotals[bId] || 0}{' '}
            {game.teams[bId].name} B
          </p>
          <p>내 응원 {myCheerCount}번</p>
        </div>
      )}

      {gameState === 'live' && phase === 'idle' && (
        <Cheer
          game={game}
          team={team}
          totals={cheerTotals}
          counts={counts}
          myCount={myCheerCount}
          sensorOk={sensor === 'ready'}
          onTap={addShake}
          objection={objectionPanel}
        />
      )}

      {gameState === 'live' && phase === 'cutscene' && (
        <Cutscene game={game} team={team} battle={battle} />
      )}
      {gameState === 'live' && phase === 'battle' && (
        <Battle
          game={game}
          team={team}
          battle={battle}
          now={now}
          myCount={myCount}
          totals={totals}
          sensorOk={sensor === 'ready'}
          onTap={addShake}
        />
      )}
      {gameState === 'live' && phase === 'result' && (
        <Result
          game={game}
          team={team}
          battle={battle}
          now={now}
          totals={totals}
          list={list}
          myCount={myCount}
        />
      )}

      {gameState === 'live' && phase === 'result' && winId && (
        <>
          {/* 이긴 팀이 놀리는 메롱 파티클: 이긴 팀·진 팀 모두의 화면에 올라온다 */}
          <CheerParticles
            hit={myTauntCount + tauntOthers}
            color={game.teams[winId].color}
            kinds={TAUNT_KINDS}
            scale={1.3}
          />
          {isWinner && (
            <div className="taunt-bar">
              <button className="px-btn taunt-btn" onPointerDown={addTaunt}>
                메롱~ <small>{myTauntCount}</small>
              </button>
            </div>
          )}
        </>
      )}

      <button className="px-btn ready-btn" disabled={sensor !== 'off'} onClick={prepareShake}>
        {SENSOR_LABEL[sensor]}
      </button>

      <p className="me">
        나: {getNickname()} ({myTeam.name})
      </p>
    </div>
  );
}
