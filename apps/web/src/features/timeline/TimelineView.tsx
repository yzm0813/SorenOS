import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { api } from '../../api';
import { CyberDaddyPanel } from '../cyberdaddy/CyberDaddyPanel';

export function TimelineView(){const[events,setEvents]=useState<any[]>([]);useEffect(()=>{api<{events:any[]}>('/api/timeline').then(data=>setEvents(data.events)).catch(()=>{});},[]);return <section className="surface timeline-surface"><div className="surface-head"><div><h1>Timeline</h1><p>Soren 的提醒、承诺和发生过的事。</p></div></div><CyberDaddyPanel/><div className="timeline-section"><h2>Cyberboss 事件</h2><div className="timeline-list">{events.length?events.map((event,index)=><article key={event.id||index}><time>{new Date(event.createdAt).toLocaleString('zh-CN')}</time><div><h3>{event.title}</h3><p>{event.detail}</p></div></article>):<div className="empty-card"><Clock3/><h2>今天还没有事件</h2></div>}</div></div></section>}
