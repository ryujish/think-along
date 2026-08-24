# 06. Think Along Memory Architecture

> Think Along의 핵심 자산인 Memory를 어떻게 저장하고, 분류하고, 검색하고, 수정하고, 폐기할 것인지 정의한다.

---

## 1. Memory의 목적

Think Along의 Memory는 단순한 Chat History가 아니다.

목표는 사용자가 AI를 바꾸거나 Session이 달라져도 다음 정보가 이어지도록 하는 것이다.

```text
User Identity
User Preferences
Project Facts
Project Decisions
Current Work State
Relevant Past Context
```

Think Along의 Memory는 다음 질문에 답할 수 있어야 한다.

> 사용자가 누구인가?

> 어떤 프로젝트를 진행하고 있는가?

> 지금까지 무엇을 결정했는가?

> 현재 어떤 작업을 하고 있는가?

> 지금 질문에 필요한 과거 정보는 무엇인가?

---

## 2. Memory의 핵심 원칙

### 2.1 Memory Belongs to Think Along

Memory는 AI Provider가 소유하지 않는다.

```text
잘못된 구조

GPT Memory

Claude Memory

Gemini Memory
```

Think Along은 하나의 Shared Memory를 가진다.

```text
             Think Along Memory
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
        OpenAI   Anthropic   Gemini
```

모델이 변경되어도 Memory는 유지된다.

---

### 2.2 Remember Meaning, Not Everything

모든 대화를 영구 기억하지 않는다.

다음과 같은 일시적인 내용은 장기 Memory가 될 필요가 없다.

```text
오늘 점심 뭐 먹지?

지금 몇 시야?

이 문장 번역해줘.
```

반면 다음 정보는 장기적으로 중요할 수 있다.

```text
사용자는 한국어를 선호한다.

Think Along의 핵심 목표는 AI Continuity다.

Frontend는 React + TypeScript로 결정했다.
```

따라서 Conversation과 Memory는 분리한다.

```text
Conversation
     │
     ▼
Memory Candidate
     │
     ▼
Evaluation
     │
     ▼
Long-term Memory
```

---

### 2.3 Memory Must Be Revisable

Memory는 한번 저장되었다고 영원한 사실이 아니다.

사용자의 생각이나 프로젝트 결정은 바뀔 수 있다.

예:

```text
Frontend = Flutter
```

이후:

```text
Frontend = React + TypeScript
```

로 변경될 수 있다.

Memory 시스템은 변경과 폐기를 지원해야 한다.

---

### 2.4 User Owns the Memory

사용자는 Think Along이 무엇을 기억하는지 확인할 수 있어야 한다.

또한:

```text
View

Edit

Delete

Forget
```

가 가능해야 한다.

---

## 3. Memory 유형

MVP에서는 Memory를 다음 네 가지로 제한한다.

```text
Memory

├── User Memory
├── Project Memory
├── Working Memory
└── Decision Memory
```

다만 Decision은 일반 Memory보다 중요하므로 실제 구현에서는 별도 Entity로 관리한다.

---

## 4. User Memory

User Memory는 특정 Project에 종속되지 않는 장기 사용자 정보다.

예:

```text
Preferred Language
Korean

Development Preference
MVP First

Preferred Response Style
Concise but structured
```

User Memory는 여러 Project에서 재사용될 수 있다.

```text
User Memory
     │
     ├── Think Along
     ├── FlowPulse
     └── Future Project
```

하지만 모든 User Memory를 모든 Context에 넣어서는 안 된다.

현재 요청과 관련 있는 것만 선택한다.

---

## 5. Project Memory

Project Memory는 특정 Project에만 유효한 사실과 목표를 저장한다.

예:

```text
Project
Think Along

Purpose
AI Continuity Layer

Core Concept
Multiple AI, One Experience

Architecture
Unified Session + Shared Memory + Context Engine + Router
```

Project Memory는 다른 프로젝트에 자동으로 전달하지 않는다.

```text
Think Along Memory
≠
FlowPulse Memory
```

Project Boundary는 명확하게 유지한다.

---

## 6. Working Memory

Working Memory는 현재 작업 상태를 나타낸다.

예:

```text
Current Task
Memory Architecture 설계

Current Step
Memory Lifecycle 정의

Next Step
Context Engine 설계
```

