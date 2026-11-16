# AI DEV DIRECTOR 소스 전수 감사 및 Think Along 아키텍처 비교 증거 보고서 (최종 정정본)

- **문서 식별자**: `docs/AI_DEV_DIRECTOR_SOURCE_AUDIT_2026-11-16.md`
- **감사 일자**: 2026-11-16
- **감사관**: agy (독립 감사관, Orca Coordination Bridge: `term_ca41c5f1-0a95-4159-be97-f03331ea6cd2`)
- **감사 대상 저장소 (Read-Only)**: `/Users/choisunghoon/Documents/Aitime/ai-dev-director`
- **비교 기준 문서 및 대상 저장소**:
  - Think Along 기준 문서: `docs/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md`
  - 대상 작업 디렉토리: `/Users/choisunghoon/Documents/Aitime/think-along_start`
- **전수 인벤토리 실측 참조**: Root가 작성한 [AI_DEV_DIRECTOR_INVENTORY_2026-11-16.md](AI_DEV_DIRECTOR_INVENTORY_2026-11-16.md) (145개 전체 파일 해시, 심볼 및 Python AST 구문 분석 증적)
- **감사 원칙**: 소스 및 테스트 읽기 전용 감사, 자격증명/토큰 노출 절대 금지, Git 상태 불변 유지.

---

## 1. 감사 개요 및 목적 (Audit Overview)

본 감사는 독립 로컬 개발 감독관인 **AI DEV DIRECTOR**의 소스 모듈, 설정, 프런트엔드 콘솔 및 테스트 스위트를 읽기 전용으로 전수 실측 감사하고, 이를 **Think Along**의 핵심 제품 불변 조건(`docs/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md`) 및 실제 코드베이스와 대조 분석한 증거 보고서다.

### Think Along 핵심 불변 조건
1. **단일 AI 정체성**: 사용자는 하나의 AI와 지속 대화하며, 내부 Provider가 바뀌어도 세션과 기억은 끊기지 않는다.
2. **세션 및 기억의 소유권**: AI Provider가 아닌 Think Along이 세션(`thinkalong_session_id`), Canonical Context, 기억, 결정을 소유한다.
3. **수동 선택 보장 (자동 Fallback 배제)**: 오류나 한도 초과 시에도 사용자가 선택하지 않은 계정이나 모델로 자동 전환하지 않는다.
4. **일반 사용자 친화적 공식 API 지향**: CLI 설치나 로컬 샌드박스를 강제하지 않으며 공식 API 연결을 기본으로 한다.
5. **MVP 제외 범위 준수**: Gateway 복잡성, 다중 에이전트 샌드박스, CLI 전용 강제, Cron/Heartbeat, 플러그인 SDK, 자동 라우팅은 MVP 범위에서 제외한다.

---

## 2. AI DEV DIRECTOR 전 모듈 소스 인벤토리 (Source Inventory)

AI DEV DIRECTOR는 핵심 파이썬 구현체 51개 파일과 보조 스크립트(4), 런처(4), 설정(2), 콘솔 프런트엔드(6), 아키텍처 문서(6), 67개 테스트 파일로 구성된다.

### 2.1 핵심 파이썬 구현체 (Core Python Implementation - 총 51개 파일)
핵심 시스템 구현체는 루트 4개, `core/` 28개, `agents/` 12개, `schemas/` 7개로 총 51개 파이썬 파일이다.

#### A. 루트 진입점 및 서버 (4개 파일)
| 모듈 경로 | 라인 수 | 바이트 | 핵심 역할 및 실제 구현 내용 |
|---|---|---|---|
| `director.py` | 383 | 16,364 | CLI 통합 진입점 (`run`, `mission`, `do`, `status`, `resume`, `clean-worktrees`, `diagnostics`). 인자 파싱 및 오케스트레이터 호출. |
| `companion_server.py` | 335 | 19,425 | 8081 포트 로컬 데몬 서버. `127.0.0.1` 전용 바인딩. `secrets.token_urlsafe(48)`로 생성된 토큰(`data/solomon-bridge.token`)을 `secrets.compare_digest`로 비교 검증(`X-Solomon-Bridge` 헤더). 정적 콘솔 및 `/ops/*` REST API 제공. *(HMAC 미사용)* |
| `dashboard_server.py` | 3,198 | 214,239 | 대시보드 백엔드. HTTP 폴링 및 Server-Sent Events (`text/event-stream`, SSE) 기반 상태 브로드캐스트, 채팅 매니저, 미션 제어(중지, 재개, 롤백, 수동 승인). *(WebSockets 미사용)* |
| `dashboard_i18n.py` | 371 | 24,665 | 한국어 및 영어 다국어 번역 사전 리소스, 스테이지 및 상태 레이블 맵. |

