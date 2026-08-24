# 08. Think Along AI Router

> Think Along이 생성한 ContextPack을 어떤 AI Provider에 전달할지 결정하고, Provider 실패 시 사용자의 대화와 작업을 끊지 않고 다른 AI로 전환하는 Routing 계층을 정의한다.

---

## 1. AI Router의 목적

Think Along의 AI Router는 단순한 Model Selector가 아니다.

핵심 목적은 다음과 같다.

> **AI가 바뀌어도 사용자의 작업은 끊기지 않아야 한다.**

Router는 다음을 담당한다.

```text
Provider Selection

Primary Provider

Fallback

Retry

Health Check

Rate Limit Handling

Quota Handling

Manual Override

Auto Mode

Provider Capability

Failure Recovery
```

---

## 2. Router의 핵심 원칙

### 2.1 Provider Changes, Context Remains

Provider가 변경되어도 Context는 유지한다.

```text
ContextPack
    │
    ▼
 OpenAI
    │
    X
 Rate Limit
    │
    ▼
  Router
    │
    ▼
 Anthropic
```

Anthropic에는 새로운 대화를 시작시키는 것이 아니라 동일한 ContextPack을 전달한다.

---

### 2.2 Router Does Not Own Memory

Router가 Memory나 Session을 직접 관리해서는 안 된다.

```text
Memory
Session
Decision
Context

   │
   ▼

Context Engine

   │
   ▼

ContextPack

   │
   ▼

AI Router
```

Router의 책임은:

> **누구에게 보낼 것인가?**

이다.

---

### 2.3 Failover Is a Core Product Feature

Provider Failover는 단순한 장애 처리 기능이 아니다.

Think Along의 핵심 사용자 경험 중 하나다.

사용자는:

```text
GPT 사용량 제한
```

을 만났다고 해서:

```text
Claude 열기

Context 다시 입력

프로젝트 다시 설명
```

을 해서는 안 된다.

Think Along이 처리해야 한다.

---

## 3. Router 위치

전체 구조:

```text
User
 │
 ▼
Unified Session
 │
 ▼
Context Engine
 │
 ▼
ContextPack
 │
 ▼
AI Router
 │
 ├── OpenAI
 ├── Anthropic
 ├── Gemini
 ├── Kimi
 └── Local
```

---

## 4. Router MVP 목표

MVP에서는 Smart Router를 만들지 않는다.

초기 목표는 명확하다.

```text
Primary Provider

↓

Fallback Provider

↓

Optional Second Fallback
```

예:

```text
OpenAI
   │
   X
   │
   ▼
Anthropic
```

MVP 초기에는 두 Provider만 있어도 충분하다.

---

## 5. 초기 Provider 구성

권장 초기 구성:

```text
Primary

OpenAI

Fallback

Anthropic
```

이 두 모델 사이에서 다음이 완벽하게 작동해야 한다.

```text
Same Session

Same Context

Same Memory

Same Decision

Same Project
```

그 후:

```text
Gemini

OpenRouter

Kimi

Local LLM
```

을 추가한다.

---

## 6. Provider Interface

Router는 모든 Provider를 동일한 인터페이스로 사용한다.

예:

```typescript
interface AIProvider {
  readonly id: string;

  chat(
    context: ContextPack,
    options?: ChatOptions
  ): AsyncIterable<AIChunk>;

  health(): Promise<ProviderHealth>;

  capabilities(): ProviderCapabilities;
}
```

---

## 7. Provider Registry

Router는 Provider 구현체를 직접 하드코딩하지 않는다.

Registry를 통해 관리한다.

예:

```typescript
interface ProviderRegistry {
  get(
    providerId: string
  ): AIProvider;

  list(): AIProvider[];

  available(): Promise<AIProvider[]>;
}
```

예:

```text
ProviderRegistry

├── openai
├── anthropic
├── gemini
├── kimi
└── local
```

---

## 8. Router Interface

예상 구조:

```typescript
interface AIRouter {
  route(
    input: RouteInput
  ): Promise<RouteResult>;
}
```

입력:

```typescript
interface RouteInput {
  context: ContextPack;

  userId: string;

  sessionId: string;

  preferredProvider?: string;

  preferredModel?: string;

  mode: "AUTO" | "MANUAL";
}
```

---

## 9. RouteResult

예:

