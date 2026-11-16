# Studio 개편 배포 — 2026-10-29

- 운영 주소: https://thinkalong.ai.kr/projects
- `/`는 `/projects`로 이동한다.
- `/projects` 기본 화면에 `thinkalong-studio` 개편안을 통합했다.
- 기존 작업은 `/projects?source=cloud`, 기존 대화는 `/legacy`에서 접근한다.
- 새 화면은 예시 응답과 브라우저 저장을 사용하는 체험 화면이다. 기존 AI API와 서버 데이터 연결은 기존 작업 경로에 유지된다.
- 태블릿의 기존 작업 링크 표시와 데스크톱 근거 버튼의 본문 겹침을 수정했다.

## 검증

- 주 작업자 최종 `npm run verify`: exit 0. lint/typecheck/build 통과, 테스트 29 통과·0 실패·1 기존 조건부 E2E 건너뜀.
- agy: 파일 수정 없이 전체 검증 및 반응형 회귀 테스트만 수행, 모두 통과.
- Oracle Linux의 별도 release에서 전체 verify 통과. 마지막 CSS 수정 후 Linux build도 exit 0.
- `node tests/studio-browser.mjs https://thinkalong.ai.kr`: 1440/900/390px에서 본문 겹침, 기존 작업 링크, 가로 넘침 검사 통과.
- 공개 `/projects` HTTP 200, `/` HTTP 307 → `/projects`, 브라우저 콘솔 오류 없음.
- 운영 서비스 active. `/legacy`, `/projects?source=cloud`, 공급자 SVG HTTP 검사 통과.
- 전환 직전/직후 DB SHA-256 일치, 운영 경로에서 DB 접근 확인.

## 운영 경로와 복구

- 실행 폴더: `/home/opc/thingalong` (실제 디렉터리)
- 이전 빌드: `/home/opc/thingalong-before-studio-20261029-0055`
- **현재 데이터 원본**: `/home/opc/thingalong-before-studio-20261029-0055/data`
- 실행 폴더의 `data`가 위 데이터 원본을 참조한다. 이전 빌드 폴더를 삭제하면 현재 데이터가 손실되므로 보존해야 한다.
- 최초 심볼릭 링크 방식의 실행 경로는 systemd CHDIR 권한 검사에 실패해 자동 복구됐다. 실제 디렉터리를 교체하는 방식으로 재전환했으며, 보안 설정과 Nginx 설정은 변경하지 않았다.

이전 버전 복구 명령(현재 빌드도 보존):

```bash
sudo systemctl stop thingalong
mv /home/opc/thingalong /home/opc/thingalong-releases/studio-20261029-0055
mv /home/opc/thingalong-before-studio-20261029-0055 /home/opc/thingalong
sudo systemctl start thingalong
```
