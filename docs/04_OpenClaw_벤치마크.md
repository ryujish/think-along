# 04. OpenClaw 벤치마크

> Think Along이 OpenClaw에서 무엇을 배우고, 무엇을 가져오며, 무엇을 가져오지 않을 것인지 정의한다.

---

## 1. 벤치마크 목적

Think Along의 핵심 목표는 여러 AI 모델을 연결하는 것 자체가 아니다.

사용자가 GPT, Claude, Gemini, Kimi, Local LLM 등 서로 다른 AI를 사용하더라도 하나의 AI와 계속 대화하고 있는 것처럼 느끼게 만드는 것이 핵심이다.

이를 위해 OpenClaw의 다음 구조를 주요 벤치마크 대상으로 삼는다.

- Session
- Memory Architecture
- Context Engine
- Model Failover
- Provider Abstraction
- Skills

그러나 OpenClaw 전체를 복제하지 않는다.

Think Along에 필요한 핵심 구조만 추출하여 더 단순한 형태로 재설계한다.

---

# 2. OpenClaw와 Think Along의 차이

OpenClaw와 Think Along은 일부 기술 구조가 비슷하지만 제품의 목적은 다르다.

## OpenClaw

OpenClaw는 개인 AI 에이전트 및 실행 플랫폼에 가깝다.

주요 관심사는 다음과 같다.

- AI Agent 실행
- Tools
- Skills
- Gateway
- Messaging Channel
- Workspace
- Automation
- Session
- Memory
- Model Provider

즉,

```text
User
  │
  ▼
OpenClaw
  │
  ├── Agent
  ├── Skills
  ├── Tools
  ├── Gateway
  └── Models
```

에 가까운 구조다.

---

## Think Along

Think Along의 중심은 Agent가 아니다.

Think Along의 중심은 **Continuity**다.

```text
User
  │
  ▼
Think Along
  │
  ├── Session
  ├── Memory
  ├── Context
  ├── Decisions
  └── Router
         │
         ▼
      AI Models
```

Think Along의 목표는 다음과 같다.

> 여러 AI를 사용하지만 사용자는 하나의 AI를 사용하고 있다고 느낀다.

---

# 3. 가장 중요한 벤치마크: Memory Architecture

OpenClaw에서 가장 적극적으로 참고할 부분은 Memory Architecture다.

핵심 아이디어는 모든 대화를 단순히 하나의 Vector DB에 저장하지 않는다는 것이다.

기억을 목적에 따라 구분한다.

개념적으로 다음과 같이 볼 수 있다.

```text
User Information
      │
      ▼
User Memory

Conversation
      │
      ▼
Episodic Memory

Important Information
      │
      ▼
Long-term Memory

Current Conversation
      │
      ▼
Working Context
```

Think Along 역시 모든 Conversation을 동일한 중요도로 취급해서는 안 된다.

---

# 4. Think Along Memory로 재해석

Think Along MVP에서는 OpenClaw의 Memory Architecture를 더 단순하게 재구성한다.

```text
Memory

├── User Memory
│
├── Project Memory
│
├── Decision Memory
│
└── Working Memory
```

## User Memory

사용자에게 장기간 유효한 정보.

예:

```text
Preferred Language
Korean

Preferred Development Style
MVP First
```

---

## Project Memory

특정 프로젝트에 속하는 정보.

예:

```text
Project
Think Along

Goal
AI Continuity Layer
```

---

## Decision Memory

프로젝트에서 명시적으로 결정된 사항.

예:

```text
Frontend
Next.js

Language
TypeScript

Status
ACTIVE
```

Decision Memory는 일반 Memory보다 높은 우선순위를 가진다.

---

## Working Memory

현재 진행 중인 작업에 필요한 단기 Context.

예:

```text
Current Task

Design Context Engine
```

작업이 종료되면 일부 정보만 장기 Memory로 승격된다.

---

# 5. Memory Promotion

모든 Conversation을 Long-term Memory로 저장하지 않는다.

기본 흐름은 다음과 같다.

```text
Conversation
     │
     ▼
Working Memory
     │
     ▼
Candidate Memory
     │
     ├── Importance
     ├── Repetition
     ├── Explicit User Request
     └── Project Relevance
     │
     ▼
Long-term Memory
```

