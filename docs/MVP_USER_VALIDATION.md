# MVP 사용자 검증 — 2026-08-23

## 전체 판정

핵심 탐색 흐름은 통과했다. 프로젝트 홈에서 새 Thinking, AI 연결, Journey, Insight, Profile로 이동할 수 있으며, 이어서 생각하기의 프로젝트 문맥 불일치도 수정했다.

## 검증 단계

1. **프로젝트 홈 — 정상**
   - 현재 프로젝트, 마지막 결정, 다음 과제, 모델 상태, 최근 대화가 한 화면에서 구분된다.
   - 증거: `docs/audits/mvp-validation-01-home.png`
2. **새 Thinking — 정상(연결 전 상태)**
   - API Key가 없을 때 전송이 비활성화되고 등록 경로가 바로 보인다.
   - 증거: `docs/audits/mvp-validation-02-new-thinking.png`
3. **AI 연결 — 정상(실제 Key 테스트 제외)**
   - Provider, 계정명, 공식 발급 페이지, 모델, 저장 범위를 확인할 수 있다.
   - 증거: `docs/audits/mvp-validation-03-api-setup.png`
4. **Journey — 정상(빈 상태)**
   - 기록이 없을 때 이유와 시작 행동이 명확하다.
   - 증거: `docs/audits/mvp-validation-04-journey.png`
5. **Insight — 정상(임계값 미달 상태)**
   - 5개 이상 Thinking이 필요하다는 생성 조건과 예정 결과가 보인다.
   - 증거: `docs/audits/mvp-validation-05-insight.png`
6. **이어서 생각하기 — 수정 후 정상**
   - 홈의 마케팅 전략이 상세 화면에서도 같은 목표, 과제, 답변, Insight로 이어진다.
   - 증거: `docs/audits/mvp-validation-06-continuity-fixed.png`

## 변경 내용

- 마케팅 전략 홈에서 무관한 B2B 메모 앱 예시로 이동하던 문맥 불일치를 제거했다.
- 공통 뒤로가기, 화면 모드 전환, 프로필, Thinking 메뉴, 캘린더 아이콘 버튼에 접근성 이름을 추가했다.

## 접근성 확인

- 핵심 버튼의 이름과 주요 heading 구조를 브라우저 접근성 트리에서 확인했다.
- 색 대비, 화면 확대, 키보드 전체 순서, VoiceOver 실기기 사용성은 자동 화면 검사만으로 준수 판정을 내리지 않았다.

## 테스트 결과

- P0~P3 계약 검사 전체 통과
- `app/page.tsx` lint 오류 없음(기존 미사용 인자 경고 1건 유지)
- production build 및 TypeScript 검사 통과

## 남은 문제

- 실제 OpenAI·Anthropic·Gemini API Key를 사용한 종단 간 호출
- 브라우저 로컬 API Key를 서버 credential vault로 이전
- 배포 환경, 모니터링, 백업·복구, rate limit
- 실사용자와 VoiceOver/키보드 기반 사용성 검사

