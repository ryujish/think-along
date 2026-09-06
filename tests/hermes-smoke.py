"""Opt-in integration smoke: real Hermes, isolated config and local fake inference."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

requests = []
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass
    def do_POST(self):
        payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if not payload.get("model"):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"{}")
            return
        requests.append(payload)
        content = "첫 응답" if payload.get("model") == "ta-smoke-a" else "기억 유지 성공"
        self.send_response(200)
        if payload.get("stream"):
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            for delta, finish in [({"role": "assistant", "content": content}, None), ({}, "stop")]:
                chunk = {"id": "test", "object": "chat.completion.chunk", "model": payload["model"], "choices": [{"index": 0, "delta": delta, "finish_reason": finish}]}
                self.wfile.write(("data: " + json.dumps(chunk) + "\n\n").encode())
            self.wfile.write(b"data: [DONE]\n\n")
        else:
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"id": "test", "object": "chat.completion", "model": payload["model"], "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 10, "completion_tokens": 3, "total_tokens": 13}}).encode())
        self.wfile.flush()

if __name__ == "__main__":
    source = Path(__file__).resolve().parents[1]
    repo = Path(os.environ.get("THINK_ALONG_HERMES_REPO", Path.home() / ".hermes/hermes-agent"))
    node = os.environ.get("THINK_ALONG_NODE", "node")
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with tempfile.TemporaryDirectory(prefix="thinkalong-hermes-smoke-") as temp:
            root = Path(temp)
            hermes_home = root / "hermes"
            hermes_home.mkdir()
            (hermes_home / "config.yaml").write_text(json.dumps({
                "model": {"provider": "custom", "default": "ta-smoke-a", "base_url": f"http://127.0.0.1:{server.server_port}/v1", "api_key": "local-test-only"},
                "toolsets": [],
                "mcp_servers": {},
            }))
            env = {**os.environ, "HERMES_HOME": str(hermes_home), "THINK_ALONG_HOME": str(root / "state"), "THINK_ALONG_HERMES_REPO": str(repo), "PYTHONDONTWRITEBYTECODE": "1"}
            def cli(*args):
                p = subprocess.run([node, "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", str(source / "cli/think-along.mjs"), *args], cwd=root, env=env, capture_output=True, text=True, timeout=120)
                if p.returncode:
                    raise AssertionError("CLI failed: " + p.stdout + p.stderr[-500:])
                return p.stdout
            cli("model", "use", "custom", "ta-smoke-a")
            cli("memory", "add", "프로젝트 확인 단어: 청록")
            first = json.loads(cli("run", "첫 질문", "--json"))
            cli("model", "use", "custom", "ta-smoke-b")
            second = json.loads(cli("run", "이전 질문을 이어서 답해", "--json"))
            assert first["ok"] and second["ok"]
            assert first["thinkalong_session_id"] == second["thinkalong_session_id"]
            second_request = next(r for r in requests if r.get("model") == "ta-smoke-b" and "You name chat sessions" not in json.dumps(r))
            text = json.dumps(second_request["messages"], ensure_ascii=False)
            assert "첫 질문" in text and "첫 응답" in text and "청록" in text, json.dumps({"first": first, "second": second, "contents": [{"role": m["role"], "content": str(m.get("content"))[-1600:]} for m in second_request["messages"]]}, ensure_ascii=False)
            assert len(requests) == 2, f"unexpected extra model calls: {len(requests)}"
            print("PASS: real Hermes -> local inference; two models; same session; original history and project memory; exactly two calls")
    finally:
        server.shutdown()
        server.server_close()
