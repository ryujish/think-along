# Think Along — Architecture Blueprint

## 1. 현재 코드와 목표 구조의 연결

현재 저장소에서 `Thinking`은 대화 메타데이터, `ConversationMessage`는 메시지, `lib/server/ai.ts`는 provider 호출과 라우팅을 모두 담당한다. 첫 변경은 기능을 새로 복제하지 않고 이 흐름을 분리하는 것이다.

```text
POST /api/thinkings/:id/continue
  → session service
  → context engine
  → model router (사용자가 선택한 Provider·계정·모델)
  → provider adapter
  → messages 저장
```

MVP에서는 `Thinking`을 즉시 제거하지 않는다. 기존 API/UI 호환을 위해 `Thinking.id`와 새 `thinkalong_session_id`를 1:1로 연결한 뒤, 후속 마이그레이션에서 이름을 정리한다.

## 2. 실제 폴더 구조

기존 저장소에 아래 파일만 추가하거나 분리한다.

```text
lib/server/
  session.ts                 # session 조회/생성, 접근 권한
  memory.ts                  # 저장된 memory 조회/기록
  context-engine.ts          # provider 중립 Context 조립
  router.ts                  # 사용자가 선택한 provider/account/model 실행
  providers/
    types.ts                 # 모든 adapter가 공유하는 단일 계약
    openai.ts
    anthropic.ts
    gemini.ts

lib/types.ts                 # domain types 유지
database/schema.sql          # 영구 DB 목표 스키마
app/api/thinkings/[id]/continue/route.ts
```

Kimi, Qwen, Local LLM, OpenRouter adapter 파일은 실제 연결 시점에만 만든다. `providers/index.ts`, factory class, DI container, repository 계층은 P0에 필요 없다.

## 3. DB 스키마

기존 `thinkings`와 `conversation_messages`를 호환하면서 다음을 목표로 한다.

```sql
create table thinkalong_sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  project_id text,
  title text not null,
  status text not null default 'active'
    check (status in ('active', 'archived', 'deleted')),
  selected_provider text,
  selected_connection_id text,
  selected_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table provider_connections (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  provider text not null,
  name text not null,
  auth_kind text not null check (auth_kind in ('api_key', 'oauth', 'local')),
  credential_ref text not null,
  status text not null default 'unknown'
    check (status in ('unknown', 'available', 'unavailable')),
  last_error_code text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id text primary key,
  thinkalong_session_id text not null
    references thinkalong_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  provider text,
  connection_id text,
  model text,
  context_version integer,
  execution_status text check (execution_status in ('succeeded', 'failed')),
  error_code text,
  created_at timestamptz not null default now()
);

create table memories (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  project_id text,
  thinkalong_session_id text
    references thinkalong_sessions(id) on delete cascade,
  kind text not null
    check (kind in ('user', 'project', 'conversation', 'decision')),
  content text not null,
  source_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sessions_user_updated
  on thinkalong_sessions(user_id, updated_at desc);
create index idx_connections_user_provider
  on provider_connections(user_id, provider);
create index idx_messages_session_created
  on messages(thinkalong_session_id, created_at);
create index idx_memories_scope
  on memories(user_id, project_id, thinkalong_session_id, kind);
```

P0에서는 provider health 테이블, 자동 fallback, 임베딩/vector DB를 만들지 않는다. 실제 필요와 사용자 결정이 확인된 뒤 추가한다.

### 기존 JSON 저장소의 최소 마이그레이션

현재 `AppDatabase`에는 아래 배열만 추가한다.

```ts
type AppDatabase = {
  // existing fields
  providerConnections: ProviderConnection[];
  memories: Memory[];
};
```

기존 `thinkings`는 P0 동안 session 저장소로 재사용하고 `ConversationMessage.thinkingId`를 논리적 `thinkalongSessionId`로 취급한다. JSON 데이터의 전면 변환은 SQL 전환과 동시에 한 번만 수행한다.

## 4. TypeScript 계약