Working Memory의 특징:

```text
Short-lived

Highly Relevant

Frequently Updated
```

현재 Session이나 작업이 종료되면:

```text
삭제

또는

Project Memory로 승격
```

될 수 있다.

---

## 7. Decision Memory

Decision Memory는 Think Along에서 가장 중요한 Memory 유형 중 하나다.

일반적인 사실보다 우선순위가 높다.

예:

```text
Subject
Frontend

Value
React + TypeScript

Status
ACTIVE
```

Decision은 다음 상태를 가진다.

```text
ACTIVE

SUPERSEDED

REVOKED
```

---

## 8. Decision 변경

사용자:

> Flutter로 만들자.

저장:

```text
Frontend

Flutter

ACTIVE
```

이후 사용자:

> Flutter 말고 React + TypeScript로 바꾸자.

기존 Decision:

```text
Frontend

Flutter

SUPERSEDED
```

새 Decision:

```text
Frontend

React + TypeScript

ACTIVE
```

관계:

```text
Flutter
   │
   ▼
SUPERSEDED BY
   │
   ▼
React + TypeScript
```

Context Engine은 기본적으로 ACTIVE Decision만 사용한다.

---

## 9. Memory 데이터 모델

기본 Memory Entity 예시:

```typescript
interface Memory {
  id: string;

  userId: string;

  projectId?: string;

  sessionId?: string;

  type:
    | "USER"
    | "PROJECT"
    | "WORKING";

  key?: string;

  content: string;

  importance: number;

  confidence: number;

  status:
    | "ACTIVE"
    | "ARCHIVED"
    | "DELETED";

  sourceMessageId?: string;

  createdAt: Date;

  updatedAt: Date;

  lastUsedAt?: Date;
}
```

---

## 10. Decision 데이터 모델

```typescript
interface Decision {
  id: string;

  userId: string;

  projectId: string;

  subject: string;

  value: string;

  status:
    | "ACTIVE"
    | "SUPERSEDED"
    | "REVOKED";

  supersededBy?: string;

  sourceMessageId?: string;

  createdAt: Date;

  updatedAt: Date;
}
```

---

## 11. Memory Key

가능하면 Memory에 의미 있는 Key를 부여한다.

예:

```text
user.preferred_language

user.development_style

project.core_goal

project.frontend_stack
```

이를 통해 단순한 자연어 덩어리만 저장하는 것보다 변경과 중복 처리가 쉬워진다.

예:

```text
key:
project.frontend_stack

old:
Flutter

new:
React + TypeScript
```

---

## 12. Memory Lifecycle

Memory는 다음 생명주기를 가진다.

```text
Conversation
     │
     ▼
Candidate
     │
     ▼
Classify
     │
     ▼
Score
     │
     ├── Ignore
     │
     ├── Working Memory
     │
     ├── Project Memory
     │
     ├── User Memory
     │
     └── Decision
     │
     ▼
Store
     │
     ▼
Retrieve
     │
     ▼
Update / Archive / Delete
```

---

## 13. Memory Candidate 생성

모든 메시지를 Memory로 저장하지 않는다.

Conversation에서 Memory Candidate를 추출한다.

예:

사용자:

> 앞으로 Think Along은 Next.js로 개발하자.

Candidate:

```text
type:
DECISION

subject:
frontend_framework

value:
Next.js
```

사용자:

> 오늘 너무 덥네.

Candidate:

```text
NONE
```

---

## 14. Candidate Classification

Memory Candidate는 다음 범주 중 하나로 분류한다.

```text
USER

PROJECT

WORKING

DECISION

NONE
```

예:

```text
"앞으로 한국어로 답해줘."

→ USER
```

```text
"Think Along의 핵심은 AI Continuity야."

→ PROJECT
```

```text
"지금은 Memory부터 설계하자."

→ WORKING
```

```text
"Backend는 Node.js로 확정하자."

→ DECISION
```

---

## 15. Importance Score

Memory마다 중요도를 둔다.

예:

```text
0 ~ 100
```

기본 판단 요소:

```text
Explicit Save Request

Decision

Repetition

Project Relevance

Long-term Value

Recency
```

예시:

