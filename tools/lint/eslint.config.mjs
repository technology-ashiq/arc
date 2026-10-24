// ESLint for arc's own scripts (ci CI-N, ADR-2203). Run from the repo root with --config, so patterns are
// root-relative. TRIAL (CI-S): every rule warns, so lint reports and never blocks; a parse error still exits 1.
// A rule turned off carries its reason; a file is never disabled wholesale to get green.
import js from "@eslint/js";
import globals from "globals";

const warn = (rules) => Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, Array.isArray(v) ? ["warn", ...v.slice(1)] : v === "off" ? "off" : "warn"]));

export default [
  { ignores: ["**/node_modules/**", "face/**", "tests/fixtures/**", "docs/**", ".codex/**", ".opencode/**", ".agents/**", "initiatives/**", "**/dist/**"] },
  {
    files: ["**/*.{mjs,js,cjs}"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: { ...globals.node } },
    linterOptions: { reportUnusedDisableDirectives: "off" }, // the directives predate this config; noise, not a defect
    rules: {
      ...warn(js.configs.recommended.rules),
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-sparse-arrays": "off", // `(s.match(re) || [, ""])[1]` is the house match-fallback idiom, not a hole
      "no-empty": ["warn", { allowEmptyCatch: true }], // a best-effort probe swallows by design
      "no-control-regex": "off", // sanitizers and payload parsers match control characters on purpose
      "no-irregular-whitespace": "off", // fixtures and guards carry U+2028/U+00A0 on purpose
      "no-useless-escape": "off", // style only; an extra escape never changes what a regex matches
      "no-regex-spaces": "off", // style only; `  ` and ` {2}` match the same
    },
  },
  { files: ["**/*.cjs"], languageOptions: { sourceType: "commonjs" } },
];
