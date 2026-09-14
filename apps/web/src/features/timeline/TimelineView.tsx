import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { api } from '../../api';

export function TimelineView(){const[events,setEvents]=useState<any[]>([]);useEffect(()=>{api<{events:any[]}>('/api/timeline').then(data=>setEvents(data.events)).catch(()=>{});},[]);return <section className="surface"><div className="surface-head"><div><h1>Timeline</h1><p>Cyberboss 的提醒和事件留在这里。</p></div></div><div className="timeline-list">{events.length?events.map((event,index)=><article key={event.id||index}><time>{new Date(event.createdAt).toLocaleString('zh-CN')}</time><div><h2>{event.title}</h2><p>{event.detail}</p></div></article>):<div className="empty-card"><Clock3/><h2>今天还没有事件</h2></div>}</div></section>}
