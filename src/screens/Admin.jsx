import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getGame } from '../data/games.js';
import { subscribeAdminStatus } from '../lib/adminApi.js';
import PushBar from '../pixel/PushBar.jsx';
import AdminControls from './AdminControls.jsx';
import './admin.css';

// 운영자 화면(폰용): 상태 표 + 조작부. 조작부는 전광판과 같은 부품(AdminControls)을 쓴다.
// 로직은 전부 lib/adminApi.js를 쓴다 (이 파일은 그 API를 부르는 예제이기도 하다).
export default function Admin() {
  const { gameId } = useParams();
  const game = getGame(gameId);
  const [status, setStatus] = useState(null);

  useEffect(() => subscribeAdminStatus(gameId, setStatus), [gameId]);

  if (!game) return <div className="screen">없는 경기입니다</div>;
  if (!status) return <div className="screen">불러오는 중…</div>;

  const [aId, bId] = Object.keys(game.teams);
  const A = status.teams[aId];
  const B = status.teams[bId];
  const sec = Math.ceil(status.phaseLeftMs / 1000);
  const safe = (c) => (c === '#131230' ? '#ffffff' : c);
  const battling = status.phase !== 'idle';
  const th = status.objections.threshold;

  let statusText = '경기 시작 전';
  if (status.gameState === 'end') statusText = '경기 종료';
  if (status.gameState === 'live') {
    statusText = {
      idle: '경기 중 · 응원 중',
      cutscene: '벤치클리어링 컷신',
      battle: `벤치클리어링 배틀 ${sec}초`,
      result: `판정 결과 발표 ${sec}초`,
    }[status.phase];
  }

  return (
    <div className="screen admin">
      <h2 className="admin-cap">운영자 화면 · {A.name} vs {B.name}</h2>

      <div className="admin-now">{statusText}</div>

      <table className="admin-table">
        <thead>
          <tr>
            <th />
            <th style={{ color: safe(A.color) }}>A {A.name}</th>
            <th style={{ color: safe(B.color) }}>B {B.name}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>응원 점수</td>
            <td>{A.cheer}</td>
            <td>{B.cheer}</td>
          </tr>
          <tr>
            <td>배틀 점수</td>
            <td>{A.score}</td>
            <td>{B.score}</td>
          </tr>
          <tr>
            <td>표시 인원</td>
            <td>{A.count}</td>
            <td>{B.count}</td>
          </tr>
          <tr>
            <td>실제 접속</td>
            <td>{A.realCount}</td>
            <td>{B.realCount}</td>
          </tr>
          <tr>
            <td>이의 있음</td>
            <td colSpan={2}>
              {Math.min(status.objections.count, th)} / {th}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="admin-tug">
        {battling ? (
          <PushBar scoreA={A.score} scoreB={B.score} colorA={A.color} colorB={B.color} />
        ) : (
          <PushBar scoreA={A.cheer} scoreB={B.cheer} colorA={A.color} colorB={B.color} />
        )}
      </div>

      <AdminControls gameId={gameId} status={status} />
    </div>
  );
}
