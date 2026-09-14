import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, realpath, rename, stat, writeFile, lstat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ignored = new Set(['.git', 'node_modules', 'dist', '.DS_Store']);

export class WorkspaceService {
  constructor(readonly root: string) {}
  async init() { await mkdir(this.root, { recursive: true }); }

  projectDir(id: string) {
    if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(id)) throw new Error('无效项目 ID');
    return join(this.root, id);
  }

  async createProject(id: string, name: string, type: string) {
    const dir = this.projectDir(id);
    await mkdir(dir, { recursive: false });
    await writeFile(join(dir, 'README.md'), `# ${name}\n\n在这里记录项目目标。\n`, 'utf8');
    if (type === 'web') await writeFile(join(dir, 'index.html'), '<!doctype html>\n<meta charset="utf-8">\n<title>新项目</title>\n<main><h1>开始创作</h1></main>\n', 'utf8');
    await this.git(dir, ['init']);
    await this.git(dir, ['add', '.']);
    await this.git(dir, ['-c', 'user.name=Soren', '-c', 'user.email=soren@local', 'commit', '-m', 'Create project']);
    return dir;
  }

  async listFiles(projectId: string) {
    const dir = this.projectDir(projectId);
    const statusMap = await this.statusMap(dir);
    const out: Array<{ path: string; type: 'file' | 'directory'; size: number; modifiedAt: string; status: string }> = [];
    const walk = async (current: string) => {
      for (const entry of await readdir(current, { withFileTypes: true })) {
        if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
        const full = join(current, entry.name);
        const rel = relative(dir, full).split(sep).join('/');
        const info = await stat(full);
        out.push({ path: rel, type: entry.isDirectory() ? 'directory' : 'file', size: entry.isFile() ? info.size : 0, modifiedAt: info.mtime.toISOString(), status: statusMap.get(rel) || '' });
        if (entry.isDirectory()) await walk(full);
      }
    };
    await walk(dir);
    return out;
  }

  async read(projectId: string, relativePath: string) {
    const file = await this.safePath(projectId, relativePath, true);
    const info = await stat(file);
    if (info.size > 2_000_000) throw new Error('文件超过 2 MB');
    return readFile(file, 'utf8');
  }

  async write(projectId: string, relativePath: string, content: string) {
    const file = await this.safePath(projectId, relativePath, false);
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.soren-${crypto.randomUUID()}.tmp`;
    await writeFile(tmp, content, 'utf8');
    await rename(tmp, file);
    return { path: relativePath, modifiedAt: (await stat(file)).mtime.toISOString() };
  }

  async commit(projectId: string, message: string) {
    const dir = this.projectDir(projectId);
    await this.git(dir, ['add', '.']);
    const pending = await this.git(dir, ['status', '--porcelain']);
    if (!pending.trim()) return null;
    await this.git(dir, ['-c', 'user.name=Soren', '-c', 'user.email=soren@local', 'commit', '-m', message.slice(0, 120)]);
    return (await this.git(dir, ['rev-parse', 'HEAD'])).trim();
  }

  async history(projectId: string) {
    const raw = await this.git(this.projectDir(projectId), ['log', '--pretty=format:%H%x1f%h%x1f%s%x1f%cI', '-50']);
    return raw ? raw.split('\n').map(line => { const [id, shortId, message, date] = line.split('\x1f'); return { id, shortId, message, date }; }) : [];
  }

  async diff(projectId: string, commit?: string) {
    const args = commit ? ['show', '--format=', '--no-ext-diff', commit] : ['diff', '--no-ext-diff'];
    return this.git(this.projectDir(projectId), args);
  }

  async restore(projectId: string, commit: string) {
    if (!/^[a-f0-9]{7,40}$/i.test(commit)) throw new Error('无效版本');
    const dir = this.projectDir(projectId);
    await this.git(dir, ['restore', '--source', commit, '--worktree', '.']);
    return this.commit(projectId, `Restore ${commit.slice(0, 8)}`);
  }

  async changedPaths(projectId: string) {
    const raw = await this.git(this.projectDir(projectId), ['status', '--porcelain']);
    return raw.split('\n').filter(Boolean).map(line => line.slice(3).trim());
  }

  private async safePath(projectId: string, input: string, mustExist: boolean) {
    if (!input || isAbsolute(input) || input.includes('\0')) throw new Error('无效文件路径');
    const root = resolve(this.projectDir(projectId));
    const target = resolve(root, normalize(input));
    if (target !== root && !target.startsWith(root + sep)) throw new Error('拒绝 Workspace 外路径');
    const relParts = relative(root, target).split(sep).filter(Boolean);
    let cursor = root;
    for (let index = 0; index < relParts.length - (mustExist ? 0 : 1); index++) {
      cursor = join(cursor, relParts[index]);
      try { if ((await lstat(cursor)).isSymbolicLink()) throw new Error('拒绝符号链接'); } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
    }
    if (mustExist) {
      const canonicalRoot = await realpath(root);
      const canonical = await realpath(target);
      if (canonical !== canonicalRoot && !canonical.startsWith(canonicalRoot + sep)) throw new Error('拒绝 Workspace 外路径');
      if ((await lstat(target)).isSymbolicLink()) throw new Error('拒绝符号链接');
    }
    return target;
  }

  private async statusMap(dir: string) {
    const map = new Map<string, string>();
    const raw = await this.git(dir, ['status', '--porcelain']).catch(() => '');
    for (const line of raw.split('\n').filter(Boolean)) map.set(line.slice(3).trim().replaceAll('\\', '/'), line.slice(0, 2).trim() || 'modified');
    return map;
  }

  private async git(cwd: string, args: string[]) {
    const { stdout } = await run('git', args, { cwd, windowsHide: true, maxBuffer: 10_000_000 });
    return stdout;
  }
}

export function slugifyProject(name: string) {
  const ascii = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${ascii || 'project'}-${crypto.randomUUID().slice(0, 8)}`;
}