```typescript
interface RouteResult {
  providerId: string;

  modelId: string;

  fallbackUsed: boolean;

  fallbackReason?: ProviderErrorCode;

  response: AsyncIterable<AIChunk>;
}
```

---

## 10. Auto Mode

기본 UX는 Auto Mode로 한다.

사용자는 Provider를 신경 쓰지 않아도 된다.

```text
Think Along

Mode = Auto
```

Router가 Provider를 선택한다.

MVP에서는 Auto Mode를 복잡하게 만들지 않는다.

예:

```text
Primary = OpenAI

Fallback = Anthropic
```

이면 충분하다.

---

## 11. Manual Mode

사용자가 특정 Provider를 직접 지정할 수 있다.

예:

> 이번 건 Claude로 해줘.

Router:

```text
Manual Override

↓

Anthropic
```

이 경우에도 Context는 Think Along이 만든 동일한 ContextPack을 사용한다.

---

## 12. Manual Override 원칙

Manual Mode에서도 Provider가 실패할 수 있다.

두 가지 정책을 고려할 수 있다.

### Strict Manual

사용자가 Claude를 지정했다면 Claude만 사용한다.

실패하면 오류를 반환한다.

### Soft Manual

Claude를 우선 사용하되 실패하면 다른 Provider로 Fallback한다.

MVP에서는 사용자 혼란을 줄이기 위해 다음 정책을 권장한다.

```text
Manual Provider
      │
      ▼
Try Selected Provider
      │
      X
      │
      ▼
Ask / Allow Fallback
```

즉 강제 자동 전환보다 사용자 선택을 존중한다.

---

## 13. Provider Configuration

Provider 설정 예:

```typescript
interface ProviderConfig {
  providerId: string;

  enabled: boolean;

  priority: number;

  defaultModel: string;

  fallbackEnabled: boolean;

  timeoutMs: number;
}
```

예:

```text
OpenAI

enabled = true
priority = 1

Anthropic

enabled = true
priority = 2
```

---

## 14. Routing Priority

MVP에서는 단순 Priority 기반으로 처리한다.

예:

```text
Priority 1
OpenAI

Priority 2
Anthropic

Priority 3
Gemini
```

Router는 사용 가능한 가장 높은 Priority Provider를 선택한다.

---

## 15. Provider Health

Router는 Provider 상태를 확인할 수 있어야 한다.

예:

```typescript
type ProviderHealthStatus =
  | "HEALTHY"
  | "DEGRADED"
  | "UNAVAILABLE";
```

ProviderHealth:

```typescript
interface ProviderHealth {
  status: ProviderHealthStatus;

  latencyMs?: number;

  checkedAt: Date;

  reason?: string;
}
```

---

## 16. Health Check 목적

Health Check는 매 요청마다 무조건 실제 API 호출을 추가하는 방식으로 만들지 않는다.

그렇게 하면:

```text
Latency 증가

비용 증가

Provider Call 증가
```

가 발생한다.

대신 다음 정보를 조합한다.

```text
Last Request Result

Recent Error Rate

Timeout History

Rate Limit State

Provider Status Cache
```

---

## 17. Health Cache

Provider 상태를 짧은 시간 캐시할 수 있다.

예:

```text
OpenAI

HEALTHY

checked 20 seconds ago
```

불필요한 Health API 호출을 줄인다.

---

## 18. Standard Provider Error

Provider별 오류를 공통 형식으로 변환한다.

```typescript
type ProviderErrorCode =
  | "RATE_LIMIT"
  | "QUOTA_EXHAUSTED"
  | "TIMEOUT"
  | "AUTH_ERROR"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "CONTENT_REJECTED"
  | "MODEL_UNAVAILABLE"
  | "UNKNOWN";
```

---

## 19. Error Normalization

예:

```text
OpenAI Error
429
```

↓

```text
RATE_LIMIT
```

Anthropic:

```text
overloaded_error
```

↓

```text
PROVIDER_UNAVAILABLE
```

Router는 Provider 원본 오류를 직접 해석하지 않는다.

---

## 20. Fallback 가능 오류

다음 오류는 일반적으로 Fallback 대상이다.

```text
RATE_LIMIT

QUOTA_EXHAUSTED

TIMEOUT

PROVIDER_UNAVAILABLE

MODEL_UNAVAILABLE
```

---

## 21. Fallback하지 않을 오류