#### B. `core/` 핵심 엔진 (28개 파일)
| 모듈 경로 | 라인 수 | 바이트 | 핵심 역할 및 실제 구현 내용 |
|---|---|---|---|
| `core/__init__.py` | 1 | 40 | 코어 패키지 초기화. |
| `core/orchestrator.py` | 1,902 | 122,078 | 단방향 파이프라인(HEAD -> BUILDER -> Verifier -> REVIEWER -> HEAD Decision) 오케스트레이터. Git Worktree 생성, Diff 산출, 승인 게이트 제어. |
| `core/mission.py` | 462 | 26,709 | 다단계 마일스톤 미션 관리자. 직전 PASS 워크트리 스냅샷 연계, 재계획 루프, 원자적 임시 쓰기 후 `os.replace` 저장(`MissionStore`). |
| `core/autopilot.py` | 425 | 22,726 | HEAD 프록시 자율 정책. 결제, 실계좌 거래, 자격증명 생성, 비가역 외부 행위의 4대 예외만 사람에게 에스컬레이션. |
| `core/safety.py` | 599 | 29,617 | Scope Guard 및 Deny-All 정책. 제어 평면(`.git`, `.agents`, `.director_worktrees`, `GEMINI.md`) 보호, 카노니컬 루트 격리(`is_within_root`). |
| `core/state_machine.py` | 410 | 20,027 | SQLite(`data/director.db`) 상태 머신. Strict Forward 전이 검증, 감사 로그(`audit_logs`), 공급자 헬스 테이블. *(코드상 WAL 모드 미설정, 기본 SQLite 연결)* |
| `core/provider_manager.py` | 700 | 31,447 | 4대 공급자 도메인(OPENAI, ANTHROPIC, GOOGLE, META) 격리, 에러 분류(`ErrorCategory`), 헬스/메트릭 추적, 복구 트라이얼 락. |
| `core/process_runner.py` | 327 | 12,115 | CLI 비동기 실행기. `psutil` 기반 프로세스 트리 강제 종료(좀비 방지), 무응답 타임아웃, 스트리밍 버퍼링. |
| `core/env_utils.py` | 150 | 5,288 | CLI 실행 경로 탐색(`resolve_cli`), 환경변수 정제(`get_sanitized_env`: 모든 `*_API_KEY`를 제거하여 강제 구독 CLI 모드 유지). |
| `core/file_lock.py` | 152 | 5,905 | 크로스 프로세스 배타적 파일 락 (`O_CREAT \| O_EXCL`). PID 생존 검증 기반 stale 복구, TOCTOU 안전성 보장. |
| `core/git_manager.py` | 187 | 7,700 | Git Worktree 생성/삭제, 브랜치 관리, Diff 및 변경 파일 추출. |
| `core/verifier.py` | 170 | 6,505 | 독립 빌드/테스트 검증기. 격리 워크트리 내에서 테스트 명령 실행, 종료 코드 및 실패 테스트 수집. |
| `core/result_manager.py` | 741 | 44,998 | 작업 결과 집계, 변경 파일 수 및 Diff 분석, Human-in-the-loop 액션 상태 관리. |
| `core/chat_manager.py` | 180 | 8,023 | 대화 메시지 저장 및 사용자 즉시 중단("멈춰", "중단", "stop") 인텐트 파싱. |
| `core/db_path.py` | 25 | 947 | 카노니컬 DB 경로(`data/director.db`) 및 락 디렉토리 해석기. |
| `core/usage.py` | 272 | 14,208 | CLI 토큰 소모량 및 쿼터 사용률 집계. |
| `core/bootstrap.py` | 111 | 6,405 | 대상 프로젝트 초기 필수 파일 자동 구성. |
| `core/entry_repair.py` | 32 | 1,824 | 대상 프로젝트 진입점 경로 자동 복구. |
| `core/greenfield.py` | 211 | 8,301 | 빈 폴더(Greenfield) 프로젝트 감지 및 자동 Git 저장소 초기화. |
| `core/solomon_bridge.py` | 114 | 6,395 | 솔로몬 주문 지속 접수 및 SQLite 멱등 원장 로깅 (`solomon_orders`). *(HMAC 인증 아닌 멱등 접수 원장)* |
| `core/role_settings.py` | 40 | 1,757 | 역할별 공급자 및 모델 설정 매핑. |
| `core/triad_provider.py` | 46 | 2,022 | **공급자 준비도 판별 함수 (`assess_triad_readiness`)**: 읽기 전용 상태 스냅샷 (`TRIAD_READY`, `TRIAD_DEGRADED`, `TRIAD_BLOCKED`) 반환. *(프로토콜 인터페이스 아님)* |
| `core/builder_context.py` | 39 | 2,234 | **명시적 참조 문서 추출 (`referenced_documents`)**: Order 텍스트 내 `.docx`, `.txt`, `.md` 절대 경로 문서 내용 파싱 및 예산 제약 검증. *(일반 코드 슬라이싱 아님)* |
| `core/research_orchestrator.py` | 1,163 | 69,682 | V3 TRIAD 연구 오케스트레이터. 3자 AI 독립 연구 -> 상호 비판 -> 가설 종합 -> 실험 구현 -> 해석. |
| `core/research_state.py` | 743 | 39,140 | 연구 상태 머신 및 세션 상태 보존. |
| `core/research_prompts.py` | 445 | 23,077 | 연구 단계별 프롬프트 생성기 (독립 제안, 상호 교차 비판, 종합 가설). |
| `core/research_runner.py` | 274 | 15,837 | 연구 워크스페이스 격리 실행기. |
| `core/research_experiment.py` | 119 | 5,870 | 연구 종합 가설을 NORMAL 파이프라인 실험으로 변환 실행. |

