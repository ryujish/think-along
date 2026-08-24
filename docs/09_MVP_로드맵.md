# 09. Think Along MVP 로드맵

> Think Along의 제품 비전과 핵심 아키텍처를 실제 개발 가능한 단계로 분해하고, MVP의 범위·우선순위·완료 조건을 정의한다.

---

## 1. MVP의 목적

Think Along MVP의 목적은 많은 기능을 만드는 것이 아니다.

단 하나의 핵심 가설을 검증하는 것이다.

> **AI Provider가 바뀌어도 사용자의 대화, 기억, 결정, 프로젝트 상태가 끊기지 않고 이어질 수 있는가?**

MVP는 이 질문에 **YES**라고 답할 수 있어야 한다.

---

## 2. MVP Definition

Think Along v1을 다음과 같이 정의한다.

> **Think Along v1은 여러 AI 모델 사이에서 Session, Memory, Decision, Context를 유지하고, Provider 장애나 사용량 제한이 발생해도 사용자의 작업이 끊기지 않도록 하는 AI Continuity Layer다.**

---

## 3. Golden Scenario

MVP에서 가장 중요한 사용자 시나리오는 하나다.

```text
User
 │
 ▼
Think Along
 │
 ▼
OpenAI
 │
 │ 정상 대화
 ▼

20분 후

OpenAI
 │
 X
Rate Limit
 │
 ▼
AI Router
 │
 ▼
Anthropic
 │
 ▼
Same Session
Same Memory
Same Decisions
Same Context
 │
 ▼
Conversation Continues
```

사용자는 AI를 변경하지 않는다.

Think Along이 내부적으로 AI를 변경한다.

---

## 4. Golden Scenario 실제 예시

사용자:

> FlowPulse Backend는 어떻게 구성하는 게 좋을까?

OpenAI:

> 현재 React + TypeScript 기반의 Frontend를 기준으로 보면...

대화 진행.

이후 OpenAI Rate Limit 발생.

사용자:

> 그럼 DB는 어떤 걸 쓰는 게 좋아?

Think Along 내부:

```text
OpenAI
   X
429

↓

Router

↓

Anthropic

↓

ContextPack
```

Anthropic이 답변:

> 앞에서 정한 React + TypeScript 기반 구조와 현재 실시간 수급 중심 MVP를 고려하면...

사용자는 다시 설명하지 않는다.

---

## 5. MVP Success Criterion

MVP 성공 여부는 다음 질문으로 판단한다.

> **AI가 바뀌었는데도 사용자가 AI가 바뀐 사실을 신경 쓰지 않고 하던 작업을 계속할 수 있는가?**

YES라면 핵심 가설이 검증된 것이다.

---

# 6. MVP 핵심 구성

MVP Core는 다음으로 제한한다.

```text
Unified Session

Project

Message

Memory

Decision

Context Engine

AI Router

Provider Adapter

Persistent Storage
```

---

# 7. MVP 전체 구조

```text
                     USER
                       │
                       ▼
                ┌────────────┐
                │ Think Along│
                │     UI     │
                └─────┬──────┘
                      │
                      ▼
               Unified Session
                      │
                      ▼
                 Project
                      │
            ┌─────────┴─────────┐
            ▼                   ▼
         Memory              Decision
            │                   │
            └─────────┬─────────┘
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
                ┌─────┴─────┐
                ▼           ▼
             OpenAI      Anthropic
```

---

# 8. MVP Provider 범위

초기 Provider는 두 개만 구현한다.

```text
OpenAI

Anthropic
```

목적은 Provider 수가 아니다.

두 Provider 사이의 Continuity가 완벽하게 작동하는 것이 우선이다.

다음 Provider는 이후 추가한다.

```text
Gemini

OpenRouter

Kimi

Local LLM
```

---

# 9. 왜 2개 Provider부터 시작하는가

다음 두 모델만으로도 Think Along의 핵심 가설을 검증할 수 있다.

```text
OpenAI
   │
   X
   │
   ▼
Anthropic
```

이 구조가 제대로 작동하지 않는 상태에서 5개, 10개 AI를 연결하는 것은 의미가 없다.