예를 들어 사용자가 한 번 말한:

> 오늘 점심 뭐 먹을까?

같은 내용은 장기 기억으로 저장할 필요가 없다.

반면:

> Think Along은 모델이 바뀌어도 하나의 AI처럼 보여야 한다.

같은 내용은 핵심 제품 결정으로 승격될 수 있다.

---

# 6. Decision Memory는 별도로 관리한다

Think Along에서는 OpenClaw의 Memory 개념을 한 단계 발전시켜 **Decision**을 별도 데이터로 관리한다.

예:

```text
2026-08-04

Frontend
Flutter

status = superseded
```

이후:

```text
2026-08-09

Frontend
React + TypeScript

status = active
```

Context Engine은 기본적으로 `active` Decision을 우선한다.

이를 통해 오래된 Conversation이 현재 결정을 오염시키는 것을 방지한다.

---

# 7. 두 번째 핵심 벤치마크: Context Engine

AI에게 Conversation 전체를 무조건 전달하는 것은 좋은 Memory 시스템이 아니다.

필요한 것은:

> Right Context at the Right Time

이다.

OpenClaw의 Context Engine 개념을 Think Along에서는 다음과 같이 단순화한다.

```text
Current User Message
        │
        ▼
Context Engine
        │
        ├── User Memory
        ├── Project Memory
        ├── Active Decisions
        ├── Session Summary
        ├── Recent Messages
        └── Working Memory
        │
        ▼
ContextPack
        │
        ▼
AI Provider
```

AI Provider가 변경되어도 Context Engine은 동일하다.

---

# 8. ContextPack

Think Along의 모든 AI Provider는 논리적으로 동일한 ContextPack을 받는다.

```text
ContextPack

1. System Rules

2. User Memory

3. Project Memory

4. Active Decisions

5. Session Summary

6. Recent Messages

7. Current User Message
```

예:

```text
USER

Language
Korean


PROJECT

Think Along


DECISIONS

Core Concept
AI Continuity

Memory Ownership
Think Along


CURRENT TASK

Context Engine Architecture


CURRENT MESSAGE

"Context Engine DB 구조를 설계해줘."
```

이 ContextPack이 GPT, Claude, Gemini 등 각각의 Provider 형식으로 변환된다.

---

# 9. 세 번째 핵심 벤치마크: Model Failover

OpenClaw에서 참고할 또 하나의 핵심 구조는 Model Failover다.

AI Provider는 언제든 실패할 수 있다.

예:

```text
Rate Limit

Timeout

Quota Exhausted

Provider Outage

Authentication Failure
```

Think Along에서는 Provider 실패가 사용자의 작업 실패로 이어져서는 안 된다.

---

# 10. Think Along Model Failover

기본 구조:

```text
GPT
 │
 │ FAIL
 ▼
Claude
 │
 │ FAIL
 ▼
Gemini
```

중요한 것은 모델이 바뀌어도 Context가 유지된다는 것이다.

```text
GPT

429 Rate Limit

        ↓

AI Router

        ↓

Claude

        ↓

Same ContextPack

        ↓

Continue
```

사용자는 다시 설명하지 않는다.

---

# 11. OpenClaw와 Think Along Failover의 차이

OpenClaw에서 Model Failover의 주요 목적은 Provider 장애 대응이다.

Think Along에서는 Failover를 더 넓은 개념으로 사용한다.

향후 Router는 다음 요소를 판단할 수 있다.

```text
Availability

Rate Limit

Quota

Cost

Latency

Task Type

Model Capability

User Preference
```

하지만 MVP에서는 복잡한 Smart Routing을 구현하지 않는다.

우선:

```text
Primary Model

↓

Fallback Model

↓

Second Fallback
```

만 구현한다.

---

# 12. 네 번째 핵심 벤치마크: Provider Abstraction

Think Along Core는 특정 AI 회사에 종속되어서는 안 된다.

따라서 모든 AI는 Provider Adapter 뒤에 위치한다.

```text
Think Along Core

       │

       ▼

Provider Interface

       │

 ┌─────┼─────┬─────┐
 ▼     ▼     ▼     ▼

GPT  Claude Gemini Kimi
```

