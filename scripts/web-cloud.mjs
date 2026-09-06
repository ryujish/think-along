import { spawn } from 'node:child_process';
const port=process.env.TALO_WEB_PORT||'3003';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',port],{stdio:'inherit',env:{...process.env,TALO_CLOUD_ENABLED:'1',TALO_CLOUD_ORIGIN:`http://127.0.0.1:${port}`,NEXT_DIST_DIR:'.next-talo-cloud',API_PROXY_ORIGIN:''}});
child.on('exit',code=>process.exit(code||0));
process.on('SIGINT',()=>child.kill('SIGINT'));
process.on('SIGTERM',()=>child.kill('SIGTERM'));
