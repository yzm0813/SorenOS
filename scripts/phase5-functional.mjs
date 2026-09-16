import assert from 'node:assert/strict';

const base=process.env.SOREN_TEST_URL||'http://127.0.0.1:8790';
async function request(path,method='GET',input){const response=await fetch(`${base}${path}`,{method,headers:{'Content-Type':'application/json'},body:input===undefined?undefined:JSON.stringify(input)});const payload=await response.json();if(!response.ok)throw new Error(`${method} ${path}: ${payload.message||response.status}`);return payload;}

const initial=await request('/api/cyberdaddy');
assert.equal(initial.enabled,false);
assert.equal(initial.domains.length,6);

await request('/api/cyberdaddy','PATCH',{enabled:true,quietStart:'00:00',quietEnd:'00:00'});
await request('/api/cyberdaddy/domains/study','PATCH',{enabled:true,intensity:'daddy'});
const created=await request('/api/commitments','POST',{domainId:'study',description:'完成 Phase 5 真实测试',targetAt:new Date(Date.now()-60_000).toISOString()});
await request('/api/cyberdaddy/pulse','POST',{});
let state=await request('/api/cyberdaddy');
assert.equal(state.followUps.length,1);
assert.equal(state.followUps[0].action,'REMIND');
assert.equal(state.commitments.find(item=>item.id===created.commitment.id).followUpCount,1);

const conversations=await request('/api/conversations');
assert.equal(conversations.conversations.length,1);
const chat=await request(`/api/conversations/${conversations.conversations[0].id}`);
assert.equal(chat.messages.length,1);
assert.equal(chat.messages[0].role,'assistant');
assert.match(chat.messages[0].content,/Phase 5 真实测试/);

await request('/api/cyberdaddy/pulse','POST',{});
state=await request('/api/cyberdaddy');
assert.equal(state.followUps.length,1,'an immediate second pulse must not duplicate delivery');

await request('/api/commitments','POST',{domainId:'fitness',description:'未授权领域不能提醒',targetAt:new Date(Date.now()-60_000).toISOString()});
await request('/api/cyberdaddy/pulse','POST',{});
state=await request('/api/cyberdaddy');
assert.equal(state.followUps.length,1,'a disabled domain must remain silent');

await request('/api/cyberdaddy','PATCH',{paused:true});
await request('/api/cyberdaddy/domains/career','PATCH',{enabled:true,intensity:'normal'});
await request('/api/commitments','POST',{domainId:'career',description:'暂停时不能提醒',targetAt:new Date(Date.now()-60_000).toISOString()});
await request('/api/cyberdaddy/pulse','POST',{});
state=await request('/api/cyberdaddy');
assert.equal(state.followUps.length,1);
assert.match(state.lastOutcome,/暂停/);

await request('/api/cyberdaddy','PATCH',{paused:false,quietStart:'00:00',quietEnd:'23:59'});
await request('/api/cyberdaddy/pulse','POST',{});
state=await request('/api/cyberdaddy');
assert.equal(state.followUps.length,1);
assert.match(state.lastOutcome,/安静时间/);

await request(`/api/commitments/${created.commitment.id}`,'PATCH',{status:'completed'});
state=await request('/api/cyberdaddy');
assert.equal(state.commitments.find(item=>item.id===created.commitment.id).status,'completed');

console.log(JSON.stringify({passed:true,domains:state.domains.length,followUps:state.followUps.length,chatMessages:chat.messages.length,checks:['persistence API','Soren Chat delivery','dedupe','disabled domain','pause','quiet hours','completion']},null,2));
