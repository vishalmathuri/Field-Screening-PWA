import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
async function walk(path){const entries=await readdir(path,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?walk(`${path}/${e.name}`):`${path}/${e.name}`))).flat();}
const paths=(await walk('dist/client')).filter(p=>/\.(js|css)$/.test(p)&&!p.endsWith('/sw.js'));
const urls=paths.map(p=>p.slice('dist/client'.length));
const hash=createHash('sha256').update(urls.join('\n')).digest('hex').slice(0,12);
let source=await readFile('public/sw.js','utf8');
source=source.replace('field-screening-shell-v1',`field-screening-shell-${hash}`).replace('/*BUILD_ASSETS*/[]',JSON.stringify(urls));
await writeFile('dist/client/sw.js',source);
console.log(`PWA precache prepared: ${urls.length} bundled assets`);
