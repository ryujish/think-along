# Think Along — Project Context

## 제품 정의

Think Along은 여러 AI Provider·계정·모델을 하나의 연속된 프로젝트 경험으로 연결하는 AI Continuity Layer다. 사용자가 GPT, Claude, Gemini, Local LLM 등으로 바꿔도 대화, 기억, 결정, 파일과 현재 작업 상태가 이어져야 한다.

핵심 경험:

> 모델은 바뀔 수 있지만 대화, 기억, 결정은 이어진다.

> AI는 바뀌어도, 생각은 이어집니다.

핵심 슬로건은 `Think today. Understand tomorrow.`다. 장기 경쟁력은 시간이 지나며 축적되는 사용자의 생각, 질문, 결정, 변화와 결과다.

## 설계 원칙

1. Think Along이 프로젝트, 세션, 대화 원문, 기억, 결정과 현재 작업 상태를 소유한다.
2. 모든 대화는 provider와 무관한 `thinkalong_session_id`에 속한다.
3. Context Engine은 매 요청마다 공유 기억과 최근 대화를 provider 중립 형식으로 조립한다.
4. Provider → Account → Available Model을 독립적으로 관리하고, 세션에는 선택 상태와 계정 참조 ID만 기록한다.
5. MVP에서는 사용자가 Provider·계정·모델을 직접 선택하며, 선택 상태는 세션에 유지한다. 오류나 한도 초과가 발생해도 자동으로 다른 계정이나 모델로 전환하지 않는다.
6. provider 이름은 운영 추적용 메타데이터이지 대화의 정체성이 아니다.
7. 모델이나 계정이 바뀌어도 세션은 분리하지 않는다.
8. 웹 ChatGPT 같은 외부 대화 클라이언트도 Think Along API를 통해 같은 `thinkalong_session_id`와 기억을 사용한다. 외부 서비스의 자체 대화 기록이나 provider thread ID는 원본으로 취급하지 않는다.
9. 대화 원문은 보존하며 요약을 반복해서 재요약하지 않는다. 파생 요약과 모델별 Context Cache는 Canonical Context보다 우선할 수 없다.
10. 확정 결정은 상태와 변경 이력을 보존하고, AI가 사용자 승인 없이 덮어쓰지 않는다.
11. 모델 전환 시 어떤 정보가 전달되고 제외되는지 사용자가 이해할 수 있어야 한다.
12. 일반 사용자가 로컬 CLI 없이 사용할 수 있도록 공식 API 연결을 기본으로 한다. 각 연결 화면에서 Provider의 공식 API Key 발급 페이지로 이동할 수 있어야 한다.
13. `Sign in with ChatGPT`의 신원 인증과 모델 실행 권한을 구분한다. 공식 실행 권한이 제공되기 전에는 로그인만으로 GPT 호출이 가능하다고 가정하지 않는다.

## Canonical Context

Think Along이 보유하는 단일 기준 원본이다.

- 전체 대화 원문과 각 메시지의 Provider·계정·모델
- 프로젝트 비전, 목표, 확정 결정과 변경 이력
- 사용자 선호와 제약
- 완료·진행 중·미해결 작업을 포함한 현재 상태
- 파일과 출처
- 모델 및 계정 전환 이력

모델별 Context Cache는 Canonical Context 버전에서 파생된 캐시다. Canonical Context가 바뀌면 관련 캐시를 만료하며, 캐시 자체를 독립 기억으로 취급하지 않는다.

## 기억 계층

- User Memory: 사용자 취향, 제약, 장기 목표처럼 프로젝트를 넘어 유지되는 사실
- Project Memory: 특정 프로젝트의 목표, 도메인 지식, 산출물, 제약
- Conversation Memory: 현재 세션의 메시지와 요약
- Decision Memory: 결정, 근거, 보류/폐기된 대안
- Working Memory: 현재 요청 수행에만 필요한 임시 상태

Working Memory는 기본적으로 영속 저장하지 않는다. 나머지 기억도 P0에서는 기존 데이터와 명시적 기록만 읽는다. 자동 추출은 사용자 승인 정책과 필요성이 정해진 뒤 추가한다.

Decision Memory는 결정문, `confirmed`/`superseded` 상태, 결정 시각, 대체한 이전 결정, 출처 메시지를 보존한다. 변경된 결정을 삭제하지 않는다.

Context Packet은 프로젝트 헌장 → 확정 결정과 변경 이력 → 현재 작업 상태 → 관련 기억 → 최근 대화 원문 → 파일·출처 참조 순으로 조립한다. API Key와 OAuth Token은 저장된 세션이나 Context Packet에 포함하지 않는다.

## 우선순위

