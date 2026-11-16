# Think Along 핵심 안정성 및 배포 파이프라인 독립 검수 보고서

- **문서 식별자**: `docs/AI_DEV_DIRECTOR_REVIEW_2026-11-16.md`
- **검수 일자**: 2026-11-16
- **독립 검수관**: agy (Orca Coordination Bridge: `term_ca41c5f1-0a95-4159-be97-f03331ea6cd2`)
- **검수 대상 PR / 커밋 작업분**: Root의 핵심 스토리지 안정성, 프로바이더 실행 격리, 컨텍스트 캐시 해싱, 협동 Fail-Closed 및 단계적 릴리스 활성화/롤백 파이프라인
- **실측 검증 환경**: macOS 26.5 (Darwin Kernel 25.5.0, arm64), Node.js v26.8.1, Next.js 16.4.3 (Turbopack)
- **검증 기준**: `npm run verify` (lint, typecheck, unit/contract tests, production build), 테스트 자가 재현 (`/tmp/thinkalong-agy-final-review.log`)

---

## 1. 검수 개요 및 총평 (Executive Summary)

Root 작업자는 AI DEV DIRECTOR의 아키텍처 감사에서 도출된 핵심 개선점(원자적 파일 교체, 손상 읽기 Fail-Closed, 동시성 유실 방지, 협업 실패 투명성, 배포 시 데이터 보존 및 롤백)을 Think Along 코드베이스에 반영하였다.

독립 검수관으로서 대상 코드의 diff, 호출 경로, 엣지 케이스 테스트를 직접 실행 및 대조 검증한 결과, **검토된 범위(reviewed scope) 내에서 블로킹 이슈는 발견되지 않았음(no blocking issues found in reviewed scope)** 을 확인하여 승인(PASS) 판정을 내린다.

---

## 2. 파일별 상세 검수 내역 (Detailed File Reviews)

### 2.1 스토리지 무결성: `lib/server/db.ts`

- **수정 위치**: L344-L438
- **검수 내용**:
  1. **손상 데이터 Fail-Closed (L347-L355)**:
     - 파일 미존재(`ENOENT`)인 경우에만 초기 시드를 생성하도록 격리함.
     - `JSON.parse` 구문 오류나 I/O 오류 발생 시 예외를 상위로 즉시 throw함으로써, 손상된 JSON 파일이 데모 데이터(`seedDatabase()`)로 덮어쓰여지는 기존 결함을 차단함.
  2. **원자적 임시 쓰기 및 하드링크 초기화 (L402-L420)**:
     - 초기화 시 `link(temporary, dbPath)`를 사용하여 단 1회만 시드 생성.
     - 일반 쓰기 시 `randomUUID().tmp` 파일에 `{ flag: 'wx', mode: 0o600, flush: true }`로 기록 후 `rename(temporary, dbPath)`로 원자적 교체. 실패 시 `finally`에서 임시 파일 정리.
  3. **비동기 단일 프로세스 큐 직렬화 (L422-L438)**:
     - `writes.thinkAlongDbWrite = (writes.thinkAlongDbWrite ?? Promise.resolve()).then(...)` 프로미스 체인 체계를 구축하여 단일 Node.js 프로세스 내에서 `updateDb` 동시 호출을 순차 직렬화함.
- **테스트 재현 ([tests/db-integrity.test.mjs](../tests/db-integrity.test.mjs))**:
  - 동시 20건의 비동기 업데이트 실행 시 갱신 유실 없이 20건 전수 저장 확인.
  - 변이 실패 시 디스크 롤백 및 큐 잠금 해제 확인.
  - 손상 데이터(`{"users":`, `null` 등) 입력 시 읽기/수정이 fail-closed로 거절되고 원본 파일이 그대로 보존됨을 확인.

---

### 2.2 프로바이더 실행 안전장치 및 Fail-Closed: `lib/server/ai.ts`

- **수정 위치**: L74-L338 (전체 어댑터)
- **검수 내용**:
  1. **API Key 미설정 시 즉시 예외 발생 (L118, L146, L173, L200, L251, L297)**:
     - 최신 `ai.ts`는 키 누락 시 목 응답을 반환하던 경로를 전면 삭제함. 6개 프로바이더(OpenAI, Claude, Gemini, Grok, Kimi, OpenCode Zen) 모두 API Key가 없으면 `throw new Error(`${input.provider} API Key를 연결해주세요.`);`로 차단하여 `fetch`를 호출하지 않음.
  2. **빈 응답 거절 (L105)**:
     - `if (!text.trim()) throw new Error(`${input.provider}에서 빈 응답을 받았습니다. 다시 시도해주세요.`);`를 통해 빈 바디 반환을 거절.
  3. **전 어댑터 60초 타임아웃 바인딩 (L127, L150, L177, L206, L257, L303)**:
     - 모든 프로바이더 `fetch` 호출에 `signal: AbortSignal.timeout(60_000)`을 부여하여 무한 대기 차단.
  4. **사일런트 목 폴백 제거 (L139, L163, L193, L238, L283, L325)**:
     - HTTP 오류 응답 시 데모 템플릿 대체 없이 업스트림 에러 메시지를 파싱하여 즉시 예외 throw.
