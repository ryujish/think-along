# 07. Think Along Context Engine

> Think Along의 Memory, Session, Decision, Project 정보를 현재 사용자 요청에 맞는 하나의 Context로 조립하는 핵심 계층을 정의한다.

---

## 1. Context Engine의 목적

Think Along의 Memory가 "무엇을 기억할 것인가"를 담당한다면, Context Engine은 다음을 담당한다.

> **지금 이 순간 어떤 기억과 어떤 대화가 필요한가?**

모든 Memory와 모든 Chat History를 AI에게 그대로 전달하는 것은 좋은 Context가 아니다.

Think Along은 현재 요청과 가장 관련 있는 정보만 선별하여 AI에게 전달해야 한다.

핵심 목표:

```text
Right Context
at the
Right Time
```

---

## 2. Context Engine이 필요한 이유

사용자의 대화가 길어지고 프로젝트가 많아지면 정보는 계속 증가한다.

예:

```text
User Memory
50개

Project Memory
200개

Decisions
80개

Sessions
40개

Messages
5,000개
```

하지만 현재 질문은 단순할 수 있다.

> "아까 정한 DB 기준으로 API 구조 잡아줘."

이 질문에 5,000개의 Message를 모두 보낼 필요는 없다.

필요한 것은:

```text
현재 Project

관련 Decision

최근 작업 상태

Session Summary

최근 Message

현재 질문
```

이다.

---

## 3. Context Engine 핵심 원칙

### 3.1 Context Is Selected, Not Dumped

모든 것을 넣는 것이 Context가 아니다.

Context Engine은 다음을 수행한다.

```text
Retrieve
   ↓
Rank
   ↓
Filter
   ↓
Compress
   ↓
Assemble
```

---

### 3.2 Context Belongs to Think Along

AI Provider가 Context를 관리하지 않는다.

```text
잘못된 구조

GPT Context
Claude Context
Gemini Context
```

올바른 구조:

```text
Think Along Context Engine
          │
          ▼
      ContextPack
          │
    ┌─────┼─────┐
    ▼     ▼     ▼
   GPT  Claude Gemini
```

AI가 바뀌어도 Context 정책은 같다.

---

### 3.3 Decisions Have Priority

현재 결정은 과거 Conversation보다 우선한다.

예:

과거 Conversation:

```text
Frontend = Flutter
```

현재 Decision:

```text
Frontend = React + TypeScript
status = ACTIVE
```

Context에는 React + TypeScript를 우선한다.

---

### 3.4 Recent Context Is Not Always Best Context

최근 Message만 전달하면 장기 프로젝트에서 중요한 결정이 빠질 수 있다.

따라서 Context는 다음을 조합한다.

```text
Long-term Memory

+

Active Decisions

+

Working Memory

+

Session Summary

+

Recent Messages

+

Current Message
```

---

## 4. ContextPack

Think Along 내부에서 Provider와 독립적인 표준 Context 구조를 사용한다.

예:

```typescript
interface ContextPack {
  system: SystemContext;

  user: {
    memories: MemoryItem[];
  };

  project?: {
    id: string;
    name: string;
    memories: MemoryItem[];
  };

  decisions: Decision[];

  workingMemory: MemoryItem[];

  session: {
    id: string;
    summary?: string;
    recentMessages: Message[];
  };

  currentMessage: Message;

  metadata: {
    tokenBudget: number;
    estimatedTokens: number;
  };
}
```

---

## 5. ContextPack 구성 순서

기본 조립 순서는 다음과 같다.

```text
System Rules

↓

User Memory

↓

Project Memory

↓

Active Decisions

↓

Working Memory

↓

Session Summary

↓

Recent Messages

↓

Current User Message
```

이 순서는 Priority의 기본 뼈대이기도 하다.

---

## 6. System Context

System Context에는 Think Along의 핵심 규칙을 넣는다.

예:

```text
You are Think Along.

Maintain continuity across AI providers.

Follow active project decisions.

Do not invent memory.

If stored memory conflicts with a newer active decision,
follow the active decision.

Do not expose internal routing unless needed.
```

