import { describe, it, expect } from "vitest";
import { countTravelDays } from "../lib/policy";

// Helpers to build explicit itineraries for each locked-in fixture. These tests
// pin the PURE rule engine: travel on a show day never counts; only a full
// non-show day with a flight / 3h+ / overnight counts; personal days are excluded.

const showDay = (date, travel) => ({ date, hasPerformance: true, travel: travel || { occurs: false } });
const travelDay = (date, travel) => ({ date, hasPerformance: false, travel });

describe("countTravelDays - locked fixtures", () => {
  it("Gold Coast 17 May, MEL player flies up show day, flies home 18th -> 1", () => {
    const itin = { days: [
      showDay("2025-05-17", { occurs: true, mode: "flight", doorToDoorHours: 5.5, overnightAway: false, fromBase: "Melbourne", toBase: "Gold Coast", destLabel: "Gold Coast" }),
      travelDay("2025-05-18", { occurs: true, mode: "flight", doorToDoorHours: 5.5, overnightAway: false, fromBase: "Gold Coast", toBase: "Melbourne", destLabel: "Gold Coast" }),
    ] };
    const r = countTravelDays(itin, "Melbourne");
    expect(r.days).toBe(1);
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons[0].ruleFired).toBe("flight");
    expect(r.reasons[0].explanation).toMatch(/flight home/);
    expect(r.reasons[0].explanation).toMatch(/18 May/);
  });

  it("Bowraville 9 May, MEL player fly+drive in on 8th, drive+fly home 10th -> 2", () => {
    const itin = { days: [
      travelDay("2025-05-08", { occurs: true, mode: "flight", doorToDoorHours: 11, overnightAway: true, fromBase: "Melbourne", toBase: "Bowraville", destLabel: "Bowraville" }),
      showDay("2025-05-09"),
      travelDay("2025-05-10", { occurs: true, mode: "flight", doorToDoorHours: 11, overnightAway: false, fromBase: "Bowraville", toBase: "Melbourne", destLabel: "Bowraville" }),
    ] };
    const r = countTravelDays(itin, "Melbourne");
    expect(r.days).toBe(2);
  });

  it("Bowraville 9 May, SYD player drives up 8th and back 10th (6.5h each) -> 2", () => {
    const itin = { days: [
      travelDay("2025-05-08", { occurs: true, mode: "drive", doorToDoorHours: 6.5, overnightAway: true, fromBase: "Sydney", toBase: "Bowraville", destLabel: "Bowraville" }),
      showDay("2025-05-09"),
      travelDay("2025-05-10", { occurs: true, mode: "drive", doorToDoorHours: 6.5, overnightAway: false, fromBase: "Bowraville", toBase: "Sydney", destLabel: "Bowraville" }),
    ] };
    const r = countTravelDays(itin, "Sydney");
    expect(r.days).toBe(2);
    expect(r.reasons.every((x) => x.ruleFired === "over_3_hours")).toBe(true);
  });

  it("Melbourne metro show, MEL player -> 0 (travel on show day, local)", () => {
    const itin = { days: [
      showDay("2025-06-01", { occurs: true, mode: "drive", doorToDoorHours: 0.5, fromBase: "Melbourne", toBase: "Melbourne" }),
    ] };
    expect(countTravelDays(itin, "Melbourne").days).toBe(0);
  });

  it("Sydney one-off, MEL player up 9am back 10pm same day -> 0 (both legs on show day)", () => {
    const itin = { days: [
      showDay("2025-07-12", { occurs: true, mode: "flight", doorToDoorHours: 4.5, fromBase: "Melbourne", toBase: "Sydney", destLabel: "Sydney" }),
    ] };
    expect(countTravelDays(itin, "Melbourne").days).toBe(0);
  });

  it("Sydney show, SYD-based player -> 0 regardless of dates (local)", () => {
    const itin = { days: [
      travelDay("2025-08-04", { occurs: true, mode: "drive", doorToDoorHours: 0.8, fromBase: "Sydney", toBase: "Sydney" }), // local pre-day errand
      showDay("2025-08-05"),
    ] };
    expect(countTravelDays(itin, "Sydney").days).toBe(0);
  });

  it("Personal extension: 2 itinerary travel days + 2 personal days -> still 2", () => {
    const itin = { days: [
      travelDay("2025-05-08", { occurs: true, mode: "flight", doorToDoorHours: 11, overnightAway: true, fromBase: "Melbourne", toBase: "Bowraville", destLabel: "Bowraville" }),
      showDay("2025-05-09"),
      travelDay("2025-05-10", { occurs: true, mode: "flight", doorToDoorHours: 11, fromBase: "Bowraville", toBase: "Melbourne", destLabel: "Bowraville" }),
      // player chooses to stay on for a personal holiday and travels later - excluded
      travelDay("2025-05-12", { occurs: true, mode: "flight", doorToDoorHours: 5, isPersonal: true, fromBase: "Bowraville", toBase: "Melbourne" }),
      travelDay("2025-05-13", { occurs: true, mode: "drive", doorToDoorHours: 4, isPersonal: true, fromBase: "Melbourne", toBase: "Melbourne" }),
    ] };
    expect(countTravelDays(itin, "Melbourne").days).toBe(2);
  });
});

describe("countTravelDays - rule edges", () => {
  it("does not count a short, non-flight, no-overnight drive on a non-show day", () => {
    const itin = { days: [
      travelDay("2025-09-01", { occurs: true, mode: "drive", doorToDoorHours: 2, overnightAway: false, fromBase: "Melbourne", toBase: "Geelong" }),
    ] };
    expect(countTravelDays(itin, "Melbourne").days).toBe(0);
  });

  it("counts a non-show overnight even on a short leg", () => {
    const itin = { days: [
      travelDay("2025-09-01", { occurs: true, mode: "drive", doorToDoorHours: 2.5, overnightAway: true, fromBase: "Melbourne", toBase: "Bendigo" }),
    ] };
    const r = countTravelDays(itin, "Melbourne");
    expect(r.days).toBe(1);
    expect(r.reasons[0].ruleFired).toBe("overnight");
  });
});