원칙:

> **Two providers with perfect continuity are better than ten providers with broken continuity.**

---

# 10. MVP 우선순위 정의

Think Along MVP는 세 단계로 나눈다.

```text
P0
반드시 필요

P1
MVP 완성 후 빠르게 추가

Later
핵심 검증 이후
```

---

# 11. P0 — 반드시 구현

```text
Unified Session

Project

Message Persistence

User Memory

Project Memory

Working Memory

Decision Memory

Decision Supersede

ContextPack

Context Engine

Session Summary

Recent Messages

Provider Interface

OpenAI Provider

Anthropic Provider

AI Router

Priority Routing

Fallback

Standard Provider Error

Context Snapshot

Streaming

Persistent Storage
```

이 중 하나라도 핵심적으로 빠지면 Golden Scenario가 완성되지 않는다.

---

# 12. P1 — Core 완성 후 추가

```text
Manual Model Selection

Memory Viewer

Memory Edit

Memory Delete

Provider Status

Fallback Notification

Usage Tracking

Basic Semantic Search

Rate Limit Cooldown

Router Trace
```

P1은 사용자 신뢰성과 조작 가능성을 높이는 기능이다.

---

# 13. Later — MVP에서 제외

```text
Smart Routing

Multi-Agent

Parallel AI Answers

AI Debate

Skills Marketplace

Gateway

Telegram Integration

Slack Integration

Automation

Autonomous Agent

Complex Tools

Knowledge Graph

Graph RAG

Advanced Memory Dreaming

Cost Optimization Router

AI Personality Unification
```

---

# 14. 개발 원칙

MVP 개발에서 다음 원칙을 유지한다.

> **Continuity First**

새 기능이 Golden Scenario와 직접 관계가 없다면 우선순위를 낮춘다.

---

# 15. 개발 단계

전체 개발을 다음 Phase로 나눈다.

```text
Phase 0
Foundation

Phase 1
Unified Session

Phase 2
Provider Layer

Phase 3
Basic Router

Phase 4
Memory

Phase 5
Decision

Phase 6
Context Engine

Phase 7
Failover

Phase 8
Persistence + Cold Resume

Phase 9
UX Integration

Phase 10
Acceptance Test
```

---

# 16. Phase 0 — Foundation

목적:

> 프로젝트의 기본 구조와 Core Boundary를 만든다.

구현:

```text
Project Structure

Database Connection

Core Interfaces

Shared Types

Environment Config

Provider Config
```

권장 구조:

```text
src/

├── app/
├── components/
├── core/
├── providers/
├── db/
├── api/
└── shared/
```

---

# 17. Phase 0 완료 조건

다음이 가능해야 한다.

```text
Application 실행

Database 연결

Environment 변수 로딩

Core Module Import

Provider Module 독립성
```

아직 AI 대화 기능은 필요 없다.

---

# 18. Phase 1 — Unified Session

가장 먼저 Think Along 자체 Session을 구현한다.

핵심 Entity:

```text
User

Project

Session

Message
```

Session:

```text
id
user_id
project_id
title
summary
status
created_at
updated_at
```

---

# 19. Message 저장

Message:

```text
id
session_id

role

content

provider_id
model_id

status

created_at
```

Provider 정보는 Metadata일 뿐 Session Identity가 아니다.

---

# 20. Phase 1 테스트

사용자:

```text
Message 1
```

OpenAI:

```text
Message 2
```

사용자:

```text
Message 3
```

Anthropic:

```text
Message 4
```

모든 Message가:

```text
session_id = SAME
```

이어야 한다.

---

# 21. Phase 2 — Provider Layer

공통 Provider Interface를 만든다.

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

# 22. OpenAI Provider

구현 책임:

```text
ContextPack
→ OpenAI Request 변환

Streaming

Usage

Error Normalization
```

OpenAIProvider가 Session이나 Memory를 직접 관리해서는 안 된다.

---

# 23. Anthropic Provider

동일한 Interface로 구현한다.

```text
ContextPack
→ Anthropic Request

Streaming
→ AIChunk

Error
→ ProviderError
```

---

# 24. Phase 2 완료 조건

