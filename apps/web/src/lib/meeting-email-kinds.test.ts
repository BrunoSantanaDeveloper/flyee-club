import {
  isMeetingEmailKind,
  MEETING_EMAIL_KINDS,
  MEETING_SENT_COLUMN,
  meetingEmailWindow,
} from "./meeting-email-kinds";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-10-09T12:00:00Z");
const HOUR = 3_600_000;
const startsIn = (hours: number) => new Date(NOW + hours * HOUR).toISOString();

const meeting = (state: string, startsAt: string | null, hasRecording = false) => ({ state, startsAt, hasRecording });

describe("when each message of a meeting may go out", () => {
  it("knows the four kinds and the column each is marked in", () => {
    expect([...MEETING_EMAIL_KINDS]).toEqual(["confirmation", "day", "hour", "recording"]);
    expect(Object.keys(MEETING_SENT_COLUMN).sort()).toEqual([...MEETING_EMAIL_KINDS].sort());
    expect(isMeetingEmailKind("hour")).toBe(true);
    expect(isMeetingEmailKind("weekly")).toBe(false);
    expect(isMeetingEmailKind(null)).toBe(false);
  });

  it("confirms registrations only while people can register", () => {
    expect(meetingEmailWindow("confirmation", meeting("inscricoes", null), NOW)).toEqual({ open: true });
    expect(meetingEmailWindow("confirmation", meeting("ao_vivo", startsIn(-1)), NOW)).toEqual({ open: true });
    expect(meetingEmailWindow("confirmation", meeting("rascunho", null), NOW)).toEqual({ open: false, why: "state" });
    expect(meetingEmailWindow("confirmation", meeting("encerrado", startsIn(-3)), NOW)).toEqual({
      open: false,
      why: "state",
    });
  });

  it("opens the 24-hour reminder a day before and closes it two hours before", () => {
    const open = (hours: number) => meetingEmailWindow("day", meeting("inscricoes", startsIn(hours)), NOW);
    expect(open(30)).toEqual({ open: false, why: "too-early" });
    expect(open(24)).toEqual({ open: true });
    expect(open(3)).toEqual({ open: true });
    expect(open(2)).toEqual({ open: false, why: "too-late" });
    expect(open(-1)).toEqual({ open: false, why: "too-late" });
  });

  it("opens the last-hour reminder in the 60 minutes before the start", () => {
    const open = (hours: number, state = "inscricoes") =>
      meetingEmailWindow("hour", meeting(state, startsIn(hours)), NOW);
    expect(open(1.5)).toEqual({ open: false, why: "too-early" });
    expect(open(1)).toEqual({ open: true });
    expect(open(0.1, "ao_vivo")).toEqual({ open: true });
    expect(open(0)).toEqual({ open: false, why: "too-late" });
  });

  it("needs a date for a reminder, and the right state", () => {
    expect(meetingEmailWindow("day", meeting("inscricoes", null), NOW)).toEqual({ open: false, why: "no-date" });
    expect(meetingEmailWindow("hour", meeting("inscricoes", "not a date"), NOW)).toEqual({
      open: false,
      why: "no-date",
    });
    expect(meetingEmailWindow("day", meeting("ao_vivo", startsIn(5)), NOW)).toEqual({ open: false, why: "state" });
    expect(meetingEmailWindow("hour", meeting("rascunho", startsIn(0.5)), NOW)).toEqual({ open: false, why: "state" });
  });

  it("announces the recording only for an ended meeting that has one", () => {
    expect(meetingEmailWindow("recording", meeting("encerrado", startsIn(-3), true), NOW)).toEqual({ open: true });
    expect(meetingEmailWindow("recording", meeting("encerrado", startsIn(-3), false), NOW)).toEqual({
      open: false,
      why: "no-recording",
    });
    expect(meetingEmailWindow("recording", meeting("ao_vivo", startsIn(-1), true), NOW)).toEqual({
      open: false,
      why: "state",
    });
  });
});