#### C. `agents/` 에이전트 어댑터 (12개 파일)
| 모듈 경로 | 라인 수 | 바이트 | 핵심 역할 및 실제 구현 내용 |
|---|---|---|---|
| `agents/__init__.py` | 1 | 41 | 에이전트 패키지 초기화. |
| `agents/head.py` | 115 | 6,972 | HEAD 에이전트 기본 추상 클래스 (`BaseHead`). ORDER 생성 및 수정 지시 계약. |
| `agents/claude_head.py` | 290 | 14,610 | Claude Code CLI 기반 HEAD 구현체. Order JSON 추출. |
| `agents/codex_head.py` | 304 | 15,583 | OpenAI Codex CLI 기반 HEAD 구현체. |
| `agents/muse_head.py` | 92 | 3,972 | Meta Muse 기반 HEAD 어댑터. |
| `agents/mock_head.py` | 103 | 4,168 | 테스트용 결정론적 Mock HEAD 구현체. |
| `agents/proposal_builder.py` | 246 | 15,131 | 전체 파일 제안 방식(Whole-file Proposal) Builder 어댑터. |
| `agents/antigravity_builder.py` | 836 | 40,663 | Google Antigravity CLI(`agy`) 연동 Builder. |
| `agents/claude_reviewer.py` | 286 | 11,459 | Claude Code CLI 기반 독립 리뷰어. `ReviewResultSchema` 반환. |
| `agents/codex_reviewer.py` | 290 | 11,587 | OpenAI Codex CLI 기반 독립 리뷰어. |
| `agents/muse_reviewer.py` | 104 | 4,269 | Meta Muse 기반 독립 리뷰어. |
| `agents/google_roles.py` | 44 | 2,501 | Google CLI 기반 Head 및 Reviewer 역할 팩토리. |

#### D. `schemas/` 데이터 계약 스키마 (7개 파일)
| 모듈 경로 | 라인 수 | 바이트 | 핵심 역할 및 실제 구현 내용 |
|---|---|---|---|
| `schemas/__init__.py` | 15 | 465 | 스키마 모듈 익스포트. |
| `schemas/order.py` | 44 | 1,968 | `OrderSchema`: 목표, 허용 경로, 보호 경로, 허용 삭제, diff 상한, 파일 상한, 리스크 레벨. |
| `schemas/builder_result.py` | 19 | 733 | `BuilderResultSchema`: 제안된 파일 생성/수정/삭제 목록 및 요약. |
| `schemas/review_result.py` | 22 | 807 | **`ReviewResultSchema`**: `verdict: Literal["pass", "changes_required"]`, `p0: List[str]`, `p1: List[str]`, `p2: List[str]`, `summary: str`. *(Risk score나 PASS/FAIL/COMMENT 문자열 없음)* |
| `schemas/decision.py` | 14 | 556 | `DecisionSchema`: 최종 판정(PASS/FAIL/RETRY/HUMAN_REQUIRED), 이유, 후속 지시. |
| `schemas/provenance.py` | 26 | 2,114 | `AgentProvenanceRecord`: 관측 필드(`observed_fields`: 지속시간, 종료코드, CLI버전, 명령어)와 정책 선언 필드(`declared_fields`: 구독 인증 모드, API키 제거)를 엄격히 분리 기록. |
| `schemas/research.py` | 81 | 2,785 | Triad 연구 데이터 스키마 (가설, 교차 비판, 종합 보고서, 연구 기억). |