다음 오류는 단순 Provider 전환으로 해결되지 않을 가능성이 높다.

```text
INVALID_REQUEST

CONTENT_REJECTED
```

예:

Context 자체가 잘못된 경우 다른 Provider로 보내도 실패할 수 있다.

---

## 22. Authentication Error

AUTH_ERROR는 주의해서 처리한다.

예:

```text
OpenAI API Key invalid
```

이 경우 OpenAI는 Fallback 가능하지만 사용자에게 설정 오류를 알려야 한다.

```text
OpenAI 연결 문제

Anthropic으로 전환
```

정도로 처리할 수 있다.

---

## 23. Basic Routing Flow

MVP 기본 흐름:

```text
ContextPack
    │
    ▼
Router
    │
    ▼
Primary Provider
    │
 ┌──┴──┐
 │     │
OK    FAIL
 │     │
 ▼     ▼
Return Fallback
        │
        ▼
  Fallback Provider
        │
     ┌──┴──┐
     │     │
    OK    FAIL
     │     │
     ▼     ▼
  Return  Error
```

---

## 24. Fallback Flow

예:

```text
OpenAI

   │

429 RATE_LIMIT

   │

   ▼

Router

   │

   ▼

Anthropic

   │

   ▼

Response
```

사용자 Session은 변경되지 않는다.

---

## 25. Context Snapshot Reuse

Failover에서 가장 중요한 원칙 중 하나다.

```text
Request R1
```

에 대해 Context Engine이:

```text
ContextSnapshot C100
```

을 만들었다고 가정한다.

OpenAI 실패:

```text
C100
 ↓
OpenAI
 X
```

Anthropic 재시도:

```text
C100
 ↓
Anthropic
```

동일 Snapshot을 사용한다.

---

## 26. 왜 Context를 다시 만들지 않는가

Fallback 사이에 Context Engine을 다시 실행하면:

```text
Memory 변경

Summary 변경

Working State 변경
```

등으로 같은 요청인데도 다른 Context가 만들어질 수 있다.

이는 디버깅과 재현성을 떨어뜨린다.

따라서:

> **One Request = One Context Snapshot**

원칙을 둔다.

---

## 27. Request ID

각 사용자 요청마다 고유 Request ID를 생성한다.

예:

```text
request_id
```

관계:

```text
Request
 │
 ├── Context Snapshot
 │
 ├── Provider Attempt 1
 │
 ├── Provider Attempt 2
 │
 └── Final Response
```

---

## 28. Provider Attempt

각 Provider 호출을 별도로 기록한다.

예:

```typescript
interface ProviderAttempt {
  id: string;

  requestId: string;

  providerId: string;

  modelId: string;

  startedAt: Date;

  finishedAt?: Date;

  status:
    | "SUCCESS"
    | "FAILED"
    | "CANCELLED";

  errorCode?: ProviderErrorCode;

  latencyMs?: number;
}
```

---

## 29. Retry와 Failover 차이

Retry:

```text
같은 Provider
다시 시도
```

Failover:

```text
다른 Provider
사용
```

둘을 구분해야 한다.

---

## 30. Retry 정책

모든 오류에 Retry를 해서는 안 된다.

예:

```text
TIMEOUT
→ 1회 Retry 가능
```

```text
RATE_LIMIT
→ 즉시 Fallback 권장
```

```text
QUOTA_EXHAUSTED
→ Retry 의미 없음
```

---

## 31. MVP Retry 정책

단순하게 시작한다.

```text
TIMEOUT
Retry 1

PROVIDER_UNAVAILABLE
Retry 1

RATE_LIMIT
Retry 0

QUOTA_EXHAUSTED
Retry 0

AUTH_ERROR
Retry 0
```

---

## 32. Retry Backoff

Retry가 필요한 경우 짧은 Backoff를 둔다.

예:

```text
Attempt 1

↓

500ms

↓

Attempt 2
```

MVP에서는 복잡한 Exponential Backoff가 반드시 필요하지 않다.

---

## 33. Infinite Loop 방지

Router는 같은 Provider를 무한 반복하면 안 된다.

예:

```text
OpenAI
 ↓
Anthropic
 ↓
OpenAI
 ↓
Anthropic
```

금지.

하나의 Request에서 Provider별 최대 Attempt 수를 제한한다.

---

## 34. Routing Plan