```text
"기억해둬. 앞으로 한국어로 답해."

Importance = 100
```

```text
"나는 React를 자주 써."

Importance = 70
```

```text
"오늘 점심은 김밥 먹었어."

Importance = 10
```

---

## 16. Confidence Score

Memory의 확실성도 별도로 관리한다.

예:

```text
confidence = 1.0
```

사용자가 직접 확정한 정보:

```text
Confidence = HIGH
```

AI가 문맥에서 추론한 정보:

```text
Confidence = LOW
```

MVP에서는 가능하면 추론 Memory 저장을 최소화한다.

가장 안전한 기준은:

> 사용자가 명시적으로 말한 정보와 명확한 결정부터 기억한다.

---

## 17. Memory Promotion

모든 Candidate가 바로 Long-term Memory가 되는 것은 아니다.

예:

```text
Candidate
     │
     ▼
importance 20
     │
     ▼
Ignore
```

반면:

```text
Candidate
     │
     ▼
importance 85
     │
     ▼
Project Memory
```

초기 기준 예시:

```text
0 ~ 29
Ignore

30 ~ 59
Working / Temporary

60 ~ 79
Long-term Candidate

80 ~ 100
Long-term Memory
```

이 기준은 이후 사용 데이터에 따라 조정한다.

---

## 18. Explicit Memory

사용자가 명시적으로 기억을 요구한 경우는 별도 취급한다.

예:

> 이건 기억해.

> 앞으로 이 방식으로 해.

> 다음에도 이걸 기준으로 해.

이 경우:

```text
importance = 100
```

에 가깝게 처리한다.

다만 저장 전 Memory Type은 반드시 구분한다.

---

## 19. Explicit Forget

사용자:

> 이건 기억하지 마.

> 방금 말한 건 지워.

> React 선호한다는 기억 삭제해.

이 경우 즉시 해당 Memory를 삭제 또는 비활성화한다.

```text
ACTIVE

↓

DELETED
```

삭제된 Memory는 Context Engine에서 다시 사용하지 않는다.

---

## 20. Memory Retrieval

Context Engine은 모든 Memory를 가져오지 않는다.

현재 요청과 관련된 Memory만 검색한다.

```text
Current Message
      │
      ▼
Memory Search
      │
      ├── User Memory
      ├── Project Memory
      ├── Decision
      └── Working Memory
      │
      ▼
Relevant Memories
```

---

## 21. Retrieval 우선순위

기본 우선순위:

```text
1. Active Decision

2. Working Memory

3. Project Memory

4. User Memory

5. Older Conversation Context
```

Decision은 일반 Memory보다 우선한다.

---

## 22. Retrieval Score

향후 Memory 검색 점수는 다음 요소를 조합할 수 있다.

```text
Relevance

Importance

Recency

Confidence

Frequency

Project Match
```

개념적인 예:

```text
score =
relevance
+ importance
+ recency
+ project_match
```

MVP에서는 복잡한 수학적 최적화보다 단순한 weighted ranking으로 시작한다.

---

## 23. Semantic Search

Memory가 늘어나면 단순 Key 검색만으로 부족하다.

따라서 Embedding 기반 Semantic Search를 사용한다.

예:

사용자:

> 예전에 프론트엔드 어떻게 하기로 했지?

정확히 `frontend`라는 단어가 없어도:

```text
React + TypeScript
```

Decision을 찾을 수 있어야 한다.

---

## 24. Hybrid Retrieval

최종적으로는 Semantic Search만 사용하지 않는 것이 좋다.

권장 방식:

```text
Metadata Filter
      +
Exact Key Match
      +
Semantic Search
      +
Importance Ranking
```

예:

```text
project_id = Think Along

status = ACTIVE

type = PROJECT / DECISION
```

로 먼저 범위를 줄인 뒤 Semantic Search를 적용한다.

---

## 25. Project Isolation

Memory Retrieval 시 Project Boundary를 반드시 지킨다.

예:

```text
Current Project
Think Along
```

일 때 FlowPulse의 Project Memory를 자동으로 넣지 않는다.

예외는 User Memory다.

```text
User Memory
→ Cross Project 가능

Project Memory
→ Project 내부

Decision
→ Project 내부
```

---

