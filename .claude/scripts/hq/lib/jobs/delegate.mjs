/**
 * delegate.mjs -- how a process-job is handed to arc-run.
 *
 * EXTRACTED SO THE CONTRACT IS TESTABLE WITHOUT RUNNING ANYTHING. REQ-02 requires proof that a
 * scheduled run "cannot exceed what a manual run of the same kind could", and the whole of that
 * claim lives in the argv: same process, same driver resolution, same budget flags. A test that
 * had to spawn a driver to check it would be testing the driver.
 *
 * The budget is passed through UNCHANGED and is not clamped, widened or defaulted here. A
 * scheduled job carries exactly the budget its row declares, which `jobs-lint` has already
 * checked against the monthly ceiling at commit time -- so the ceiling is enforced before a run
 * exists, rather than by this file at the moment it is too late to matter.
 *
 * Zero dependencies, Node 18+.
 */

/**
 * The argv a process-job becomes. `arcRunPath` is injected rather than resolved here so the
 * caller owns path resolution and the test can assert on a stable string.
 */
export function processRunArgv(job, { arcRunPath }) {
  if (!job || job.type !== "process")
    throw new Error(`delegate: ${job && job.name} is not a process-job`);
  if (!job.budget || typeof job.budget.inr !== "number" || typeof job.budget.min !== "number")
    throw new Error(`delegate: ${job.name} needs a numeric inr and min budget -- jobs-lint should have refused this`);
  return [
    arcRunPath,
    "--process", String(job.entry),
    "--driver", "auto",
    "--budget", `inr=${job.budget.inr},min=${job.budget.min}`,
  ];
}

/**
 * The argv the SAME kind would carry if a human ran it by hand. Identical by construction, which
 * is the point: REQ-02's comparison is between two calls that are meant to be the same call, and
 * writing them as two separate builders would let them drift into agreeing only by accident.
 */
export function manualRunArgv(job, { arcRunPath }) {
  return processRunArgv(job, { arcRunPath });
}