- UI 기획: 제품 정의 → 사용자 시나리오 → IA → 화면·이동 구조 → 핵심 와이어프레임 → 인터랙션·상태 → 클릭 프로토타입 → 사용자 검증
- P0-1: Core/UI 경계
- P0-2: Provider → Account → Model 구조
- P0-3: Canonical Context 저장
- P0-4: Context Packet 생성
- P0-5: 수동 모델·계정 전환
- P0-6: 전환 후 세션 연속성
- P0-7: Decision Memory와 supersede
- P1: 모델별 Context Cache와 버전 무효화 → JSON 내보내기·가져오기 → 전달 범위 UI → Permission·Provider Policy → Context Snapshot·Session Summary
- P2: 역할별 내부 Agent → 이벤트 훅 → 컨텍스트 충돌 검증 → 비활성 자동 라우팅 인터페이스
- P3: Skills → Sub-agent → Tool execution

### 현재 구현 상태 (2026-08-21)

- P0-1~P0-7 구현 완료: Core/UI 경계, Provider→계정→모델 구조, Canonical Context, Context Packet, 수동 전환, 세션 연속성, Decision supersede
- P1 구현 완료: 버전 기반 Context Cache, JSON 복원, 전달 범위 UI, 세션 Context 권한, Context Snapshot과 Session Summary
- P2 구현 완료: 내부 역할 계약, append-only 이벤트, 주제 기반 결정 충돌 차단, 비활성 자동 라우팅 경계
- P3 구현 완료: 허용 목록 Tool, 정적 Skill, 동일 Context 기반 단일 Sub-agent, 권한·감사 이력
- P0~P3 로드맵 구현 완료. 다음 단계는 사용자 검증과 실제 배포·운영 준비다.
- 자동 전환, 자동 fallback, 외부 ChatGPT App/MCP 연동은 아직 구현하지 않음
- Provider 인증: 공식 API 연결을 기본으로 하고 Provider별 Key 발급 페이지를 연결 화면에서 안내

### Paseo에서 가져올 것

- Provider별 실행 차이를 adapter 내부에 격리하고 UI에는 공통 연결 상태·모델·사용량만 노출
- Provider → Account → Model 공통 구조와 연결 상태 snapshot
- Provider별 공식 설정·발급 페이지로 이어지는 명확한 연결 UX

적용하지 않는 것:

- ChatGPT 신원 로그인을 GPT 실행 권한으로 오인하는 구현
- 브라우저 쿠키나 로컬 credential 파일을 직접 읽는 구현
- CLI 설치를 일반 사용자 필수 조건으로 만드는 구현
- 사용자가 선택하지 않은 런타임 자동 실행