## 26. Session Memory와 Project Memory의 차이

Session은 대화 단위다.

Project는 장기 작업 단위다.

```text
Project
 │
 ├── Session 1
 ├── Session 2
 ├── Session 3
 │
 └── Shared Project Memory
```

Session 1에서 결정한 중요한 정보가 Project Memory로 승격되면 Session 3에서도 사용할 수 있다.

이것이 Think Along의 Continuity를 만든다.

---

## 27. Session Summary와 Memory의 차이

Session Summary는 Memory가 아니다.

Session Summary는 해당 대화의 압축된 기록이다.

```text
Session Summary

"Memory Architecture를 논의했고,
User/Project/Working/Decision Memory로 나누기로 했다."
```

Memory:

```text
Decision:
Memory Types =
User / Project / Working / Decision
```

둘은 목적이 다르다.

```text
Summary
= 대화 흐름 보존

Memory
= 중요한 정보 보존
```

---

## 28. Duplicate Memory

같은 Memory가 반복 저장되는 것을 방지해야 한다.

예:

```text
Frontend = React

Frontend = React

Frontend = React
```

세 개를 저장하지 않는다.

대신 기존 Memory를 강화한다.

```text
importance ↑

confirmation_count ↑

last_confirmed_at 갱신
```

---

## 29. Contradiction Detection

새 Memory가 기존 Memory와 충돌할 수 있다.

예:

기존:

```text
Backend = Node.js
```

새 사용자 메시지:

> Backend는 Python으로 바꾸자.

이 경우 단순 추가하지 않는다.

```text
Conflict Detected
       │
       ▼
Old Memory / Decision
       │
       ▼
Supersede
       │
       ▼
New Active Decision
```

---

## 30. Decision Conflict는 자동 처리

명확한 변경 표현이 있는 경우 자동으로 기존 Decision을 대체할 수 있다.

예:

```text
"바꾸자"

"취소하자"

"이제부터"

"대신"

"최종적으로"
```

단, 문맥이 애매하면 사용자에게 확인한다.

예:

> React도 괜찮을 것 같아.

이 문장은 기존 결정을 자동 폐기하기에는 약하다.

---

## 31. Memory Conflict는 보수적으로 처리

User Memory에서는 특히 조심한다.

예:

기존:

```text
Preferred Stack = React
```

새 메시지:

> Flutter도 괜찮네.

이걸 바로:

```text
Preferred Stack = Flutter
```

로 바꾸면 안 된다.

명시적 선호 변경이 아니라면 기존 Memory를 유지한다.

---

## 32. Memory Decay

모든 Memory가 영구적으로 같은 중요도를 유지할 필요는 없다.

시간이 지나면서 중요도가 감소할 수 있다.

예:

```text
last_used_at
last_confirmed_at
importance
```

를 기준으로 오래 사용되지 않은 Memory는 우선순위를 낮춘다.

단:

```text
Explicit Memory

Active Decision
```

은 단순 시간 경과로 자동 삭제하지 않는다.

---

## 33. Memory Archive

오래됐지만 삭제할 필요는 없는 Memory는 Archive한다.

```text
ACTIVE

↓

ARCHIVED
```

Archived Memory는 기본 Context에는 들어가지 않지만 필요할 경우 검색할 수 있다.

---

## 34. Memory Delete

사용자 요청 또는 명백한 오류로 Memory를 삭제할 수 있다.

```text
ACTIVE

↓

DELETED
```

초기 MVP에서는 Hard Delete보다 Soft Delete가 안전하다.

예:

```text
status = DELETED
deleted_at = timestamp
```

Context Engine은 DELETED 상태를 절대 사용하지 않는다.

---

## 35. Memory Source

모든 Memory는 가능하면 출처를 추적할 수 있어야 한다.

```text
source_message_id
source_session_id
created_at
```

이를 통해 사용자가:

> 이걸 왜 기억하고 있어?

라고 물었을 때 설명할 수 있다.

예:

```text
2026-08-09
Think Along Architecture 대화에서
사용자가 직접 확정함
```

---

## 36. Memory Explainability

Think Along은 Memory를 블랙박스로 만들지 않는다.

Memory Viewer에서 가능하면 다음 정보를 제공한다.

