# P1 Loop Report

## P1-1 Context Cache와 버전 무효화

- 변경 내용: 세션·Context 버전·Provider·계정·모델 조합별 캐시를 추가하고 새 버전 생성 시 이전 캐시를 제거했다.
- 테스트 결과: 동일 조합 재사용과 버전 변경 무효화 계약 통과.
- 남은 문제: 단일 프로세스 캐시이며 다중 서버 배포 시 공유 저장소가 필요하다.
- 다음 루프: JSON 내보내기·가져오기.

## P1-2 JSON 내보내기·가져오기

- 변경 내용: Thinking, 메시지, 첨부, 결정, Context Snapshot을 하나의 버전 있는 JSON으로 내보내고 복원한다.
- 테스트 결과: 사용자 소유권 재지정, 세션 ID 보존, 중복 가져오기 차단 계약 통과.
- 남은 문제: 파일 선택 UI 연결.
- 다음 루프: 전달 범위 UI.

## P1-3 모델 전환 전달 범위 UI

- 변경 내용: Thinking 상세 화면에서 다음 응답 모델을 선택하고 전달·제외 항목을 확인할 수 있다.
- 테스트 결과: 선택 Provider가 continue API에 전달되고 production build 통과.
- 남은 문제: 항목별 토글 UI는 Permission 정책 화면과 연결할 수 있다.
- 다음 루프: Permission·Provider Policy.

## P1-4 Permission·Provider Policy

- 변경 내용: 세션별 허용 Provider와 결정·최근 대화 전달 권한을 저장하고 서버에서 강제한다.
- 테스트 결과: 잘못된 정책 입력과 허용되지 않은 Provider 요청을 차단하며 변경 파일 lint 통과.
- 남은 문제: 민감정보 자동 분류는 별도 정책 설계가 필요하다.
- 다음 루프: Context Snapshot·Session Summary.

## P1-5 Context Snapshot·Session Summary

- 변경 내용: 매 성공 요청의 실제 Context Packet과 실행 대상을 Snapshot으로 저장하고 최신 Insight를 세션 요약으로 다음 요청에 전달한다.
- 테스트 결과: 계약 검사 전체와 production build 통과.
- 남은 문제: 장기 세션의 AI 요약·압축 품질 평가는 후속 범위다.
- 다음 루프: P1 전체 사용자 관점 최종 검수.