Provider가 바뀌더라도 동일한 제품 원칙을 유지해야 한다.

---

## 7. User Memory Selection

모든 User Memory를 매번 넣지 않는다.

예:

User Memory:

```text
Language = Korean

Prefers MVP First

Likes Concise Answers

Uses macOS

Interested in Finance

Has Project FlowPulse
```

현재 질문:

> "Think Along DB Schema 만들어줘."

관련성이 높은 User Memory:

```text
Language = Korean

Prefers MVP First
```

관련성이 낮은 정보는 제외한다.

---

## 8. Project Memory Selection

현재 Project가 있는 경우 해당 Project Memory를 우선 검색한다.

예:

```text
Project
Think Along

Goal
AI Continuity Layer

Architecture
Unified Session + Memory + Context + Router
```

FlowPulse의 Project Memory는 자동으로 넣지 않는다.

---

## 9. Decision Selection

Decision은 기본적으로 ACTIVE 상태만 선택한다.

```text
status = ACTIVE
```

예:

```text
Decision

Frontend = Next.js

Database = PostgreSQL

Architecture = Modular Monolith
```

SUPERSEDED 또는 REVOKED 상태의 Decision은 기본 Context에서 제외한다.

---

## 10. Working Memory Selection

Working Memory는 현재 작업을 이어주는 데 중요하다.

예:

```text
Current Document
07_Context_Engine.md

Current Task
ContextPack 설계

Next
AI Router 설계
```

Working Memory는 관련성 점수를 높게 둔다.

---

## 11. Session Summary

Conversation이 길어지면 오래된 Message를 Summary로 압축한다.

예:

```text
Session Summary

Think Along의 제품 비전과 OpenClaw 벤치마크를 바탕으로
Unified Session, Shared Memory, Decision Memory,
Context Engine, AI Router 구조를 정의했다.

현재 Context Engine 문서를 작성 중이다.
```

Summary는 Conversation의 흐름을 유지하는 역할이다.

---

## 12. Recent Messages

최근 대화는 원문 그대로 일부 유지한다.

예:

```text
최근 10~20개 Message
```

정확한 개수는 Token Budget에 따라 달라질 수 있다.

중요한 것은:

> 최근 Message와 Session Summary를 함께 사용한다.

---

## 13. Current Message

사용자의 현재 Message는 가장 마지막에 배치한다.

예:

```text
"Context Engine Retrieval 구조를 설계해줘."
```

Context Engine의 모든 선택은 이 현재 Message를 기준으로 이루어진다.

---

## 14. Context Build Flow

전체 흐름:

```text
Current Message
       │
       ▼
Scope Resolver
       │
       ▼
Memory Retriever
       │
       ▼
Decision Retriever
       │
       ▼
Session Retriever
       │
       ▼
Ranking
       │
       ▼
Filtering
       │
       ▼
Token Budget
       │
       ▼
Compression
       │
       ▼
ContextPack
```

---

## 15. Scope Resolver

Context 검색 전 현재 요청의 범위를 먼저 결정한다.

예:

```text
user_id

project_id

session_id

current_intent
```

가능한 Scope:

```text
USER

PROJECT

SESSION

GLOBAL
```

---

## 16. Project Scope

사용자가 현재 Project 내부에 있다면:

```text
project_id = Think Along
```

Project Memory와 Decision은 해당 Project 기준으로 검색한다.

다른 Project의 정보는 제외한다.

---

## 17. Global Scope

사용자가 특정 Project와 관계없는 질문을 하면 Project Context를 무리하게 넣지 않는다.

예:

> "오늘 날씨 어때?"

이 질문에 Think Along 프로젝트의 Decision을 넣을 필요가 없다.

---

## 18. Intent Detection

Context Engine은 현재 요청의 Intent를 간단하게 파악할 수 있다.

예:

```text
Coding

Planning

Project Continuation

Fact Recall

Decision Recall

General Question
```

