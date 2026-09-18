// Loaded by planted-error.html. One console error and one uncaught exception, so the probe
// proves both detection paths at once.
console.error("planted-face-v2-console-error");
setTimeout(() => { throw new Error("planted-face-v2-exception"); }, 50);