Application 코드에서 다음이 가능해야 한다.

```typescript
provider.chat(context)
```

Provider가 OpenAI인지 Anthropic인지 상위 로직이 몰라도 된다.

---

# 25. Phase 3 — Basic Router

초기 Router는 단순하게 만든다.

```text
Primary

OpenAI

↓

Fallback

Anthropic
```

Smart Routing은 구현하지 않는다.

---

# 26. Router 기본 Flow

```text
ContextPack
    │
    ▼
 OpenAI
    │
 ┌──┴──┐
 │     │
OK    FAIL
 │     │
 ▼     ▼
Return Anthropic
        │
        ▼
      Return
```

---

# 27. Standard Error

다음 공통 오류를 먼저 구현한다.

```typescript
type ProviderErrorCode =
  | "RATE_LIMIT"
  | "QUOTA_EXHAUSTED"
  | "TIMEOUT"
  | "AUTH_ERROR"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "MODEL_UNAVAILABLE"
  | "UNKNOWN";
```

---

# 28. Phase 3 완료 조건

강제로 OpenAI에:

```text
RATE_LIMIT
```

을 발생시켰을 때 Anthropic으로 자동 전환되어야 한다.

아직 Memory가 없어도 된다.

---

# 29. Phase 4 — Memory

다음 Memory를 구현한다.

```text
User Memory

Project Memory

Working Memory
```

기본 CRUD:

```text
Create

Read

Update

Delete

Search
```

---

# 30. Memory MVP 원칙

초기에는 모든 Conversation을 자동 분석하지 않는다.

먼저 명시적인 정보 중심으로 구현한다.

예:

```text
"이 프로젝트 이름은 Think Along이야."

→ Project Memory
```

```text
"앞으로 한국어로 답해."

→ User Memory
```

---

# 31. Phase 4 완료 조건

OpenAI에서 저장한 Memory를 Anthropic에서도 사용할 수 있어야 한다.

예:

OpenAI Session:

> 프로젝트 이름은 Think Along이야.

Anthropic으로 전환 후:

> 프로젝트 이름이 뭐였지?

PASS:

> Think Along

---

# 32. Phase 5 — Decision Memory

Decision을 별도 Entity로 구현한다.

```text
subject

value

status

superseded_by
```

상태:

```text
ACTIVE

SUPERSEDED

REVOKED
```

---

# 33. Decision Supersede

사용자:

> Frontend는 Flutter로 하자.

```text
Flutter
ACTIVE
```

이후:

> React로 바꾸자.

결과:

```text
Flutter
SUPERSEDED

React
ACTIVE
```

---

# 34. Phase 5 완료 조건

새 Session에서:

> Frontend 뭐 쓰기로 했지?

라고 물으면:

> React

라고 답해야 한다.

Flutter가 현재 결정처럼 사용되면 FAIL이다.

---

# 35. Phase 6 — Context Engine

Memory와 Decision을 실제 Provider Context로 조립한다.

기본 ContextPack:

```text
System Rules

User Memory

Project Memory

Active Decisions

Working Memory

Session Summary

Recent Messages

Current Message
```

---

# 36. Context Retrieval MVP

초기에는 다음 조합으로 충분하다.

```text
Metadata Filter

+

Key Match

+

Basic Relevance
```

Semantic Search는 P1에서도 가능하다.

Memory 수가 적은 초기에는 복잡한 RAG가 필요하지 않다.

---

# 37. Context Deduplication

같은 정보가 여러 위치에 있으면 우선순위를 둔다.

```text
Decision

>

Memory

>

Summary

>

Old Conversation
```

예:

```text
Summary
Flutter

Decision
React
```

최종 Context:

```text
React
```

---

# 38. Phase 6 완료 조건

ContextPack을 출력했을 때 다음이 확인되어야 한다.

```text
Relevant Memory only

Active Decision only

Correct Project

Current Working State

Recent Conversation
```

---

# 39. Phase 7 — Real Failover

이제 Router와 Context Engine을 결합한다.

```text
ContextPack C1

↓

OpenAI

X

↓

Anthropic

↓

Same ContextPack C1
```

---

