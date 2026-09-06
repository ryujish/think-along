# Think Along CLI

터미널에서 `think-along`을 실행한다. Orca의 일반 터미널에서도 동일한 명령을 사용한다.
웹 서버나 Orca가 실행 중이지 않아도 CLI는 동작한다.

## 실행

Node.js 22.18 이상과 설치된 Hermes가 필요하다. Loc에서 검증한 버전은
Node.js 26.8.1, Hermes Agent 0.21.0 (2026.8.31, upstream 593aa74c)이다.

```sh
npm run cli:install
think-along doctor
think-along setup
think-along
```

`setup`에서 사용자가 선택한 Hermes 공급자·모델은 현재 Think Along 세션에도 반영한다.
일반 셸과 Orca 모두 `~/.local/bin`이 PATH에 있어야 한다.
설치 스크립트는 기존의 다른 `think-along` 실행 파일을 덮어쓰지 않는다.

## 구조

- 터미널 / Orca 터미널 → Think Along CLI → 기존 Context Engine → Hermes adapter → 선택한 모델.
- Think Along: 프로젝트별 원본 대화, 세션 ID, 명시적 기억, 모델 전환과 실행 이력.
- Hermes: 공급자 인증, 모델 실행, 보조 Memory, Skills, 설정된 Tools/MCP.
- Orca: CLI를 실행하는 선택적 클라이언트. CLI 실행에 Orca 의존성 없음.
- Codex CLI와 GPT 모델, Claude Code와 Claude 모델은 구분한다. 이번 연결은 Hermes가 제공하는 inference provider를 사용하며 임의의 별도 CLI를 모델처럼 감싸지 않는다.

프로젝트별 원본 저장소는 `~/.think-along/projects/<프로젝트 실제 경로의 해시>/state.json`이다.
모든 대화는 `thinkalong_session_id`에 속한다. 공급자의 세션 ID를 기준 원본으로 사용하지 않는다.
파일은 0600, 디렉터리는 0700으로 만들고 프로세스 간 잠금과 임시 파일 rename으로 저장한다.
갑작스러운 프로세스 강제 종료 뒤 잠금 폴더가 남으면 실제 실행 중인 요청이 없는지 확인한 뒤 해당 잠금만 정리한다.

현재 웹의 `lib/server/context-engine.ts`를 직접 재사용한다. 웹 계정과 CLI 원본의 자동 동기화는 아직 구현하지 않았다.
CLI의 JSON export는 CLI 전용 스키마이며 웹 import API와 호환된다고 가정하면 안 된다.

## 인증

```sh
think-along auth add openai-codex --type oauth
think-along auth add openrouter --type api-key
think-along setup
```

OAuth와 API Key 입력은 설치된 Hermes의 공식 인증 명령으로 위임한다.
사용자가 직접 브라우저 로그인이나 키 입력을 완료해야 한다.
키를 CLI 인자로 쓰는 대신 Hermes의 숨김 입력을 사용한다.
ChatGPT 신원 로그인만으로 일반 OpenAI API 실행 권한이 생긴다고 가정하지 않는다.

OpenRouter를 선택하면 그 연결의 API Key로 해당 계정에서 이용 가능한 모델을 선택한다.
Anthropic, Gemini 등 직접 공급자도 Hermes가 지원하는 공급자 ID와 모델 ID를 명시적으로 선택한다.
이번 작업에서 각 외부 공급자의 실제 로그인·잔액·모델 실행 성공을 모두 검증한 것은 아니다.

## 대화와 수동 전환

```sh
think-along run "현재 작업을 정리해줘"
think-along run "이전 대화를 이어서 답해줘" --json
think-along sessions
think-along resume <세션-ID>
think-along model
think-along model use <provider-ID> <정확한-model-ID>
think-along model sync
think-along memory add "이 프로젝트는 한국어로 답변한다."
think-along memory list
think-along context "다음 질문"
think-along export > think-along-export.json
```

대화 화면에서는 `/new`, `/sessions`, `/resume ID`, `/model 공급자 모델`,
`/memory 내용`, `/skills 이름,...`, `/exit`를 사용한다.
현재 폴더의 실제 경로가 프로젝트 경계다. 다른 프로젝트의 세션 ID로 재개할 수 없다.
전체 원문은 보존하지만 모델에 보내는 최근 대화는 기존 Context Engine의 20개 메시지 제한을 따른다.
장기 문맥은 `memory add`로 명시적으로 남길 수 있다.

오류나 한도 초과 시 다른 모델·계정을 자동 실행하지 않는다.
실패한 질문과 실행 상태를 보존하되 다음 Context에는 실패 질문을 중복 주입하지 않는다.
동일 모델에 대한 Hermes/SDK 내부 네트워크 재시도는 별개다.

## Memory / Skills / MCP

```sh
think-along skills list
think-along skills use <스킬이름,...>
think-along tools
think-along mcp --help
```

관리 명령은 Hermes의 인터페이스에 위임한다. 선택한 Skills를 매 요청에 사전 로드한다.
Hermes의 Memory, 사용자 프로필과 현재 프로젝트 규칙은 보조 문맥으로 유지한다.
Think Along의 원본·명시적 프로젝트 기억이 기준이라는 지시를 함께 전달한다.
`context` 명령은 Think Along이 조립한 부분만 보여주며 Hermes가 추가하는 보조 문맥 전체를 보여주는 기능은 아니다.

전용 Python adapter는 `AIAgent`를 직접 구성하며 `hermes -z`를 실행하지 않는다.
`fallback_model=[]`, `credential_pool=None`으로 실행 중 자동 fallback·계정 순환을 비활성화한다.
백그라운드 리뷰와 delegation도 이 연결에서는 끈다.
도구 권한은 Hermes가 처리하며 자동 승인 환경변수를 추가하지 않는다.
외부 API 키와 OAuth 토큰은 Hermes가 해석하고 Think Along의 상태 파일/Context에는 복사하지 않는다.
사용자가 질문이나 기억에 직접 입력한 민감 문자열을 자동 제거하는 기능은 없다.

## 검증

```sh
npm run verify
python3 tests/hermes-smoke.py
```

첫 명령은 전체 lint/typecheck/test/build를 실행한다.
두 번째는 실제 설치된 Hermes와 로컬 가짜 inference 서버를 연결해
두 모델 간 동일 세션·원문·기억 전달을 검사하는 선택적 통합 테스트다.
외부 유료 모델 성공이나 OAuth 성공을 대신 증명하지 않는다.

개별 설치 경로는 `THINK_ALONG_HERMES_REPO`, `THINK_ALONG_HERMES_PYTHON`,
`THINK_ALONG_HERMES_BIN`으로 지정한다. 원본 저장소 위치는 `THINK_ALONG_HOME`으로 바꿀 수 있다.
Hermes 업데이트 뒤에는 내부 Python 계약 호환성을 이 통합 테스트로 확인해야 한다.

## Loc의 현재 연결 상태

구현 중 기본 선택 `opencode-zen / gemini-3-pro`의 실제 요청은 실패했다.
다른 모델로 자동 전환하지 않았으며 `think-along setup`에서 사용 가능한 공급자·모델을 선택해야 한다.
웹 자동 동기화, npm 공개 배포, 모든 외부 공급자 실계정 인증은 이번 로컬 CLI 설치와 별도다.
