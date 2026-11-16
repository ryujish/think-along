# AI Dev Director 분석·Think Along 적용·배포 보고서

- 작성일: 2026-11-16
- 참조 소스: `/Users/choisunghoon/Documents/Aitime/ai-dev-director`
- 구현 대상: `/Users/choisunghoon/Documents/Aitime/think-along_start`
- 운영 주소: https://thinkalong.ai.kr/projects
- 작업 브랜치: `codex/ai-dev-director-adoption-2026-11-16`
- 최신 운영 배포: `f6951a623e299058df5865f96411841166f3941a` — 2026-11-16 13:26 KST 재검증·재배포 완료 (8절).
- 결과: **구현·독립 검수·GitHub Actions 배포·운영 상태 검사 완료**. 최종 증거는 마지막 절에 기록한다.

## 1. 결론과 적용 기준

AI Dev Director는 여러 CLI를 HEAD·BUILDER·REVIEWER로 조직하는 개발 감독관이다. Think Along은 사용자 대화·기억·결정의 연속성을 소유하는 서비스다. 가져올 핵심은 **실패를 성공으로 바꾸지 않는 실행, 문맥과 권한의 정확한 경계, 데이터 보존, 독립 검수와 증거 기반 완료 판정**이다.

이번에는 기존 저장소·API·선택형 협업의 신뢰도를 보강했다. Python 런타임이나 신규 패키지를 제품에 추가하지 않았고, 사용자가 선택하지 않은 모델·계정으로 자동 전환하는 기능도 만들지 않았다. 기존 Studio 화면은 별도 보존 커밋 `f40ec28`으로 기록해 배포에 포함한다. 로컬 `thinkalong-studio/` 참조 디렉터리는 수정·커밋하지 않았다.

## 2. 분석한 입력과 증거 수준

- 입력 Git HEAD: `d2541ad63c0145618312fb7f8dffc9c3e57fcb57`. 미커밋 변경과 미추적 Muse 어댑터를 포함한 현재 디렉터리를 기준으로 삼았다.
- `rg --files`가 반환한 145개 파일의 바이트·줄 수·SHA-256을 기록하고, Python 파일은 AST로 구문과 최상위 심볼을 확인했다.
- 분류: Python 런타임 51개, 콘솔 6개, 보조 스크립트 4개, 테스트 관련 파일 67개, 문서·설정·실행 파일 등 17개.
- [전체 입력 목록](AI_DEV_DIRECTOR_INVENTORY_2026-11-16.md), [agy 소스 분석](AI_DEV_DIRECTOR_SOURCE_AUDIT_2026-11-16.md), [독립 변경 검수](AI_DEV_DIRECTOR_REVIEW_2026-11-16.md)를 함께 보존한다.
- 원본의 604개 테스트라는 수치는 README의 선언이다. 이번 작업에서 원본 전체 pytest 또는 실제 3개 유료 CLI 파이프라인을 실행했다고 주장하지 않는다.
- 원본 보조 스크립트 `scripts/pick_folder.py:12`에는 종료되지 않은 문자열 구문 오류가 있다. 참조 소스의 오류를 Think Along으로 복사하지 않았고 원본을 수정하지 않았다.
- ignore 대상 런타임 데이터와 비밀 파일은 입력 범위에서 제외한다. 자격증명은 보고서·코드·캐시에 추가하지 않는다.

## 3. 개념 전체의 대응 관계

