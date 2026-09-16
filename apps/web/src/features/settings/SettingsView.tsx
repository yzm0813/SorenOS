import { useEffect, useState } from 'react';
import { MapPin, Save, Search } from 'lucide-react';
import type { DomainEvent, NotificationRecord, WeatherLocation } from '@soren/shared';
import { api } from '../../api';

type Diagnostics={events:DomainEvent[];notifications:NotificationRecord[]};

export function SettingsView(){
  const[settings,setSettings]=useState<Record<string,any>>({});
  const[persona,setPersona]=useState<Record<string,string>>({});
  const[mcp,setMcp]=useState<any>({servers:[],permissions:[]});
  const[diagnostics,setDiagnostics]=useState<Diagnostics>({events:[],notifications:[]});
  const[notificationPermission,setNotificationPermission]=useState(typeof Notification==='undefined'?'unsupported':Notification.permission);
  const[activePersona,setActivePersona]=useState('core.md'),[saved,setSaved]=useState(false);
  const[locationQuery,setLocationQuery]=useState(''),[locations,setLocations]=useState<WeatherLocation[]>([]),[searching,setSearching]=useState(false);

  useEffect(()=>{
    api<any>('/api/settings').then(data=>{setSettings(data.settings);setPersona(data.persona);if(data.settings.weatherLocation)setLocationQuery(data.settings.weatherLocation.name)});
    api<any>('/api/mcp').then(setMcp).catch(()=>{});
    Promise.all([api<{events:DomainEvent[]}>('/api/events?limit=8'),api<{notifications:NotificationRecord[]}>('/api/notifications?limit=8')]).then(([eventData,notificationData])=>setDiagnostics({events:eventData.events,notifications:notificationData.notifications})).catch(()=>{});
  },[]);

  const save=async()=>{await api('/api/settings',{method:'PUT',body:JSON.stringify({settings,persona})});setSaved(true);setTimeout(()=>setSaved(false),1800);};
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
        {notificationPermission!=='unsupported'&&<button className="permission-button" disabled={notificationPermission!=='default'} onClick={async()=>setNotificationPermission(await Notification.requestPermission())}>系统权限：{notificationPermission==='granted'?'已允许':notificationPermission==='denied'?'已拒绝，请在浏览器设置中重新允许':'点击授权'}</button>}

        <h2>Persona</h2>
        <div className="persona-tabs">{Object.keys(persona).map(name=><button className={activePersona===name?'active':''} onClick={()=>setActivePersona(name)} key={name}>{name.replace('.md','')}</button>)}</div>
        <textarea className="persona-editor" value={persona[activePersona]||''} onChange={event=>setPersona({...persona,[activePersona]:event.target.value})}/>
      </article>

      <article className="panel">
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
