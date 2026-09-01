# 30초 온보딩 · Loop 1

## 목표
첫 방문자가 30초 안에 Think Along의 차별점을 이해하고 자신의 첫 생각을 입력하게 한다.

핵심 메시지: **AI는 바뀌어도, 당신의 생각은 이어집니다.**

## 흐름
1. 0~8초: One memory. Any AI. — 여러 AI보다 Shared Memory가 제품의 중심임을 설명
2. 8~20초: 사용자가 현재 고민/아이디어 한 문장을 직접 입력
3. 20~30초: 그 생각이 다음 AI에서도 이어지는 Memory로 보존된다는 결과를 미리 체험
4. 완료 후 기존 앱으로 이동. 로그인/API Key 요구는 가치 체험 뒤로 미룸

## 구현 원칙
- 첫 방문만 `/start`로 유도 (`proxy.ts`, 완료 쿠키 1년)
- 기존 사용자는 바로 `/` 진입
- 첫 생각은 `think_along_first_thought` localStorage에 보존
- 기존 Home/API 로직은 Loop 1에서 건드리지 않아 회귀 위험 최소화
- 다음 Loop에서 저장된 첫 생각을 실제 Home 입력/Thinking 생성으로 이어 붙임

## 성공 지표
- onboarding_start → thought_input: 55% 이상
- thought_input → onboarding_complete: 80% 이상
- 전체 completion: 45% 이상
- median time-to-value: 30초 이하
- skip rate: 30% 이하

## QA 체크리스트
- [x] 로그인/API Key 없이 가치 체험 가능
- [x] Skip 경로 제공
- [x] 완료/Skip 후 재방문 시 온보딩 반복 안 됨
- [x] 모바일 폭 320px 이상에서 단일 컬럼
- [x] 기존 Theme CSS variable 사용
- [x] Next.js 16 `proxy.ts` 규약 사용
- [ ] Loop 2: 첫 생각을 Home textarea에 자동 복원
- [ ] Loop 2: onboarding 이벤트 analytics 연결
- [ ] Loop 2: 실제 사용자 5명 테스트 후 카피/단계 재조정