```ts
export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'kimi'
  | 'qwen'
  | 'local'
  | 'openrouter';

export type MemoryKind = 'user' | 'project' | 'conversation' | 'decision';

export type ConnectionStatus = 'unknown' | 'available' | 'unavailable';

export type ProviderConnection = {
  id: string;
  userId: string;
  provider: ProviderId;
  name: string;
  authKind: 'api_key' | 'oauth' | 'local';
  credentialRef: string;
  status: ConnectionStatus;
  lastErrorCode?: ProviderErrorCode;
  lastCheckedAt?: string;
};

export type ModelCapability = {
  id: string;
  text: true;
  vision?: boolean;
  files?: boolean;
  tools?: boolean;
  structuredOutput?: boolean;
  streaming?: boolean;
};

export type ProviderErrorCode =
  | 'authentication'
  | 'permission'
  | 'invalid_request'
  | 'rate_limit'
  | 'quota_exhausted'
  | 'timeout'
  | 'unavailable'
  | 'safety_refusal'
  | 'unknown';

export type ProviderError = {
  code: ProviderErrorCode;
  provider: ProviderId;
  connectionId: string;
  retryable: boolean;
  message: string;
};

export type Memory = {
  id: string;
  userId: string;
  projectId?: string;
  thinkalongSessionId?: string;
  kind: MemoryKind;
  content: string;
  sourceMessageId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ContextMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type AssembledContext = {
  thinkalongSessionId: string;
  version: number;
  system: string;
  memories: Memory[];
  messages: ContextMessage[];
};

export type GenerateRequest = {
  context: AssembledContext;
  connectionId: string;
  model: string;
  signal?: AbortSignal;
};

export type GenerateResult = {
  text: string;
  provider: ProviderId;
  connectionId: string;
  model: string;
};

export interface ProviderAdapter {
  id: ProviderId;
  listModels(connectionId: string): Promise<ModelCapability[]>;
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

export type RouteRequest = {
  context: AssembledContext;
  provider: ProviderId;
  connectionId: string;
  model: string;
};

export type RouteResult = GenerateResult;
```

Provider adapter는 provider SDK 객체나 thread ID를 밖으로 노출하지 않는다. 인증키, endpoint, wire format 변환은 adapter 내부 책임이다.

## 5. Context Engine

P0의 조립 순서는 고정한다.

1. 제품 system instruction
2. User Memory
3. Project Memory
4. Decision Memory
5. Conversation Memory 요약이 있으면 포함
6. 현재 session의 최근 메시지
7. 새 사용자 메시지

P0는 token 계산기나 임베딩을 추가하지 않는다. 최근 메시지 개수 제한 하나로 시작한다. P1에서 provider별 context window에 맞춘 compaction을 추가하되, 원본 메시지는 삭제하지 않는다.

```ts
export async function assembleContext(input: {
  userId: string;
  thinkalongSessionId: string;
  projectId?: string;
  prompt: string;
}): Promise<AssembledContext>;
```

## 6. Router와 수동 전환 규칙

MVP의 Router는 세션에 저장된 사용자 선택을 그대로 실행한다.

1. 사용자가 Provider·계정·모델을 선택한다.
2. 선택 결과를 session에 저장한다.
3. 같은 선택을 다음 요청에도 사용한다.
4. 사용자가 변경하면 동일한 Context Packet으로 새 선택을 실행한다.

오류나 한도 초과가 발생하면 대체 후보를 제시할 수 있지만 자동 실행하지 않는다. Provider Adapter는 오류를 정규화하고 Router는 선택된 대상을 한 번 호출한다. 자동 fallback과 Predictive Router는 MVP에서 비활성이다.

인증정보는 세션이나 Context Packet과 분리해 안전한 저장소에 두고, 세션에는 `connectionId` 참조만 기록한다. Adapter는 Provider 응답을 `ProviderError`로 정규화하지만 Router는 다른 연결을 자동 실행하지 않는다.

### Provider 인증 — Paseo의 공통 연결 UX 적용

일반 사용자용 웹 서비스는 공식 API 연결을 기본으로 한다. 연결 화면은 OpenAI Platform, Anthropic Console, Google AI Studio의 공식 API Key 발급 페이지로 직접 이동할 수 있게 한다.

Paseo에서는 Provider별 구현 격리, 공통 연결 상태, 모델 발견 snapshot을 가져오되 로컬 CLI 설치는 요구하지 않는다. `Sign in with ChatGPT`는 별도의 모델 실행 권한이 확인되지 않는 한 GPT Provider 연결로 취급하지 않는다. API Key는 Context Packet과 session 데이터에 포함하지 않는다.

## 7. 구현 순서

### P0

