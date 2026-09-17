import type { HomeTodayItem,WeatherLocation,WeatherSnapshot } from '@soren/shared';
import { emptyWeather } from '../weather.js';
import type { RouteHandler } from '../http/index.js';

export function createHomeRoutes({db,events,moments,cyberboss,weatherProvider,memory,codex,homeNote,http}:{db:any;events:any;moments:any;cyberboss:any;weatherProvider:any;memory:any;codex:any;homeNote:any;http:any}):RouteHandler{
  const cache=new Map<string,{expires:number;value:WeatherSnapshot}>();
  const weather=async()=>{const location=db.setting('weatherLocation',null) as WeatherLocation|null;if(!location)return emptyWeather('unconfigured');const key=`${location.latitude},${location.longitude}`,cached=cache.get(key);if(cached&&cached.expires>Date.now())return cached.value;try{const value=await weatherProvider.current(location);cache.set(key,{expires:Date.now()+600000,value});return value;}catch{return emptyWeather('unavailable',location);}};
  const today=():HomeTodayItem[]=>{const items:HomeTodayItem[]=[],conversation=db.conversations()[0],project=db.projectRows()[0];if(conversation)items.push({type:'chat',id:conversation.id,title:conversation.title,detail:'最近的对话',occurredAt:conversation.updatedAt});if(project)items.push({type:'workspace',id:project.id,title:project.name,detail:'最近的 Workspace 项目',occurredAt:project.updated_at});const reminder=(cyberboss.listReminders()||[]).find((item:any)=>!['done','completed','dismissed'].includes(String(item.status||'').toLowerCase()));if(reminder)items.push({type:'reminder',id:String(reminder.id||'reminder'),title:String(reminder.title||reminder.text||'今天的提醒'),detail:String(reminder.detail||reminder.dueAt||reminder.due_at||'Cyberboss 提醒'),occurredAt:String(reminder.updatedAt||reminder.createdAt||new Date().toISOString())});const event=(cyberboss.listTimeline()||[])[0];if(event)items.push({type:'timeline',id:String(event.id||'timeline'),title:String(event.title||'最近的事件'),detail:String(event.detail||''),occurredAt:String(event.createdAt||new Date().toISOString())});return items.sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)).slice(0,4);};
  const probe=async(url:string)=>{try{const response=await fetch(url,{signal:AbortSignal.timeout(1500)});return{configured:true,connected:response.ok};}catch{return{configured:true,connected:false};}};
  return async({req,res,url,path})=>{
    if(req.method==='GET'&&path==='/api/health'){http.json(res,200,{ok:true,name:'soren-core',version:2});return true;}
    if(req.method==='GET'&&path==='/api/bootstrap'){http.json(res,200,{core:{connected:true,version:2},services:{codex:await probe('http://127.0.0.1:8765/readyz'),ombre:await memory.status(),cyberboss:{configured:true,connected:true,mode:'soren-channel'}}});return true;}
    if(req.method==='GET'&&path==='/api/models'){http.json(res,200,{models:await codex.models()});return true;}
    if(req.method==='GET'&&path==='/api/home'){http.json(res,200,{note:db.homeNote()||homeNote,weather:await weather(),today:today(),moments:{unreadCount:moments.social.unreadCount(),available:true}});return true;}
    if(req.method==='PUT'&&path==='/api/home/note'){const input=await http.body(req),content=String(input.content||'').trim();if(!content)http.json(res,400,{message:'Home Note 不能为空'});else{const note=db.setHomeNote(content.slice(0,2000));events.emit({type:'home_note.created',sourceType:'home_note',sourceId:note.id,title:'Soren 留给你',body:note.content});http.json(res,200,{note});}return true;}
    if(req.method==='GET'&&path==='/api/weather/locations'){const query=String(url.searchParams.get('q')||'').trim();if(query.length<2)http.json(res,200,{locations:[]});else try{http.json(res,200,{locations:await weatherProvider.search(query)});}catch{http.json(res,200,{locations:[]});}return true;}
    if(req.method==='GET'&&path==='/api/reminders'){http.json(res,200,{reminders:cyberboss.listReminders()});return true;}
    if(req.method==='POST'&&path==='/api/reminders'){const input=await http.body(req),reminder=cyberboss.createReminder(input),event=events.emit({type:'reminder.created',sourceType:'reminder',sourceId:String(reminder.id||crypto.randomUUID()),title:'提醒已创建',body:String(reminder.text||input.text||''),payload:{important:Boolean(reminder.important),dueAt:reminder.dueAt}});http.json(res,201,{reminder,event});return true;}
    if(req.method==='GET'&&path==='/api/inbox'){http.json(res,200,{messages:cyberboss.listInbox()});return true;}
    if(req.method==='GET'&&path==='/api/timeline'){http.json(res,200,{events:cyberboss.listTimeline()});return true;}
    return false;
  };
}