MVP에서는 복잡한 Intent Model 없이 Rule + LLM 기반의 가벼운 분류로 시작할 수 있다.

---

## 19. Retrieval

Context Engine은 여러 Source에서 관련 정보를 가져온다.

```text
Sources

├── User Memory
├── Project Memory
├── Decisions
├── Working Memory
├── Session Summary
└── Recent Messages
```

---

## 20. Retrieval 순서

기본 우선순위:

```text
1. Active Decision

2. Working Memory

3. Current Project Memory

4. Relevant User Memory

5. Session Summary

6. Recent Messages

7. Older Conversation Search
```

---

## 21. Hybrid Retrieval

Memory 검색은 한 가지 방식에만 의존하지 않는다.

권장 구조:

```text
Metadata Filter
      +
Exact Key Match
      +
Semantic Search
      +
Priority Ranking
```

예:

```text
project_id = Think Along

status = ACTIVE

type = PROJECT
```

로 먼저 범위를 줄인다.

이후 Semantic Search를 적용한다.

---

## 22. Exact Match

명시적인 Key가 있을 경우 Exact Match를 우선한다.

예:

사용자:

> "Frontend 뭐 쓰기로 했지?"

검색:

```text
subject = frontend
```

Decision에서 바로 찾을 수 있다.

Semantic Search보다 더 정확하다.

---

## 23. Semantic Search

사용자가 정확한 용어를 사용하지 않을 수 있다.

예:

> "웹 쪽은 어떤 기술로 정했지?"

Semantic Search를 통해:

```text
Frontend = Next.js + React + TypeScript
```

를 찾을 수 있어야 한다.

---

## 24. Ranking

검색된 후보는 Ranking한다.

기본 요소:

```text
Relevance

Importance

Recency

Confidence

Project Match

Decision Priority
```

---

## 25. Ranking Score

초기에는 단순한 Weighted Score로 충분하다.

예:

```text
finalScore =
  relevance * 0.40
+ importance * 0.20
+ recency * 0.10
+ confidence * 0.10
+ projectMatch * 0.20
```

정확한 Weight는 운영 데이터에 따라 수정한다.

---

## 26. Decision Priority Boost

ACTIVE Decision은 강한 Boost를 준다.

예:

```text
Decision Priority = +100
```

즉 일반 Conversation에서 Flutter가 많이 언급되었더라도:

```text
ACTIVE Decision
React + TypeScript
```

가 우선한다.

---

## 27. Working Memory Priority

Working Memory도 높은 점수를 가진다.

현재 작업 상태는 최근 작업 흐름을 이어가는 데 중요하기 때문이다.

```text
Working Memory
Priority = HIGH
```

---

## 28. Filtering

검색된 후보 중 다음은 제거한다.

```text
DELETED Memory

ARCHIVED Memory

SUPERSEDED Decision

REVOKED Decision

Wrong Project

Low Relevance

Low Confidence
```

---

## 29. Conflict Filtering

Context 내부에 서로 충돌하는 정보가 동시에 들어가지 않도록 한다.

예:

```text
Frontend = Flutter

Frontend = React
```

이 경우:

```text
ACTIVE Decision
React
```

만 사용한다.

---

## 30. Token Budget

모델마다 Context Window가 다르다.

따라서 Context Engine은 Token Budget을 관리해야 한다.

예:

```text
Model Context Window
128K

Reserved for Output
16K

Available Input
112K
```

하지만 항상 전체 112K를 사용하는 것은 좋지 않다.

필요한 Context만 넣는다.

---

## 31. Budget Allocation

예시:

```text
System Rules
5%

User Memory
10%

Project Memory
15%

Decisions
10%

Working Memory
10%

Session Summary
15%

Recent Messages
30%

Current Message
5%
```

이 비율은 고정 규칙이 아니라 초기 기준이다.

---

## 32. Context Overflow

Context가 Token Budget을 초과하면 우선순위가 낮은 정보부터 줄인다.

