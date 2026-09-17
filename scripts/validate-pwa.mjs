import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest=JSON.parse(await readFile(new URL('../apps/web/public/manifest.webmanifest',import.meta.url),'utf8'));
const sw=await readFile(new URL('../apps/web/public/sw.js',import.meta.url),'utf8');
const main=await readFile(new URL('../apps/web/src/main.tsx',import.meta.url),'utf8');
const push=await readFile(new URL('../apps/web/src/push-client.ts',import.meta.url),'utf8');
const pushFlow=await readFile(new URL('../apps/web/src/push-flow.ts',import.meta.url),'utf8');
const mobile=await readFile(new URL('../apps/web/src/mobile.css',import.meta.url),'utf8');
assert.equal(manifest.name,'SorenOS');assert.equal(manifest.short_name,'Soren');assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');assert.ok(manifest.start_url.startsWith('/'));assert.ok(manifest.icons.length);
assert.match(main,/registerServiceWorker/);assert.match(push,/Notification\.requestPermission\(\)/);assert.match(push,/currentNotificationPermission\(\)==='denied'/);assert.match(push,/PushManager/);assert.match(push,/navigator\.serviceWorker\.ready/);assert.match(pushFlow,/push_subscription_created/);assert.match(pushFlow,/subscription_post_success/);assert.match(mobile,/push-device button\.primary\.push-connect-button/);
assert.match(sw,/pathname\.startsWith\('\/api\/'\)/);assert.match(sw,/notificationclick/);assert.match(sw,/clients\.matchAll/);assert.match(sw,/safePayload/);assert.match(sw,/setAppBadge/);assert.match(sw,/caches\.match\('\/'\)/);
for(const width of [320,375,390,430])assert.ok(width<=700&&mobile.includes('@media (max-width:700px)'));
console.log('PWA validation passed: manifest, registration, safe push handling, deep links, offline shell, badge fallback, and mobile breakpoints.');