Router는 Request 시작 시 Routing Plan을 만들 수 있다.

예:

```text
Routing Plan

1. OpenAI
2. Anthropic
3. Gemini
```

각 Provider는 최대 한 번 또는 정해진 Retry 횟수만 사용한다.

---

## 35. Routing Plan Interface

```typescript
interface RoutingPlan {
  requestId: string;

  providers: RoutingCandidate[];

  currentIndex: number;
}
```

---

## 36. Routing Candidate

```typescript
interface RoutingCandidate {
  providerId: string;

  modelId: string;

  priority: number;

  reason: string;
}
```

예:

```text
1

OpenAI
GPT
Primary

2

Anthropic
Claude
Fallback
```

---

## 37. Streaming

AI 응답은 Streaming을 기본으로 한다.

```text
Provider

 ↓

AIChunk

 ↓

Router

 ↓

Client
```

Router는 Streaming 중에도 Provider 상태를 감시한다.

---

## 38. Streaming 중 실패

가장 까다로운 상황이다.

예:

```text
Claude:

"Think Along의 구조는 크게..."

        X

     timeout
```

일부 응답은 이미 사용자에게 전달되었을 수 있다.

---

## 39. MVP Streaming Failure 정책

MVP에서는 Provider 간 문장 이어쓰기를 시도하지 않는다.

권장:

```text
Partial Response
       │
       X
       │
       ▼
Mark Incomplete
       │
       ▼
Fallback Provider
       │
       ▼
Regenerate Full Response
```

---

## 40. Partial Response 처리

가능하면 UI에서 불완전 Response를 최종 Message로 확정하지 않는다.

내부 상태:

```text
GENERATING

↓

FAILED_PARTIAL
```

Fallback 성공 후:

```text
COMPLETED
```

Response 하나만 최종 대화 기록으로 남긴다.

---

## 41. 중복 답변 방지

OpenAI가 실제로 응답을 완료했지만 네트워크 오류로 Client가 완료 신호를 못 받는 상황도 있을 수 있다.

따라서 Request ID와 Provider Attempt ID를 사용해 중복 저장을 방지한다.

---

## 42. Response 상태

예:

```typescript
type ResponseStatus =
  | "GENERATING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";
```

---

## 43. 사용자 취소

사용자가 응답 생성을 중지할 수 있어야 한다.

```text
User
 │
 └── Stop
```

Router는 현재 Provider 요청을 취소한다.

이 경우 다른 Provider로 자동 Fallback하지 않는다.

사용자 취소는 장애가 아니다.

---

## 44. Quota State

Provider의 Quota 상태를 관리할 수 있다.

예:

```text
AVAILABLE

NEAR_LIMIT

EXHAUSTED

UNKNOWN
```

---

## 45. Quota의 한계

모든 Provider가 실시간 남은 Quota를 정확히 제공하는 것은 아니다.

따라서 Quota 상태는:

```text
API Metadata

Recent Errors

Local Usage Tracking
```

을 조합해서 추정할 수 있다.

추정값은 확정 사실로 취급하지 않는다.

---

## 46. Rate Limit Cooldown

특정 Provider에서 RATE_LIMIT이 발생하면 일정 시간 해당 Provider를 우선순위에서 제외할 수 있다.

예:

```text
OpenAI

RATE_LIMIT

↓

cooldown_until = +60s
```

그동안:

```text
Anthropic
```

을 우선 사용한다.

---

## 47. Circuit Breaker

향후 Provider가 반복적으로 실패하면 Circuit Breaker를 적용할 수 있다.

```text
HEALTHY
  │
  │ repeated failures
  ▼
OPEN
  │
  │ cooldown
  ▼
HALF_OPEN
  │
  ├── success → HEALTHY
  └── failure → OPEN
```

MVP에서는 단순 Cooldown으로 시작한다.

---

## 48. Provider Capability

Provider마다 능력이 다를 수 있다.

예:

```typescript
interface ProviderCapabilities {
  streaming: boolean;

  tools: boolean;

  vision: boolean;

  maxContextTokens: number;

  structuredOutput: boolean;
}
```

---

## 49. Capability Routing

향후 요청이 이미지 분석이라면:

```text
vision = true
```

인 Provider만 후보가 된다.

Tool 사용 요청이면:

```text
tools = true
```

인 Provider만 선택한다.