```text
Overflow
   │
   ▼
Remove Low Relevance Memory
   │
   ▼
Reduce Recent Messages
   │
   ▼
Compress Session Summary
   │
   ▼
Compress Project Memory
```

ACTIVE Decision은 가장 마지막까지 유지한다.

---

## 33. Compression Priority

압축 우선순위:

```text
Old Conversation

↓

Low Priority Memory

↓

Project Description

↓

Session Summary

↓

Recent Messages
```

다음은 가급적 압축하지 않는다.

```text
Current Message

Active Decision

Critical Working Memory
```

---

## 34. Context Compaction

같은 의미의 Memory가 여러 개 있으면 Context에서 통합한다.

예:

```text
React를 사용함

Frontend는 React

React + TypeScript 사용
```

↓

```text
Frontend Stack
React + TypeScript
```

---

## 35. Context Deduplication

동일 정보가:

```text
Project Memory

Decision

Session Summary
```

에 동시에 있을 수 있다.

이 경우 중복 제거가 필요하다.

Decision이 있으면 일반 Memory를 제거할 수 있다.

```text
Decision > Memory > Summary
```

---

## 36. Summary 생성 기준

Session Summary는 일정 Message 또는 Token Threshold를 넘으면 갱신한다.

예:

```text
Message 1~40
      │
      ▼
Summary v1

Message 41~80
      │
      ▼
Summary v2
```

Summary는 누적 갱신 방식으로 관리할 수 있다.

---

## 37. Summary 구조

단순 서술문보다 구조화된 Summary를 권장한다.

예:

```text
Goal:
Think Along Context Engine 설계

Completed:
- Product Vision
- Product Principles
- OpenClaw Benchmark
- Architecture
- Memory

Current:
Context Engine 설계

Decisions:
- Memory belongs to Think Along
- Provider-independent Context
- Active Decision priority

Next:
AI Router
```

이 구조가 다음 AI가 이어받기 쉽다.

---

## 38. Session Handoff

Provider가 변경될 때 Context Engine이 핵심 역할을 한다.

예:

```text
GPT
 │
 X
Rate Limit
 │
 ▼
Router
 │
 ▼
Claude
```

Claude는 GPT의 Conversation ID를 받을 필요가 없다.

Claude가 받는 것은:

```text
ContextPack
```

이다.

---

## 39. Provider Handoff Context

Provider 전환 시 반드시 유지해야 하는 정보:

```text
User Memory

Project Memory

Active Decisions

Working Memory

Session Summary

Recent Messages

Current Request
```

Provider 자체의 Session State에 의존하지 않는다.

---

## 40. Failover Context Freeze

중요한 설계 포인트다.

하나의 Request 처리 중 Provider가 실패하면 최초 생성한 ContextPack을 유지한다.

```text
ContextPack v32
      │
      ▼
OpenAI
      X
      │
      ▼
Anthropic
```

Fallback 과정에서 Memory가 새로 바뀌어 다른 Context를 만들지 않는다.

동일 Request는 동일 Context Snapshot을 사용하는 것이 안전하다.

---

## 41. Context Snapshot

각 AI Request마다 Context Snapshot ID를 만들 수 있다.

예:

```text
context_snapshot_id
```

저장 정보:

```text
session_id

project_id

memory_ids

decision_ids

summary_version

message_ids

created_at
```

향후 Debugging에 매우 유용하다.

---

## 42. Context Trace

AI가 왜 특정 답변을 했는지 추적하기 위해 내부적으로 Context Trace를 남긴다.

예:

```text
Request
R102

Used Memories
M12
M14
M20

Used Decisions
D4
D9

Session Summary
S7

Provider
Anthropic
```

사용자에게 모두 보여줄 필요는 없지만 시스템 Debugging에는 중요하다.

---

## 43. Explainable Context

향후 사용자가:

> "왜 그렇게 기억했어?"

또는:

> "어떤 정보를 보고 그렇게 답했어?"

라고 물을 수 있다.

