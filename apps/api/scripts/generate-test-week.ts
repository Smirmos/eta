/* eslint-disable no-console */
// NOTE: This CLI is being rewired in poc-a Task 10. Until then it intentionally
// fails fast so callers do not insert weekly_details rows with a placeholder
// macro_plan_id (the FK would either fail or pollute the DB). Task 10 will
// rewrite this script to look up the latest macro plan from the DB by user.
async function main(): Promise<void> {
  throw new Error(
    'pnpm generate:test-week is being rewired in poc-a Task 10. Re-run when that task lands.',
  );
}

void main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
