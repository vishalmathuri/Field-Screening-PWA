import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--inspector-port','0','--port','8791'],{stdio:['ignore','pipe','pipe']});
let started=false,done=false;const timeout=setTimeout(()=>finish(1,'Local server did not start within 45 seconds.'),45000);
function finish(code,message){if(done)return;done=true;clearTimeout(timeout);server.kill('SIGTERM');if(message)console.log(message);process.exitCode=code;}
server.on('error',e=>finish(1,e.message));server.on('exit',code=>{if(!done)finish(code||1,'Local server exited early.');});
const output=async(chunk)=>{const text=chunk.toString();if(text.includes('Ready on')&&!started){started=true;const check=spawn(process.execPath,['test/api-smoke.mjs'],{stdio:'inherit',env:{...process.env,SCREENING_TEST_URL:'http://127.0.0.1:8791'}});check.on('exit',code=>finish(code??1));}};
server.stdout.on('data',output);server.stderr.on('data',output);
