// A candidate that flags every fixture. Its catch-count looks perfect and its false-block
// count is the whole cost -- which is exactly why clean/ controls exist.
export function check() { return { flagged: true, why: "flags everything" }; }
