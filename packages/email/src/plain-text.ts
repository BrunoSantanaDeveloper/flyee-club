import { plainTextSelectors, render } from "@react-email/render";
import type { ReactElement } from "react";

/**
 * How a message reads as plain text. The renderer's own list, with two fixes:
 * the Preview of this version of the components carries no id, so its hidden
 * line (and the invisible characters that pad it) is skipped by its style; and
 * a link whose text is its own address prints once, not twice. Passing the
 * list replaces the renderer's, so it starts from a copy of it.
 */
const SELECTORS = [
  ...plainTextSelectors.filter((entry) => entry.selector !== "a"),
  { selector: 'div[style*="display:none"]', format: "skip" },
  { selector: "a", options: { linkBrackets: false, hideLinkHrefIfSameAsText: true } },
];

/** The plain-text part of a message, rendered from the same template as its HTML. */
export const plainTextOf = (element: ReactElement): Promise<string> =>
  render(element, { plainText: true, htmlToTextOptions: { selectors: SELECTORS } });