```text
Memory

"AI는 바뀌어도 생각은 이어진다."

Type
Project

Source
Product Vision Session

Importance
High

Created
2026-08-09
```

---

## 37. Memory Viewer

MVP 이후 또는 P1 수준에서 간단한 Memory Viewer를 제공한다.

```text
Memory

├── About You
├── Projects
├── Decisions
└── Current Work
```

사용자는 각 Memory를:

```text
View

Edit

Delete
```

할 수 있다.

---

## 38. Memory Edit

사용자가 Memory를 직접 수정할 수 있어야 한다.

예:

기존:

```text
Preferred Language
Korean
```

사용자 수정:

```text
Preferred Language
Korean + English
```

수정 시:

```text
updated_at
```

을 기록한다.

---

## 39. Memory Injection 방지

AI 응답 자체를 자동으로 사용자 Memory로 저장해서는 안 된다.

예:

AI:

> 사용자는 아마 단순한 UI를 선호하시는 것 같습니다.

이걸 바로:

```text
User prefers simple UI
```

로 저장하면 안 된다.

AI 추론과 사용자 사실을 구분해야 한다.

---

## 40. Source Priority

Memory 생성 시 출처별 신뢰 우선순위를 둔다.

권장 순서:

```text
1. User Explicit Statement

2. User Explicit Decision

3. Repeated User Behavior

4. Assistant Inference
```

MVP에서는 1과 2 중심으로 저장한다.

Assistant Inference는 장기 Memory로 자동 승격하지 않는 것이 안전하다.

---

## 41. Memory Write Pipeline

기본 Write Flow:

```text
Conversation Turn
       │
       ▼
Candidate Extractor
       │
       ▼
Classifier
       │
       ▼
Conflict Checker
       │
       ▼
Importance Scorer
       │
       ▼
Memory Repository
```

---

## 42. Memory Read Pipeline

기본 Read Flow:

```text
Current Request
       │
       ▼
Scope Resolver
       │
       ├── User
       ├── Project
       └── Session
       │
       ▼
Retriever
       │
       ▼
Ranker
       │
       ▼
Filter
       │
       ▼
Context Engine
```

---

## 43. Scope Resolver

Memory 검색 전 현재 범위를 먼저 파악한다.

예:

```text
user_id

project_id

session_id

current_intent
```

현재 Project가 없으면 Project Memory를 억지로 가져오지 않는다.

---

## 44. Database Schema

MVP 기준 Memory Table 예시:

```sql
CREATE TABLE memories (
  id UUID PRIMARY KEY,

  user_id UUID NOT NULL,

  project_id UUID NULL,

  session_id UUID NULL,

  type VARCHAR(20) NOT NULL,

  key VARCHAR(255) NULL,

  content TEXT NOT NULL,

  importance INTEGER NOT NULL DEFAULT 50,

  confidence REAL NOT NULL DEFAULT 1.0,

  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

  source_message_id UUID NULL,

  created_at TIMESTAMP NOT NULL,

  updated_at TIMESTAMP NOT NULL,

  last_used_at TIMESTAMP NULL
);
```

---

## 45. Decision Schema

```sql
CREATE TABLE decisions (
  id UUID PRIMARY KEY,

  user_id UUID NOT NULL,

  project_id UUID NOT NULL,

  subject VARCHAR(255) NOT NULL,

  value TEXT NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

  superseded_by UUID NULL,

  source_message_id UUID NULL,

  created_at TIMESTAMP NOT NULL,

  updated_at TIMESTAMP NOT NULL
);
```

---

## 46. Embedding

Semantic Search가 필요한 Memory에는 Embedding을 생성한다.

```text
Memory
   │
   ▼
Embedding
   │
   ▼
Vector
```

PostgreSQL + pgvector 사용 시 Memory와 Vector를 같은 DB에서 관리할 수 있다.

---

## 47. Embedding 재생성

Memory가 수정되면 기존 Embedding도 갱신해야 한다.

```text
Memory Update

↓

Embedding Rebuild
```

삭제된 Memory Vector는 Retrieval 대상에서 제외한다.

---

## 48. Memory Write 비용 관리

모든 메시지마다 별도 대형 모델을 호출해 Memory를 분석하면 비용이 커질 수 있다.

