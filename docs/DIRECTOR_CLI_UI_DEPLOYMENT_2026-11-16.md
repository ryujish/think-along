# Think Along Director — CLI 역할 분담·UI 개선·배포 보고서

- 날짜: 2026-11-16 (KST)
- 대상: `/Users/choisunghoon/Documents/Aitime/think-along_start`
- 참조: `/Users/choisunghoon/Documents/Aitime/ai-dev-director` (읽기 전용)
- 작업 브랜치: `codex/director-cli-workspace-2026-11-16`
- 운영 URL: https://thinkalong.ai.kr/projects
- 현재 기록: 구현·로컬 전체 검증 완료. 배포 결과는 실제 Actions 완료 후 아래에 추가한다.

## 요청과 결과

최초 적용은 저장소·Context·실행 실패 신뢰도를 개선했다. 사용자는 "기억 보존말고 여러개의 CLI가 각각 head 이런식으로 분담", "UI도 개선하고 서버에 배포"라고 범위를 명확히 확장했다. 이번 변경은 역할별 실제 CLI 실행기와 이를 제어하는 새 Director 화면을 추가한다.

`/projects` 기본 진입점에서 HEAD·BUILDER·REVIEWER를 배정하고 개발 목표를 입력한다. 실행 결과는 계획 → 제안 → 실제 검증 → 독립 검수 → 최종 판정의 5단계로 표시한다. 각 단계의 담당 CLI·상태·출력·종료 코드, 코드 diff, 이력, 기기 상태, 오류와 취소를 확인한다. 기존 Studio는 `/projects?view=studio`에 남긴다.

## 참조 소스에서 실제 적용한 개념

전체 파일 목록·해시·분석 범위는 [소스 인벤토리](AI_DEV_DIRECTOR_INVENTORY_2026-11-16.md), 기존 신뢰도 변경은 [최초 적용 보고서](AI_DEV_DIRECTOR_ADOPTION_REPORT_2026-11-16.md)를 참조한다. 이번 대응은 다음과 같다.

| 원본 개념·근거 | Think Along 구현 |
|---|---|
| `core/orchestrator.py`, `agents/*`, `schemas/order.py`: HEAD → BUILDER → verifier → REVIEWER → HEAD | `cli/director-core.mjs`: 서로 다른 세 CLI의 명시적 순서, 인수 기준·허용 파일 JSON 계약 |
| `core/role_settings.py`: 역할과 실행기 분리 | `lib/director/protocol.mjs`의 allowlist·역할 검증, UI 역할 선택; 기본 Codex/agy/Claude |
| `core/safety.py`, `builder_context.py`: 작업 범위·보호 파일·문맥 예산 | 허용 경로·symlink·보호 설정 검사, 최대 10개 파일·파일 100KB·전체 200KB·1,500줄 변경 상한, 제한된 원본 발췌 |
| `core/git_manager.py`, `result_manager.py`: 격리 작업·diff·증거 | detached Git worktree에서 controller가 텍스트 제안 적용, 실제 diff 보존, 원본 자동 적용 없음 |
| `core/verifier.py`, `schemas/review_result.py`: 검증 생략 시 PASS 금지 | 원본 package.json의 verify/test를 실제 실행; 실패 시 검수·최종 PASS 차단 |
| `core/process_runner.py`, `chat_manager.py`: 시간·출력 상한과 중단 | shell 없는 spawn, 제한 시간·2MB 출력 상한, 프로세스 그룹 TERM/KILL, 서버 취소 요청과 실제 중단 확인 구분 |
| `core/env_utils.py`: 구독 CLI와 자격증명 경계 | 상속 API Key·중첩 실행 변수 제거, 기존 CLI 로그인 이용; credential 파일을 읽거나 서버로 복사하지 않음 |
| `core/state_machine.py`, `solomon_bridge.py`: 상태·ID·재전달 방지 | 기존 RemoteStore 명령 ID·내용 해시 재사용, 단일 수신·완료 증거, 재시작 interrupted 및 자동 재실행 금지 |
| `schemas/provenance.py`: 실측과 선언 분리 | 설치 여부와 인증 성공 구분, 테스트 fixture와 실제 CLI 실행 구분, 실패를 정상 응답으로 대체하지 않음 |
| 원본 콘솔·stage·trinity UI | Next.js/React의 새 Director: 역할 카드, 목표, 5단계, 출력·diff·이력·기기 연결, 반응형 화면 |

원본 Python 서버·자동 연구 TRIAD·자동 fallback·greenfield bootstrap·자동 원본 반영을 복제하지 않았다. 신규 패키지나 별도 서버도 추가하지 않았다.

## 실행과 데이터 경계

서버는 `/api/remote`의 비밀번호 계정·HttpOnly 세션·Origin·소유권 검사와 기기 페어링을 담당한다. 사용자의 Mac에서 `think-along director start`가 명령을 받아 기존 로그인된 CLI를 실행한다. 서버가 개인 Mac의 파일을 임의 탐색하거나 CLI 토큰을 가져가지 않는다.

CLI는 read-only/plan 모드와 파일 텍스트 제안 계약을 사용한다. Controller만 격리 worktree에 제안을 기록한다. package.json의 기존 verify/test는 제안 전에 읽고 보호하며 실제 실행한다. Worktree는 OS sandbox가 아니므로 신뢰한 프로젝트의 npm 스크립트만 실행한다.