| AI Dev Director 개념과 근거 | Think Along 대응·판정 |
|---|---|
| 목표를 허용 경로·보호 경로·인수 기준·변경 상한으로 구체화 (`schemas/order.py`, `core/safety.py`) | 이번 작업의 파일 소유권과 완료 기준에 적용. 제품의 임의 파일 실행기는 추가하지 않음 |
| 계획 → 구현 → 독립 검수 → 최종 증거 게이트 (`core/orchestrator.py`, `core/verifier.py`) | 주 작업자 구현, agy 독립 검수, `npm run verify`, Actions와 공개 SHA 확인으로 적용 |
| 실행 상태와 전이 이력을 별도로 보존 (`core/state_machine.py`) | 기존 `events`, 메시지 실행 메타데이터, 결정 supersede 구조를 유지. 별도 상태 머신 서비스는 추가하지 않음 |
| 원자적 JSON 교체 (`core/mission.py`, `core/role_settings.py`) | `lib/server/db.ts`의 임시 파일 flush·rename 및 안전한 최초 생성에 적용 |
| 배타적 파일 잠금·소유자 확인 (`core/file_lock.py`) | 현재 단일 서버에는 프로세스 내 갱신 직렬화 적용. 다중 프로세스 잠금은 확장 전 필요 사항으로 명시 |
| 실패·검수 누락 시 통과 금지 (`agents/*reviewer.py`, `schemas/review_result.py`) | API 실패·빈 응답·연결 누락 및 협업 참여자 실패를 성공으로 대체하지 않도록 적용 |
| 프로세스 실행 상한·중단 (`core/process_runner.py`) | 제품의 6개 HTTP Provider 호출에 60초 제한 적용. CLI 프로세스 관리기는 도입하지 않음 |
| 같은 입력의 제한된 재시도 (`core/research_runner.py`) | 동일 Canonical Context 원칙 유지. 이번에는 자동 재시도·계정 전환을 추가하지 않음 |
| Provider 장애 분류·복구 후보 (`core/provider_manager.py`) | 오류는 사용자에게 전달. 자동 fallback과 round-robin은 제품 원칙상 제외 |
| 관측 사실과 정책 선언의 구분 (`schemas/provenance.py`) | 검증 보고서에서 실측 결과·미검증 영역을 분리. 기존 메시지·`subAgentRuns`의 provider/account/model 기록 유지 |
| 독립 연구의 입력 오염 방지 (`core/research_prompts.py`) | 정확한 Context Packet 전체 해시로 캐시 경계를 보강. 기존 협업의 독립 입력 유지 |
| 축소된 협업을 숨기지 않음 (`core/triad_provider.py`) | 기존 2개 모델 협업은 두 참여자가 모두 성공해야 종합. 실패 참여자를 조용히 제외하지 않음 |
| 가설 → 반증 예측 → 실험 → 해석 (`schemas/research.py`, `core/research_orchestrator.py`) | 후속 제품 후보: 사용자가 확정한 결정에 근거·검증 결과 연결. TRIAD 자동 연구 루프는 제외 |
| 부정적 증거·반복 금지·미해결 질문을 기억 (`ResearchMemorySchema`) | 후속 후보: 사용자 승인 기반 실패·보류 대안 기록. 자동 기억 추출·확정 결정 덮어쓰기는 제외 |
| 반복 가설·무진전·횟수 예산 (`core/research_state.py`) | 이번 실행의 유한 검증·수정 루프에 적용. 상시 자동화/Cron은 추가하지 않음 |
| 사용자 정지의 영속성 (`core/chat_manager.py`, `core/mission.py`) | 장시간 작업 기능을 확장할 때 취소·재개 정책의 기준으로 보존. 이번에 백그라운드 작업 기능은 만들지 않음 |
| 결과 반영 전 충돌 검사·복구 (`core/result_manager.py`) | 기존 작업 보존 커밋, 새 릴리스 사전 준비, 상태 검사 실패 시 이전 릴리스 복구로 적용 |
| 안정된 request ID와 내용 해시 (`core/solomon_bridge.py`) | 기존 RemoteStore의 명령 ID·변경 내용 검증과 대응. 범용 Gateway를 중복 구현하지 않음 |
| 명시적 참조 파일과 문맥 예산 (`core/builder_context.py`) | 분석 입력 목록·출처를 남김. 사용자 로컬 파일을 서버에서 임의 탐색하는 기능은 추가하지 않음 |
| 역할 설정과 실행 어댑터 분리 (`agents/`, `core/role_settings.py`) | 기존 Provider·Connection·Model 구조 유지. 역할별 CLI 설치 요구는 제외 |
| 빈 프로젝트의 baseline 면제와 실제 테스트 통과 구분 (`core/greenfield.py`, `core/research_experiment.py`) | 실행하지 않은 검사·조건부 제외를 통과 수와 분리 기록 |
| 사용량·단계·승인·결과 중심 콘솔 (`console/`, `core/usage.py`, `dashboard_server.py`) | 후속 관측 UI 후보로 문서화. 현재 Studio 데모를 실제 실행·실측 사용량으로 표시하지 않음 |
| 로컬 origin·브리지 접근 통제 (`companion_server.py`) | 기존 인증·소유자·origin 경계 유지. 로컬 브리지의 신뢰를 공개 서버로 확대하지 않음 |
| 구독 CLI 강제·API Key 환경 제거 (`core/env_utils.py`) | 공식 API 기반 제품과 상충하므로 제외. 개발 협업용 agy와 제품 실행 경로를 구분 |
| Git worktree sandbox·자동 bootstrap·복잡한 다중 agent 실행 | MVP 경계를 넘으므로 도입하지 않음 |