MVP 초기에는 텍스트 Chat 중심으로 단순화한다.

---

## 50. Smart Routing

장기적으로 Router는 단순 Failover를 넘어 다음을 판단할 수 있다.

```text
Task Type

Model Quality

Cost

Latency

Quota

User Preference

Context Length

Provider Capability
```

예:

```text
Coding
→ Claude

General Reasoning
→ GPT

Very Long Context
→ Large-context Model
```

하지만 이는 MVP 이후다.

---

## 51. Smart Routing을 MVP에서 제외하는 이유

Smart Routing은 그 자체로 큰 문제다.

초기부터 넣으면:

```text
왜 이 모델을 선택했는가?

선택 기준은 정확한가?

모델 성능을 어떻게 비교하는가?

가격 변화는 어떻게 반영하는가?
```

등의 새로운 복잡성이 생긴다.

Think Along MVP의 핵심은:

> **Model Selection이 아니라 Model Continuity**

다.

---

## 52. Model Selection과 Provider Selection

두 개념을 구분한다.

Provider:

```text
OpenAI
Anthropic
Google
```

Model:

```text
GPT-x

Claude-x

Gemini-x
```

Router는 장기적으로 둘 다 선택해야 한다.

---

## 53. Provider / Model Identifier

Provider 내부 ID를 표준화한다.

예:

```text
openai:gpt-x

anthropic:claude-x

google:gemini-x
```

정확한 모델 이름은 Provider Config에 저장한다.

---

## 54. Default Model

각 Provider는 기본 Model을 가진다.

```text
OpenAI
defaultModel = ...

Anthropic
defaultModel = ...
```

Router는 Provider 선택 후 해당 기본 Model을 사용할 수 있다.

---

## 55. User Preference

사용자는 특정 모델 또는 Provider를 선호할 수 있다.

예:

```text
Coding
Claude 선호
```

하지만 이를 무조건 적용하지 않는다.

Model이 사용 불가능하면 Fallback이 가능해야 한다.

---

## 56. Session Provider Preference

Session 단위로 Provider를 고정할 수도 있다.

예:

```text
Session Mode

AUTO
```

또는:

```text
Session Mode

MANUAL

Provider
Anthropic
```

---

## 57. Message-level Override

사용자가 특정 요청만 다른 AI에 보낼 수도 있다.

예:

> 이것만 GPT로 다시 봐줘.

이 경우:

```text
Message Override
OpenAI
```

다음 Message부터는 다시 Auto로 돌아갈 수 있다.

---

## 58. UX 원칙

Router 내부는 복잡하지만 UI는 단순해야 한다.

기본:

```text
Auto
```

사용자가 원할 때만:

```text
GPT

Claude

Gemini
```

를 선택할 수 있다.

---

## 59. 자동 전환 표시

Provider가 자동으로 바뀌었을 때 사용자를 방해하는 Modal을 띄우지 않는다.

작은 상태 표시 정도를 권장한다.

예:

```text
Claude로 자동 전환됨
```

---

## 60. Transparency

사용자가 상세 정보를 원하는 경우 볼 수 있어야 한다.

예:

```text
Response Details

Provider
Anthropic

Model
Claude

Fallback
Yes

Reason
OpenAI Rate Limit

Context Preserved
Yes
```

---

## 61. Invisible Complexity

기본 사용자 경험에서는:

```text
429

Provider Timeout

Retry

Fallback Plan
```

같은 내부 세부정보를 노출하지 않는다.

사용자가 해야 할 일은:

> 계속 대화하기

뿐이다.

---

## 62. Provider Status UI

Settings에서 Provider 상태를 표시할 수 있다.

예:

```text
Providers

OpenAI
Connected

Anthropic
Connected

Gemini
Not configured
```

---

## 63. Credentials

각 Provider API Credential은 Router와 분리하여 안전하게 관리한다.

예:

```text
provider_configs

credentials_reference

enabled

priority
```

Credential 원문을 일반 Log에 남겨서는 안 된다.

---

## 64. BYOK

장기적으로 사용자가 자신의 API Key를 등록하는 BYOK 구조를 지원할 수 있다.

```text
Bring Your Own Key
```

예:

```text
OpenAI Key

Anthropic Key

Gemini Key
```

이는 비용 구조 측면에서도 중요할 수 있다.

---