1. `ProviderId`, `ProviderConnection`, `ModelCapability`, `ProviderError`와 Generate/Route 계약을 만든다.
2. 기존 환경변수 연결을 `providerConnections`로 노출하되 실제 key는 DB나 Context에 복사하지 않는다.
3. 기존 `lib/server/ai.ts`의 세 provider 호출을 adapter로 이동하고 오류를 정규화한다.
4. `router.ts`는 세션에 저장된 Provider·Connection·Model 한 개만 실행한다.
5. `session.ts`로 Thinking 소유권, 선택 상태와 메시지 조회를 옮긴다.
6. `memory.ts`와 JSON `memories` 배열을 추가한다.
7. `context-engine.ts`에서 기억과 최근 메시지를 버전 있는 Context로 조립한다.
8. create/continue route를 `assembleContext → routeModel → save messages` 한 경로로 합친다.
9. 메시지에 Provider·Connection·Model·Context 버전·실행 결과를 기록한다.
10. 사용자가 서로 다른 두 연결과 모델을 순차 선택해도 session이 이어지고 자동 fallback은 일어나지 않는 테스트를 남긴다.

### P1

1. 모델별 Context Cache와 Canonical Context 버전 무효화
2. JSON 내보내기·가져오기
3. 모델 전환 전달 범위 UI
4. Permission과 Provider Policy
5. Context Snapshot과 Session Summary

### P2

1. 역할별 내부 Agent
2. 플러그인 이벤트 훅
3. 확정 결정 충돌 검증
4. 자동 라우팅 인터페이스 유지(비활성)

### P3

1. Tool 실행 계약
2. Skills 로딩
3. 단일 sub-agent 실행
4. 실제 필요가 확인된 뒤 병렬/다중 agent orchestration

## 8. Codex / Claude 작업 분할

두 도구가 같은 파일을 동시에 수정하지 않도록 단계별 소유권을 고정한다.

### Codex — 통합과 실행 경로

- 현재 호출 흐름과 모든 caller 확인
- `providers/types.ts`, provider adapter 분리
- `router.ts` 구현
- create/continue API를 새 실행 경로로 연결
- runnable test와 lint/build 확인

완료 기준: 기존 API 응답을 깨지 않고, provider가 달라도 같은 Context 계약을 사용한다.

### Claude — 데이터와 문맥 설계

- `lib/types.ts`의 session/memory 타입 변경 제안
- `database/schema.sql` 마이그레이션 초안
- `memory.ts`, `context-engine.ts` 구현
- Context 조립 순서와 privacy 경계 검토
- 설계 문서와 실제 구현의 차이 검토

완료 기준: session/user/project 범위를 넘는 기억 누수가 없고, 같은 session이 provider와 독립적으로 복원된다.

### 합류 순서

1. Codex가 provider 공통 계약을 먼저 확정한다.
2. Claude는 그 계약을 소비하는 Context Engine과 schema를 만든다.
3. Codex가 API route를 통합하고 테스트한다.
4. Claude가 최종 diff에서 기억 범위와 데이터 손실 위험만 리뷰한다.

## 9. 첫 구현의 검증 시나리오

```text
Given 한 thinkalong_session_id에 사용자 메시지 A와 GPT 응답 B가 저장돼 있고
When 다음 요청 C를 Claude adapter로 처리하면
Then Claude가 받는 Context에 A, B, C가 순서대로 포함되고
And 저장된 응답에는 provider=anthropic이 기록되며
And session ID는 바뀌지 않는다.
```

수동 전환 검증:

```text
Given 선택한 adapter가 429를 반환할 때
When 대체 Provider·계정·모델 후보가 존재하면
Then Router는 후보를 자동 호출하지 않고
And 사용자가 후보를 선택한 뒤 동일한 AssembledContext로 다시 실행한다.
```

## 10. 웹 ChatGPT 공유 경계

웹 ChatGPT는 별도 기억 저장소가 아니라 Think Along의 외부 클라이언트로 연결한다. ChatGPT App(MCP)이 사용자 인증 후 `thinkalong_session_id`를 전달해 동일한 Context Engine과 Shared Memory를 사용한다.

ChatGPT 자체 대화 기록이나 Memory를 자동 동기화하는 기능에는 의존하지 않는다. P0에서는 외부 클라이언트가 재사용할 session API 경계까지만 유지하고, ChatGPT App/MCP 서버는 P0 완료 후 실제 연동 시 추가한다.