## 4. 실제 코드 변경

### 4.1 JSON 데이터 손실 방지

- 변경: `lib/server/db.ts`, `tests/db-integrity.test.mjs`.
- 재현: 기존 코드에서 동시 20건의 이벤트 갱신 결과가 1건만 남았다.
- 해결: `globalThis`의 프로세스 내 쓰기 큐로 전체 read-modify-write를 직렬화한다. 실패한 갱신은 저장하지 않으며 다음 갱신을 막지 않는다.
- 임시 파일을 `wx`, 권한 `0600`, flush로 완전히 쓴 뒤 같은 디렉터리에서 rename한다. 최초 생성은 hard link로 배타적으로 게시해 동시 초기화가 기존 파일을 덮어쓰지 않는다.
- `ENOENT`에 한해 초기화한다. JSON 파싱·권한·기타 읽기 오류는 그대로 실패하고 원본을 보존한다.
- 영향 범위: 인증·대화·결정·가져오기·Skill·자동화 등 `updateDb`를 사용하는 기존 호출자 전체. 데이터 형식과 공개 함수 계약은 유지한다.

### 4.2 Context Cache 권한·입력 격리

- 변경: `lib/server/context-cache.ts`, `tests/p1-context-cache.test.mjs`.
- 재현: 버전과 system이 같으면 결정·메시지·요약·현재 질문이 달라도 같은 캐시가 반환됐다.
- 해결: system만 해시하던 키를 **Context Packet 전체 SHA-256**으로 변경했다.
- 검증: 같은 버전에서 결정 제외, 대화 제외, 요약 제거, 질문 변경 시 각각 정확한 패킷을 반환한다. `thinkalong_session_id`와 수동 모델 선택은 유지된다.

### 4.3 실제 Provider 실행 사실 보존

- 변경: `lib/server/ai.ts`, `tests/ai-execution.test.mjs`.
- GPT·Claude·Gemini·Grok·Kimi·OpenCode Zen 모두 API Key가 없으면 연결 오류를 반환한다. 요청을 보내지 않고 예시 답변을 실제 실행 결과로 저장하던 경로를 제거했다.
- 환경변수 Key와 요청 Key 모두 HTTP 오류를 전달한다. 빈 응답·공백 응답을 예시 문장으로 대체하지 않는다.
- 모든 Provider fetch에 `AbortSignal.timeout(60_000)`을 적용한다. 다른 모델·계정으로 자동 전환하지 않는다.
- 6개 어댑터의 연결 누락·HTTP 실패·빈 결과·성공·타임아웃 전파를 fetch 스텁으로 검증했다. 외부 API 비용은 발생시키지 않았다.
- 호출자: 새 Thinking, 이어가기, 기존 내부 Agent 흐름. 새 Thinking·이어가기는 기존 API 오류 응답 경로를 사용한다. API 미연결 사용자는 연결 설정이 필요하다.

### 4.4 기존 협업의 완전성·자격증명 경계

