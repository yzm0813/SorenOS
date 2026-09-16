import { useEffect, useState } from 'react';
import { Brain, Clock3, Folder, Heart, Home, MessageCircle, Settings, UserRound } from 'lucide-react';
import type { Conversation, HomeTodayItem, WorkspaceProject } from '@soren/shared';
import { api } from './api';
import { ChatView } from './features/chat/ChatView';
import { HomeView } from './features/home/HomeView';
import { MemoryView } from './features/memory/MemoryView';
import { MomentsView } from './features/moments/MomentsView';
import { SettingsView } from './features/settings/SettingsView';
import { TimelineView } from './features/timeline/TimelineView';
import { WorkspaceView } from './features/workspace/WorkspaceView';

type View='home'|'chat'|'workspace'|'memory'|'moments'|'timeline'|'settings';
const nav=[['home','Home',Home],['chat','Chat',MessageCircle],['workspace','Workspace',Folder],['memory','Memory',Brain],['moments','Moments',Heart],['timeline','Timeline',Clock3],['settings','Settings',Settings]] as const;

export default function App(){
  const[view,setView]=useState<View>('home');const[online,setOnline]=useState(false);const[currentConversation,setCurrentConversation]=useState<Conversation|null>(null);const[openProjectId,setOpenProjectId]=useState<string|null>(null);const[chatDraft,setChatDraft]=useState(''),[momentsUnread,setMomentsUnread]=useState(0);
  useEffect(()=>{api('/api/bootstrap').then(()=>setOnline(true)).catch(()=>setOnline(false));},[]);
  const askProject=async(project:WorkspaceProject)=>{let conversation=currentConversation;if(!conversation){conversation=(await api<{conversation:Conversation}>('/api/conversations',{method:'POST',body:JSON.stringify({title:project.name})})).conversation;}conversation=(await api<{conversation:Conversation}>(`/api/conversations/${conversation.id}`,{method:'PATCH',body:JSON.stringify({projectId:project.id})})).conversation;setCurrentConversation(conversation);setView('chat');};
  const openHomeItem=async(item:HomeTodayItem)=>{if(item.type==='chat'){const data=await api<{conversation:Conversation}>(`/api/conversations/${item.id}`);setCurrentConversation(data.conversation);setView('chat');}else if(item.type==='workspace'){setOpenProjectId(item.id);setView('workspace');}else setView('timeline');};
  const replyToNote=(content:string)=>{setChatDraft(`回应你留在 Home 的话：\n\n> ${content.replace(/\n/g,'\n> ')}\n\n`);setView('chat');};
  return <div className="app-shell"><aside className="rail"><button className="brand" onClick={()=>setView('home')}>S</button><nav>{nav.map(([id,label,Icon])=><button key={id} className={view===id?'active':''} onClick={()=>setView(id)} title={label}><Icon/>{id==='moments'&&momentsUnread>0&&<i className="nav-unread"/>}<span>{label}</span></button>)}</nav><div className="rail-bottom"><span className={`status-dot ${online?'online':''}`}/><UserRound/></div></aside><main className="main"><header className="topbar"><div><strong>{nav.find(item=>item[0]===view)?.[1]}</strong><span>{view==='home'?'今天，和 Soren 在一起':view==='chat'?(currentConversation?.title||'私人对话'):view==='workspace'?'本地创作空间':view==='moments'?'只属于我们的片刻':'Soren Core'}</span></div><div className="runtime"><span className={`status-dot ${online?'online':''}`}/>{online?'Runtime connected':'Runtime offline'}</div></header>{view==='home'&&<HomeView onReply={replyToNote} onOpen={openHomeItem} onMoments={()=>setView('moments')} onUnreadChange={setMomentsUnread}/>} {view==='chat'&&<ChatView selected={currentConversation} onSelect={setCurrentConversation} onWorkspace={()=>setView('workspace')} draftPrompt={chatDraft} onDraftConsumed={()=>setChatDraft('')}/>} {view==='workspace'&&<WorkspaceView openProjectId={openProjectId} setOpenProjectId={setOpenProjectId} onAsk={askProject}/>} {view==='memory'&&<MemoryView/>}{view==='moments'&&<MomentsView onUnreadChange={setMomentsUnread}/>} {view==='timeline'&&<TimelineView/>}{view==='settings'&&<SettingsView/>}</main></div>;
}
