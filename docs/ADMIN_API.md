# 운영자 API

운영진 화면을 만들 때 쓰는 API입니다. 서버를 새로 띄우지 않고, 이미 쓰는 Firebase Realtime Database를 그대로 씁니다(무료, HTTPS).
방법은 두 가지이고 기능은 같습니다.

| 방법 | 언제 쓰나 |
|---|---|
| A. JS 모듈 (`src/lib/adminApi.js`) | 이 프로젝트(React) 안에서 화면을 만들 때. 가장 쉽다 |
| B. REST (HTTP 호출) | 다른 프레임워크·정적 HTML·외부 도구에서 호출할 때 |

경기 ID는 지금 `kbo-lg-hh` 하나입니다. 아래 `{gameId}`에 넣으세요.

---

## 0. 상태(phase)와 흐름

```
idle(대기) ──[이의 있음 3명 / 강제 시작]──▶ cutscene(5초) ──▶ battle(기본 10초) ──▶ result(15초) ──▶ idle
                                                                              └ [다음 판정]으로 바로 idle
```

| phase | 뜻 | 운영자가 할 수 있는 것 |
|---|---|---|
| `idle` | 대기. 이의 있음 대기 중 | 강제 판정 시작 |
| `cutscene` | 컷신 재생 중 | (없음) |
| `battle` | 흔들기 대결 중 | (없음) |
| `result` | 결과 발표 중 | 다음 판정 |

배틀 길이 설정은 어느 phase에서든 바꿀 수 있고, **다음 배틀부터** 적용됩니다.

---

## A. JS 모듈

```js
import { subscribeAdminStatus, adminActions } from '../lib/adminApi.js';
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
  "serverNow": 1763100000000,          // 서버 시각(ms). 시간 계산은 이 값 기준
  "phase": "idle",                     // idle | cutscene | battle | result
  "phaseLeftMs": 0,                    // 현재 단계가 끝날 때까지 남은 시간
  "battle": null,                      // 진행 중이면 { id, cutsceneAt, startAt, endAt }
  "battleMs": 10000,                   // 다음 배틀부터 적용되는 배틀 길이
  "teams": {                           // 첫 번째가 A(왼쪽), 두 번째가 B(오른쪽)
    "lg": { "name": "LG",   "color": "#c30452", "count": 3, "score": 0 },
    "hh": { "name": "한화", "color": "#ff6600", "count": 2, "score": 0 }
  },
  "presenceTotal": 5,                  // 전체 접속자
  "objections": { "count": 2, "threshold": 3, "leftMs": 6400 },
  "can": { "start": true, "next": false }   // 지금 누를 수 있는 동작 (버튼 활성/회색 판단용)
}
```

### 동작

```js
await adminActions.forceStart('kbo-lg-hh');          // 강제 판정 시작. idle일 때만 성공 → true / 아니면 false
await adminActions.next('kbo-lg-hh');                // 다음 판정(대기로 복귀). 진행 중일 때만 성공 → true / false
await adminActions.setBattleSeconds('kbo-lg-hh', 20); // 다음 배틀부터 20초. 5~60초로 보정
```

모두 Promise이고, 서버 연결 문제면 reject 됩니다. 예제는 `src/screens/Admin.jsx`입니다.

---

## B. REST

`{DB}`는 Firebase 콘솔 → Realtime Database 상단의 주소(`https://xxxx-default-rtdb.<지역>.firebasedatabase.app`)입니다.
모든 요청 끝에 `.json`을 붙입니다. 로그인/토큰은 필요 없습니다(현재 규칙이 `rooms/` 전체 읽기·쓰기 허용).

### 읽기 (GET)