- 변경: `lib/server/collaboration.ts`, `tests/p4-collaboration.test.mjs`.
- 재현: 참여자 하나가 실패해도 남은 답변을 종합해 완전한 협업처럼 반환했다.
- 해결: 두 독립 응답이 모두 성공한 뒤에만 종합한다. 참여자 또는 종합 단계의 실패는 기존 API 오류 경로로 전달된다.
- 기여 기록은 provider·connectionId·model·answer만 반환한다. API Key를 포함한 실행 설정 객체를 증거 객체로 퍼뜨리지 않는다.
- 기존 성공 기여 내역은 `/continue`의 `subAgentRuns` 저장 구조를 그대로 사용한다. 새로운 에이전트 시스템은 추가하지 않았다.

### 4.5 GitHub Actions 릴리스 준비·검증·복구

- 변경: `.github/workflows/deploy-oracle.yml`, `deploy/activate-release.sh`, `tests/deployment.test.mjs`.
- CI에서 `npm ci`와 `npm run verify`를 통과한 산출물만 고유 릴리스 디렉터리로 업로드한다. 현재 실행 중인 소스와 `.next`를 전송 도중 덮어쓰지 않는다.
- 서버의 환경 파일과 canonical data 경로를 보존하고, 운영 의존성 설치가 끝난 후 서비스 교체를 시작한다.
- 현재 앱이 실제 디렉터리를 유지하도록 폴더를 이동한다. data가 일반 디렉터리이거나 외부 심볼릭 링크인 경우를 모두 처리하며 교체 전후 DB checksum을 비교한다.
- 정확한 `release.txt` 커밋과 `/projects`의 정상 응답을 확인한다. 교체·재시작·내부 상태 검사 실패 시 이전 폴더를 복구한다.
- 공개 HTTPS에서도 동일 커밋과 페이지를 확인한다. 이 과정은 전부 GitHub Actions에서 수행하며 수동 SSH 배포로 대체하지 않는다.
- 이전 릴리스는 데이터 경로의 대상일 수 있으므로 자동 삭제하지 않는다.

## 5. 검증과 독립 검수

| 검사 | 관측 결과 |
|---|---|
| 문제 재현 후 수정 | 동시 저장 유실, Context 키 충돌, Provider 실패 은폐, 불완전 협업 모두 수정 전 실패를 확인하고 테스트 보존 |
| JSON 저장소 | 동시 초기화·20개 갱신 보존·실패 mutation 미저장·큐 복구·읽기 중 완전한 JSON·손상 원본 보존 |
| Provider 계약 | 외부 네트워크 호출 없이 6개 어댑터 검증 |
| 배포 스크립트 | 일반 data·외부 data 링크·실패 상태 복구·설치 실패 시 운영 서비스 비중단 검증 |
| `npm ci` | 성공, lockfile 재설치 확인 |
| `npm run verify` | 로컬 주 작업자·agy 및 GitHub Actions 모두 성공: 33개 중 32개 통과, 실패 0개, 기존 opt-in E2E 1개 제외 |
| 운영 의존성 감사 | `npm audit --omit=dev`: 취약점 0개. 개발 의존성의 기존 moderate 항목은 이번에 일괄 변경하지 않음 |
| 교차 검수 | agy는 보고서만 수정하고 주 작업자는 코드·테스트를 담당. 실제 diff·테스트 결과를 주 작업자가 재확인 |

협업 기록: Orca Run `run_cf17af4269ec`, 소스 분석 Task `task_a2a518d3744e`, 검수 Task `task_3faa0d1739cf`, 최종 사실 대조 Task `task_8fd69bbe9f08`. agy는 Paseo 워크스페이스 터미널에서 `agy --dangerously-skip-permissions`로 실행했으며 Orca 셸은 협업 기록용 연결에만 사용했다. 주 작업자는 검수 종료 후 보고서의 상대 링크와 과도한 단정 표현을 정리했다.

## 6. 후속 발전 우선순위와 적용하지 않은 범위

