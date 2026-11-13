const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { renderComment, publishComment, MARKER } = require('../scripts/evidence_pr_comment.cjs');

const report = { packet_status: 'source_review_required', counts: { packet_complete: 1, source_review_required: 2, packet_incomplete: 0 }, owner_actions: ['@all secret'], claims: [{ text: 'secret source' }] };

test('summary never publishes raw claims, source text or instructions', () => {
  const text = renderComment(report);
  assert.ok(text.includes(MARKER));
  assert.ok(text.includes('source_review_required'));
  assert.ok(!text.includes('secret'));
  assert.ok(!text.includes('@all'));
  assert.ok(text.includes('not truth'));
});

test('invalid reports remain visibly invalid and cannot inject markdown', () => {
  const text = renderComment({ packet_status: '@everyone [attack](https://evil.invalid)' });
  assert.ok(text.includes('No valid'));
  assert.ok(!text.includes('evil'));
});

function mock(existing = [], fork = false) {
  const calls = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenda-comment-'));
  const reportPath = path.join(dir, 'result.json');
  fs.writeFileSync(reportPath, JSON.stringify(report));
  return {
    calls, dir, reportPath,
    core: { info: x => calls.push(['info', x]), warning: x => calls.push(['warning', x]) },
    context: { eventName: 'pull_request', repo: { owner: 'owner', repo: 'repo' }, payload: { repository: { full_name: 'owner/repo' }, pull_request: { number: 7, head: { repo: { full_name: fork ? 'fork/repo' : 'owner/repo' } } } } },
    github: { paginate: async () => existing, rest: { issues: { listComments: {}, createComment: async x => calls.push(['create', x]), updateComment: async x => calls.push(['update', x]) } } },
  };
}

test('create summary, then update only an existing bot-owned marker', async () => {
  const first = mock([{ id: 99, user: { login: 'attacker' }, body: MARKER }]);
  try {
    await publishComment(first);
    assert.equal(first.calls[0][0], 'create');
    assert.equal(first.calls[0][1].issue_number, 7);
  } finally { fs.rmSync(first.dir, { recursive: true }); }
  const second = mock([{ id: 88, user: { login: 'github-actions[bot]' }, body: MARKER }]);
  try {
    await publishComment(second);
    assert.equal(second.calls[0][0], 'update');
    assert.equal(second.calls[0][1].comment_id, 88);
  } finally { fs.rmSync(second.dir, { recursive: true }); }
});

test('fork and non-PR events never write', async () => {
  const args = mock([], true);
  try {
    await publishComment(args);
    assert.equal(args.calls[0][0], 'info');
    args.context.eventName = 'pull_request_target';
    await publishComment(args);
    assert.equal(args.calls.length, 2);
  } finally { fs.rmSync(args.dir, { recursive: true }); }
});

test('read-only token warns, never hides evidence failure', async () => {
  const args = mock();
  args.github.rest.issues.createComment = async () => { const e = new Error('denied'); e.status = 403; throw e; };
  try {
    await publishComment(args);
    assert.equal(args.calls[0][0], 'warning');
  } finally { fs.rmSync(args.dir, { recursive: true }); }
});
