import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WorkspaceService } from '@soren/workspace';

test('workspace preserves the edit, diff, commit and restore flow', async () => {
  const root = mkdtempSync(join(tmpdir(), 'soren-workspace-'));
  const workspace = new WorkspaceService(root);
  try {
    await workspace.init();
    await workspace.createProject('phase-zero-project', 'Phase Zero', 'web');
    await workspace.write('phase-zero-project', 'index.html', '<h1>Changed</h1>');
    assert.match(await workspace.diff('phase-zero-project'), /Changed/);
    const changedCommit = await workspace.commit('phase-zero-project', 'Change page');
    assert.ok(changedCommit);
    const initialCommit = (await workspace.history('phase-zero-project')).at(-1)?.id;
    assert.ok(initialCommit);
    await workspace.restore('phase-zero-project', initialCommit);
    assert.doesNotMatch(await workspace.read('phase-zero-project', 'index.html'), /Changed/);
    await assert.rejects(() => workspace.write('phase-zero-project', '../outside.txt', 'blocked'), /拒绝 Workspace 外路径/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