# 40. Context Snapshot

각 Request마다 Context Snapshot을 만든다.

```text
request_id

context_snapshot_id
```

원칙:

> **One Request = One Context Snapshot**

Failover 시 Snapshot을 다시 만들지 않는다.

---

# 41. Phase 7 핵심 테스트

OpenAI와 20턴 정도 프로젝트 대화를 진행한다.

이후 강제로 OpenAI를 실패시킨다.

사용자:

> 우리가 지금 뭐 결정하고 있었지?

Anthropic이 정확한 작업 상태를 설명해야 한다.

---

# 42. Phase 8 — Session Summary

Conversation이 길어지면 오래된 Message를 Summary로 압축한다.

```text
Old Messages

↓

Session Summary

+

Recent Messages
```

---

# 43. Summary 구조

권장:

```text
Goal

Completed

Current Task

Decisions

Open Questions

Next Step
```

예:

```text
Goal:
Think Along 설계

Completed:
Architecture
Memory

Current:
Context Engine

Decision:
PostgreSQL
Modular Monolith

Next:
Router
```

---

# 44. Phase 8 — Cold Resume

Application을 종료한 뒤 다시 실행한다.

DB에서:

```text
Project

Session

Memory

Decision

Session Summary
```

를 복원한다.

---

# 45. Cold Resume Scenario

Day 1:

> Context Engine까지 설계하자.

종료.

Day 2:

> 어제 하던 거 계속하자.

Think Along:

> 어제 Context Engine 설계를 진행했고 다음 단계는 AI Router였습니다...

이 경험이 가능해야 한다.

---

# 46. Phase 8 완료 조건

Provider가 Day 1과 Day 2에 달라도 정상 작동해야 한다.

예:

```text
Day 1
OpenAI

Day 2
Anthropic
```

Continuity가 유지되어야 한다.

---

# 47. Phase 9 — UX Integration

이제 Core를 실제 제품 UX에 연결한다.

MVP 기본 화면:

```text
┌──────────────────────────────┐
│ Think Along           Auto ▾ │
│                              │
│                              │
│ Think Along                  │
│                              │
│ 무엇을 함께 생각해볼까요?    │
│                              │
│ ┌──────────────────────────┐ │
│ │ 메시지 입력...        ↑ │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

---

# 48. 대화 화면

Provider 이름은 기본적으로 전면에 표시하지 않는다.

```text
You

Think Along

You

Think Along
```

필요할 경우 Metadata로 실제 Provider를 확인할 수 있다.

---

# 49. Auto Mode

MVP 기본값:

```text
Auto
```

내부:

```text
OpenAI
↓
Anthropic
```

자동 전환.

---

# 50. Failover UX

Provider가 변경되더라도 대화를 막는 Modal을 띄우지 않는다.

가능한 표시:

```text
Claude로 자동 전환됨
```

작은 상태 정보 정도만 제공한다.

---

# 51. Continue Thinking

Home에서 Chat History보다 작업 Continuity를 강조한다.

예:

```text
Continue Thinking

Think Along
Context Engine
10분 전

FlowPulse
Backend Architecture
어제
```

사용자는 Conversation ID를 기억할 필요가 없다.

---

# 52. New Thought

새로운 작업:

```text
+ New Thought
```

또는:

```text
New Conversation
```

UX 단계에서 최종 명칭을 결정한다.

---

# 53. Memory Viewer

P1에서 간단한 Memory UI를 제공한다.

```text
Memory

About You

Projects

Decisions

Current Work
```

---

# 54. Provider Settings

```text
AI Connections

OpenAI
Connected

