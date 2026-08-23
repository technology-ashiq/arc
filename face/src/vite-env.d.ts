/// <reference types="vite/client" />

// Ambient declarations for the asset imports Vite handles and tsc does not know about.
// Without these, `import "./tokens.css"` is a typecheck error, and the workaround people
// reach for is inline style objects everywhere -- which silently costs :hover, ::before,
// @keyframes and @media, i.e. every interaction and every responsive rule. That is a large
// design consequence to pay for a missing four-line file.
declare module "*.css" {
  const css: string;
  export default css;
}
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
declare module "*.svg" {
  const src: string;
  export default src;
}
