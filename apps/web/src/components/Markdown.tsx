import { Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Markdown({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{code({children,className,...props}){const text=String(children).replace(/\n$/,'');return <span className="code-wrap"><code className={className} {...props}>{children}</code><button className="copy-code" onClick={()=>navigator.clipboard.writeText(text)}><Copy size={13}/></button></span>}}}>{children}</ReactMarkdown>;
}