1. **운영 규모를 늘리기 전** JSON 쓰기를 DB 트랜잭션으로 전환한다. 현재 직렬화는 단일 Node.js 프로세스 범위이며 여러 인스턴스가 같은 파일을 갱신하는 환경을 보장하지 않는다.
2. **실제 사용 검증 후** 실행 이력 UI에 성공·실패·시간·모델·Context 버전을 표시한다. 토큰·비용은 실제 응답에 있는 경우에만 관측값으로 기록한다. 실패 실행의 영속 감사 기록은 이번 변경에 추가하지 않았다.
3. **기억 정책 확정 후** 사용자 승인 아래 결정의 근거, 실패한 대안, 부정적 증거, 미해결 질문을 연결한다. 대화 원문과 확정 결정은 자동으로 요약·교체하지 않는다.
4. **장시간 작업이 필요해질 때** 취소·정지·명시적 재개 계약과 유한 실행 예산을 먼저 정의한다. 상시 Agent/Cron이나 자동 복구 루프를 먼저 추가하지 않는다.

실제 유료 Provider 호출, 원본의 전체 pytest, 다중 Node 프로세스 경쟁, 전원 손실/파일시스템 장애, 데이터 백업 복원 훈련은 이번에 검증하지 않았다. Provider JSON 필드의 완전한 런타임 스키마 검증도 별도 과제다. 서버 릴리스 교체는 짧은 재시작 구간을 포함하며 무중단 배포를 주장하지 않는다.

## 7. 최초 배포 증거 (2026-11-16 11:40 KST)

### 배포 결과