Anthropic
Connected
```

MVP에서는 복잡한 Provider Dashboard가 필요하지 않다.

---

# 55. Phase 10 — Acceptance Testing

기능별 Unit Test보다 먼저 Golden Scenario 기반 E2E Test를 통과해야 한다.

---

# 56. Acceptance Test A — Provider Handoff

### Setup

OpenAI Primary  
Anthropic Fallback

### Steps

1. OpenAI로 20턴 프로젝트 대화
2. 여러 Project Memory 생성
3. 여러 Decision 생성
4. OpenAI 강제 Rate Limit
5. 다음 질문 전송

### PASS

Anthropic이 자연스럽게 대화를 이어간다.

---

# 57. Acceptance Test B — Decision Continuity

사용자:

> Frontend는 Flutter로 하자.

이후:

> React로 변경하자.

다른 Provider로 전환.

질문:

> Frontend 뭐였지?

### PASS

```text
React
```

---

# 58. Acceptance Test C — Project Isolation

FlowPulse:

```text
Database = Oracle
```

Think Along:

```text
Database = PostgreSQL
```

Think Along Session에서 질문:

> DB 뭐 쓰기로 했지?

### PASS

```text
PostgreSQL
```

---

# 59. Acceptance Test D — Cold Resume

1. 대화 진행
2. Application 종료
3. 일정 시간 후 실행
4. 다른 Provider 사용
5. "아까 하던 거 계속"

### PASS

기존 Project와 Task를 이어간다.

---

# 60. Acceptance Test E — Provider Removal

OpenAI Provider를 완전히 제거한다.

### PASS

Anthropic만으로 기존:

```text
Projects

Sessions

Messages

Memory

Decisions
```

를 그대로 사용할 수 있다.

---

# 61. Acceptance Test F — Provider Addition

Gemini Provider Adapter를 추가한다.

### PASS

다음 Core 코드를 수정하지 않는다.

```text
Session

Memory

Decision

Context Engine
```

---

# 62. Acceptance Test G — No False Memory

Backend Decision이 없는 상태.

사용자:

> Backend는 Python으로 했었지?

### PASS

Think Along:

> 저장된 결정에서 Backend를 Python으로 확정한 기록을 찾지 못했습니다.

없는 기억을 생성하면 FAIL이다.

---

# 63. Acceptance Test H — Memory Delete

사용자:

> 이 기억은 지워.

삭제 후 새로운 Session에서 관련 질문.

### PASS

삭제된 Memory를 Context에 사용하지 않는다.

---

# 64. Acceptance Test I — Partial Streaming Failure

OpenAI Streaming 도중 강제 Timeout.

### PASS

불완전 답변이 최종 Message로 남지 않는다.

Anthropic이 동일 Context를 사용하여 정상 답변을 생성한다.

---

# 65. Acceptance Test J — Same Session

Provider가 여러 번 바뀐다.

```text
OpenAI

Anthropic

OpenAI

Anthropic
```

### PASS

모든 Message가 동일한 Think Along Session에 존재한다.

---

# 66. Definition of Done

Think Along MVP는 다음 조건을 모두 만족할 때 완료한다.

```text
[ ] Think Along 자체 Session이 존재한다.

[ ] Provider와 Session이 분리되어 있다.

[ ] OpenAI Provider가 작동한다.

[ ] Anthropic Provider가 작동한다.

[ ] Provider Adapter Interface가 공통화되어 있다.

[ ] Provider 오류가 공통 Error로 변환된다.

[ ] OpenAI 실패 시 Anthropic으로 Fallback된다.

[ ] Provider 변경 시 Session이 유지된다.

[ ] Provider 변경 시 Memory가 유지된다.

[ ] Provider 변경 시 Decision이 유지된다.

[ ] ContextPack이 Provider 독립적으로 생성된다.

[ ] Decision Supersede가 동작한다.

[ ] Project Memory가 격리된다.

[ ] Session Summary가 생성된다.

[ ] Application 재실행 후 Session을 복구한다.

[ ] 다른 Provider로 Cold Resume가 가능하다.

[ ] Golden Scenario E2E Test를 통과한다.
```

---

# 67. 개발 순서 요약

실제 개발 작업 순서는 다음을 권장한다.

```text
1. Database / Project Foundation

2. Session + Message

3. Provider Interface

4. OpenAI Provider

5. Anthropic Provider

6. Basic Router

7. Project

8. Memory

9. Decision

10. ContextPack

11. Context Engine

12. Context Snapshot

13. Failover

14. Session Summary

15. Cold Resume

16. UX Integration

17. Golden Scenario Test
```

---

# 68. 개발 순서에서 중요한 점

Memory부터 완벽하게 만들려고 하지 않는다.

먼저:

```text
Provider A
     ↓
