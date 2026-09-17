// A clean component: every colour is a token. The near-misses below must NOT be findings --
// an HTML entity, a whitespace utility, a triple inside rgba(var()), a colour-mix of tokens,
// a hash route, and an identifier that merely contains a colour word.
const isWhiteSpace = (s: string) => s.trim() === "";
export function Kit({ label }: { label: string }) {
  return (
    <a href="#/map" className="inline-flex whitespace-nowrap text-(--text-2) border-(--line-1)"
      style={{ background: "rgba(var(--accent-rgb), 0.1)", borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)" }}>
      <span aria-hidden="true">&#8983;</span>
      {isWhiteSpace(label) ? "untitled" : label}
    </a>
  );
}