참고: [Paseo Providers](https://paseo.sh/docs/supported-providers), [Sign in with ChatGPT](https://help.openai.com/en/articles/20001410-sign-in-with-chatgpt)

자동 모델·계정 전환은 현재 MVP 범위에서 제외한다. 내부 Router 계약은 수동 선택 결과만 실행하며, 자동 라우팅은 사용자가 별도로 결정하기 전까지 활성화하지 않는다.

UI 기획과 사용자 관점 검증이 데이터·API 상세 설계보다 먼저다. 각 루프는 완료 조건과 검증 증거를 가지며, 종료 시 `변경 내용 / 테스트 결과 / 남은 문제 / 다음 루프` 형식으로 보고한다.

## OpenClaw에서 가져올 것

- Context Engine
- 계층화된 Memory Architecture
- Model Router 인터페이스와 Context Snapshot
- Provider abstraction
- 이후 단계의 Skills

## OmniRoute에서 가져올 것

OmniRoute는 Think Along의 제품 코어나 기억 저장소가 아니라 Provider 실행 계층의 벤치마크다. Think Along은 Canonical Context와 사용자 결정권을 소유하고, OmniRoute의 장점 중 연결 정규화·격리·관측 가능성만 흡수한다.

### 채택

- `Provider → Connection(Account) → Available Model` 구조
- Provider별 wire format을 adapter 내부에 가두는 공통 요청·응답 계약
- 인증, 권한, 잘못된 요청, rate limit, quota, timeout, 장애, safety refusal 오류 정규화
- Provider 전체, Connection, Connection+Model 단위의 상태 분리
- 메시지별 Provider·Connection·Model·Context 버전·실행 결과 추적
- API Key·OAuth Token과 세션·Context Packet의 완전한 분리
- 실제 연결된 모델부터 관리하는 capability registry(text, vision, file, tool, structured output, streaming)

### Think Along 방식으로 변형

- OmniRoute의 자동 routing은 `대체 후보 계산 → 사용자 표시 → 사용자 선택 → 동일 Context로 실행`으로 바꾼다.
- multi-account round-robin은 복수 계정 등록과 수동 선택으로 바꾼다.
- circuit breaker는 P0에서 최근 오류와 사용 불가 상태 표시만 기록한다.
- context relay는 Provider 간 기억 전달이 아니라 Canonical Context에서 새 Context Packet을 만드는 방식으로 구현한다.
- 비용·속도·quota 정보는 자동 선택 기준이 아니라 확인 가능한 경우 후보 설명에만 사용한다.

### 제외

- 사용자 승인 없는 자동 모델·계정 fallback
- round-robin, weighted, cheapest, random, fusion 등 다중 routing strategy
- 별도 범용 AI Gateway와 OpenAI 호환 프록시 전체 복제
- Canonical Context 원문을 변경하는 자동 프롬프트 압축
- OmniRoute의 Memory·Agent·Skill 시스템과 수백 Provider 카탈로그 복제

P0에서는 Provider·Connection·Model 타입, 공통 Generate 계약, Provider Adapter, 세션 선택 상태, 실행 메타데이터, 오류 정규화까지만 구현한다. OAuth 자동 갱신, 모델 목록 동기화, quota·usage 수집, cooldown, 후보 점수는 실제 필요가 확인된 뒤 추가한다.

참고: [OmniRoute 공식 저장소](https://github.com/diegosouzapw/OmniRoute)

## MVP에서 가져오지 않을 것

- Gateway 복잡성
- 메신저 중심 구조
- 복잡한 agent config
- SOUL/IDENTITY 다중 설정
- Cron/Heartbeat
- 다중 agent sandbox
- 복잡한 plugin SDK
- 고도화된 멀티에이전트 협업과 provider 간 말투 통일
- 웹 ChatGPT 연동 앱/MCP 배포 (P0의 Unified Session API가 안정된 뒤 추가)
- 자동 모델·계정 전환
- Predictive Account & Model Router
- 복잡한 이벤트·권한·플러그인 구현

## 제품 경험

전체 흐름은 `Think → Journey → Insight → Profile`이다.

- Think: 질문 시작, AI·계정·모델 선택, 최근 상태 확인
- Journey: 시간순 대화와 결정 변화 확인
- Insight: 충분한 Thinking이 쌓인 뒤 관심사·반복 질문·목표·결정 패턴 분석
- Profile: Provider·계정·모델, 개인정보, 기억, 내보내기·가져오기 관리

UX 정서는 기대감, 따뜻함, 명확함, 성장감을 기준으로 한다. Insight 시작 기준으로 Thinking 5개 이상이 제안됐지만 실제 임계값은 구현 전 검증한다.

## UI/UX 기준

FlowPulse 계열 제품처럼 색상, 타이포그래피, 간격, 상태 표현을 일관되게 유지한다. 다만 내부 모델 전환을 제품의 주인공으로 만들지 않는다.

- 대화 헤더와 URL의 주 식별자는 session이다.
- 모델은 작은 상태 정보로 표시할 수 있지만 대화를 모델별 탭으로 쪼개지 않는다.
- 오류나 한도 초과 시 대체 후보를 보여줄 수 있지만 최종 선택은 사용자가 한다.
- 모델 전환 UI는 전달·제외되는 Context 범위를 보여준다.
- 기억이 사용된 경우 출처를 확인하거나 관리할 수 있어야 하지만, P0에서는 별도 기억 관리 UI를 만들지 않는다.

## 성공 조건

1. 한 session의 두 연속 요청이 서로 다른 provider로 처리돼도 두 번째 응답이 첫 번째 대화를 이해한다.
2. provider 오류나 한도 초과 시 사용자가 선택하지 않은 계정이나 모델로 자동 전환되지 않는다.
3. provider 고유 ID가 없어도 대화를 완전히 복원할 수 있다.
4. 메시지마다 실제 사용 Provider·계정·모델과 전환 이력을 추적할 수 있다.
5. 확정 결정이 모델 전환 후에도 누락되지 않고, 변경된 결정은 `superseded` 이력으로 남는다.
6. 민감정보 제외 정책이 외부 Provider 전송 전에 적용된다.
7. 프로젝트를 내보낸 뒤 동일한 메시지·결정·기억을 복원할 수 있다.

## 확인된 범위와 확인 필요 사항

- 원본 코드베이스는 Next.js 16, TypeScript, React 19, 파일 기반 JSON 저장소다. 이 실제 코드가 과거 문서의 Next.js 15, Supabase, Zustand 등 초기 기술 제안보다 우선한다.
- GitHub 저장소 후보는 `ryujish/think-along`이지만 최신 브랜치와 로컬 작업의 대응 관계는 확인이 필요하다.
- 과거 UI 보드, Flutter 위젯 매핑, `apps/think|journey|insight` 골격은 산출물 존재 여부와 현재 구현 상태를 별도로 확인해야 한다.
