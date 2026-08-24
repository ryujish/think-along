# Think Along — MVP Information Architecture

## 1. 사용자 중심 구조

```text
Projects
├── Project Home
│   ├── 최근 세션
│   ├── 현재 상태와 미해결 항목
│   └── 새 Thinking 시작
├── Think
│   ├── 대화
│   ├── Provider / Account / Model 선택
│   ├── Memory 저장
│   ├── Decision 저장
│   └── Context 전달 확인
├── Journey
│   ├── 대화·기억·결정 타임라인
│   └── 모델·계정 전환 이력
├── Decisions
│   ├── 확정
│   ├── 검토 중
│   ├── 폐기
│   └── 대체됨(superseded)
├── Evidence
│   └── 결정·기억의 원문과 출처
├── Insight
│   ├── 반복 주제와 변화
│   ├── 결정 충돌
│   └── 미결정 사항
└── Profile
    ├── Provider Accounts
    ├── API Key / Connection
    ├── Memory 관리
    └── Export / Import
```

MVP의 전역 내비게이션은 `Projects / Think / Journey / Insight / Profile`로 두고, Decisions와 Evidence는 프로젝트 내부에서 Think·Journey·Insight가 공통으로 연결하는 상세 영역으로 둔다. Decision을 전역 탭으로 승격할지는 사용성 검증 후 결정한다.

## 2. 대표 흐름

```text
Projects
→ Project Home
→ 새 Thinking
→ Think 대화
→ Memory 또는 Decision 저장
→ 모델 선택 열기
→ Provider / Account / Model 선택
→ 전달·제외 Context 확인
→ 사용자 전환 승인
→ 같은 세션에서 대화 계속
→ Journey에서 변화 확인
→ Decision / Evidence 확인
→ Insight에서 패턴·충돌·미결정 확인
```

## 3. 첫 화면 묶음

### Project Home

사용자가 답해야 하는 질문:

- 지금 어떤 프로젝트를 이어가고 있는가?
- 마지막으로 무엇을 결정했고 무엇이 미해결인가?
- 기존 세션을 이어갈지 새 Thinking을 시작할지?

주요 행동: `이어서 생각하기`, `새 Thinking`.

### Think

상단에는 프로젝트와 세션 정체성을, 모델 정보는 그보다 작은 실행 상태로 표시한다. 대화 중 각 응답에서 `기억으로 저장`, `결정으로 저장`, `근거 보기`에 접근할 수 있어야 한다.

주요 행동: 메시지 전송. 보조 행동: 기억·결정 저장, 모델 변경.

### 모델 전환 및 Context 확인

한 화면 또는 단계형 sheet에서 다음을 확인한다.

1. 현재 Provider·Account·Model
2. 새 Provider·Account·Model
3. 전달: 프로젝트 목표, 확정 결정, 검토 중 의견, 사용자 선호, 현재 상태, 최근 대화
4. 제외: 민감정보, 비공개 파일 등
5. 전환 후에도 유지되는 프로젝트·세션

주요 행동: `이 Context로 전환`. 취소하면 기존 선택을 유지한다.

## 4. 핵심 상태

| 화면 | 상태 |
|---|---|
| Project Home | 첫 프로젝트 없음, 프로젝트 있음, 최근 작업 없음, 미해결 항목 있음 |
| Think | 빈 대화, 응답 생성 중, 응답 완료, Provider 오류, 한도 초과 |
| Memory/Decision 저장 | 미선택, 검토 중, 확정, 저장 완료, 중복·충돌 |
| 모델 전환 | 선택 전, Context 검토, 전환 중, 성공, 실패, 취소 |
| Journey | 기록 없음, 타임라인 있음, 필터 결과 없음 |
| Insight | 데이터 부족, 분석 가능, 충돌 있음, 미결정 있음 |
| Profile | 연결 없음, 연결됨, 인증 오류, 모델 사용 불가 |

한도 초과 상태는 자동 전환하지 않는다. `다른 모델 선택`, `나중에 다시 시도`, `현재 내용 저장`을 제공한다.

## 5. UI와 Core의 경계

| UI 책임 | Core 책임 |
|---|---|
| Provider·Account·Model 선택 입력 | 선택 상태 영속화와 접근 권한 검증 |
| 전달 Context 범위 표시·승인 | Canonical Context 조회와 Context Packet 생성 |
| Memory·Decision 저장 의도 입력 | 상태·출처·supersede 이력 저장 |
| 모델 전환 진행·오류 표시 | Adapter 실행과 오류 정규화 |
| Journey·Insight 표현 | 원문·기억·결정·실행 메타데이터 제공 |

UI는 Context를 직접 조립하거나 Provider thread ID를 저장하지 않는다. Core는 사용자 승인 없이 모델·계정을 바꾸지 않는다.
