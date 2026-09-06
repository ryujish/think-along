"""Development web transport; domain implementation lives in the Talo package."""
import json
import sys
from talo.application.web import handle, projects, snapshot

if __name__ == '__main__':
    try:
        result = handle(json.loads(sys.stdin.readline(1024 * 1024)))
        print(json.dumps({'ok': True, 'result': result}, ensure_ascii=False, default=str))
    except Exception as exc:
        print(json.dumps({'ok': False, 'error': str(exc), 'code': getattr(exc, 'code', 'REQUEST_ERROR')}, ensure_ascii=False))
        sys.exit(1)