MVP에서는 다음 방식을 권장한다.

```text
Explicit Decision
→ 즉시 저장

Explicit Memory Request
→ 즉시 저장

일반 Conversation
→ 필요 시 Batch 분석
```

초기 단계에서는 정확성과 비용을 모두 관리할 수 있다.

---

## 49. Background Memory Processing

향후에는 대화 응답과 Memory 정리를 분리할 수 있다.

```text
User Request
      │
      ▼
AI Response
      │
      ▼
Return to User

      +

Background Memory Processing
```

이렇게 하면 Memory 분석 때문에 응답 속도가 느려지는 것을 방지할 수 있다.

MVP 초기에는 단순 구조로 시작해도 된다.

---

## 50. Memory Compaction

Memory 자체도 장기간 사용하면 많아진다.

유사한 Memory를 하나로 합칠 수 있다.

예:

```text
React를 선호함

React를 자주 사용함

Frontend에서 React를 선호함
```

↓

```text
Preferred Frontend Stack
React
```

이를 Memory Compaction이라고 정의한다.

---

## 51. Memory Promotion과 Compaction의 차이

```text
Promotion

Conversation
→ Memory
```

```text
Compaction

Multiple Memories
→ Consolidated Memory
```

둘은 다른 과정이다.

---

## 52. Dreaming 개념

OpenClaw의 Memory Architecture처럼 장기적으로는 비활성 시간에 Memory를 재정리하는 과정도 고려할 수 있다.

Think Along에서는 이를 예를 들어:

```text
Memory Consolidation
```

이라고 부를 수 있다.

역할:

```text
Duplicate Removal

Conflict Resolution

Importance Adjustment

Memory Merge

Archive Candidate Detection
```

하지만 MVP에서는 구현하지 않는다.

---

## 53. Memory API

예상 Application Interface:

```typescript
interface MemoryService {
  create(
    input: CreateMemoryInput
  ): Promise<Memory>;

  update(
    id: string,
    input: UpdateMemoryInput
  ): Promise<Memory>;

  delete(
    id: string
  ): Promise<void>;

  search(
    query: MemoryQuery
  ): Promise<Memory[]>;

  getRelevant(
    context: MemoryContext
  ): Promise<Memory[]>;
}
```

---

## 54. Decision API

```typescript
interface DecisionService {
  create(
    input: CreateDecisionInput
  ): Promise<Decision>;

  supersede(
    oldDecisionId: string,
    newDecision: CreateDecisionInput
  ): Promise<Decision>;

  revoke(
    decisionId: string
  ): Promise<void>;

  getActive(
    projectId: string
  ): Promise<Decision[]>;
}
```

---

## 55. Context Engine과의 경계

Memory Service는 Memory를 저장하고 검색한다.

하지만 어떤 Memory를 최종 Prompt에 넣을지는 Context Engine이 결정한다.

```text
Memory Service

"관련 Memory 후보 반환"

        ↓

Context Engine

"실제로 사용할 Context 결정"
```

이 책임을 섞지 않는다.

---

## 56. Provider와의 경계

Provider가 Memory DB에 직접 접근해서는 안 된다.

잘못된 구조:

```text
ClaudeProvider
      │
      ▼
Memory DB
```

올바른 구조:

```text
Memory DB
   │
   ▼
Context Engine
   │
   ▼
ContextPack
   │
   ▼
ClaudeProvider
```

---

## 57. Privacy Boundary

Memory에는 사용자 관련 정보가 들어갈 수 있으므로 최소 저장 원칙을 따른다.

기본 원칙:

```text
필요한 것만 저장

사용자가 확인 가능

사용자가 삭제 가능

Provider에 필요한 Context만 전달
```

모든 Memory를 매번 외부 AI Provider에 전달하지 않는다.

---

## 58. Memory Acceptance Tests

### Test A — Cross Provider Memory

사용자가 OpenAI를 사용하며 말한다.

> 이 프로젝트 이름은 Think Along이야.

이후 Anthropic으로 전환한다.

질문:

> 프로젝트 이름이 뭐였지?

#### PASS

> Think Along

이라고 답한다.

---

### Test B — Cross Session Memory

Session A:

> Frontend는 React로 하자.

Session 종료.

Session B 생성.

