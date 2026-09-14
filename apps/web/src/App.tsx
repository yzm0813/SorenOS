import { useEffect, useState } from 'react';
import { Brain, Clock3, Folder, MessageCircle, Settings, UserRound } from 'lucide-react';
import type { Conversation, WorkspaceProject } from '@soren/shared';
import { api } from './api';
import { ChatView } from './features/chat/ChatView';
import { MemoryView } from './features/memory/MemoryView';
import { SettingsView } from './features/settings/SettingsView';
import { TimelineView } from './features/timeline/TimelineView';
import { WorkspaceView } from './features/workspace/WorkspaceView';

type View='chat'|'workspace'|'memory'|'timeline'|'settings';
const nav=[['chat','Chat',MessageCircle],['workspace','Workspace',Folder],['memory','Memory',Brain],['timeline','Timeline',Clock3],['settings','Settings',Settings]] as const;

export default function App(){
  const[view,setView]=useState<View>('chat');const[online,setOnline]=useState(false);const[currentConversation,setCurrentConversation]=useState<Conversation|null>(null);const[openProjectId,setOpenProjectId]=useState<string|null>(null);
  useEffect(()=>{api('/api/bootstrap').then(()=>setOnline(true)).catch(()=>setOnline(false));},[]);
  const askProject=async(project:WorkspaceProject)=>{let conversation=currentConversation;if(!conversation){conversation=(await api<{conversation:Conversation}>('/api/conversations',{method:'POST',body:JSON.stringify({title:project.name})})).conversation;}conversation=(await api<{conversation:Conversation}>(`/api/conversations/${conversation.id}`,{method:'PATCH',body:JSON.stringify({projectId:project.id})})).conversation;setCurrentConversation(conversation);setView('chat');};
  return <div className="app-shell"><aside className="rail"><button className="brand" onClick={()=>setView('chat')}>S</button><nav>{nav.map(([id,label,Icon])=><button key={id} className={view===id?'active':''} onClick={()=>setView(id)} title={label}><Icon/><span>{label}</span></button>)}</nav><div className="rail-bottom"><span className={`status-dot ${online?'online':''}`}/><UserRound/></div></aside><main className="main"><header className="topbar"><div><strong>{nav.find(item=>item[0]===view)?.[1]}</strong><span>{view==='chat'?(currentConversation?.title||'私人对话'):view==='workspace'?'本地创作空间':'Soren Core'}</span></div><div className="runtime"><span className={`status-dot ${online?'online':''}`}/>{online?'Runtime connected':'Runtime offline'}</div></header>{view==='chat'&&<ChatView selected={currentConversation} onSelect={setCurrentConversation} onWorkspace={()=>setView('workspace')}/>} {view==='workspace'&&<WorkspaceView openProjectId={openProjectId} setOpenProjectId={setOpenProjectId} onAsk={askProject}/>} {view==='memory'&&<MemoryView/>}{view==='timeline'&&<TimelineView/>}{view==='settings'&&<SettingsView/>}</main></div>;
}