예상 Interface:

```typescript
interface AIProvider {
  id: string;

  chat(
    context: ContextPack,
    options?: ChatOptions
  ): AsyncIterable<AIChunk>;

  health(): Promise<ProviderHealth>;
}
```

---

# 13. Provider Independence 원칙

새로운 Provider가 추가되어도 다음 영역은 변경하지 않는다.

```text
Session

Memory

Decision

Context Engine
```

새 Provider는:

```text
providers/

├── openai
├── anthropic
├── gemini
├── kimi
└── local
```

아래에 Adapter 형태로 추가한다.

---

# 14. Session Ownership

OpenClaw의 Session 개념 역시 Think Along에 중요하다.

하지만 Think Along에서는 Session Ownership을 더욱 명확하게 정의한다.

잘못된 구조:

```text
GPT Conversation ID

        ↓

Claude Conversation ID

        ↓

Gemini Conversation ID
```

이 경우 Session이 Provider에 종속된다.

Think Along은 자체 Session을 가진다.

```text
ThinkAlongSession

session_id = xxx

       │

       ├── User Message
       ├── GPT Response
       ├── User Message
       ├── Claude Response
       ├── User Message
       └── Gemini Response
```

Provider는 Session의 주인이 아니다.

---

# 15. Think Along Session 원칙

> Session belongs to Think Along.

따라서 AI가 변경되어도:

```text
Same Session

Same Memory

Same Decisions

Same Project

Same Context
```

가 유지된다.

이것이 Think Along의 가장 중요한 아키텍처 원칙 중 하나다.

---

# 16. Session Compaction

Conversation이 계속 길어지면 모든 Message를 AI에게 전달할 수 없다.

따라서 오래된 Conversation은 Summary로 압축한다.

```text
Conversation

Message 1
Message 2
Message 3
...
Message 100
```

↓

```text
Session Summary

+

Recent Messages

+

Current Message
```

Context Engine은 이를 Memory와 조합한다.

```text
Long-term Memory

+

Active Decisions

+

Session Summary

+

Recent Messages

+

Current Message
```

---

# 17. Skills 구조

OpenClaw의 Skills 구조도 향후 참고 가치가 있다.

개념적으로:

```text
skills/

├── github/
│   └── SKILL.md
│
├── research/
│   └── SKILL.md
│
└── finance/
    └── SKILL.md
```

처럼 특정 작업에 필요한 지침과 Tool 사용법을 분리할 수 있다.

Think Along 역시 장기적으로 다음과 같은 Skill 구조를 가질 수 있다.

```text
Research

Coding

Finance

Travel

Shopping

Translation
```

하지만 Skills는 Think Along MVP의 핵심이 아니다.

따라서 초기 버전에서는 구현하지 않는다.

---

# 18. OpenClaw에서 가져오지 않을 것

OpenClaw의 모든 구조가 Think Along에 필요한 것은 아니다.

MVP에서는 다음 기능을 제외한다.

```text
Complex Gateway

Telegram / WhatsApp 중심 구조

Multi-Agent Sandbox

Heartbeat

Cron

Complex Plugin SDK

Large Skill Ecosystem

Autonomous Agent

Complex Tool Execution
```

이 기능들은 강력하지만 Think Along의 핵심 가설을 검증하는 데 필요하지 않다.

---

# 19. OpenClaw의 가장 큰 교훈

OpenClaw에서 가져와야 할 것은 기능의 개수가 아니다.

가장 중요한 교훈은:

> AI 모델과 AI 시스템을 분리할 수 있다는 것이다.

Think Along에서는 이를 더 강하게 적용한다.

```text
Think Along

Memory
Context
Session
Decision
Identity

        │

        ▼

Replaceable Intelligence Engine

        │

 ┌──────┼──────┐

GPT   Claude   Gemini
```

AI 모델은 교체 가능하다.

사용자의 기억과 작업은 교체되지 않는다.

---

# 20. Think Along의 차별화

OpenClaw의 중심:

> Personal AI Agent

Think Along의 중심:

> AI Continuity Layer

Think Along이 해결하려는 문제는 다음과 같다.

