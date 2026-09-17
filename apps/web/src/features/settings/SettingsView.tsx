import { useEffect, useState } from 'react';
import { MapPin, Save, Search } from 'lucide-react';
import type { DomainEvent, NotificationRecord, WeatherLocation } from '@soren/shared';
import { api } from '../../api';
import { currentNotificationPermission, pushStatus, sendTestPush, subscribeThisDevice, unsubscribeThisDevice, type PushProgress, type PushUiStatus } from '../../push-client';

type Diagnostics={events:DomainEvent[];notifications:NotificationRecord[]};
const stageLabels:Record<string,string>={permission_request:'请求通知权限',permission_granted:'通知权限已允许',service_worker_ready:'等待 Service Worker',push_subscription_created:'创建浏览器推送订阅',subscription_post_started:'保存订阅到 Soren Core',subscription_post_success:'设备连接完成'};
const stageLabel=(stage?:string)=>stageLabels[stage||'']||'连接此设备';

export function SettingsView(){
  const[settings,setSettings]=useState<Record<string,any>>({});
  const[persona,setPersona]=useState<Record<string,string>>({});
  const[mcp,setMcp]=useState<any>({servers:[],permissions:[]});
  const[diagnostics,setDiagnostics]=useState<Diagnostics>({events:[],notifications:[]});
  const[network,setNetwork]=useState<{lanMode:boolean;secure:boolean;authentication:boolean;phoneUrl:string|null}|null>(null);
  const[chatRuntime,setChatRuntime]=useState<{connected:boolean;managed:boolean;message:string}|null>(null);
  const[push,setPush]=useState<PushUiStatus|null>(null),[pushBusy,setPushBusy]=useState(false),[pushError,setPushError]=useState(''),[pushProgress,setPushProgress]=useState<PushProgress|null>(null);
  const[activePersona,setActivePersona]=useState('SOREN_CORE.md'),[saved,setSaved]=useState(false);
  const[locationQuery,setLocationQuery]=useState(''),[locations,setLocations]=useState<WeatherLocation[]>([]),[searching,setSearching]=useState(false);

  useEffect(()=>{
    api<any>('/api/settings').then(data=>{setSettings(data.settings);setPersona(data.persona);if(data.settings.weatherLocation)setLocationQuery(data.settings.weatherLocation.name)});
    api<any>('/api/mcp').then(setMcp).catch(()=>{});
    api<any>('/api/bootstrap').then(data=>{setNetwork(data.network);setChatRuntime(data.services?.chatRuntime||null);}).catch(()=>{});
    pushStatus().then(setPush).catch(error=>setPushError(error.message));
    Promise.all([api<{events:DomainEvent[]}>('/api/events?limit=8'),api<{notifications:NotificationRecord[]}>('/api/notifications?limit=8')]).then(([eventData,notificationData])=>setDiagnostics({events:eventData.events,notifications:notificationData.notifications})).catch(()=>{});
  },[]);

  const save=async()=>{await api('/api/settings',{method:'PUT',body:JSON.stringify({settings})});setSaved(true);setTimeout(()=>setSaved(false),1800);};
  const enablePush=async()=>{setPushBusy(true);setPushError('');setPushProgress(null);try{const next={...settings,systemNotificationsEnabled:true};await api('/api/settings',{method:'PUT',body:JSON.stringify({settings:next})});setSettings(next);setPush(await subscribeThisDevice('此设备',progress=>{setPushProgress(progress);if(progress.permission)setPush(previous=>previous?{...previous,permission:progress.permission!}:previous);}));}catch(error:any){const permission=currentNotificationPermission();setPush(previous=>previous?{...previous,permission}:previous);setPushError(`${stageLabel(error.stage||pushProgress?.stage)}：${error.message||'连接失败'}`);void pushStatus().then(setPush).catch(()=>{});}finally{setPushBusy(false);}};
  const disablePush=async()=>{setPushBusy(true);setPushError('');try{setPush(await unsubscribeThisDevice());}catch(error:any){setPushError(error.message||'断开失败');}finally{setPushBusy(false);}};
  const testPush=async()=>{setPushBusy(true);setPushError('');try{await sendTestPush();}catch(error:any){setPushError(error.message||'测试失败');}finally{setPushBusy(false);}};
  const findLocations=async()=>{if(locationQuery.trim().length<2)return;setSearching(true);try{setLocations((await api<{locations:WeatherLocation[]}>(`/api/weather/locations?q=${encodeURIComponent(locationQuery)}`)).locations);}finally{setSearching(false);}};
  const selected=settings.weatherLocation as WeatherLocation|undefined;

  return <section className="surface settings">
    <div className="surface-head"><div><h1>Settings</h1><p>模型、人格、记忆与工具权限。</p></div><button className="primary" onClick={save}><Save size={16}/>{saved?'已保存':'保存设置'}</button></div>
    <div className="settings-grid">
      <article className="panel">
        <h2>Home 天气</h2><p className="setting-help">选择 Home 固定显示的城市，不读取设备定位。</p>
        <div className="location-search"><MapPin size={16}/><input value={locationQuery} onChange={event=>setLocationQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')findLocations();}} placeholder="输入城市，例如：上海"/><button onClick={findLocations} disabled={searching}><Search size={15}/>{searching?'搜索中':'搜索'}</button></div>
        {selected&&<div className="selected-location">当前：{[selected.name,selected.admin1,selected.country].filter(Boolean).join(' · ')}</div>}
        {locations.length>0&&<div className="location-results">{locations.map(location=><button key={`${location.latitude}-${location.longitude}`} className={selected?.latitude===location.latitude&&selected?.longitude===location.longitude?'active':''} onClick={()=>{setSettings({...settings,weatherLocation:location});setLocationQuery(location.name);setLocations([]);}}><strong>{location.name}</strong><span>{[location.admin1,location.country].filter(Boolean).join(' · ')}</span></button>)}</div>}

        <h2>主动功能</h2>
        <label className="toggle-row"><span><strong>全部暂停</strong><small>暂停主动消息与定时触发</small></span><input type="checkbox" checked={Boolean(settings.proactivePaused)} onChange={event=>setSettings({...settings,proactivePaused:event.target.checked})}/></label>
        <label className="toggle-row"><span><strong>朋友圈生活</strong><small>有公开表达动机时，Soren 和固定好友可以自然更新</small></span><input type="checkbox" checked={settings.momentsLifeEnabled!==false} onChange={event=>setSettings({...settings,momentsLifeEnabled:event.target.checked})}/></label>

        <h2>通知</h2>
        <label className="toggle-row"><span><strong>系统通知</strong><small>只用于主动 Chat 和重要提醒；Home 与朋友圈不会弹出</small></span><input type="checkbox" checked={Boolean(settings.systemNotificationsEnabled)} onChange={event=>setSettings({...settings,systemNotificationsEnabled:event.target.checked})}/></label>
        <div className="push-device"><strong>{push?.subscribed?'这台设备已连接':'这台设备未连接'}</strong><small>{!push?.browserSupported?'当前浏览器不支持 Web Push':push.permission==='denied'?'浏览器已拒绝通知，请在站点设置中重新允许':!push.serverConfigured?'Soren Core 尚未配置推送密钥':`浏览器权限：${push.permission==='granted'?'已允许':'尚未询问'} · 已连接 ${push.activeDevices} 台设备`}</small><div>{push?.subscribed?<><button onClick={testPush} disabled={pushBusy||!settings.systemNotificationsEnabled}>发送测试通知</button><button onClick={disablePush} disabled={pushBusy}>断开此设备</button></>:<button className="primary push-connect-button" onClick={enablePush} disabled={pushBusy||!push?.browserSupported||!push?.serverConfigured||push?.permission==='denied'}>{pushBusy?'正在连接':'连接此设备'}</button>}</div>{pushProgress&&<p className={`push-progress ${pushProgress.status}`}>{stageLabel(pushProgress.stage)} · {pushProgress.status==='failed'?'失败':pushProgress.status==='success'?'完成':'进行中'}</p>}{pushError&&<p className="setting-error">{pushError}</p>}<p className="setting-help">推送依赖运行中的 Soren Core；只有点击“连接此设备”才会请求浏览器权限。</p></div>

        <h2>Persona</h2>
        <div className="persona-tabs">{Object.keys(persona).map(name=><button className={activePersona===name?'active':''} onClick={()=>setActivePersona(name)} key={name}>{name.replace('.md','')}</button>)}</div>
        <textarea className="persona-editor" value={persona[activePersona]||''} readOnly aria-label="只读 Persona"/>
        <p className="setting-help">正式 Core 是版本化身份文件，只随 SorenOS 发布更新；Settings 仅供查看。</p>
      </article>

      <article className="panel">
        <h2>连接状态</h2>
        <div className="connection-diagnostics"><div><strong>Core</strong><span>Online</span></div><div><strong>Chat Runtime</strong><span>{chatRuntime?.connected?'Online':'Offline'}</span></div><div><strong>Connection</strong><span>{network?.lanMode?'LAN Test Mode':'Localhost'}</span></div><div><strong>HTTPS</strong><span>{window.isSecureContext?'Secure':'Not secure'}</span></div><div><strong>Authentication</strong><span>{network?.lanMode?'OFF':'Local only'}</span></div><div><strong>Push</strong><span>{push?.browserSupported?'Supported':'Unsupported'}</span></div><div><strong>Permission</strong><span>{currentNotificationPermission()}</span></div></div>
        {network?.lanMode&&<p className="lan-warning">只可在可信私人 Wi-Fi 使用。当前没有登录或设备认证，禁止用于公共、公司、学校、酒店或访客网络。</p>}
        <h2>MCP Connections</h2>
        {mcp.servers?.map((server:any)=><div className="mcp-server" key={server.id}><div><strong>{server.name}</strong><span className={server.status?.connected?'connected':''}>{server.status?.connected?'已连接':'暂不可达'}</span></div>{(server.tools||[]).map((tool:any)=>{const current=mcp.permissions?.find((permission:any)=>permission.server===server.id&&permission.tool===tool.name);return <label key={tool.name}><span>{tool.name}<small>{tool.description}</small></span><select value={current?.permission||'ask_each_time'} onChange={async event=>{const permission={server:server.id,tool:tool.name,permission:event.target.value,risk:/delete|archive|write|exec/i.test(tool.name)?'high':'low'};await api('/api/mcp/permissions',{method:'PUT',body:JSON.stringify(permission)});setMcp({...mcp,permissions:[...(mcp.permissions||[]).filter((item:any)=>!(item.server===server.id&&item.tool===tool.name)),permission]});}}><option value="always_allow">始终允许</option><option value="ask_each_time">每次询问</option><option value="disabled">停用</option></select></label>})}</div>)}

        <h2>事件与通知诊断</h2><p className="setting-help">最近事件可审计；同一个去重键不会重复投递。</p>
        <div className="event-diagnostics">
          {diagnostics.events.length===0?<span>还没有事件记录</span>:diagnostics.events.map(event=><div key={event.id}><strong>{event.type}</strong><small>{new Date(event.occurredAt).toLocaleString('zh-CN')}</small></div>)}
          {diagnostics.notifications.slice(0,4).map(item=><div key={item.id}><strong>{item.deliveryChannel} · {item.status}</strong><small>{item.type}</small></div>)}
        </div>
      </article>
    </div>
  </section>;
}