---

### 2.2 보조 스크립트, 런처, 설정 및 프런트엔드 콘솔

#### A. 보조 스크립트 (`scripts/` - 4개 파일)
- `scripts/cli_diagnostics.py` (45 lines): 설치된 CLI 실행 가능 여부 및 버전 진단.
- `scripts/pick_folder.py` (28 lines): **[구문 결함 주의]** Tkinter 기반 폴더 선택 GUI 도구. L12-L13에 줄바꿈으로 인한 종결되지 않은 문자열 리터럴(`sys.stderr.write("tkinter unavailable\n")`) 결함이 존재하여 Python AST 파싱 시 SyntaxError 발생. 소스가 읽기 전용이므로 수정하지 않고 결함으로 기록함.
- `scripts/retry_transport_run.py` (13 lines): 실패한 전송 실행건 재시도 스크립트.
- `scripts/test_role_cli_smoke.py` (38 lines): CLI 역할별 스모크 테스트.

#### B. 런처 스크립트 (4개 파일)
- `start-companion.sh` (16 lines) / `start-companion.ps1` (16 lines): 로컬 백그라운드 companion 서버 기동 스크립트.
- `stop-companion.sh` (20 lines) / `stop-companion.ps1` (17 lines): PID 기반 companion 서버 안전 종료 스크립트.

#### C. 설정 및 프로젝트 카탈로그 (2개 파일)
- `config.yaml` (81 lines): 역할별 공급자(head: musecode, builder: antigravity, reviewer: codex), 타임아웃, 안전 상한(`max_files_changed: 15`, `max_diff_lines: 1500`), 승인 명령어(`approved_commands`), 프로젝트별 검증 설정.
- `companion.json` (3 lines): 콘솔 바인딩 포트(`port: 8081`) 및 허용 프로젝트 경로 목록.

#### D. 콘솔 웹 프런트엔드 (`console/` - 6개 파일, 실측 라인 수 대조 완료)
- `console/index.html` (101 lines): TRINITY 무대형 콘솔 HTML 진입점.
- `console/console.css` (60 lines) / `console/console.js` (199 lines): 클래식 작업실 UI 스타일 및 인터랙션.
- `console/stage.css` (278 lines) / `console/stage.js` (400 lines): 3자 AI 무대형 시각화 스타일 및 이벤트 핸들러.
- `console/trinity.js` (330 lines): 3자 AI 역할 교환, 상태 폴링, 중지 제어 스크립트.

#### E. 설계 문서 (`docs/` - 6개 파일)
- `docs/AUTONOMOUS_DELIVERY_V1.md`: 자율 전달 파이프라인 명세.
- `docs/AUTO_BOOTSTRAP_2026-09-13.md`: 자동 프로젝트 부트스트랩 설계.
- `docs/DASHBOARD_WORKSPACE_V2.md`: 대시보드 워크스페이스 구조.
- `docs/MANUAL_ROLES.md`: 역할 수동 지정 정책.
- `docs/STABILIZATION_2026_09_19.md`: 안정화 릴리스 기록.
- `docs/V3_TRIAD_RESEARCH_PLAN.md`: Triad 3자 AI 연구 시스템 설계도.

---

### 2.3 `tests/` 테스트 카테고리 (67개 파일, README 선언 기준 604개 테스트)

> [!NOTE]
> `README.md`에 기재된 604개 테스트는 원작성자의 선언적 수치(declared count)이며, 본 감사는 67개 테스트 파일 전수를 직접 실행하거나 전체를 심층 독해한 것이 아니다.
> 실제 소스 구현을 심층 대조한 12개 테스트 파일과, 파일명 및 테스트 인벤토리 검증에 한정한 55개 테스트 파일을 명확히 구분하여 보고한다.