## 65. Managed Provider

향후 Think Along 자체 Provider Account를 통해 AI를 제공하는 구조도 가능하다.

```text
Managed

or

BYOK
```

하지만 MVP 비즈니스 모델에 따라 별도 결정한다.

---

## 66. Provider Config 데이터 모델

예:

```typescript
interface ProviderConfig {
  id: string;

  userId: string;

  providerId: string;

  enabled: boolean;

  priority: number;

  defaultModel: string;

  mode:
    | "BYOK"
    | "MANAGED";

  createdAt: Date;

  updatedAt: Date;
}
```

---

## 67. Routing Log

Router 의사결정은 내부적으로 기록하는 것이 좋다.

예:

```text
Request R20

Mode
AUTO

Selected
OpenAI

Result
RATE_LIMIT

Fallback
Anthropic

Final
SUCCESS
```

---

## 68. Router Trace

예:

```typescript
interface RouterTrace {
  requestId: string;

  mode: "AUTO" | "MANUAL";

  candidates: string[];

  selectedProvider: string;

  selectedModel: string;

  fallbackCount: number;

  finalStatus:
    | "SUCCESS"
    | "FAILED";
}
```

---

## 69. Debugging 가치

Router Trace가 있으면 다음 문제를 분석할 수 있다.

```text
왜 Claude를 사용했는가?

왜 OpenAI를 건너뛰었는가?

Fallback이 너무 자주 발생하는가?

특정 Provider의 Timeout이 많은가?
```

---

## 70. Router Metrics

향후 다음 지표를 측정한다.

```text
Primary Success Rate

Fallback Rate

Fallback Success Rate

Provider Error Rate

Average Routing Latency

Provider Latency

Rate Limit Frequency

Quota Exhaustion Frequency
```

---

## 71. 핵심 제품 지표

Think Along 관점에서 중요한 지표:

```text
Interrupted Conversation Rate
```

Router가 잘 작동할수록 이 값은 낮아져야 한다.

또 하나:

```text
Successful Provider Handoff Rate
```

를 측정할 수 있다.

---

## 72. Router Storage

권장 테이블:

```text
provider_configs

provider_health

ai_requests

provider_attempts

router_traces
```

MVP에서는 모든 테이블을 처음부터 만들 필요는 없다.

최소한:

```text
provider_configs

ai_requests

provider_attempts
```

정도면 충분하다.

---

## 73. AI Request Schema

예:

```sql
CREATE TABLE ai_requests (
  id UUID PRIMARY KEY,

  user_id UUID NOT NULL,

  session_id UUID NOT NULL,

  context_snapshot_id UUID NOT NULL,

  mode VARCHAR(20) NOT NULL,

  preferred_provider VARCHAR(100),

  final_provider VARCHAR(100),

  final_model VARCHAR(255),

  status VARCHAR(20) NOT NULL,

  created_at TIMESTAMP NOT NULL,

  completed_at TIMESTAMP NULL
);
```

---

## 74. Provider Attempt Schema

```sql
CREATE TABLE provider_attempts (
  id UUID PRIMARY KEY,

  request_id UUID NOT NULL,

  provider_id VARCHAR(100) NOT NULL,

  model_id VARCHAR(255) NOT NULL,

  attempt_number INTEGER NOT NULL,

  status VARCHAR(20) NOT NULL,

  error_code VARCHAR(50),

  latency_ms INTEGER,

  created_at TIMESTAMP NOT NULL,

  completed_at TIMESTAMP NULL
);
```

---

## 75. Router Pipeline

구현 흐름:

```text
AIRouter.route()

      │

      ▼

Resolve Mode

      │

      ▼

Load Provider Config

      │

      ▼

Build Routing Plan

      │

      ▼

Check Provider Availability

      │

      ▼

Execute Provider

      │

   ┌──┴───┐
   │      │
Success  Failure
   │      │
   ▼      ▼
Return  Normalize Error
          │
          ▼
       Retry?
          │
          ▼
      Fallback?
          │
          ▼
       Next Provider
```

---

## 76. 권장 폴더 구조

```text
src/core/router/

├── ai-router.ts

├── routing-plan.ts

├── routing-policy.ts

├── provider-registry.ts

├── provider-health.ts

├── retry-policy.ts

├── fallback-policy.ts

├── error-classifier.ts

├── router-trace.ts

└── types.ts
```