Provider B
```

가 가능한 구조를 만든다.

그다음 Memory와 Context를 연결한다.

---

# 69. Sprint 1 — Foundation + Session

목표:

> Think Along 자체 Conversation을 만든다.

구현:

```text
DB

Project

Session

Message

Basic Chat UI
```

완료 결과:

```text
한 Provider와 정상 Chat
```

---

# 70. Sprint 2 — Multi Provider

목표:

> OpenAI와 Anthropic을 동일 Interface로 실행한다.

구현:

```text
AIProvider

OpenAIProvider

AnthropicProvider

ProviderRegistry
```

완료 결과:

```text
코드 변경 없이 Provider 교체 가능
```

---

# 71. Sprint 3 — Router

목표:

> AI 장애가 사용자 대화 장애가 되지 않게 한다.

구현:

```text
AIRouter

Standard Error

Fallback

Retry

Provider Attempt
```

완료 결과:

```text
OpenAI 실패
→ Anthropic 성공
```

---

# 72. Sprint 4 — Memory + Decision

목표:

> Provider를 바꿔도 중요한 정보가 유지된다.

구현:

```text
User Memory

Project Memory

Working Memory

Decision

Supersede
```

완료 결과:

```text
Cross-provider Memory
```

---

# 73. Sprint 5 — Context Engine

목표:

> 새로운 Provider가 기존 상황을 정확히 이해한다.

구현:

```text
ContextPack

Retrieval

Ranking

Deduplication

Decision Priority

Recent Messages
```

완료 결과:

```text
Provider Handoff Continuity
```

---

# 74. Sprint 6 — Long Session Continuity

목표:

> 대화가 길어져도 이어진다.

구현:

```text
Session Summary

Compaction

Token Budget

Context Snapshot
```

---

# 75. Sprint 7 — Cold Resume

목표:

> 다음날 돌아와도 이어진다.

구현:

```text
Persistent Working State

Session Restore

Project Resume

Context Rebuild
```

---

# 76. Sprint 8 — MVP UX

목표:

> 기술 기능을 하나의 AI 경험으로 보이게 한다.

구현:

```text
Think Along Chat

Auto Mode

Continue Thinking

Fallback Status

Provider Settings
```

---

# 77. Sprint 9 — Hardening

구현:

```text
Error Cases

Streaming Failure

Cancellation

Memory Conflict

Decision Conflict

Project Isolation

Retry Limits
```

---

# 78. Sprint 10 — MVP Verification

최종적으로 Golden Scenario를 반복 검증한다.

```text
OpenAI
 ↓
20 Turns
 ↓
Rate Limit
 ↓
Anthropic
 ↓
Continue
 ↓
Close App
 ↓
Next Day
 ↓
Resume
```

PASS해야 한다.

---

# 79. MVP에서 가장 위험한 영역

기술적으로 가장 위험한 부분은 다음 세 가지다.

```text
1. Context Quality

2. Memory Pollution

3. Streaming Failover
```

---

# 80. Risk 1 — Context Quality

Memory가 저장되어 있어도 올바른 Context를 전달하지 못하면 Continuity가 깨진다.

대응:

```text
Active Decision Priority

Project Isolation

Recent Message Preservation

Structured Summary

Context Trace
```

---

# 81. Risk 2 — Memory Pollution

불필요하거나 잘못된 Memory가 누적되면 AI 전체가 잘못된 방향으로 갈 수 있다.

대응:

```text
Explicit Memory First

Low-confidence Memory 제외

Decision 별도 관리

Memory Delete

Source Tracking
```

---

# 82. Risk 3 — Streaming Failover

부분 응답 후 Provider 실패는 구현 난도가 높다.

MVP에서는 단순 정책을 사용한다.

```text
Partial Response

↓

Discard / Mark Failed

↓

Fallback

↓

Regenerate Full Response
```

완벽한 문장 이어쓰기는 Later로 미룬다.

---

# 83. 성능 목표

초기 MVP에서 Context Engine 자체가 지나치게 느려서는 안 된다.

목표 예:

```text
Context Build
< 500ms ~ 1s