질문:

> Frontend 뭐 쓰기로 했지?

#### PASS

> React

---

### Test C — Decision Supersede

기존:

```text
Frontend = Flutter
```

사용자:

> React로 바꾸자.

#### PASS

```text
Flutter = SUPERSEDED

React = ACTIVE
```

---

### Test D — Memory Delete

사용자:

> React를 선호한다는 기억은 지워.

#### PASS

해당 Memory는 이후 Retrieval 결과에 포함되지 않는다.

---

### Test E — Project Isolation

FlowPulse:

```text
Backend = Python
```

Think Along Project에서 질문:

> 우리 Backend는 뭐였지?

#### PASS

FlowPulse의 Python Decision을 Think Along Decision처럼 사용하지 않는다.

---

### Test F — No False Memory

Memory에 Backend 결정이 없다.

사용자:

> Backend는 Python으로 하기로 했었지?

#### PASS

Think Along은 없는 결정을 만들어내지 않는다.

예:

> 현재 저장된 결정에서는 Backend를 Python으로 확정한 기록을 찾지 못했습니다.

---

## 59. MVP 구현 우선순위

### P0

```text
User Memory

Project Memory

Working Memory

Decision Memory

Memory CRUD

Decision Supersede

Project Isolation

Context Retrieval

Persistent Storage
```

### P1

```text
Semantic Search

Memory Viewer

Memory Edit

Memory Delete UI

Importance Ranking

Source Tracking
```

### Later

```text
Automatic Memory Consolidation

Memory Decay

Dreaming / Consolidation

Advanced Conflict Detection

Behavior-based User Memory
```

---

## 60. MVP Memory의 단순화 원칙

처음부터 완벽한 인간 기억 시스템을 만들려고 하지 않는다.

MVP에서는 다음을 정확하게 하는 것이 더 중요하다.

```text
명시적인 사용자 정보

명시적인 프로젝트 정보

명시적인 결정

현재 작업 상태
```

특히:

> **틀린 것을 많이 기억하는 시스템보다 중요한 것을 적게 기억하는 시스템이 낫다.**

이 원칙을 유지한다.

---

## 61. Memory North Star

Think Along의 Memory 시스템은 결국 다음 경험을 만들어야 한다.

```text
Yesterday

GPT
"Frontend는 React로 결정했습니다."


Today

Claude
"어제 결정한 React 구조를 기준으로 이어가겠습니다."


Tomorrow

Gemini
"현재 Frontend 결정은 React이며,
Backend는 아직 확정되지 않았습니다."
```

AI는 계속 바뀐다.

Memory는 이어진다.

---

## 62. 핵심 Memory 원칙

> **Memory belongs to Think Along.**

> **Remember meaning, not everything.**

> **Decisions outrank conversation history.**

> **Memory can change.**

> **The user owns the memory.**

> **No memory is better than false memory.**

---

## 63. 최종 정의

Think Along Memory는 Chat History 저장소가 아니다.

Think Along Memory는 서로 다른 AI와 서로 다른 Session 사이에서 사용자의 중요한 정보와 프로젝트 상태, 결정, 현재 작업을 지속시키는 **Continuity Memory Layer**다.

구조:

```text
Conversation
      │
      ▼
Memory Lifecycle
      │
      ├── User Memory
      ├── Project Memory
      ├── Working Memory
      └── Decisions
             │
             ▼
      Context Engine
             │
             ▼
       Any AI Provider
```

핵심 문장:

> **AI가 대화를 생성하고, Think Along이 기억을 유지한다.**

---

## 64. 다음 문서

다음 문서는:

`07_Context_Engine.md`

여기서는 Memory와 Session에 저장된 방대한 정보 중에서 **현재 질문에 정확히 필요한 Context를 어떻게 선택하고 조립할 것인지** 정의한다.

주요 설계 대상:

```text
ContextPack

Retrieval

Ranking

Token Budget

Recent Messages

Session Summary

Memory Selection

Decision Priority

Context Compression

Provider-independent Context

Context Quality Evaluation
```

Think Along에서 Memory가 장기 기억이라면 Context Engine은 그 기억을 실제 AI가 사용할 수 있도록 만드는 **실시간 두뇌 조립 계층**이다.