#### A. 심층 구현 대조 검증 테스트군 (Inspected Implementations - 12개 파일)
1. `tests/test_safety.py`: Scope Guard 경로 검증 및 위험 패턴 차단.
2. `tests/test_v0239_glob_containment.py`: 와일드카드 경로 격리 및 탈출 방지.
3. `tests/test_state_machine.py`: 상태 머신 전이 규칙 및 감사 로그 영속화.
4. `tests/test_hang_protection.py`: CLI 무응답 타임아웃 차단.
5. `tests/test_process_tree_kill.py`: `psutil` 기반 프로세스 트리 강제 종료.
6. `tests/test_git_manager.py`: Git Worktree 격리 생성 및 정리.
7. `tests/test_v0236_evidence_isolation.py`: 이전 실행 증거와 작업본 분리.
8. `tests/test_v020_provider_ops.py`: 공급자 상태 머신 및 헬스 체크.
9. `tests/test_v300h_transient_retry.py`: 일시적 장애 재시도 및 복구 락.
10. `tests/test_v306_head_proxy_autonomy.py` (940 lines): 자율 프록시 4대 예외(결제, 계정, 거래, 비가역 외부 행위) 에스컬레이션.
11. `tests/test_v315_system_stop.py`: 시스템 즉시 중단 제어.
12. `tests/test_v316_mission_stop.py`: 미션 영구 STOPPED 상태 보존.

#### B. 인벤토리 목록 검증 테스트군 (Inventory-Only Coverage - 55개 파일)
- 마일스톤 자격/회귀: `test_v014_qualification.py`, `test_v017_audit.py`, `test_v018_closure.py`, `test_v019_final.py`
- 대시보드 및 UX: `test_v021_dashboard.py`, `test_v022_active_run.py`, `test_v0238_dashboard_ux.py`, `test_v0241_ux_polish.py`, `test_v0242_command_center.py`, `test_v0247_perf_i18n.py`
- 채팅 및 재개 안정화: `test_v023_chat.py`, `test_v0231_chat_stabilization.py`, `test_v0232_e2e_blockers.py`, `test_v0233_codex_fixes.py`, `test_v0234_resume_parity.py`, `test_v0235_resume_closure.py`, `test_v0237_mode_truthfulness.py`
- 승인 및 결과 센터: `test_v0243_approval.py`, `test_v0244_human_actions.py`, `test_v0245_policy_hotfix.py`, `test_v0246_result_center.py`
- Triad 연구 파이프라인: `test_v300a_triad_foundation.py` ~ `test_v300g_research_dashboard.py`, `test_v300h_builder_headless.py`, `test_v300h_real_three_provider_e2e.py`, `test_v300i_failure_learning_loop.py`, `test_v300j_chat_order_path_normalization.py`, `test_v300k_wildcard_protect_path.py`, `test_v300l_zero_write_budget_entry_gate.py`
- 플랫폼 호환성 및 어댑터: `test_v301_companion_http.py`, `test_v301_readonly_inspection.py`, `test_v301_solomon_bridge.py`, `test_v302_bootstrap.py`, `test_v303_proposal.py`, `test_v304_roles.py`, `test_v305_stabilization.py`, `test_v307_work_visibility.py`, `test_v308_builder_edits.py`, `test_v309_trinity_stage.py`, `test_v310_korean_paths.py`, `test_v311_order_conflicts.py`, `test_v312_delivery.py`, `test_v313_head_parity.py`, `test_v314_generated_paths.py`, `test_v317_posix_compat.py`, `test_v318_muse_provider.py`, `test_brake.py`, `test_e2e.py`, `test_entry_root_repair.py`, `conftest.py`

---

## 3. 핵심 아키텍처 비교 및 실측 감사 (Fact-Based Analysis)

### 3.1 JSON 저장소 원자성 및 Fail-Closed 읽기 (`lib/server/db.ts`)
- **AI DEV DIRECTOR 구현**: `core/file_lock.py`의 배타적 파일 락(`O_CREAT | O_EXCL`)과 `core/mission.py`의 `.tmp` 작성 후 `os.replace` 원자적 대체 패턴.
- **Think Along 수정 전 상태**: `readDb()`가 에러 발생 시 무조건 `seedDatabase()`로 덮어쓰는 치명적 데이터 손실 결함 보유.
- **Root 수정 완료 사항 검증**:
  1. `ENOENT` 부재 시에만 원자적 하드링크(`link(temporary, dbPath)`)로 시드를 생성하고, 손상 JSON이나 기타 I/O 에러 시 예외를 throw하여 원본 손상 파일을 보존(Fail-Closed).
  2. `randomUUID().tmp` 파일 기록(`{ flag: 'wx', mode: 0o600, flush: true }`) 후 `rename`으로 원자적 대체.
  3. `writes.thinkAlongDbWrite` Promise 큐를 통한 단일 프로세스 내 비동기 쓰기 직렬화. [db-integrity.test.mjs](../tests/db-integrity.test.mjs)로 동시 20건 쓰기 및 롤백 검증 통과.