Router Overhead
Minimal

Provider Switching
User가 큰 지연으로 느끼지 않는 수준
```

정확한 수치는 실제 환경에서 측정 후 조정한다.

---

# 84. 운영 지표

MVP 출시 후 다음을 측정한다.

```text
Provider Handoff Success Rate

Fallback Rate

Fallback Success Rate

Cold Resume Success Rate

Decision Recall Accuracy

Wrong Memory Rate

Context Build Latency

Interrupted Conversation Rate
```

---

# 85. 제품 핵심 지표

가장 중요한 지표는:

```text
Re-explanation Rate
```

이다.

정의:

> 사용자가 AI에게 이미 설명한 내용을 다시 설명해야 했던 빈도.

Think Along의 성능이 좋아질수록 이 비율은 낮아져야 한다.

---

# 86. 두 번째 핵심 지표

```text
Continuity Success Rate
```

예:

```text
Provider Change 후
기존 작업을 정상적으로 이어간 비율
```

이 값이 Think Along의 핵심 제품 품질을 나타낸다.

---

# 87. MVP 비즈니스 검증보다 먼저 볼 것

초기에는 사용자 수나 매출보다 먼저 다음을 본다.

```text
정말 AI가 자연스럽게 이어지는가?

사용자가 다시 설명하지 않는가?

사용자가 모델 전환을 신경 쓰지 않는가?

다음날 작업을 바로 이어갈 수 있는가?
```

이 네 가지가 먼저다.

---

# 88. Technical Debt Policy

MVP라고 해서 Core Boundary를 깨지는 않는다.

빠르게 구현하더라도 다음은 지킨다.

```text
Provider Adapter

Session Ownership

Memory Ownership

Context Independence

Decision Priority
```

UI나 세부 기능은 임시 구현이 가능하지만 Core Architecture는 초기부터 지킨다.

---

# 89. 금지할 Shortcut

다음 방식으로 MVP를 만들지 않는다.

```text
GPT Conversation ID를 그대로 Session으로 사용

Claude History에 의존

Provider별 Memory 별도 저장

Provider별 Context 로직 작성

OpenAI SDK를 Core에서 직접 호출

Conversation 전체를 무조건 Prompt에 삽입
```

이 방식들은 빠르게 보여줄 수는 있지만 Think Along의 핵심 구조를 망친다.

---

# 90. MVP Architecture Freeze

다음 구조는 MVP 개발 중 기본적으로 고정한다.

```text
Session
   │
   ▼
Memory / Decision
   │
   ▼
Context Engine
   │
   ▼
ContextPack
   │
   ▼
Router
   │
   ▼
Provider Adapter
```

기능 요구 때문에 이 의존성 방향을 역전하지 않는다.

---

# 91. MVP 이후 확장 순서

MVP 성공 후 다음 순서를 권장한다.

```text
MVP
 │
 ▼
Better Memory
 │
 ▼
Better Context
 │
 ▼
More Providers
 │
 ▼
Smart Router
 │
 ▼
Tools
 │
 ▼
Skills
 │
 ▼
Multi-Agent
 │
 ▼
Automation
```

---

# 92. 왜 More Providers보다 Memory가 먼저인가

Think Along의 가치는 지원 AI 개수에서 나오지 않는다.

가치는:

```text
How well Think Along knows the user
```

와:

```text
How well Think Along preserves continuity
```

에서 나온다.

따라서 Provider 확대보다 Memory와 Context 품질을 먼저 개선한다.

---

# 93. Smart Router 도입 시점

다음 조건이 만족된 후 Smart Router를 검토한다.

```text
Basic Failover 안정화

Provider Usage 데이터 축적

Latency 데이터 축적

Task 유형 데이터 축적

사용자 Provider 선호 데이터 확보
```

그 전에는 Priority Router로 충분하다.

---

# 94. Multi-Agent 도입 시점

Multi-Agent는 다음 단계다.

기본 Continuity가 완성된 후:

```text
One User
    │
    ▼
One Think Along Context
    │
    ├── Agent A
    ├── Agent B
    └── Agent C