Think Along은 Context Source를 추적할 수 있어야 한다.

예:

```text
Current Decision

Frontend = React

Source
2026-08-09 Architecture Session
```

---

## 44. Context Security

모든 Memory를 모든 Provider에 전달하지 않는다.

Context Engine은 최소 전달 원칙을 따른다.

```text
Only Necessary Context
```

특히 민감하거나 현재 작업과 관계없는 Memory는 제외한다.

---

## 45. Provider Capability

향후 Provider별 Context Window와 기능이 다를 수 있다.

예:

```text
Provider A
128K Context

Provider B
200K Context

Provider C
32K Context
```

Context Engine은 Provider Capability를 고려해 Budget을 조정할 수 있다.

하지만 Context 의미 구조 자체는 동일하게 유지한다.

---

## 46. Provider Formatting

ContextPack을 Provider별 Request로 변환하는 것은 Provider Adapter 책임이다.

```text
ContextPack
      │
      ├── OpenAI Adapter
      ├── Anthropic Adapter
      └── Gemini Adapter
```

Context Engine이 Provider API 형식을 직접 알아서는 안 된다.

---

## 47. Context Engine Interface

예:

```typescript
interface ContextEngine {
  build(
    input: BuildContextInput
  ): Promise<ContextPack>;
}
```

입력:

```typescript
interface BuildContextInput {
  userId: string;

  sessionId: string;

  projectId?: string;

  currentMessage: Message;

  tokenBudget: number;
}
```

---

## 48. Context Retrieval Interface

```typescript
interface ContextRetriever {
  retrieveUserMemory(
    input: RetrievalInput
  ): Promise<MemoryItem[]>;

  retrieveProjectMemory(
    input: RetrievalInput
  ): Promise<MemoryItem[]>;

  retrieveDecisions(
    input: RetrievalInput
  ): Promise<Decision[]>;

  retrieveWorkingMemory(
    input: RetrievalInput
  ): Promise<MemoryItem[]>;
}
```

---

## 49. Context Ranker

```typescript
interface ContextRanker {
  rankMemories(
    memories: MemoryItem[],
    query: string
  ): Promise<RankedMemory[]>;
}
```

MVP에서는 복잡한 ML Ranking 없이 단순 Score 기반으로 시작한다.

---

## 50. Context Compressor

```typescript
interface ContextCompressor {
  compress(
    context: ContextPack,
    tokenBudget: number
  ): Promise<ContextPack>;
}
```

Context 의미를 최대한 유지하면서 크기를 줄인다.

---

## 51. Context Assembler

```typescript
interface ContextAssembler {
  assemble(
    input: ContextAssemblyInput
  ): Promise<ContextPack>;
}
```

Retriever와 Ranker가 반환한 정보를 최종 순서로 배치한다.

---

## 52. Context Build Pipeline

코드 구조 관점:

```text
ContextEngine.build()

  ↓

ScopeResolver

  ↓

ContextRetriever

  ↓

ContextRanker

  ↓

ContextFilter

  ↓

ContextAssembler

  ↓

ContextBudgetManager

  ↓

ContextSnapshot

  ↓

ContextPack
```

---

## 53. 권장 폴더 구조

```text
src/core/context/

├── context-engine.ts
├── context-pack.ts

├── scope/
│   └── scope-resolver.ts

├── retrieval/
│   ├── memory-retriever.ts
│   ├── decision-retriever.ts
│   └── session-retriever.ts

├── ranking/
│   └── context-ranker.ts

├── filtering/
│   └── context-filter.ts

├── compression/
│   └── context-compressor.ts

├── assembly/
│   └── context-assembler.ts

├── budget/
│   └── token-budget.ts

└── snapshot/
    └── context-snapshot.ts
```

---

## 54. Context와 Memory의 책임 분리

Memory Service:

```text
Memory를 저장한다.

Memory를 검색한다.
```

Context Engine:

```text
어떤 Memory를 사용할지 결정한다.

Context를 조립한다.
```

