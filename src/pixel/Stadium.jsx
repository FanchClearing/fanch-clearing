import { useEffect, useRef } from 'react';
import { BASE, HOME } from './sprites.js';
import { drawSprite, line, rect, seededRandom, setupCanvas } from './draw.js';
import './stadium.css';

export const STADIUM_W = 160;
export const STADIUM_H = 284;

const SKY = ['#29366f', '#3b5dc9', '#41a6f6', '#73eff7'];
const CROWD = ['#b13e53', '#ffcd75', '#f4f4f4', '#3b5dc9', '#566c86', '#ef7d57', '#a7f070'];

/** 픽셀 야구장을 160x284 canvas에 그린다 (하늘·관중석 띠·펜스·잔디 줄무늬·흙 다이아몬드) */
export function drawStadium(ctx) {
  const rand = seededRandom(7);

  // 하늘
  SKY.forEach((c, i) => rect(ctx, 0, i * 15, STADIUM_W, 15, c));

  // 관중석 띠 (y 60~100)
  rect(ctx, 0, 60, STADIUM_W, 40, '#333c57');
  for (let y = 62; y < 98; y += 4) {
    for (let x = (y / 4) % 2 ? 1 : 3; x < STADIUM_W; x += 4) {
      rect(ctx, x, y, 2, 2, CROWD[Math.floor(rand() * CROWD.length)]);
    }
  }

  // 펜스 (y 100~108)
  rect(ctx, 0, 100, STADIUM_W, 8, '#257179');
  rect(ctx, 0, 100, STADIUM_W, 1, '#f4f4f4');

  // 잔디 줄무늬 (y 108~)
  for (let y = 108, i = 0; y < STADIUM_H; y += 12, i += 1) {
    rect(ctx, 0, y, STADIUM_W, 12, i % 2 ? '#38b764' : '#3ea85a');
  }

  // 흙 다이아몬드: 홈(80,250) 1루(130,200) 2루(80,150) 3루(30,200)
  const cx = 80;
  const top = 150;
  const bottom = 250;
  const mid = 200;
  const half = 50;
  for (let y = top; y <= bottom; y += 1) {
    const w = y <= mid ? y - top : bottom - y;
    const outer = Math.round((w / (mid - top)) * half);
    rect(ctx, cx - outer, y, outer * 2 + 1, 1, '#b86f50');
    // 안쪽 잔디 (가장자리 흙 띠를 남긴다)
    const inner = outer - 10;
    if (inner > 0 && y > top + 6 && y < bottom - 6) {
      rect(ctx, cx - inner, y, inner * 2 + 1, 1, (Math.floor(y / 12) % 2 ? '#38b764' : '#3ea85a'));
    }
  }

  // 파울 라인
  line(ctx, cx, bottom, cx - 142, bottom - 142, '#f4f4f4');
  line(ctx, cx, bottom, cx + 142, bottom - 142, '#f4f4f4');

  // 투수 마운드
  rect(ctx, cx - 6, mid - 3, 13, 7, '#b86f50');
  rect(ctx, cx - 3, mid - 1, 7, 2, '#733e39');

  // 베이스, 홈플레이트
  drawSprite(ctx, BASE, 130 - 3, mid - 3);
  drawSprite(ctx, BASE, 30 - 3, mid - 3);
  drawSprite(ctx, BASE, cx - 3, top - 3);
  drawSprite(ctx, HOME, cx - 3, bottom - 2);
}

/** 화면 뒤에 깔리는 배경. 위에 반투명 어둠막을 얹어 글자가 읽히게 한다. */
export default function Stadium({ dim = 0.35 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      drawStadium(setupCanvas(ref.current, STADIUM_W, STADIUM_H));
    } catch (e) {
      console.error('야구장 그리기 실패', e);
    }
  }, []);

  return (
    <div className="stadium-wrap" aria-hidden="true">
      <canvas ref={ref} className="stadium-canvas" />
      <div className="stadium-dim" style={{ background: `rgba(26, 28, 44, ${dim})` }} />
    </div>
  );
}