| 무엇 | 주소 |
|---|---|
| 배틀 상태 | `GET {DB}/rooms/{gameId}/battle.json` → `{state, id, cutsceneAt, startAt, endAt}` 또는 `null` (`state`가 `idle`이면 대기) |
| 접속자 | `GET {DB}/rooms/{gameId}/presence.json` → `{ uid: {team, nickname, joinedAt} }` |
| 이의 있음 | `GET {DB}/rooms/{gameId}/objections.json` → `{ uid: {team, at} }` (최근 10초 것만 유효) |
| 배틀 점수 | `GET {DB}/rooms/{gameId}/shakes/{battleId}.json` → `{ uid: {team, nickname, count} }` (팀별로 count 합산) |
| 배틀 길이 설정 | `GET {DB}/rooms/{gameId}/config/battleMs.json` → 숫자(ms), 없으면 기본 10000 |

phase 계산(`now`는 서버 시각 ms):

```
battle이 null 이거나 state != "cutscene"  → idle
now < startAt                              → cutscene
now < endAt                                → battle
now < endAt + 15000                        → result
그 밖                                      → idle (곧 자동 초기화됨)
```

서버 시각은 응답의 `Date` 헤더를 쓰면 됩니다(예: `curl -sI "{DB}/.json?shallow=true"`).
실시간으로 받으려면 같은 주소에 `Accept: text/event-stream` 헤더를 주면 변경 때마다 푸시됩니다(SSE).

### 쓰기

**배틀 길이 설정** (다음 배틀부터, 5000~60000 사이로 넣으세요)

```bash
curl -X PUT -d 15000 "{DB}/rooms/{gameId}/config/battleMs.json"
```

**강제 판정 시작** — "대기일 때만" 성공해야 하므로 ETag 조건부 쓰기를 씁니다.

```bash
# 1) 현재 값과 ETag 조회
curl -si -H "X-Firebase-ETag: true" "{DB}/rooms/{gameId}/battle.json"
#    → 응답 헤더 ETag: <값>, 본문: null 또는 {"state":"idle"} ...

# 2) state가 null 이거나 "idle"일 때만 계속. 1)에서 받은 ETag를 if-match에 넣어 PUT
#    now = 서버 시각(ms), battleMs = 위 설정값(없으면 10000)
#    cutsceneAt = now + 300 / startAt = cutsceneAt + 5000 / endAt = startAt + battleMs
curl -X PUT -H "if-match: <1에서 받은 ETag>" \
  -d '{"state":"cutscene","id":"admin-<아무 고유 문자열>","cutsceneAt":0,"startAt":0,"endAt":0}' \
  "{DB}/rooms/{gameId}/battle.json"
#    0 대신 위에서 계산한 값을 넣으세요.
#    200 = 성공 / 412 = 그 사이 다른 곳에서 먼저 시작됨(실패, 정상 동작)
```

**다음 판정(대기로 복귀)**

```bash
# 1) ETag 조회 (위와 동일)  → state가 "cutscene"일 때만 계속
# 2) 같은 ETag로 idle 전환
curl -X PUT -H "if-match: <ETag>" -d '{"state":"idle"}' "{DB}/rooms/{gameId}/battle.json"
# 3) 이의 있음 기록 삭제
curl -X DELETE "{DB}/rooms/{gameId}/objections.json"
```

> 위 조건부 쓰기(`if-match`)는 빈 값에 처음 쓰면 200, 같은 ETag로 다시 쓰면 412가 나오는 것을 실제 DB로 확인했습니다.
> 단, "강제 판정 시작" 전체 순서를 실제 방(`kbo-lg-hh`)에 대고 돌려보지는 않았습니다. 처음 쓸 때 테스트 방 ID로 먼저 해보세요.

---

## 주의

- **로그인이 없습니다.** 주소와 방 ID를 아는 사람은 누구나 시작/초기화할 수 있습니다. 발표용으로만 쓰고, 끝나면 DB 규칙을 닫으세요.
- 실제 "서버 API"(자체 URL, 인증 포함)가 필요하면 Firebase Cloud Functions를 써야 하는데, **카드 등록이 필요한 요금제(Blaze)** 가 필요합니다. 무료 범위 안에서는 위 방식이 가장 단순합니다.
- 점수·접속자 값은 클라이언트가 직접 씁니다. 운영자 API는 읽기 + 위 3가지 동작만 제공합니다.
