# Think Along Product Workspace

This workspace contains the product-oriented Think Along app.

## Architecture Work

This copy is the active development Work for the unified-session architecture.

- Permanent product context: [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)
- P0 architecture and implementation plan: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Read-only source baseline: `/Users/choisunghoon/Documents/Aitime/think-along`
- Active Work: `/Users/choisunghoon/Documents/Aitime/think-along_start`

## Run

```bash
npm install
npm run dev -- --port 3001
```

## Implemented

- Email session authentication with `think_along_session` cookie
- File-backed JSON storage in `data/db.json`
- Thinking create/list/detail/update/delete/continue API routes
- Search, Insight, and Export API routes
- OpenAPI draft in `docs/openapi.yaml`
- SQL schema draft in `database/schema.sql`
- AI provider adapter with real calls when API keys exist and local fallback otherwise

## Optional Environment

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-5-haiku-latest
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
```

The previous Think Along prototype remains untouched in:

- `/Users/choisunghoon/Documents/Codex/2026-07-28/new-chat-2/work/source`
- `/Users/choisunghoon/Documents/Codex/2026-07-28/new-chat-2/outputs/think-along-prototype-snapshot`

## 로컬·서버 동기화와 원격 작업 v0.3

개발 설계와 검증 결과: [TALO_LOCAL_CLOUD_REMOTE_DESIGN_v0.3.md](docs/TALO_LOCAL_CLOUD_REMOTE_DESIGN_v0.3.md).

- 로컬 웹: `npm run web:local` → http://127.0.0.1:3002/projects
- 서버 모드 개발 실행: `npm run web:cloud` → http://127.0.0.1:3003/projects?source=cloud
- 원격 통합 검증 포함: `TALO_REMOTE_E2E=1 npm run verify`
- 서버 모드는 Node 22.13+와 영속 디스크가 필요합니다. 운영 도메인은 별도 배포해야 합니다.
