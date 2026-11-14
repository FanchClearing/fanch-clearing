# 운영자 API

운영진 화면을 만들 때 쓰는 API입니다. 서버를 새로 띄우지 않고, 이미 쓰는 Firebase Realtime Database를 그대로 씁니다(무료, HTTPS).
방법은 두 가지이고 기능은 같습니다.

| 방법 | 언제 쓰나 |
|---|---|
| A. JS 모듈 (`src/lib/adminApi.js`) | 이 프로젝트(React) 안에서 화면을 만들 때. 가장 쉽다 |
| B. REST (HTTP 호출) | 다른 프레임워크·정적 HTML·외부 도구에서 호출할 때 |

경기 ID는 지금 `kbo-lg-hh` 하나입니다. 아래 `{gameId}`에 넣으세요. 예제 화면은 `src/screens/Admin.jsx`(`/admin/kbo-lg-hh`)입니다.

---

## 0. 경기 흐름

```
경기 시작 전(wait) ──[경기 시작]──▶ 경기 중(live) ──[경기 종료]──▶ 종료(end)
                                     │
                                     ├ 평소: 응원 모드 (phase = idle)  흔들기/누르기로 팀 응원 점수 ↑, 밀어내기 바
                                     └ 이의 있음이 기준 인원 이상 모이거나 [벤치클리어링 시작]
                                          └▶ 컷신 5초(cutscene) ▶ 배틀(battle, 기본 10초) ▶ 결과 15초(result) ▶ 다시 응원 모드
```

- 이의 있음·벤치클리어링은 **경기 중(live)일 때만** 동작합니다.
- 경기 종료는 **응원 모드(idle)일 때만** 할 수 있습니다(배틀 중 종료 불가).
- 경기를 다시 시작하면 응원 점수가 0부터 다시 쌓입니다(`runId`가 새로 만들어짐).
- 평소 응원 화면에는 인원수가 없고, 이의 있음 패널에만 `n / 기준`이 나옵니다.

---

## A. JS 모듈

```js
import { subscribeAdminStatus, adminActions, ADMIN_LIMITS } from '../lib/adminApi.js';
```

### 상태 구독

```js
const stop = subscribeAdminStatus('kbo-lg-hh', (status) => { /* 화면 갱신 */ });
// 화면을 닫을 때 stop() 호출
```

값이 바뀌거나 250ms마다 `status`를 넘겨 줍니다.

```jsonc
{
  "gameId": "kbo-lg-hh",
  "serverNow": 1763100000000,           // 서버 시각(ms). 시간 계산은 이 값 기준
  "gameState": "live",                  // wait(시작 전) | live(진행 중) | end(종료)
  "phase": "idle",                      // live일 때 세부 단계: idle(응원 중) | cutscene | battle | result
  "phaseLeftMs": 0,                     // 현재 단계가 끝날 때까지 남은 시간
  "battle": null,                       // 진행 중이면 { id, cutsceneAt, startAt, endAt }
  "battleMs": 10000,                    // 다음 배틀부터 적용되는 배틀 길이
  "teams": {                            // 첫 번째가 A(왼쪽), 두 번째가 B(오른쪽)
    "lg": { "name": "LG",   "color": "#c30452",
            "count": 12,                // 화면에 보이는 인원수 (실제 + 가감)
            "realCount": 10,            // 실제 접속자 수
            "adjust": 2,                // 운영자 가감값
            "score": 0,                 // 이번 배틀 점수
            "cheer": 340 },             // 이번 경기 응원 점수
    "hh": { "name": "한화", "color": "#ff6600", "count": 9, "realCount": 9, "adjust": 0, "score": 0, "cheer": 310 }
  },
  "presenceTotal": 19,                  // 실제 전체 접속자
  "objections": { "count": 2, "threshold": 3, "leftMs": 6400 },   // threshold = 발동 기준 인원
  "can": { "startGame": false, "endGame": true, "startBattle": true, "next": false }  // 지금 누를 수 있는 동작
}
```

`can`의 값으로 버튼을 켜고 끄면 됩니다(누를 수 있는 것만 활성).

### 동작

```js
await adminActions.startGame(gameId);              // 경기 시작 (시작 전/종료 상태에서만) → true/false
await adminActions.endGame(gameId);                // 경기 종료 (진행 중 + 응원 모드일 때만) → true/false
await adminActions.startBattle(gameId);            // 벤치클리어링 시작 = 판정 배틀 강제 시작 (경기 중 + 응원 모드일 때만) → true/false
await adminActions.next(gameId);                   // 다음 판정: 결과를 끝내고 응원 모드로 (진행 중 배틀이 있을 때만) → true/false
await adminActions.setBattleSeconds(gameId, 20);   // 다음 배틀부터 20초 (5~60초로 보정)
await adminActions.setThreshold(gameId, 5);        // 이의 있음 발동 기준 인원 (1~50)
await adminActions.setCountAdjust(gameId, 'lg', 3);// 화면에 보이는 LG 인원수에 +3 (-99~99, 0이면 실제 수 그대로)
```

성공/불가 여부는 `true/false`로, 서버 연결 문제는 reject로 알려 줍니다. 한계값은 `ADMIN_LIMITS`에 있습니다.

> 인원수 가감은 **연출용**입니다. 전광판·경기 선택 카드에 보이는 인원수만 바뀌고, 실제 접속자 수(`realCount`)는 그대로입니다.
> 이의 있음 발동은 가감값이 아니라 **실제로 누른 사람 수**로 판단합니다.

---

## B. REST

