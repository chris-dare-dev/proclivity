/*
 * DEBUG-style namespace glob matcher. Tiny, synchronous, dependency-free.
 *
 * Supports:
 *   - `"*"` — matches everything.
 *   - `"foo"` — exact match.
 *   - `"foo:*"` — prefix match (matches `foo`, `foo:bar`, `foo:bar:baz`).
 *   - `"foo,bar:*"` — comma-separated alternatives; first hit wins.
 *   - leading `!` on a segment → negation. Negations are evaluated AFTER all
 *     positive matches, so `"nano:*,!nano:download"` matches everything under
 *     `nano:` except the `nano:download` namespace.
 *
 * NOT supported (deliberately, to keep the matcher tiny): mid-string `*`,
 * regex, character classes. The convention is colon-separated namespaces,
 * so prefix matches cover the realistic cases.
 */

export function matchesFilter(namespace: string, pattern: string): boolean {
  if (!pattern) return false;

  let matched = false;
  for (const rawSegment of pattern.split(",")) {
    const segment = rawSegment.trim();
    if (!segment) continue;

    const negate = segment.startsWith("!");
    const glob = negate ? segment.slice(1) : segment;
    if (!glob) continue;

    const isMatch = globMatches(namespace, glob);
    if (negate) {
      if (isMatch) return false; // explicit exclusion wins
    } else if (isMatch) {
      matched = true;
    }
  }
  return matched;
}

function globMatches(ns: string, glob: string): boolean {
  if (glob === "*") return true;
  if (glob.endsWith(":*")) {
    const prefix = glob.slice(0, -2);
    return ns === prefix || ns.startsWith(prefix + ":");
  }
  return ns === glob;
}