- **Actions 결과**: `success` — [Deploy to Oracle 실행 #43793365133](https://github.com/ryujish/think-along/actions/runs/43793365133).
- **최초 배포 SHA**: `ffd0ac73d9a62c8625a4af5406481a292f551223` ([변경 커밋](https://github.com/ryujish/think-along/commit/ffd0ac73d9a62c8625a4af5406481a292f551223)).
- **실행 시간**: 2026-11-16 11:38:05~11:40:58 KST (02:38:05~02:40:58 UTC).
- **CI 환경**: Ubuntu, Node.js `v22.23.4`. `npm ci`, lint, typecheck, 테스트, Next.js production build, 릴리스 업로드, 서버 활성화, 공개 revision 검사가 모두 성공했다.
- **CI 테스트**: `tests 33`, `pass 32`, `fail 0`, `skipped 1`. 제외 항목은 기존 원격 연결 opt-in E2E다.
- **서버 증거**: `Activated ffd0ac73d9a62c8625a4af5406481a292f551223; database preserved`가 Actions 로그에 기록됐다. 교체 전후 canonical DB checksum 비교와 내부 상태 검사가 성공했다.
- **이전 릴리스 보존 경로**: `/home/opc/thingalong-releases/ffd0ac73d9a62c8625a4af5406481a292f551223-43793365133-1-previous`. 이전 폴더가 canonical data 경로의 일부일 수 있으므로 임의 삭제하면 안 된다.
- 이번 배포는 기능 브랜치를 `workflow_dispatch`로 실행했다. `main` 병합은 수행하지 않았다. 이후 main에서 배포할 때는 이 변경을 포함해야 한다. 배포 후 작성한 이 보고서의 문서 커밋은 운영 코드 SHA와 구분한다.

### 배포 후 공개 HTTP 확인

| 경로 | 관측 결과 |
|---|---|
| `/release.txt` | HTTP 200, 본문이 운영 배포 SHA와 정확히 일치 |
| `/projects` | HTTP 200 |
| `/legacy` | HTTP 200 |
| `/projects?source=cloud` | HTTP 200 |
| `/studio-assets/openai.svg` | HTTP 200 |
| `/api/ai/providers` (인증 없음) | HTTP 401, 접근 통제 유지 |
| `/api/thinkings` (인증 없음) | HTTP 401, 접근 통제 유지 |

### 배포 후 브라우저 확인

- `node tests/studio-browser.mjs https://thinkalong.ai.kr`: **1440·900·390px 모두 통과**. 본문과 근거 버튼 겹침, 가로 넘침, 기존 작업 링크 표시를 검사했다.
- Orca 인앱 브라우저 새 탭의 `/projects`에서 체험 데이터·예시 응답 표시와 기존 대화/프로젝트 진입 경로를 확인했다. 해당 탭의 브라우저 콘솔 조회 결과는 빈 목록이었다.
- Paseo Shared Browser 플러그인은 실행 중이나 현재 세션에 조작 MCP 도구가 주입되지 않아, 사용자 프로젝트의 Orca 인앱 브라우저 우선 규칙에 따라 검사했다. 다른 브라우저를 공유 브라우저라고 부르지 않았다.
- 실제 유료 Provider 호출이나 사용자 데이터의 생성·삭제로 운영 검증을 확장하지 않았다.

### 실행 증거 파일

- 주 작업자 전체 검증: `/tmp/thinkalong-verify-20261116.log` (exit 0).
- agy 독립 전체 검증: `/tmp/thinkalong-agy-final-review.log` (exit 0).
- GitHub Actions 로그 로컬 보관: `/tmp/thinkalong-deployment-43793365133.log`.
- `/tmp` 로그는 영구 보존을 보장하지 않는다. 지속적인 배포 증거는 위 Actions URL과 커밋, 이 보고서의 결과 요약이다.

## 8. 재검증·최신 커밋 재배포 (2026-11-16 13:26 KST)

사용자의 추가 검증·배포 요청에 따라 소스를 수정하지 않고 현재 커밋을 재검증·재배포했다. 최초 배포본과의 차이는 이 보고서를 포함한 문서 6개이며, 기존 로컬 참조 디렉터리 `thinkalong-studio/`는 수정하거나 배포에 포함하지 않았다.

- **배포 SHA**: `f6951a623e299058df5865f96411841166f3941a`.
- **Actions**: [Deploy to Oracle 실행 #43803903789](https://github.com/ryujish/think-along/actions/runs/43803903789), 결과 `success`.
- **실행 시간**: 2026-11-16 13:24:23~13:26:23 KST (04:24:23~04:26:23 UTC).
- **전체 검증**: 로컬 `npm run verify` exit 0. lint·typecheck·production build 성공, 테스트 33개 중 32개 통과·실패 0개·기존 opt-in E2E 1개 제외. GitHub Actions에서도 동일한 전체 검증을 통과했다.
- **독립 검수**: agy가 저장소를 수정하지 않고 두 커밋의 코드 동일성 및 배포 스크립트를 검수했다. Provider·JSON 저장소·Context Cache·협업·배포 회귀 테스트 5개를 직접 실행해 전부 통과(exit 0)했다. Orca Run `run_46d143d7f886`, Task `task_be183ea6e1f1`.
- **데이터 보존**: 서버 로그에 `Activated f6951a623e299058df5865f96411841166f3941a; database preserved`가 기록됐다. 기존 환경·canonical data 경로와 교체 전후 DB checksum 검사 유지.
- **운영 확인**: `/release.txt` HTTP 200과 배포 SHA 정확히 일치. `/projects`, `/legacy`, `/projects?source=cloud`, Provider 정적 이미지 HTTP 200. 인증 없는 `/api/ai/providers`, `/api/thinkings`는 HTTP 401로 접근 통제 유지.
- **브라우저 확인**: 운영 주소의 1440·900·390px 자동 회귀 검사 통과, 해당 새 탭의 콘솔 조회 결과 빈 목록. Paseo Shared Browser 조작 도구가 세션에 없어 프로젝트 지침의 Orca 인앱 브라우저를 사용했다.
- **증거 로그**: `/tmp/thinkalong-reverify-20261116.log`, `/tmp/thinkalong-agy-redeploy-20261116.log`, `/tmp/thinkalong-redeployment-43803903789.log`. 영구 결과 요약은 이 절과 Actions 링크에 남긴다.
- **범위와 한계**: 실제 유료 API 호출과 기존 opt-in 원격 E2E는 실행하지 않았다. JSON 쓰기 직렬화는 단일 서버 프로세스 범위다. main 병합은 수행하지 않았으며, 이 재배포 결과 기록은 배포 후 별도 문서 커밋으로 남긴다.
