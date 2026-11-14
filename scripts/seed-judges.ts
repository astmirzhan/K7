// Resets only judge1, judge2 and demo (plus Sarah's pending request). Run before every rehearsal.
import { ensureSarah, resetJudges } from './lib/judges';
import { loadCatalog } from './lib/seed-core';

async function main() {
  const catalog = await loadCatalog();
  const sarah = await ensureSarah(catalog);
  const r = await resetJudges(catalog, sarah);
  process.stdout.write(
    [
      'Judges reset',
      `  judge1@example.com → ${r.judge1}`,
      `  judge2@example.com → ${r.judge2}`,
      `  demo@example.com   → ${r.demo} (auth only, no profile)`,
      `  Sarah's request to judge1: ${r.sarahRequestId}`,
      '',
    ].join('\n'),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
