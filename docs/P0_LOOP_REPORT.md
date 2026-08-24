# P0 Loop Report

## P0-1 Core/UI 경계

- 변경 내용: Think Along 소유 세션과 Provider 실행 정보의 경계를 문서·화면 흐름에 고정했다.
- 테스트 결과: 프로젝트 홈 → Think → 모델 전환 확인 흐름을 프로토타입으로 검증했다.
- 남은 문제: 실제 제품 UI와 API 연결.
- 다음 루프: Provider → Account → Model.

## P0-2 Provider → Account → Model

- 변경 내용: Provider 카탈로그, 연결 계정, 모델 capability 계약과 기존 API 호환 응답을 추가했다.
- 테스트 결과: 저장소 보정 계약, lint, build 통과.
- 남은 문제: 실시간 모델 목록·OAuth는 제외.
- 다음 루프: Canonical Context 저장.

## P0-3 Canonical Context 저장

- 변경 내용: Thinking·메시지·첨부를 `thinkalongSessionId`에 귀속하고 구버전 JSON을 보정했다.
- 테스트 결과: 생성·조회·이어서 대화의 동일 세션 계약, lint, build 통과.
- 남은 문제: 현재는 기존 ID와 session ID가 1:1인 호환 단계.
- 다음 루프: Context Packet.

## P0-4 Context Packet

- 변경 내용: Provider 중립 system/context/messages 패킷과 버전을 생성한다.
- 테스트 결과: 최근 메시지 범위·순서·세션 격리 계약, lint, build 통과.
- 남은 문제: 고정 20개 메시지 제한은 P1에서 token 기반 압축으로 전환.
- 다음 루프: 수동 모델·계정 전환.

## P0-5 수동 모델·계정 전환

- 변경 내용: Provider·계정·모델 선택을 한 묶음으로 세션에 저장하고 요청마다 명시 선택만 실행한다.
- 테스트 결과: 선택 저장·구버전 보정·불완전 선택 차단, lint, build 통과.
- 남은 문제: 자동 전환은 의도적으로 제외.
- 다음 루프: 전환 후 세션 연속성.

## P0-6 전환 후 세션 연속성

- 변경 내용: 전환 전후 메시지에 실행 Provider·계정·모델·Context 버전·성공 상태를 기록한다.
- 테스트 결과: A·B(GPT) → C(다른 모델)가 동일 세션과 순서를 유지하고 다른 세션은 제외됨을 검증했다.
- 남은 문제: 실패 실행 상세 이력은 후속 범위.
- 다음 루프: Decision Memory.

## P0-7 Decision Memory와 supersede

- 변경 내용: 검토/확정 결정 저장, 출처 메시지, 대체 전후 관계, 최신 확정 결정의 Context 전달을 구현했다.
- 테스트 결과: 이전 결정 보존, `superseded` 전환, 최신 결정만 Context에 포함되는 계약을 통과했다.
- 남은 문제: Decision UI 연결과 Shared Memory 확장.
- 다음 루프: P0 전체 사용자 관점 최종 검수.
