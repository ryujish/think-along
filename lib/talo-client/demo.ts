import type { Snapshot } from './types';
export const DEMO_DIFF = `--- a/cli/connection.py
+++ b/cli/connection.py
@@ -12,3 +12,5 @@
 def connection_status(client):
-    return "connected"
+    if not client.is_available():
+        return "unavailable"
+    return "response_unverified"
--- a/tests/test_connection.py
+++ b/tests/test_connection.py
@@ -1,2 +1,4 @@
 def test_connection():
-    assert status == "connected"
+    assert status == "response_unverified"
+    assert missing_client.status == "unavailable"
`;
export function demoSnapshot(): Snapshot {
 const at = Date.parse('2026-09-05T09:00:00+09:00') / 1000;
 return {
 project: { id: 'demo', name: 'Talo', path: '예제 / Talo', branch: 'main' }, revision: 'demo-v1', updated_at: at,
 sessions: [{ id: 'demo-session', title: '연결 오류 복구', updated_at: at }],
 runs: [{ id: 'demo-run', session_id: 'demo-session', state: 'completed', mode: 'dev', created_at: at - 86400, updated_at: at - 86400 }],
 messages: [{ id: 'demo-user', session_id: 'demo-session', run_id: 'demo-run', role: 'user', text: '연결 상태를 정확하게 구분하고, 다음 날에도 작업을 이어갈 수 있게 해줘.', created_at: at - 86400 }, { id: 'demo-answer', session_id: 'demo-session', run_id: 'demo-run', role: 'assistant', text: '설치 확인과 실제 응답 확인을 분리하는 변경을 제안했습니다. 적용하기 전에 변경 검토에서 두 파일을 확인하세요. 실제 AI 호출은 아직 검증하지 않았습니다.', created_at: at - 86390 }],
 tasks: [{ id: 'task-a', title: '재현 시나리오로 연결 상태 확인하기', status: 'needs_review' }, { id: 'task-b', title: '제안된 변경 두 파일 검토하기', status: 'blocked' }, { id: 'task-c', title: '실제 AI 계정으로 응답 확인하기', status: 'blocked' }],
 changes: [{ id: 'demo-change', state: 'proposed', patch_hash: 'demo-hash', created_at: at, updated_at: at, manifest: { files: [{ path: 'cli/connection.py' }, { path: 'tests/test_connection.py' }], match_method: 'exact' } }],
 memories: [{ id: 'demo-decision', content: 'AI 모델이 바뀌어도 프로젝트의 결정과 미완료 작업을 유지한다.', status: 'confirmed', version: 1, source_refs: ['demo-user'], created_at: at - 172800, updated_at: at - 172800 }, { id: 'demo-decision-b', content: '파일을 수정하기 전에 변경 내용을 검토한다.', status: 'confirmed', version: 1, source_refs: ['demo-user'], created_at: at - 86400, updated_at: at - 86400 }],
 verifications: [{ id: 'demo-v', result: 'passed', evidence_ref: '예제: 단위 테스트 통과. 이후 제안은 미검증.', created_at: at - 86400 }],
 connections: [{ id: 'demo-model', provider: '예제', model: '예제 AI · 실제 호출 없음', status: 'demo' }],
 };
}