- **테스트 재현 ([tests/ai-execution.test.mjs](../tests/ai-execution.test.mjs))**:
  - 6개 프로바이더 전수 업스트림 503 거절 예외 보존 확인.
  - 빈 문자열 응답 시 에러 발생 확인.
  - 타임아웃 발생 시 `TimeoutError`가 정상 전파됨을 확인.

---

### 2.3 컨텍스트 캐시 해시 핑거프린트: `lib/server/context-cache.ts`

- **수정 위치**: L6-L7
- **검수 내용**:
  - 기존 캐시 키는 `packet.system`의 앞 12자리 해시만 사용하였으나, Root는 `createHash('sha256').update(JSON.stringify(packet)).digest('hex')`로 패킷 전체 내용을 해싱하도록 수정.
  - 세션 버전 번호가 동일하더라도 프롬프트, 결정 목록, 요약 등이 변경될 경우 캐시 키가 달라지므로 캐시 오염 및 부적절한 재사용이 방지됨.
- **테스트 재현 ([tests/p1-context-cache.test.mjs](../tests/p1-context-cache.test.mjs))**:
  - 동일 버전 내 패킷 내용 변경 시 새 캐시가 적용됨을 확인.

---

### 2.4 협동 Fail-Closed 및 메모리 객체 스코프 축소: `lib/server/collaboration.ts`

- **수정 위치**: L8-L12, L29-L41
- **검수 내용**:
  1. **전원 참여 완료 Fail-Closed (L29-L38)**:
     - `Promise.allSettled`로 일부 협업자 실패 시 조용히 성공분만 합성하던 방식을 `Promise.all`로 수정.
     - 참여 모델 중 1개라도 실패하면 전체 작업이 즉시 reject되어 부분 성공으로 처리되지 않음 (의미론적 '합의'가 아닌 기술적 참여자 전원 완료 및 Fail-Closed임).
  2. **메모리 객체 스코프 축소 (L8-L12)**:
     - 기존에도 `app/api/thinkings/[id]/continue/route.ts`가 명시적 필드(`provider`, `model`, `answer`)만 골라 저장하고 있었으므로 컨텍스트/스토리지로의 영구 유출 버그는 없었음.
     - 신규 타입 `CollaborationContribution = Omit<CollaborationModel, 'apiKey'> & { answer: string }`을 통해 메모리상 기여 객체 자체에서도 `apiKey` 속성을 배제함으로써 런타임 객체 스코프를 축소함.
- **테스트 재현 ([tests/p4-collaboration.test.mjs](../tests/p4-collaboration.test.mjs))**:
  - 주 모델 또는 협업 모델 실패 시 합성으로 넘어가지 않고 즉시 reject됨을 확인.
  - 반환된 `contributions`의 모든 항목에 `apiKey` 속성이 존재하지 않음을 확인.

---

### 2.5 단계적 릴리스 활성화, 카노니컬 데이터 심링크 보존 및 자동 롤백: `.github/workflows/deploy-oracle.yml`, `deploy/activate-release.sh`

- **수정 파일**:
  - `.github/workflows/deploy-oracle.yml` (L7, L27-L70)
  - `deploy/activate-release.sh` (L1-L53)
  - `tests/deployment.test.mjs` (L1-L60)
- **검수 내용**:
  1. **동시 워크플로 취소 방지 (`cancel-in-progress: false`)**:
     - 이전 릴리스가 컷오버 도중 취소되어 불완전 상태로 남는 것을 방지하기 위해 워크플로 레벨에서 `cancel-in-progress: false` 설정.
  2. **격리 릴리스 업로드 및 서비스 정지 기반 활성화**:
     - `/home/opc/thingalong-releases/${GITHUB_SHA}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}` 경로에 스테이징 배포.
     - `deploy/activate-release.sh:36`에서 `sudo systemctl stop thingalong`을 호출하여 서비스를 일시 중지한 뒤 디렉토리 교체를 수행함. **(무중단/Zero-downtime 배포가 아니며, 서비스 정지 후 안전 교체 방식임)**
  3. **카노니컬 데이터 심링크 보존**:
     - `application/data`의 실제 경로(`realpath`)를 계산하여 `release/data`로 심링크(`ln -s "$data" "$release/data"`) 연결.
     - macOS/Linux 경로 alias(예: `/var` -> `/private/var`)를 고려한 경로 카노니컬화 적용.
  4. **디렉토리 교체 및 체크섬 검증**:
     - `checksum=$(sha256sum "$application/data/db.json")`로 기록 후 `mv "$application" "$backup"` -> `mv "$release" "$application"`.
     - 교체 후 동일 체크섬을 재검증하여 데이터 훼손이 없음을 확인한 뒤 systemd 서비스 기동.
  5. **자동 롤백 트랩 (`trap rollback ERR`)**:
     - 기동 후 30회 헬스 체크(`http://127.0.0.1:3000/release.txt` 및 `/projects`) 실패 시 `rollback()` 함수가 발동하여 백업 디렉토리를 원복하고 기존 서비스 재가동.
