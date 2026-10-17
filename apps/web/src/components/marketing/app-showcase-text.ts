/**
 * The text of an <AppShowcase> reply and how much of it shows while it is
 * typed. Pure, with no "use client", so tests import it and the typing state
 * stays a single number: how many characters are out.
 */

/** One line of a reply: a short label (a scene and its time, "Gancho · 0:00") and what it says. */
export type ShowcaseLine = { label?: string; text: string };

export type RevealedLine = {
  label: string;
  /** The part of the label already typed. */
  labelShown: string;
  text: string;
  /** The part of the text already typed. */
  textShown: string;
  /** The caret sits at the end of this line's typed part: the last line that has started (the first, before any). */
  current: boolean;
};

/** How many characters the whole reply has (labels included). */
export const replyLength = (lines: ShowcaseLine[]) =>
  lines.reduce((total, line) => total + (line.label?.length ?? 0) + line.text.length, 0);

/** The character counts at which a line ends: the typing pauses there. */
export function lineEnds(lines: ShowcaseLine[]): Set<number> {
  const ends = new Set<number>();
  let total = 0;
  for (const line of lines) {
    total += (line.label?.length ?? 0) + line.text.length;
    ends.add(total);
  }
  return ends;
}

/** Each line with the part `count` characters reveal, the label typed before the text. */
export function revealLines(lines: ShowcaseLine[], count: number): RevealedLine[] {
  let left = Math.max(0, Math.floor(count));
  const revealed = lines.map((line) => {
    const label = line.label ?? "";
    const labelShown = label.slice(0, left);
    left -= labelShown.length;
    const textShown = line.text.slice(0, left);
    left -= textShown.length;
    return { label, labelShown, text: line.text, textShown, current: false };
  });
  const started = revealed.findLastIndex((line) => line.labelShown.length + line.textShown.length > 0);
  if (revealed.length > 0) revealed[Math.max(0, started)].current = true;
  return revealed;
}

/** The reply as one sentence per line, for assistive technology. */
export const replyText = (lines: ShowcaseLine[]) =>
  lines.map((line) => (line.label ? `${line.label}: ${line.text}` : line.text)).join(" ");