둘을 분리한다.

---

## 55. Context와 Router의 책임 분리

Context Engine:

```text
무엇을 AI에게 전달할 것인가?
```

Router:

```text
어떤 AI에게 전달할 것인가?
```

이 둘을 명확히 분리한다.

```text
Context Engine
      │
      ▼
ContextPack
      │
      ▼
AI Router
```

---

## 56. Context와 Provider의 책임 분리

Context Engine:

```text
논리적인 Context 생성
```

Provider:

```text
Provider-specific API Request 생성
```

따라서 Context Engine 내부에:

```text
if OpenAI

if Claude

if Gemini
```

같은 코드가 존재해서는 안 된다.

---

## 57. Context Quality

Context가 많다고 답변 품질이 좋아지는 것은 아니다.

품질 기준:

```text
Relevant

Current

Consistent

Compact

Traceable
```

---

## 58. Context Pollution

잘못된 Memory가 들어가면 전체 AI가 잘못된 방향으로 갈 수 있다.

이를 Context Pollution이라고 정의한다.

원인:

```text
Outdated Memory

Wrong Project Memory

Superseded Decision

Assistant Inference

Duplicate Memory
```

Context Engine은 이를 최대한 제거해야 한다.

---

## 59. No False Context

없는 정보를 Context에 만들어 넣어서는 안 된다.

예:

Backend Decision이 없는데:

```text
Backend = Python
```

을 추론해서 Context에 넣지 않는다.

Unknown은 Unknown으로 유지한다.

---

## 60. Context Confidence

Memory Confidence가 낮은 경우 Context에 표시할 수 있다.

예:

```text
Possible Preference

confidence = 0.4
```

Provider Prompt에서도 이를 확정 사실처럼 사용하지 않도록 한다.

MVP에서는 낮은 Confidence Memory 자체를 제외하는 것이 더 안전할 수 있다.

---

## 61. Cold Resume

다음날 사용자가 다시 접속한다.

```text
New Runtime
    │
    ▼
Session Load
    │
    ▼
Project Load
    │
    ▼
Memory Retrieval
    │
    ▼
Decision Retrieval
    │
    ▼
Session Summary
    │
    ▼
ContextPack
```

사용자:

> "어제 하던 것 계속하자."

Think Along은 이전 AI Provider와 관계없이 작업을 이어간다.

---

## 62. New Session with Same Project

새로운 Session에서도 Project Context는 이어진다.

```text
Project
Think Along

├── Session A
├── Session B
└── Session C
```

Session B에서도:

```text
Project Memory

Active Decisions
```

를 사용할 수 있다.

하지만 Session A의 모든 Message를 그대로 가져오지는 않는다.

---

## 63. New Project

새로운 Project를 시작하면 기존 Project Context는 분리한다.

```text
Think Along
Context
```

와

```text
FlowPulse
Context
```

는 섞이지 않는다.

공유 가능한 것은 User Memory 정도다.

---

## 64. No Project Conversation

사용자가 Project가 아닌 일반 대화를 할 수도 있다.

```text
project_id = null
```

이 경우:

```text
User Memory

Session Summary

Recent Messages
```

중심으로 Context를 구성한다.

---

## 65. Context Engine MVP

MVP에서 구현할 핵심:

```text
ContextPack

Project Scope

User Memory Retrieval

Project Memory Retrieval

Active Decision Retrieval

Working Memory

Session Summary

Recent Messages

Token Budget

Basic Ranking

Deduplication

Provider-independent Context
```

---

## 66. MVP에서 하지 않을 것

초기에는 다음을 제외한다.

```text
Complex ML Ranking

Graph-based Retrieval

Knowledge Graph

Multi-hop Retrieval

Large-scale RAG Pipeline

Cross-user Memory

Agent-specific Context

Automatic Context Reasoning Graph
```

필요해질 때 확장한다.

---

## 67. Context Acceptance Test

### Test A — Relevant Memory

Memory:

```text
Frontend = React

Favorite Food = Pizza
```