Provider 구현:

```text
src/providers/

├── base/
│   ├── ai-provider.ts
│   └── provider-error.ts
│
├── openai/
│   └── openai-provider.ts
│
└── anthropic/
    └── anthropic-provider.ts
```

---

## 77. Dependency Rule

Router는 Provider Interface를 안다.

```text
Router
  │
  ▼
AIProvider
```

Router가 특정 SDK를 직접 사용해서는 안 된다.

금지:

```typescript
import OpenAI from "openai";
```

in:

```text
ai-router.ts
```

특정 SDK는 Provider 구현 내부에만 존재한다.

---

## 78. Router와 Context Engine 경계

Context Engine:

> 무엇을 전달할 것인가?

Router:

> 누구에게 전달할 것인가?

```text
Context Engine
      │
      ▼
ContextPack
      │
      ▼
Router
```

Router는 Memory 검색을 하지 않는다.

---

## 79. Router와 Session 경계

Router는 Session을 변경하지 않는다.

```text
session_id
```

는 Request 내내 동일하다.

Provider 전환 시 새 Session을 생성하지 않는다.

---

## 80. Router와 Message 경계

Router는 최종 AI Response를 반환한다.

Message Service가 최종 Response를 Session에 저장한다.

```text
Router

↓

Final Response

↓

Message Service

↓

Database
```

역할을 분리한다.

---

## 81. Router와 Usage

Provider Adapter는 가능하면 Usage 정보를 표준화해 반환한다.

예:

```typescript
interface AIUsage {
  inputTokens?: number;

  outputTokens?: number;

  totalTokens?: number;

  estimatedCost?: number;
}
```

Router는 향후 비용 기반 Routing에 활용할 수 있다.

---

## 82. 비용 기반 Routing

장기적으로:

```text
High Quality

Balanced

Low Cost
```

등의 Router Mode를 제공할 수 있다.

예:

```text
Quality Mode
→ Best available model

Economy Mode
→ Cheapest acceptable model
```

하지만 MVP에서는 구현하지 않는다.

---

## 83. Latency 기반 Routing

향후 Provider Latency 데이터가 축적되면 빠른 Provider를 선택할 수 있다.

```text
Provider A
1.2s

Provider B
3.8s
```

다만 속도만 보고 모델을 선택하면 품질 저하가 발생할 수 있으므로 다중 기준이 필요하다.

---

## 84. User-visible Provider Identity

Think Along의 기본 UI에서는 Assistant 이름을 Provider별로 변경하지 않는다.

잘못된 UX:

```text
GPT:
...

Claude:
...

Gemini:
...
```

기본 UX:

```text
Think Along:
...
```

필요하면 Metadata에서 실제 Provider를 확인한다.

---

## 85. One AI Experience

Router는 Think Along의 다음 원칙을 기술적으로 실현한다.

> **One AI Experience**

내부:

```text
GPT → Claude → Gemini
```

외부:

```text
Think Along
```

---

## 86. Failover Acceptance Test

### Test A — Rate Limit

Primary:

```text
OpenAI
```

강제로 RATE_LIMIT 발생.

#### PASS

```text
Anthropic
```

으로 자동 전환되고 정상 Response를 생성한다.

---

## 87. Test B — Same Context

OpenAI 실패 후 Anthropic으로 전환한다.

#### PASS

Anthropic이 동일한:

```text
Project

Decision

Memory

Recent Conversation
```

을 알고 답한다.

---

## 88. Test C — Same Session

Failover 전:

```text
session_id = S1
```

Failover 후:

```text
session_id = S1
```

#### PASS

새 Session이 생성되지 않는다.

---

## 89. Test D — Quota Exhausted

OpenAI가 QUOTA_EXHAUSTED 반환.

#### PASS

불필요한 OpenAI Retry 없이 Anthropic으로 이동한다.

---

## 90. Test E — Invalid Request

ContextPack 자체에 문제가 있어 INVALID_REQUEST 발생.

#### PASS

무한 Fallback을 하지 않는다.

오류를 정상적으로 종료한다.

---

## 91. Test F — User Cancel

Streaming 도중 사용자가 Stop을 누른다.

#### PASS

현재 요청을 취소하고 다른 Provider로 자동 전환하지 않는다.

---

## 92. Test G — Partial Streaming Failure

