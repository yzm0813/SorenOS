import { readFile,stat,writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const SOREN_CORE_FILE='SOREN_CORE.md';
export interface SorenIdentityDocument{content:string;version:string;sourcePath:string;}
export interface SorenIdentitySource{identity():Promise<SorenIdentityDocument>;text():Promise<string>;scene(instruction:string):Promise<string>;}

export class PersonaService implements SorenIdentitySource{
  readonly corePath:string;
  constructor(private readonly root:string){this.corePath=join(root,SOREN_CORE_FILE);}
  async init(){await stat(this.corePath);await this.identity();}
  async identity():Promise<SorenIdentityDocument>{const content=await readFile(this.corePath,'utf8'),version=content.match(/^#\s+Soren Core\s+(v\d+(?:\.\d+)*)/m)?.[1];if(!version)throw new Error('SOREN_CORE.md 缺少版本标题');return{content,version,sourcePath:this.corePath};}
  async text(){return(await this.identity()).content;}
  async version(){return(await this.identity()).version;}
  async scene(instruction:string){const identity=await this.identity();return`=== Soren Identity / Core (${identity.version}) ===\n${identity.content}\n\n=== Scene Instruction ===\n${String(instruction).trim()}`;}
  async all(){return{[SOREN_CORE_FILE]:await this.text()};}
  async save(input:Record<string,unknown>){if(SOREN_CORE_FILE in input){const content=String(input[SOREN_CORE_FILE]);if(!/^#\s+Soren Core\s+v\d+(?:\.\d+)*/m.test(content))throw new Error('Soren Core 必须包含版本标题');await writeFile(this.corePath,content,'utf8');}}
}
