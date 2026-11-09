const { test } = require('node:test');
const assert = require('node:assert/strict');

test('a project index keeps named projects and drops the reserved index id', async () => {
  const projects = await import('../shared/projects.js');
  const index = projects.normalizeProjectIndex({
    activeId: 'index',
    projects: [
      { id: 'booth-1', name: 'Booth', updatedAt: '2026-11-05T00:00:00.000Z' },
      { id: 'index', name: 'Reserved' },
      { name: 'Missing id' },
    ],
  });
  assert.equal(index.activeId, null);
  assert.deepEqual(index.projects, [
    { id: 'booth-1', name: 'Booth', updatedAt: '2026-11-05T00:00:00.000Z' },
  ]);
  assert.equal(projects.createProjectId().length > 8, true);
});