### 3.2 프로비넌스(Provenance) 및 컨텍스트 경계
- **AI DEV DIRECTOR 구현 (`schemas/provenance.py`)**: `observed_fields`(소요시간, 종료코드, CLI버전, 명령어)와 `declared_fields`(인증모드, API키 제거)를 엄격히 분리 기록.
- **Think Along 기존 구현 실측 확인**:
  - `ConversationMessage`는 **이미** `connectionId`, `model`, `contextVersion`, `executionStatus` 필드를 정의 및 저장하고 있음 (`lib/types.ts` L68-L79).
  - `app/api/thinkings/[id]/continue/route.ts` (L147-L154)는 **이미** 다중 협업 결과를 `mutableDb.subAgentRuns`에 개별 저장(`role: 'thinker'`, `output: contribution.answer`, `provider`, `connectionId`, `model`), `contextSnapshots` 기록, `model.executed` 이벤트 발행을 수행하고 있음.
  - 따라서 협업 출처가 완전히 누락되었다는 평가는 사실과 다르며, 세부 실행 결과가 정규화된 스토어에 이미 기록되고 있었음을 정정 확인.
- **컨텍스트 캐시 키 무효화**:
  - 기존 캐시 키: `[sessionId, version, createHash('sha256').update(packet.system).digest('hex').slice(0, 12), provider, connectionId, model]`
  - Root 수정 캐시 키: `[sessionId, version, createHash('sha256').update(JSON.stringify(packet)).digest('hex'), provider, connectionId, model]`
  - 기존 키에도 `packet.system`의 해시가 포함되어 있었으나, Root가 패킷 전체(`JSON.stringify(packet)`) 해시로 확장하여 프롬프트, 결정, 요약 변경 시에도 동일 버전 내 패킷 차이도 캐시에서 구분하도록 강화함.

### 3.3 협업 실패 투명성 및 Fail-Closed
- **AI DEV DIRECTOR 구현 (`core/provider_manager.py`)**: 공급자 장애 시 `REDUCED_INDEPENDENCE` 및 `FAILOVER` 감사 로그를 명시 발행하여 결코 실패를 은폐하지 않음.
- **Think Along 개선 확인**:
  - 기존 `lib/server/collaboration.ts`는 `Promise.allSettled`로 일부 협업자 실패 시 조용히 성공분만 합성하는 사일런트 드롭 문제가 있었음.
  - Root가 `Promise.all`로 전면 교체하여 협업자 중 1개라도 실패 시 전체 작업이 Fail-Closed로 예외를 발생시키도록 수정 완료 ([p4-collaboration.test.mjs](../tests/p4-collaboration.test.mjs) 검증 통과).
  - 기존 `lib/server/ai.ts`에서 API 설정 실패 시 조용히 `localAiResult` 목 템플릿을 반환하던 문제를 전면 제거하고, 6개 어댑터 모두에 60초 타임아웃(`AbortSignal.timeout(60_000)`) 및 빈 응답 거절을 적용하여 Fail-Closed 확립 ([ai-execution.test.mjs](../tests/ai-execution.test.mjs) 검증 통과).

---

## 4. 의도적 제외 항목 (Strictly Excluded Items)

Think Along의 제품 원칙에 따라 배제해야 하는 AI DEV DIRECTOR의 메커니즘을 명확히 재확인한다.
1. **자동 모델/계정 Fallback**: 사용자 직접 선택권 및 동일 세션 지속성 유지 원칙에 따라 배제.
2. **CLI 전용 강제 및 API Key 박탈**: 일반 웹 사용자를 위한 공식 API 연결 원칙에 따라 배제.
3. **Git Worktree 코드 변경 샌드박스**: Think Along은 AI 연속성 계층이므로 로컬 파일 수정 엔진 기능 배제.
4. **Cron / Heartbeat 백그라운드 데몬**: MVP 범위 제외.
5. **복잡한 플러그인 SDK / SOUL 다중 페르소나**: MVP 범위 제외.

---

*(정정 완료: `docs/AI_DEV_DIRECTOR_SOURCE_AUDIT_2026-11-16.md`)*
