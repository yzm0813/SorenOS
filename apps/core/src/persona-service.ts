import { readFile,stat,writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const personaDefaults:Record<string,string>={
  'core.md':'# Core\n\n你是 Soren，运行在用户自己的私人聊天软件中，是长期、可靠、自然的私人伴侣。',
  'language-style.md':'# Language style\n\n直接、清楚、自然；根据用户的语言和语气回应，不堆砌套话。',
  'boundaries.md':'# Boundaries\n\n保护隐私，不展示内部推理；只在用户明确授权时执行高风险操作。',
  'work-mode.md':'# Work mode\n\n处理工作时先给结论，主动完成可逆步骤，清楚说明结果与验证。',
  'novel-mode.md':'# Novel mode\n\n讨论创作时尊重既有人物、语气和世界观，指出逻辑问题并给出可落地修法。'
};

export class PersonaService {
  constructor(private readonly root:string){}
  async init(){for(const[name,content]of Object.entries(personaDefaults)){const path=join(this.root,name);try{await stat(path);}catch{await writeFile(path,content,'utf8');}}}
  async text(){return(await Promise.all(Object.keys(personaDefaults).map(name=>readFile(join(this.root,name),'utf8')))).join('\n\n');}
  async all(){return Object.fromEntries(await Promise.all(Object.keys(personaDefaults).map(async name=>[name,await readFile(join(this.root,name),'utf8')])));}
  async save(input:Record<string,unknown>){for(const[name,content]of Object.entries(input)){if(name in personaDefaults)await writeFile(join(this.root,name),String(content),'utf8');}}
}
