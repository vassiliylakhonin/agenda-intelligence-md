const fs = require('node:fs');

const MARKER = '<!-- agenda-evidence-check -->';

function renderComment(report) {
  // Never reflect caller-supplied claim text, identifiers, quotes or actions.
  // A PR comment is a status summary, not a publication of private source data.
  const response = report.response || report;
  const statuses = ['packet_complete', 'source_review_required', 'packet_incomplete'];
  if (!statuses.includes(response.packet_status)) {
    return `${MARKER}\n## Agenda evidence check\n\nNo valid evidence-packet result. See the action log.\n\nTruth is not assessed. Human review is required.`;
  }
  const counts = response.counts || {};
  const rows = statuses.map(status => {
    const count = Number.isSafeInteger(counts[status]) && counts[status] >= 0 ? counts[status] : 0;
    return `| ${status} | ${count} |`;
  });
  return `${MARKER}\n## Agenda evidence check\n\nPacket: \`${response.packet_status}\`\n\n| Result | Claims |\n| --- | ---: |\n${rows.join('\n')}\n\nThis checks supplied evidence structure and lexical consistency, not truth or semantic entailment. Human review is required.`;
}

async function publishComment({ github, context, core, reportPath }) {
  const pr = context.payload.pull_request;
  if (!pr || context.eventName !== 'pull_request') {
    core.info('PR comment skipped: only pull_request events are supported.');
    return;
  }
  if (pr.head.repo.full_name !== context.payload.repository.full_name) {
    core.info('PR comment skipped: fork PRs have a read-only token. Do not use pull_request_target.');
    return;
  }
  if (!fs.existsSync(reportPath)) {
    core.warning('No evidence result for PR comment; see the failed check step.');
    return;
  }
  const body = renderComment(JSON.parse(fs.readFileSync(reportPath, 'utf8')));
  const params = { ...context.repo, issue_number: pr.number };
  try {
    const comments = await github.paginate(github.rest.issues.listComments, params);
    const existing = comments.find(comment => comment.user?.login === 'github-actions[bot]' && comment.body?.includes(MARKER));
    if (existing) {
      await github.rest.issues.updateComment({ ...context.repo, comment_id: existing.id, body });
    } else {
      await github.rest.issues.createComment({ ...params, body });
    }
  } catch (error) {
    // A comment permission problem must never overwrite the evidence check's result.
    if ([403, 404].includes(error.status)) {
      core.warning('PR comment unavailable. Grant pull-requests: write for same-repository PRs; evidence result remains in logs.');
    } else {
      throw error;
    }
  }
}

module.exports = { MARKER, renderComment, publishComment };
