# Think Along — MVP Scope v0.2

## 1. MVP의 단 하나의 목표

> 사용자가 Provider·계정·모델을 바꿔도 같은 세션에서 대화·기억·확정 결정이 이어지고, 다음날 다시 접속해도 하던 일을 계속할 수 있다.

오류나 한도 초과 시 대체 후보는 보여줄 수 있지만 사용자 승인 없이 자동 전환하지 않는다.

### Golden Rule

새 기능이 아래 시나리오에 직접 필요하지 않으면 MVP에서 제외한다.

```text
GPT 연결 A로 대화
→ 원문·기억·결정 저장
→ 사용자가 Claude 연결 B와 모델을 선택
→ 전달 Context 범위 확인
→ 같은 thinkalong_session_id로 대화 계속
```

## 2. MVP 전체 구조

```text
Think Along UI
      │ 사용자 선택
      ▼
Unified Session ── Provider / Connection / Model
      │
      ▼
Canonical Context
      ├── Shared Memory
      └── Decision Memory
      │
      ▼
Context Engine
      │
      ▼
Manual Model Router
      │
      ▼
Provider Adapter ── OpenAI / Anthropic / Gemini
```

## 3. P0 포함

- 기존 `Thinking.id`를 논리적 `thinkalong_session_id`로 재사용
- Provider → Connection(Account) → Model 선택과 세션 유지
- Provider 중립 Generate 요청·응답 계약
- Provider 오류 정규화와 연결 상태 기록
- User·Project·Conversation·Decision Memory 저장과 조회
- 버전 있는 Canonical Context와 Context Packet 조립
- 메시지별 Provider·Connection·Model·Context 버전·실행 결과 기록
- create/continue API의 단일 실행 경로
- 모델을 바꿔도 세션이 유지되고 자동 fallback이 없음을 검증하는 테스트

## 4. P0 제외

- 자동 모델·계정 fallback과 Predictive Router
- round-robin, cheapest, weighted, fusion 등 routing strategy
- OAuth 자동 갱신과 quota·비용·지연시간 기반 추천
- 모델별 Context Cache와 자동 compaction
- JSON 프로젝트 내보내기·가져오기
- Permission·Provider Policy 관리 UI
- ChatGPT App/MCP 배포
- 장기 기억 자동 추출과 역할별 내부 Agent
- 별도 Gateway, vector DB, 신규 서비스

## 5. P0 완료 조건

1. Provider 고유 thread ID 없이 저장 데이터만으로 세션을 복원한다.
2. 연결과 모델을 변경한 다음 요청에도 이전 대화와 확정 결정이 포함된다.
3. 429·quota·timeout 발생 시 다른 연결이나 모델을 자동 호출하지 않는다.
4. 인증정보가 메시지, Context Packet, export 가능한 프로젝트 데이터에 포함되지 않는다.
5. 기존 API 응답과 UI의 기본 Thinking 흐름을 깨지 않는다.
6. 최소 연속성 테스트와 `lint`, `build`가 통과한다.
