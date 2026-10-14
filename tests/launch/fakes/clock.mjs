// One logical clock shared by the GitHub and Vercel fakes, so "built before the env value" is an ordering the fakes
// agree on. Milliseconds-shaped, strictly increasing, never wall time.
let t = 1700000000000;
export const tick = () => (t += 1000);
