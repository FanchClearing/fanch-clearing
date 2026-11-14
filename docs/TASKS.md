# TASKS — 구현 순서 (해커톤)

규칙: 하나 끝내면 `[x]` 체크 → 커밋 → 멈추고 확인받기.
괄호 안 시간은 목표치. 넘으면 단순화하고 다음으로 넘어간다.
**T1~T7이 데모의 뼈대**, T8~T10은 비주얼, T11~T12는 마무리.

## 뼈대 (데모 동작) — 약 90분
- [x] **T1 프로젝트 세팅 (10분)**
  Vite React(JS) 생성, react-router-dom·firebase·qrcode.react 설치, Galmuri 폰트·global.css, `firebase.js`(env 읽기), 빈 라우트 8개.
  배포는 하지 않는다(T12에서 진행). 개발 중 테스트는 `npm run dev -- --host` + 같은 와이파이 폰 접속, 센서 대신 연타 버튼으로 확인.
- [x] **T2 선택 화면 S0~S3 (10분)**
  `data/games.js`, `lib/identity.js`(uid·닉네임·team localStorage), 홈 → 종목 → 경기 → 팀 선택 → `/room/:gameId` 이동. 픽셀 꾸밈은 최소한으로.
- [x] **T3 방 입장·접속자 수 (10분)**
  `lib/room.js`에 presence 등록/onDisconnect/구독. Room 화면 상단 팀별 접속자 수. 경기 선택 카드에도 접속자 수.
- [x] **T4 서버 시각 + 이의 있음 트리거 (15분)**
  `lib/serverTime.js`, objection 기록·구독·10초 윈도 게이지, 기준 충족 시 battle transaction(`idle`일 때만). 상태 단계 계산 훅 `useBattlePhase(gameId)` → `'idle'|'cutscene'|'battle'|'result'`. 결과 후 자동 리셋.
  이 단계에서는 컷신/배틀/결과를 글자만 있는 임시 화면으로 둔다.
- [x] **T5 흔들기 + 점수 동기화 (20분)**
  `lib/shake.js`(권한 요청, 감지, 센서 없음 판단), [흔들기 준비] 버튼, 배틀 중에만 카운트, 300ms flush, 팀별 합산·줄다리기 게이지(단순 div), 타이머, 연타 버튼 대체.
- [x] **T6 결과 화면 (10분)**
  승리 팀·합계·내 기록·MVP TOP 3·랜덤 판정문·동점 처리·15초 카운트다운.
- [x] **T7 호스트 화면 (10분)**
  `/host/:gameId`: QR(origin + `/game/:gameId`), 접속자 수, objection 게이지, 상태별 대형 뷰(배틀 게이지·결과), [강제 판정 시작](threshold 무시 transaction), [다음 판정](idle 리셋), 배틀 시간 설정(5~60초, `setBattleDuration`, 다음 배틀부터 적용).
  ✅ **체크포인트: 브라우저 탭 여러 개(또는 같은 와이파이 폰) + 노트북으로 데모 시나리오 1~8을 끝까지 돌려본다.**

## 비주얼 (픽셀) — 약 60분
- [x] **T8 픽셀 엔진 + 야구장 배경 (15분)**
  `pixel/draw.js`(문자열 스프라이트 + 팔레트 → 저해상도 canvas 160x284 → CSS로 확대, pixelated), `Stadium.jsx`(하늘, 관중석 띠, 펜스, 잔디 줄무늬, 흙 다이아몬드). Room·배틀 배경 적용. 픽셀 버튼 스타일 공통화.
- [x] **T9 컷신 (25분)**
  `Cutscene.jsx`: 클로즈업 노려보기(팀 컬러 모자·유니폼, 로고 없음, 눈 깜빡임, 줌인) → 와이드 구장 벤치클리어링(양 팀 8명씩 몰려가 뭉치기) → START!! + 화면 흔들림 + 플래시. `cutsceneAt` 기준 경과 시간으로 장면 결정(폰끼리 싱크). Host에서도 재생.
- [x] **T10 배틀 이펙트 (20분)**
  `Effects.jsx`: 흔들기마다 화면 흔들림·타격 텍스트·주먹 뻗기, 회전 집중선, 멀리 상대 팀 선수 무리, 하단 내 주먹(팀 컬러). 게이지·숫자도 픽셀 스타일로.

## 마무리 — 약 20분
- [ ] **T11 안정화 (10분)**
  새로고침·재입장 시 상태 복구, 에러 토스트, 데스크톱 고정 폭, iOS 권한 거부 시 연타 버튼, 콘솔 에러 0개 확인.
- [ ] **T12 배포 + 데모 리허설 (15분)**
  `firebase init hosting`(public: dist, SPA rewrite: yes) → `npm run build` → `firebase deploy --only hosting` → HTTPS 주소에서 iOS 흔들기 권한 확인 → 실제 폰 3대 이상으로 시나리오 1~8 두 번 반복 → [강제 판정 시작] 대체 동선 확인 → DB `rooms/kbo-lg-hh` 비우고 발표 대기.
