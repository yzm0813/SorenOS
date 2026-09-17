export type SorenNavigation={view:'home'|'chat'|'workspace'|'memory'|'moments'|'timeline'|'settings';conversationId:string|null;messageId:string|null;};
const views=new Set(['home','chat','workspace','memory','moments','timeline','settings']);
export function parseSorenNavigation(value:string):SorenNavigation{const url=new URL(value,window.location.origin),raw=url.searchParams.get('view')||'home',view=(views.has(raw)?raw:'home') as SorenNavigation['view'];return{view,conversationId:url.searchParams.get('conversation'),messageId:url.searchParams.get('message')};}