모든 역할은 동일한 `thinkalong_session_id`와 확정 사용자 문맥을 받는다. 기존 projectStore의 Director 상태에 단계·diff·이력을 저장하고 기기 토큰은 별도 0600 파일에 둔다. 서버 전송은 shape allowlist·길이 상한을 적용하고 worktree 절대 경로·credential 속성은 제외한다. `--share-diff` 없이 diff를 보내지 않는다. 사용자가 본문에 직접 쓴 비밀 문자열까지 자동 제거하는 기능은 아니다.

기본 설치·실행 절차는 [CLI 문서](CLI.md)를 참조한다. 원격 실행은 `--allow-run --share-diff`를 명시하고 웹에서 기기를 승인해야 한다. 기존 대화의 간이 이메일 로그인과 Director 비밀번호 계정은 별도다.

## 검증 증거

| 검사 | 현재 관측 |
|---|---|
| 실제 CLI smoke | 실제 Codex HEAD 계획 성공 → 실제 agy BUILDER 제안 성공 → 실제 npm verify 1개 테스트 성공 → 실제 Claude REVIEWER 인증 실패 |
| Claude 실패 이유 | `OAuth session expired and could not be refreshed`. 최종 HEAD 결정은 실행하지 않았으며 다른 CLI로 대체하지 않음 |
| Core 회귀 | 실제 Git·npm, 원본 불변, 경로·symlink·범위 차단, 실패/누락 검증, 독립 검수, JSON 계약, argv/stdin/env, 취소·시간 상한 |
| 서버 계약 | 소유권·인증·기기·opt-in, CLI 역할·설치 검사, ID 멱등성·재전달 방지, 취소·권한 철회, 증거 shape·문맥 revision |
| HTTP 통합 | 실제 HTTP pairing → 실제 로컬 daemon → 역할 전달 → 실제 Git·npm verifier → 증거 저장, 취소, 재시작 중단/재실행 금지. 추론만 명시적 fixture |
| UI | Orca 인앱 브라우저에서 1440·900·390px 역할/결과 가로 넘침 없음, 실제 로컬 HTTP signup·pair·enqueue·cancel·실패 표시·이력 잠금·역할 변경·권한·로그아웃 통과. 추론 증거는 명시적 fixture |
| 기존 Studio | `tests/studio-browser.mjs http://127.0.0.1:3185`: 세 화면 크기에서 본문·근거 버튼·내비게이션·가로 넘침 통과 |
| 전체 검증 | `npm run verify`: lint·typecheck·test·production build 성공. 44개 중 43개 pass·fail 0·기존 선택 실행 테스트 skip 1 |
| 배포 | GitHub Actions 실행 전. 완료 후 아래에 결과 추가 |

통합 테스트 중 실패 명령의 `error` 속성을 HTTP RPC 오류로 오인해 결과 조회가 409가 되는 문제를 재현했다. `remote-http.mjs`에서 숫자 status가 있는 RPC 오류와 정상 응답 안의 실행 실패를 구분했고, 실제 취소 결과 조회까지 통과했다. Node test runner의 `NODE_TEST_CONTEXT` 상속으로 하위 verifier가 실제 테스트를 건너뛰는 문제도 재현·차단하고 회귀 검사를 남겼다.

브라우저에서 로그인 후 effect 의존성이 재생성되어 snapshot 갱신이 반복되는 문제를 재현·수정했다. 순차 polling·프로젝트 세대 번호·대기 명령의 실제 상태 확인·실패 시 실행 차단을 적용하고 요청 횟수 상한으로 회귀를 확인했다. CLI가 이미 수정된 파일을 바꿔도 Git 상태 문자만 같을 수 있으므로 호출 전후 실제 diff도 비교한다. verifier가 제안 코드를 바꾸면 동일 증거가 아니므로 중단한다.

기존 Node 모듈 형식 경고와 빌드의 기존 파일 추적 경고는 기능 실패가 아니며 이번에 package 전체 module 설정을 바꾸지 않았다. Paseo Shared Browser 플러그인은 설치되어 있으나 이 세션에 브라우저 도구가 노출되지 않아, 사전 안내 후 프로젝트의 Orca 인앱 브라우저로 검증했다.

## 협업과 검수

Orca Run `run_09f45e4fc055`에 설계·UI 구현·교차 수정 Task를 남겼다. agy는 Paseo 터미널에서 실행하고 Orca 셸을 협업 기록에만 사용했다. agy는 Director UI 파일, 주 작업자는 코어·서버·테스트·설정·문서를 소유했다. 완료 보고와 별도로 주 작업자가 diff·실제 CLI·HTTP·브라우저·전체 검증 결과를 확인한다.

## 한계와 다음 발전

- 세 CLI 전체의 실제 성공은 Claude 공식 로그인 갱신 후 재검증해야 한다. 설치 상태를 인증 성공으로 표시하지 않는다.
- 첫 버전은 기존 Git·Node.js 프로젝트의 verify/test와 제한된 파일 수정을 지원한다. manifest·lockfile·배포 설정 변경은 대상에서 제외한다.
- 기기 러너가 실행 중일 때 서버에서 작업할 수 있다. 개인 Mac 인증을 서버로 이동하는 상시 서버 실행기는 만들지 않았다.
- 원본 적용·충돌 해결·자동 배포, 다중 프로젝트 동시 실행, 자동 재시도·provider fallback은 현재 기능이 아니다.
- 서버의 기존 JSON 대화 저장소는 단일 프로세스 범위의 직렬화다. 별도 RemoteStore는 기존 SQLite를 재사용한다.

## 배포 결과

GitHub Actions만 사용한다. 커밋 SHA·Actions URL·공개 revision·화면/remote 상태를 완료 후 기록한다.
