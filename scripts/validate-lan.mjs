import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');
const[pkg,env,gitignore,api,chat,pushDelivery,server,lan,lanCli,manifest]=await Promise.all([read('package.json').then(JSON.parse),read('.env.example'),read('.gitignore'),read('apps/web/src/api.ts'),read('apps/web/src/features/chat/ChatView.tsx'),read('apps/core/src/push-delivery-service.ts'),read('apps/core/src/server.ts'),read('apps/core/src/lan.ts'),read('apps/core/src/lan-cli.ts'),read('apps/web/public/manifest.webmanifest').then(JSON.parse)]);
assert.match(env,/SOREN_LAN_MODE=false/);assert.equal(pkg.scripts['lan:setup'].includes('lan-cli.ts setup'),true);assert.equal(pkg.scripts['lan:start'].includes('lan-cli.ts start'),true);assert.equal(pkg.scripts['lan:status'].includes('lan-cli.ts status'),true);
assert.match(lan,/host:'127\.0\.0\.1'/);assert.match(lan,/lanHost:'0\.0\.0\.0'/);assert.match(lan,/SOREN_LAN_MODE 只接受 true 或 false/);assert.match(lan,/certificate\.checkIP/);assert.match(lan,/No authentication is enabled/);assert.match(lanCli,/Authentication: OFF/);assert.match(server,/https\.createServer/);
for(const source of [api,chat])assert.doesNotMatch(source,/https?:\/\/(localhost|127\.0\.0\.1)/);assert.match(api,/fetch\(path/);assert.match(chat,/fetch\(`\/api\/conversations/);assert.match(chat,/consumeSse/);assert.match(pushDelivery,/deepLink:row\.conversation_id\?`\/\?view=chat/);assert.equal(manifest.scope,'/');assert.ok(manifest.start_url.startsWith('/'));
assert.match(gitignore,/\.lan\//);assert.match(gitignore,/\.env/);const dependencies={...pkg.dependencies,...pkg.devDependencies};for(const forbidden of ['ngrok','cloudflared','tailscale'])assert.equal(dependencies[forbidden],undefined);
const tracked=execFileSync('git',['ls-files'],{cwd:new URL('.',root),encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);for(const file of tracked){const text=await read(file).catch(()=> '');assert.doesNotMatch(text,/-----BEGIN (?:RSA )?PRIVATE KEY-----/,`private key found in tracked file ${file}`);}assert.ok(!tracked.some(path=>path.startsWith('.lan/')));
console.log('LAN validation passed: explicit opt-in, localhost default, HTTPS/SAN checks, relative-origin client, no tunnel dependency, and no tracked private keys.');
