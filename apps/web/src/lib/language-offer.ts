import { LOCAL_STORAGE_KEYS } from "@/constants";
import { CRAWLER_PATTERN } from "@/lib/locale-detection";

/**
 * The public site offers its other language to a browser that reads it
 * (components/marketing/language-suggestion.tsx). Whether to offer is decided
 * in the browser, so the server render stays identical for everyone, but it
 * has to be decided BEFORE the first paint: the bar sits above the header, and
 * showing it after hydration pushed the whole page down while the visitor was
 * already reading it.
 *
 * So the bar is always in the HTML, hidden, and this attribute on <html>
 * reveals it. The script below sets the attribute from <head>.
 */
export const LANGUAGE_OFFER_ATTRIBUTE = "data-language-offer";

/**
 * Inline script for <head>. Same rules as the component used to apply after
 * mount: never to a browser that already answered, never to a crawler, and
 * only when the first language the browser lists that the site ships is not
 * the language of the page (`<html lang>`). The matching mirrors
 * `localeFromAcceptLanguage` for a list that is already in order of
 * preference: an exact tag, else the primary subtag (pt-PT reads Portuguese,
 * en-GB reads English); a browser that lists neither gets no offer.
 */
export function languageOfferScript(): string {
  const key = JSON.stringify(LOCAL_STORAGE_KEYS.languageSuggestion);
  const bots = JSON.stringify(CRAWLER_PATTERN.source);
  const attribute = JSON.stringify(LANGUAGE_OFFER_ATTRIBUTE);
  return `(function(){try{if(localStorage.getItem(${key}))return;if(new RegExp(${bots},"i").test(navigator.userAgent))return;var d=document.documentElement,l=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""],r=null;for(var i=0;i<l.length&&!r;i++){var p=String(l[i]).toLowerCase().split("-")[0];if(p==="pt")r="pt-BR";else if(p==="en")r="en"}if(r&&r!==d.lang)d.setAttribute(${attribute},"")}catch(e){}})()`;
}