- **테스트 재현 ([tests/deployment.test.mjs](../tests/deployment.test.mjs))**:
  - 4개 시나리오 전수 검증 완료:
    1. `directory`: 표준 디렉토리 배포 및 데이터 보존 통과.
    2. `external-symlink`: 외부 심링크 데이터 보존 통과.
    3. `failed-health`: 헬스 체크 실패 시 서비스 자동 롤백 및 실패 릴리스 격리 통과.
    4. `failed-install`: 패키지 설치 실패 시 실행 중인 서비스 중단 없이 원상 유지 통과.

---

## 3. 종합 검증 결과 (Verification Evidence)

독립 검수관이 직접 실행한 검증 로그는 `/tmp/thinkalong-agy-final-review.log`에 기록되었으며, 종료 코드(exit status) 0으로 완료되었다. (Root 실행 로그: `/tmp/thinkalong-verify-20261116.log`)

```bash
$ npm run verify > /tmp/thinkalong-agy-final-review.log 2>&1
$ echo $?
0
```

- **ESLint**: 0 errors, 0 warnings
- **TypeScript (`tsc --noEmit`)**: 0 errors
- **Node 테스트 러너 (`node --test tests/*.test.mjs`)**:
  - 총 33개 테스트 중 **32개 통과, 1개 건너뜀 (skipped)**
  - 건너뛴 1건: `tests/remote-e2e.test.mjs`의 실제 HTTP 페어링 통합 테스트 (로컬 하네스 opt-in)
  - 주요 검증 테스트:
    - [tests/ai-execution.test.mjs](../tests/ai-execution.test.mjs) (98.9ms)
    - [tests/db-integrity.test.mjs](../tests/db-integrity.test.mjs) (324.2ms)
    - [tests/deployment.test.mjs](../tests/deployment.test.mjs) (2,928.2ms)
    - [tests/p1-context-cache.test.mjs](../tests/p1-context-cache.test.mjs) (86.4ms)
    - [tests/p4-collaboration.test.mjs](../tests/p4-collaboration.test.mjs) (65.1ms)
- **Next.js 프로덕션 빌드 (`next build`)**: Turbopack 기반 448ms 컴파일 완료, 21개 정적 페이지 정상 생성.
- **기존 Studio 자산 보존**: `codex/ai-dev-director-adoption-2026-11-16` 브랜치의 기준 커밋 `f40ec28`에 포함된 Studio UI 컴포넌트 및 정적 자산 보존 확인.

---

## 4. 검증 한계 및 운영 경계 (Verification Limits & Boundaries)

본 검수는 아래 영역을 보증하지 않으며 명시적 한계로 보고한다:
1. **실제 외부 Provider API 라이브 호출 미검증**:
   - `ai-execution.test.mjs` 등 단위 테스트는 mock/stub 환경에서 실행되었으며, 실제 OpenAI, Anthropic, Google, xAI, Moonshot 서버와의 실시간 네트워크 통신 및 결제/쿼터 상태는 검증 범위에 포함되지 않는다.
2. **다중 프로세스 / 멀티 인스턴스 동시성 미검증**:
   - `lib/server/db.ts`의 직렬화는 단일 Node.js 프로세스 메모리 큐 기반이다. 다중 프로세스(클러스터 모드 또는 다중 컨테이너) 환경에서의 동시 쓰기 안전성은 보증되지 않으며, 향후 `database/schema.sql` (SQLite WAL/PostgreSQL)로의 전환이 필요하다.
3. **전원 차단 / 비정상 하드웨어 크래시 복원력 미검증**:
   - 파일 시스템의 전원 차단(power loss)이나 OS 커널 크래시 상황에서의 저수준 저널링 복원력은 테스트되지 않았다.

---

## 5. 결론 (Conclusion)

- **검수 판정**: **PASS (블로킹 이슈 없음)**
- **결론**: Root의 수정 사항은 검토된 범위의 자동 검사에서 블로킹 이슈가 발견되지 않았으며, Think Along의 제품 불변 조건(공식 API, 사용자 주도 세션, Fail-Closed)을 충실히 만족한다.
