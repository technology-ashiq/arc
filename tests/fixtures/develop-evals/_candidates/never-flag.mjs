// A candidate that flags nothing. Both counts are zero: it catches no real failure and
// blocks no legitimate work.
export function check() { return { flagged: false, why: "flags nothing" }; }