질문:

> "Frontend 구조 잡아줘."

#### PASS

React 관련 Memory는 사용한다.

Pizza Memory는 사용하지 않는다.

---

### Test B — Decision Priority

과거 Conversation:

```text
Flutter
```

ACTIVE Decision:

```text
React
```

질문:

> "Frontend 기반으로 다음 작업 하자."

#### PASS

React를 사용한다.

---

### Test C — Project Isolation

FlowPulse:

```text
Database = Oracle
```

Think Along:

```text
Database = PostgreSQL
```

Think Along에서 질문.

#### PASS

PostgreSQL Context만 사용한다.

---

### Test D — Provider Handoff

GPT가 실패한다.

Claude로 변경한다.

#### PASS

동일 Context Snapshot을 Claude가 받는다.

---

### Test E — Cold Resume

24시간 후:

> "어제 하던 거 계속."

#### PASS

Session Summary + Project Memory + Decision을 사용해 작업을 이어간다.

---

### Test F — No False Context

Backend Decision이 없다.

질문:

> "Backend는 Python으로 하기로 했지?"

#### PASS

Context Engine은 Python Decision을 생성하지 않는다.

AI는 저장된 결정이 없다고 답할 수 있어야 한다.

---

## 68. Context Engine 성능 지표

향후 다음 지표를 측정할 수 있다.

```text
Memory Retrieval Precision

Decision Recall Accuracy

Context Token Size

Context Build Latency

Wrong Project Injection Rate

Provider Handoff Success Rate

Cold Resume Success Rate
```

---

## 69. 가장 중요한 지표

Think Along에서 가장 중요한 Context 품질 지표는 단순 Retrieval Precision보다 사용자 경험에 가깝다.

> **사용자가 다시 설명해야 하는가?**

이를 예를 들어:

```text
Re-explanation Rate
```

라고 정의할 수 있다.

Think Along이 성공할수록 사용자가 같은 내용을 다시 설명하는 횟수는 줄어들어야 한다.

---

## 70. Context Engine North Star

최종 경험:

```text
Day 1

GPT
"React + TypeScript로 결정했습니다."


Day 2

Claude
"어제 정한 React 구조를 기준으로 계속하겠습니다."


Day 10

Gemini
"현재 Frontend 결정은 React + TypeScript이고,
Backend는 아직 결정되지 않았습니다."
```

이 과정에서 각 AI는 서로의 Session을 공유하지 않는다.

공유하는 것은 Think Along이 만든 Context뿐이다.

---

## 71. 핵심 원칙

> **Context belongs to Think Along.**

> **Retrieve what matters, not everything.**

> **Decisions outrank history.**

> **Current intent determines context.**

> **Provider changes, Context remains.**

> **Unknown stays unknown.**

---

## 72. 최종 정의

Think Along Context Engine은 Memory 검색기가 아니다.

Memory, Decision, Session, Project, 현재 요청을 종합하여 특정 순간에 AI가 알아야 할 정보를 구성하는 **Continuity Context Layer**다.

구조:

```text
Memory
   │
Decisions
   │
Sessions
   │
Projects
   │
Current Request
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
   ▼
Any AI Provider
```

핵심 문장:

> **Think Along은 모든 것을 AI에게 보여주는 것이 아니라, 지금 필요한 것을 정확히 보여준다.**

---

## 73. 다음 문서

다음 문서는:

`08_AI_Router.md`

여기서는 완성된 ContextPack을 기준으로 **어떤 AI를 사용할지, 실패하면 어떻게 다른 AI로 전환할지** 정의한다.

주요 설계 대상:

```text
Primary Provider

Fallback

Provider Health

Rate Limit

Quota

Retry

Failover

Manual Override

Auto Mode

Context Snapshot Reuse

Streaming Failure

Provider Capability

Provider Configuration
```

AI Router는 Think Along의 Memory와 Context를 실제 여러 AI 모델에 연결하는 **교체 가능한 Intelligence Routing Layer**다.