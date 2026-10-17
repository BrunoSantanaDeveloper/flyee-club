/**
 * Splits a copy line on its `{token}`s (the hero subtitle's segments), so a
 * page renders each token as an element of its own (a link) and the words
 * between them as text. A `{word}` that is not one of the known tokens stays
 * as text, braces included, which the copy tests then catch. Pure.
 */
export type CopyPart = { text: string } | { token: string };

export function splitTokens(line: string, tokens: readonly string[]): CopyPart[] {
  const parts: CopyPart[] = [];
  let rest = line;
  const pattern = /\{(\w+)\}/;
  for (let match = pattern.exec(rest); match; match = pattern.exec(rest)) {
    const before = rest.slice(0, match.index);
    if (tokens.includes(match[1])) {
      if (before) parts.push({ text: before });
      parts.push({ token: match[1] });
    } else {
      parts.push({ text: before + match[0] });
    }
    rest = rest.slice(match.index + match[0].length);
  }
  if (rest) parts.push({ text: rest });
  return parts;
}