`{DB}`는 Firebase 콘솔 → Realtime Database 상단의 주소(`https://xxxx-default-rtdb.<지역>.firebasedatabase.app`)입니다.
모든 요청 끝에 `.json`을 붙입니다. 로그인/토큰은 필요 없습니다(현재 규칙이 `rooms/` 전체 읽기·쓰기 허용).

### 읽기 (GET)

| 무엇 | 주소 / 값 |
|---|---|
| 경기 상태 | `{DB}/rooms/{gameId}/game.json` → `{state, runId, startedAt, endedAt}` 또는 `null`(= wait) |
| 배틀 상태 | `{DB}/rooms/{gameId}/battle.json` → `{state, id, cutsceneAt, startAt, endAt}` 또는 `null` |
| 접속자 | `{DB}/rooms/{gameId}/presence.json` → `{ uid: {team, nickname, joinedAt} }` |
| 이의 있음 | `{DB}/rooms/{gameId}/objections.json` → `{ uid: {team, at} }` (최근 10초 것만 유효) |
| 응원 점수 | `{DB}/rooms/{gameId}/cheer/{runId}.json` → `{ uid: {team, nickname, count} }` (팀별로 count 합산) |
| 배틀 점수 | `{DB}/rooms/{gameId}/shakes/{battleId}.json` → 같은 모양 |
| 설정 | `config/battleMs`(기본 10000), `config/threshold`(기본 3), `config/countAdjust/{teamId}`(기본 0) |

배틀 단계(`now`는 서버 시각 ms):

```
battle이 null 이거나 state != "cutscene"  → idle
now < startAt → cutscene / now < endAt → battle / now < endAt + 15000 → result / 그 밖 → idle
```

서버 시각은 응답의 `Date` 헤더를 쓰면 됩니다(`curl -sI "{DB}/.json?shallow=true"`).
실시간으로 받으려면 같은 주소에 `Accept: text/event-stream` 헤더를 주면 변경 때마다 푸시됩니다(SSE).

### 쓰기 — 단순 값

```bash
curl -X PUT -d 15000 "{DB}/rooms/{gameId}/config/battleMs.json"        # 배틀 길이(ms), 5000~60000
curl -X PUT -d 5     "{DB}/rooms/{gameId}/config/threshold.json"       # 발동 기준 인원, 1~50
curl -X PUT -d 3     "{DB}/rooms/{gameId}/config/countAdjust/lg.json"  # LG 표시 인원 +3, -99~99
```

### 쓰기 — "조건이 맞을 때만" 하는 동작 (ETag 조건부 쓰기)

두 곳에서 동시에 누르거나 상태가 이미 바뀐 경우를 막기 위해, 먼저 ETag를 받고 `if-match`로 씁니다.
`200`이면 성공, `412`면 그 사이 상태가 바뀐 것이니 정상 동작입니다(실패 처리).

```bash
# 공통: 현재 값과 ETag 조회
curl -si -H "X-Firebase-ETag: true" "{DB}/rooms/{gameId}/game.json"     # 응답 헤더 ETag: <값>
```

**경기 시작** — `game.state`가 `live`가 아닐 때만

```bash
curl -X PUT -H "if-match: <ETag>" \
  -d '{"state":"live","runId":"run-<고유 문자열>","startedAt":<서버시각ms>}' \
  "{DB}/rooms/{gameId}/game.json"
curl -X DELETE "{DB}/rooms/{gameId}/objections.json"      # 이전 이의 있음 기록 정리
```

**경기 종료** — `game.state`가 `live`이고 배틀이 진행 중이 아닐 때만

```bash
curl -X PUT -H "if-match: <ETag>" \
  -d '{"state":"end","runId":"<기존 runId>","startedAt":<기존 값>,"endedAt":<서버시각ms>}' \
  "{DB}/rooms/{gameId}/game.json"
```

**벤치클리어링 시작(배틀 강제 시작)** — `game.state`가 `live`이고, `battle`이 `null`이거나 `state`가 `idle`일 때만

```bash
# battle.json의 ETag를 조회한 뒤
#   cutsceneAt = 서버시각 + 300 / startAt = cutsceneAt + 5000 / endAt = startAt + battleMs(기본 10000)
curl -X PUT -H "if-match: <battle ETag>" \
  -d '{"state":"cutscene","id":"admin-<고유 문자열>","cutsceneAt":<..>,"startAt":<..>,"endAt":<..>}' \
  "{DB}/rooms/{gameId}/battle.json"
```

**다음 판정** — `battle.state`가 `cutscene`일 때만

```bash
curl -X PUT -H "if-match: <battle ETag>" -d '{"state":"idle"}' "{DB}/rooms/{gameId}/battle.json"
curl -X DELETE "{DB}/rooms/{gameId}/objections.json"
```

> 조건부 쓰기(`if-match`)는 빈 값에 처음 쓰면 200, 같은 ETag로 다시 쓰면 412가 나오는 것을 실제 DB로 확인했습니다.
> 하지만 위 동작들을 실제 방(`kbo-lg-hh`)에 대고 순서대로 돌려보지는 않았습니다. 처음 쓸 때는 테스트 방 ID로 먼저 해 보세요.

---

## 주의

- **로그인이 없습니다.** 주소와 방 ID를 아는 사람은 누구나 시작/종료할 수 있습니다. 발표용으로만 쓰고, 끝나면 DB 규칙을 닫으세요.
- 자체 URL과 인증이 있는 "진짜 서버 API"가 필요하면 Firebase Cloud Functions를 써야 하는데, **카드 등록이 필요한 요금제(Blaze)** 가 필요합니다. 무료 범위 안에서는 위 방식이 가장 단순합니다.
- 점수·접속자 값은 클라이언트가 직접 씁니다. 운영자 API는 읽기 + 위 동작만 제공합니다.
