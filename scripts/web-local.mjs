import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', process.env.TALO_WEB_PORT || '3002'], { stdio: 'inherit', env: { ...process.env, TALO_WEB_LOCAL: '1', API_PROXY_ORIGIN: '', NEXT_DIST_DIR: '.next-talo-web' } });
child.on('exit', code => process.exit(code || 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
