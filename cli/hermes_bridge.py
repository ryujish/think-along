#!/usr/bin/env python3
"""Version-scoped adapter for installed Hermes. JSON stdin/stdout; no credentials exported."""
import contextlib
import json
import logging
import os
from pathlib import Path
import sys

repo = Path(os.environ.get("THINK_ALONG_HERMES_REPO", Path.home() / ".hermes/hermes-agent"))
sys.path.insert(0, str(repo))

def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)

def config_selection(cfg):
    model = cfg.get("model") or {}
    if isinstance(model, str):
        return {"provider": "", "model": model}
    default = model.get("default") or model.get("model") or ""
    if isinstance(default, dict):
        from hermes_cli.config import split_model_config_default
        default, _ = split_model_config_default(default)
    return {"provider": str(model.get("provider") or ""), "model": str(default)}

def main(request):
    from hermes_cli.env_loader import load_hermes_dotenv
    load_hermes_dotenv()
    # Never inherit bypass flags from an enclosing automation shell.
    os.environ.pop("HERMES_YOLO_MODE", None)
    os.environ.pop("HERMES_ACCEPT_HOOKS", None)
    from hermes_cli.config import load_config
    cfg = load_config()
    if request["action"] == "info":
        return {"ok": True, "selection": config_selection(cfg), "hermesRepo": str(repo),
                "automaticFallback": False, "webSync": False}
    from hermes_cli.runtime_provider import resolve_runtime_provider
    from run_agent import AIAgent
    from gateway.session_context import declare_stateless_channel
    from hermes_cli.tools_config import _get_platform_tools
    from hermes_cli.mcp_startup import ensure_mcp_discovery_before_agent_build
    from hermes_cli.oneshot import _build_preloaded_skills_prompt
    from hermes_state import SessionDB

    selection = request["selection"]
    provider, model = selection["provider"], selection["model"]
    if not provider or provider == "auto" or not model:
        raise ValueError("explicit_selection_required")
    runtime = resolve_runtime_provider(requested=provider, target_model=model)
    if request.get("action") == "probe":
        return {"ok": True, "provider": provider, "model": model,
                "runtimeProvider": runtime.get("provider"), "credentialsResolved": bool(runtime.get("api_key")),
                "automaticFallback": False}

    declare_stateless_channel()
    ensure_mcp_discovery_before_agent_build(logger=logging.getLogger(__name__), single_query=True)
    packet = request["packet"]
    session_db = SessionDB()
    agent = None
    try:
        agent = AIAgent(
            api_key=runtime.get("api_key"), base_url=runtime.get("base_url"),
            provider=runtime.get("provider"), requested_provider=runtime.get("requested_provider"),
            api_mode=runtime.get("api_mode"), model=model,
            enabled_toolsets=sorted(_get_platform_tools(cfg, "cli")),
            disabled_toolsets=["delegation"],
            fallback_model=[], credential_pool=None,
            quiet_mode=True, platform="cli", session_db=session_db,
            skip_background_review=True, max_iterations=30, run_budget_seconds=180,
            ephemeral_system_prompt=_build_preloaded_skills_prompt(request.get("skills")),
            clarify_callback=lambda *_args, **_kwargs: "사용자에게 확인이 필요합니다. 추측해 실행하지 말고 최종 응답으로 질문하세요.",
        )
        # Think Along already owns titles; pre-name the derived Hermes session
        # so the native auto-titler does not make an auxiliary model call.
        session_db.set_session_title(agent.session_id, "Think Along " + str(agent.session_id))
        agent.suppress_status_output = True
        result = agent.run_conversation(
            packet["messages"][-1]["content"],
            system_message=packet["system"],
            conversation_history=packet["messages"][:-1],
        )
        if result.get("failed") or result.get("partial"):
            return {"ok": False, "error": "Hermes 실행이 실패하거나 미완료 상태입니다. think-along auth 또는 model로 연결을 확인하세요. 자동 전환하지 않았습니다."}
        if getattr(agent, "model", model) != model:
            return {"ok": False, "error": "Hermes 모델이 선택과 달라 응답을 거부했습니다."}
        return {"ok": True, "text": result.get("final_response") or "", "provider": provider, "model": model}
    finally:
        if agent is not None:
            try:
                agent.shutdown_memory_provider(getattr(agent, "_session_messages", None))
            finally:
                agent.close()
        session_db.close()

if __name__ == "__main__":
    try:
        request = json.load(sys.stdin)
        # Dependencies may log HTTP headers or model output. Keep protocol and credentials isolated.
        with open(os.devnull, "w") as sink, contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
            response = main(request)
        emit(response)
        sys.exit(0 if response.get("ok") else 1)
    except Exception as exc:
        # Never forward provider exception text: some SDK errors contain credentials/URLs.
        emit({"ok": False, "error": "Hermes 연결 실패 (" + type(exc).__name__ + "). think-along setup 또는 auth에서 공급자/모델 인증을 확인하세요."})
        sys.exit(1)