```

로 확장할 수 있다.

하지만 Agent가 늘어나도 Shared Context 원칙은 유지한다.

---

# 95. Skills 도입 시점

Skills 역시 Context Engine 위에서 작동하게 한다.

예:

```text
Context
   │
   ▼
Coding Skill
   │
   ▼
Provider
```

Skill이 자체 Memory를 소유하지 않도록 한다.

---

# 96. 장기적인 Think Along Core

장기적으로도 Core는 다음 다섯 요소가 중심이다.

```text
Session

Memory

Context

Decision

Routing
```

AI Model, Agent, Skill, Tool은 이 Core 위에 붙는다.

---

# 97. MVP North Star

MVP 개발 과정에서 기능 우선순위가 헷갈릴 때 이 장면으로 돌아온다.

```text
User:

"그럼 다음 단계 계속해."


Think Along Internal:

GPT unavailable

↓

Claude


Claude receives:

Same Project
Same Decisions
Same Memory
Same Context


Think Along:

"좋습니다. 앞에서 정한 구조를 기준으로 다음 단계로 가겠습니다."
```

이 경험이 깨지면 우선 수정한다.

---

# 98. 최종 MVP 범위

```text
Think Along MVP v1

├── Unified Session
├── Project
├── Persistent Messages
├── User Memory
├── Project Memory
├── Working Memory
├── Decision Memory
├── Decision Supersede
├── Context Engine
├── ContextPack
├── Session Summary
├── OpenAI Adapter
├── Anthropic Adapter
├── AI Router
├── Automatic Failover
├── Context Snapshot
├── Streaming
└── Cold Resume
```

---

# 99. MVP에서 하지 않는 것

```text
❌ 최고의 AI를 자동 판단하는 Smart Router

❌ 여러 AI의 답변을 동시에 보여주는 기능

❌ AI끼리 토론시키는 기능

❌ Multi-Agent 조직

❌ OpenClaw Gateway 복제

❌ Telegram / WhatsApp 중심 구조

❌ Skills Marketplace

❌ Autonomous Agent

❌ 복잡한 Workflow Automation

❌ 모든 Conversation의 자동 장기 기억

❌ 완벽한 AI Personality 통일
```

---

# 100. MVP Definition of Success

Think Along MVP가 성공했다는 것은 기능이 많이 존재한다는 뜻이 아니다.

다음 경험이 안정적으로 반복되는 것을 의미한다.

```text
Different Provider

Same Session

Same Memory

Same Decisions

Same Context

Same Work

Same Relationship
```

---

# 101. 핵심 개발 문장

> **두 AI를 연결하는 것이 목표가 아니다.**

> **두 AI 사이에서 사용자의 생각을 연결하는 것이 목표다.**

---

# 102. 최종 정의

Think Along MVP는 ChatGPT, Claude, Gemini를 한 화면에서 선택하는 Multi-AI Client가 아니다.

Think Along은 AI Provider보다 위에서:

```text
Session

Memory

Decision

Context
```

를 소유하고, 현재 사용 가능한 AI를 실행 엔진으로 사용하는 시스템이다.

```text
                  USER
                    │
                    ▼
              THINK ALONG
                    │
            ┌───────┴───────┐
            │               │
         Memory          Session
            │               │
            └───────┬───────┘
                    │
                Decision
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
             ┌──────┴──────┐
             ▼             ▼
          OpenAI       Anthropic
```

핵심 문장:

> **AI는 바뀌어도, 생각은 이어집니다.**

---

# 103. MVP 이후 다음 단계

MVP Core가 구현된 이후 다음 문서는:

`10_UX_설계.md`

에서 Think Along의 실제 사용자 경험을 설계한다.

주요 내용:

```text
Information Architecture

First Launch

Provider Connection

Home

Continue Thinking

Conversation

New Thought

Auto Mode

Manual Model Selection

Automatic Failover UX

Memory Viewer

Project Navigation

Settings

Desktop Layout

Mobile Layout

FlowPulse와의 Design Language 통일
```

UX의 목표 역시 동일하다.

> 내부에서는 여러 AI가 움직이지만 사용자는 하나의 Think Along을 사용한다.