```text
현재

GPT Memory
Claude Memory
Gemini Memory

각각 분리


Think Along

             Shared Memory
                  │
             Shared Context
                  │
             Shared Session
                  │
             Shared Decisions
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼

       GPT      Claude    Gemini
```

사용자는 더 이상 AI들의 기억을 직접 관리하지 않는다.

Think Along이 관리한다.

---

# 21. OpenClaw → Think Along Mapping

| OpenClaw 개념 | Think Along | 적용 |
|---|---|---|
| Session | Unified Session | P0 |
| Memory | Shared Memory | P0 |
| Context Engine | Context Engine | P0 |
| Model Failover | AI Router | P0 |
| Provider | Provider Adapter | P0 |
| Memory Compaction | Session Compaction | P0 |
| Skills | Think Along Skills | Later |
| Gateway | 제외 | 제외 |
| Multi-Agent | Multi-Agent | Later |
| Automation | Agent Automation | Later |
| Tool Execution | Tools | Later |

---

# 22. MVP에서 가져올 것

OpenClaw에서 MVP에 가져올 핵심은 정확히 다섯 가지다.

## 1. Unified Session

AI Provider와 독립된 Session.

## 2. Memory Architecture

User / Project / Decision / Working Memory.

## 3. Context Engine

현재 작업에 필요한 Context만 구성.

## 4. Model Failover

Provider 실패 시 Context를 유지한 채 다른 AI로 전환.

## 5. Provider Abstraction

AI Model을 교체 가능한 실행 엔진으로 만든다.

---

# 23. 가져오지 않을 것

MVP에서는 다음을 하지 않는다.

- Gateway
- Messaging Integration
- Multi-Agent
- Skills Marketplace
- Autonomous Agent
- Complex Tool System
- Cron
- Heartbeat
- Agent Sandbox

Think Along MVP의 목적은 Agent Platform을 만드는 것이 아니다.

---

# 24. Think Along Architecture Direction

OpenClaw 벤치마크를 바탕으로 Think Along의 기본 구조를 다음과 같이 정의한다.

```text
                    USER
                      │
                      ▼
               THINK ALONG
                      │
              Unified Session
                      │
          ┌───────────┴───────────┐
          ▼                       ▼

       Memory                 Decisions

          │                       │
          └───────────┬───────────┘
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
             ┌────────┼────────┐
             ▼        ▼        ▼

           OpenAI  Anthropic  Gemini
```

---

# 25. 핵심 결론

OpenClaw를 Think Along의 기반으로 사용하지 않는다.

OpenClaw의 좋은 설계 원칙을 벤치마킹하고 Think Along 목적에 맞게 단순화한다.

가져올 것은:

```text
Context Engine

Memory Architecture

Model Failover

Session Ownership

Provider Abstraction
```

이다.

가져오지 않을 것은:

```text
Gateway

Complex Agent Runtime

Messaging Infrastructure

Large Skill System

Automation Infrastructure
```

이다.

---

# 26. Think Along의 핵심 원칙

OpenClaw 벤치마크를 통해 Think Along의 가장 중요한 아키텍처 원칙을 다음과 같이 확정한다.

> **AI 자체가 기억을 소유하지 않는다.**

> **Think Along이 기억을 소유한다.**

> **AI는 필요에 따라 교체 가능한 Intelligence Engine이다.**

따라서:

```text
AI changes.

Memory remains.

Context remains.

Session remains.

Decisions remain.

The thought continues.
```

---

# 27. 최종 정의

Think Along은 OpenClaw의 복제판이 아니다.

OpenClaw가 개인 AI Agent를 구축하기 위한 실행 플랫폼에 가깝다면 Think Along은 서로 다른 AI 모델 사이에서 사용자의 기억과 맥락, 결정, 작업 상태를 유지하는 계층이다.

> **Think Along = AI Continuity Layer**

그리고 이 차이를 한 문장으로 표현한다.

> **AI는 바뀌어도, 생각은 이어집니다.**

---

## Next

다음 문서:

`05_아키텍처.md`

여기서는 본 문서에서 확정한 다음 다섯 개의 핵심 요소를 실제 시스템 구조로 구체화한다.

1. Unified Session
2. Memory
3. Context Engine
4. AI Router
5. Provider Adapter