OpenAI가 일부 Token을 생성한 뒤 Timeout.

#### PASS

불완전 Message를 최종 저장하지 않는다.

Fallback Provider가 정상 Response를 다시 생성한다.

---

## 93. Test H — Provider Removal

OpenAI Provider를 제거한다.

#### PASS

Router 설정만 변경하면 Anthropic을 Primary로 사용할 수 있다.

Session, Context, Memory 코드는 수정하지 않는다.

---

## 94. Test I — Provider Addition

GeminiProvider를 추가한다.

#### PASS

Provider Registry와 Config에 등록하는 것만으로 Routing 후보가 된다.

Context Engine 수정 없음.

Memory 수정 없음.

Session 수정 없음.

---

## 95. Test J — Manual Override

사용자:

> 이번 답변은 Claude로 해줘.

#### PASS

Anthropic을 사용한다.

다음 메시지에서 Auto Mode라면 기본 Routing으로 복귀할 수 있다.

---

## 96. MVP 구현 범위

### P0

```text
Provider Interface

Provider Registry

OpenAI Provider

Anthropic Provider

Auto Mode

Priority Routing

Fallback

Standard Error

Basic Retry

Context Snapshot Reuse

Streaming

Provider Attempts

Request Tracking
```

---

## 97. P1

```text
Manual Provider Selection

Provider Status UI

Rate Limit Cooldown

Health Cache

Router Trace

Usage Tracking

Fallback Notification
```

---

## 98. Later

```text
Smart Routing

Cost Routing

Latency Routing

Capability Routing

Model Benchmarking

Circuit Breaker

Multi-model Parallel Execution

Automatic Quality Evaluation

Dynamic Model Ranking
```

---

## 99. MVP에서 가장 중요한 것

처음부터 최고의 Router를 만드는 것이 목표가 아니다.

MVP에서 검증해야 하는 것은:

```text
OpenAI
    │
    X
    │
    ▼
Anthropic
```

이라는 단순한 전환이 사용자에게:

```text
Conversation continues.
```

로 느껴지는가이다.

---

## 100. Router North Star

최종 사용자 경험:

```text
User

"이제 다음 API를 설계해줘."


Internally

OpenAI
RATE_LIMIT

↓

Anthropic


User sees

Think Along

"앞서 결정한 PostgreSQL 구조를 기준으로
다음 API를 설계하겠습니다."
```

사용자는 Provider를 바꾸지 않았다.

사용자는 Think Along과 계속 이야기했을 뿐이다.

---

## 101. 핵심 원칙

> **Provider changes. Session remains.**

> **Provider changes. Context remains.**

> **Provider changes. Memory remains.**

> **Provider changes. Decisions remain.**

> **Failure belongs to the system, not the user.**

> **Routing complexity stays invisible.**

---

## 102. 최종 정의

Think Along AI Router는 단순한 Model Selector가 아니다.

Think Along이 관리하는 Session, Memory, Decision, Context를 어떤 AI Intelligence Engine에 전달할지 결정하고, 해당 Engine이 실패할 경우 동일한 작업 상태를 유지한 채 다른 Engine으로 전환하는 **Continuity Routing Layer**다.

전체 구조:

```text
                  Think Along

                       │

                Unified Session

                       │

               Context Engine

                       │

                 ContextPack

                       │

                   AI Router

                       │

          ┌────────────┼────────────┐

          ▼            ▼            ▼

       OpenAI       Anthropic      Gemini

          │
          X

          └──────────────► Anthropic
```

핵심 문장:

> **사용자가 AI 장애를 관리하는 것이 아니라 Think Along이 AI를 관리한다.**

---

## 103. 다음 문서

다음 문서는:

`09_MVP_로드맵.md`

여기서는 지금까지 설계한:

```text
Product Vision

Product Principles

Core User Scenarios

OpenClaw Benchmark

Architecture

Memory

Context Engine

AI Router
```

를 실제 개발 순서로 변환한다.

주요 내용:

```text
MVP Definition

Golden Scenario

Scope

P0 / P1 / Later

Development Phases

Database

Provider Integration

Memory Implementation

Context Engine Implementation

Failover Implementation

UX Integration

Acceptance Tests

Definition of Done
```

`09_MVP_로드맵.md`의 목적은 설계 문서를 실제 개발 가능한 **실행 계획**으로 바꾸는 것이다.