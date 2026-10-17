"use client";

import { lineEnds, replyLength, replyText, revealLines, type ShowcaseLine } from "./app-showcase-text";
import { useEffect, useMemo, useRef, useState } from "react";

import { TONE, type Tone } from "@/components/marketing/tone";
import NiCheck from "@/icons/nexture/ni-check";
import { cn } from "@/lib/utils";

/** Milliseconds per character, the pause at the end of a line, the time the full reply stays, the fade between rounds. */
const TYPE_MS = 24;
const LINE_PAUSE_MS = 320;
const HOLD_MS = 3200;
const FADE_MS = 450;
/** Rounds per visit of the block: it loops while read, and rests on the full reply (nothing animates forever). */
const ROUNDS = 3;

type Phase = "typing" | "done" | "fading";

/**
 * The featured app answering a request (decided 2026-10-17): the RESULT of
 * the app, not the command that installs it. A conversation card: the
 * member's request, then the app's reply typed out line by line, then the
 * file it saved. It loops while it is on screen, up to three rounds, and
 * rests on the full reply; out of the viewport it stops, and it types again
 * when the reader comes back.
 *
 * The full reply is in the server HTML (no script, reduced motion and
 * crawlers read it whole); the untyped rest of each line stays in place,
 * invisible, so the card never changes height while it types. Screen readers
 * get the reply once, from a hidden copy, and the figure's caption says it is
 * an example.
 */
export default function AppShowcase({
  icon,
  name,
  context,
  request,
  lines,
  saved,
  caption,
  tone,
}: {
  /** The app's <AppIcon>, rendered on the server. */
  icon: React.ReactNode;
  name: string;
  /** Where the conversation happens ("Na sua IA"). */
  context: string;
  /** What the member asked; none when the app has no example yet. */
  request?: string;
  lines: ShowcaseLine[];
  /** The closing line once the reply is out (the file it saved); none to leave it out. */
  saved?: string;
  /** What the figure shows, for assistive technology. */
  caption: string;
  tone: Tone;
}) {
  const root = useRef<HTMLElement>(null);
  const total = useMemo(() => replyLength(lines), [lines]);
  const ends = useMemo(() => lineEnds(lines), [lines]);
  const [count, setCount] = useState(total);
  const [phase, setPhase] = useState<Phase>("done");

  useEffect(() => {
    const node = root.current;
    if (!node || total === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer: number | undefined;
    let rounds = 0;
    let visible = false;
    const stop = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };
    const advance = (next: number) => {
      setCount(next);
      if (next >= total) {
        setPhase("done");
        rounds += 1;
        if (rounds < ROUNDS) timer = window.setTimeout(fade, HOLD_MS);
        return;
      }
      timer = window.setTimeout(() => advance(next + 1), ends.has(next) && next > 0 ? LINE_PAUSE_MS : TYPE_MS);
    };
    const fade = () => {
      setPhase("fading");
      timer = window.setTimeout(() => {
        setPhase("typing");
        advance(0);
      }, FADE_MS);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !visible) {
          visible = true;
          stop();
          rounds = 0;
          setPhase("typing");
          advance(0);
        } else if (!entry.isIntersecting && visible) {
          visible = false;
          stop();
          setCount(total);
          setPhase("done");
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      stop();
    };
  }, [total, ends]);

  const revealed = revealLines(lines, count);
  const hue = TONE[tone];

  return (
    <figure
      ref={root}
      className="border-grey-100 bg-background-paper shadow-darker-xs m-0 w-full overflow-hidden rounded-3xl border"
    >
      <figcaption className="sr-only">{caption}</figcaption>

      <div className="border-grey-100 bg-grey-25 flex flex-row items-center gap-3 border-b px-5 py-3.5">
        {icon}
        <div className="flex min-w-0 flex-col">
          <span className="font-display text-text-primary truncate text-base leading-5 font-normal">{name}</span>
          <span className="text-text-secondary text-xs">{context}</span>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-5 py-6 sm:px-7">
        {request ? (
          <p className="bg-grey-50 text-text-primary m-0 ml-8 self-end rounded-2xl rounded-br-md px-4 py-3 text-sm leading-6 sm:ml-20">
            {request}
          </p>
        ) : null}

        <p className="sr-only">{replyText(lines)}</p>
        <div
          aria-hidden
          className={cn(
            "flex flex-col gap-3 transition-opacity duration-500 motion-reduce:transition-none",
            phase === "fading" && "opacity-0",
          )}
        >
          {revealed.map((line, index) => {
            const caret = phase === "typing" && line.current;
            return (
              <div key={index} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                {line.label ? (
                  <span className="text-text-secondary font-mono text-xs leading-6 whitespace-nowrap sm:w-32 sm:flex-none">
                    {line.labelShown}
                    {caret && line.textShown === "" && line.labelShown.length < line.label.length ? <Caret /> : null}
                    <span className="invisible">{line.label.slice(line.labelShown.length)}</span>
                  </span>
                ) : null}
                <span
                  className={cn(
                    "text-text-primary text-sm leading-6",
                    index === 0 && "font-display text-base font-normal",
                  )}
                >
                  {line.textShown}
                  {caret && (line.labelShown.length === line.label.length || !line.label) ? <Caret /> : null}
                  <span className="invisible">{line.text.slice(line.textShown.length)}</span>
                </span>
              </div>
            );
          })}
        </div>

        {saved ? (
          <p
            aria-hidden={phase !== "done"}
            className={cn(
              "text-text-secondary m-0 flex flex-row items-center gap-2 font-mono text-xs transition-opacity duration-500 motion-reduce:transition-none",
              phase === "done" ? "opacity-100" : "opacity-0",
            )}
          >
            <NiCheck size="small" className={cn("flex-none", hue.text)} />
            {saved}
          </p>
        ) : null}
      </div>
    </figure>
  );
}

/** Where the next character lands; it only shows while the reply is being typed. */
function Caret() {
  return <span className="bg-text-primary ml-px inline-block h-4 w-0.5 translate-y-0.5" />;
}
