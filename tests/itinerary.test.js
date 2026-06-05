import { describe, it, expect } from "vitest";
import { computePlayerTravel, computePlayerTravelFromAI, validateTravelEstimate, parseHour } from "../lib/itinerary";

describe("computePlayerTravel - inference from the static table", () => {
  it("MEL player, Gold Coast single show -> 1 travel day, 1 night", () => {
    const r = computePlayerTravel({ homeBase: "Melbourne", destination: "Gold Coast", showDates: ["2025-05-17"] });
    expect(r.resolved).toBe(true);
    expect(r.sameDayIn).toBe(true);
    expect(r.sameDayOut).toBe(false);
    expect(r.travelDays).toBe(1);
    expect(r.nights).toBe(1);
    expect(r.reasons[0].ruleFired).toBe("flight");
  });

  it("MEL player, Melbourne metro show -> 0", () => {
    const r = computePlayerTravel({ homeBase: "Melbourne", destination: "Melbourne", showDates: ["2025-06-01"] });
    expect(r.travelDays).toBe(0);
    expect(r.nights).toBe(0);
  });

  it("SYD player, Sydney show -> 0 (local)", () => {
    const r = computePlayerTravel({ homeBase: "Sydney", destination: "Sydney", showDates: ["2025-08-05"] });
    expect(r.travelDays).toBe(0);
  });

  it("MEL player, Bowraville (regional, fly+drive) -> 2 travel days, 2 nights", () => {
    const r = computePlayerTravel({ homeBase: "Melbourne", destination: "Bowraville", showDates: ["2025-05-09"] });
    expect(r.travelDays).toBe(2);
    expect(r.nights).toBe(2);
  });

  it("SYD player, Bowraville (6.5h drive each way) -> 2 travel days", () => {
    const r = computePlayerTravel({ homeBase: "Sydney", destination: "Bowraville", showDates: ["2025-05-09"] });
    expect(r.travelDays).toBe(2);
    expect(r.nights).toBe(2);
    expect(r.reasons.every((x) => x.ruleFired === "over_3_hours")).toBe(true);
  });

  it("per-player from home base: a Sydney show is away for MEL, local for SYD", () => {
    const mel = computePlayerTravel({ homeBase: "Melbourne", destination: "Sydney", showDates: ["2025-07-12"] });
    const syd = computePlayerTravel({ homeBase: "Sydney", destination: "Sydney", showDates: ["2025-07-12"] });
    expect(syd.travelDays).toBe(0);
    // MEL is conservative: same-day in, but assumes overnight out for a 4.5h flight return.
    expect(mel.sameDayIn).toBe(true);
    expect(mel.travelDays).toBeGreaterThanOrEqual(1);
  });

  it("unknown destination needs an estimate (AI fallback)", () => {
    const r = computePlayerTravel({ homeBase: "Melbourne", destination: "Wagga Wagga", showDates: ["2025-05-09"] });
    expect(r.resolved).toBe(false);
    expect(r.needsEstimate).toBe(true);
  });

  it("unknown regional resolves when given a gateway + drive hours", () => {
    const r = computePlayerTravel({
      homeBase: "Melbourne", destination: "Some Town", showDates: ["2025-05-09"],
      regional: { gateway: "Sydney", driveHoursFromGateway: 6 },
    });
    expect(r.resolved).toBe(true);
    expect(r.travelDays).toBe(2);
  });

  it("flags the default soundcheck as an assumption when none supplied", () => {
    const r = computePlayerTravel({ homeBase: "Melbourne", destination: "Gold Coast", showDates: ["2025-05-17"] });
    expect(r.assumptions.some((a) => a.assumed && /3:00pm soundcheck/.test(a.text))).toBe(true);
  });
});

describe("computePlayerTravelFromAI", () => {
  it("builds an itinerary from a validated AI estimate", () => {
    const r = computePlayerTravelFromAI(
      { homeBase: "Melbourne", destination: "Wagga Wagga", showDates: ["2025-05-09"] },
      { canTravelSameDayIn: false, canTravelSameDayOut: false, estimatedDoorToDoorHours: 6, assumptions: ["No direct flights"] },
    );
    expect(r.travelDays).toBe(2);
    expect(r.assumptions.some((a) => a.text === "No direct flights")).toBe(true);
  });
});

describe("validateTravelEstimate - strict JSON only", () => {
  it("accepts a well-formed object", () => {
    const r = validateTravelEstimate({ canTravelSameDayIn: true, canTravelSameDayOut: false, estimatedDoorToDoorHours: 5.5, assumptions: ["x"] });
    expect(r.valid).toBe(true);
    expect(r.value.estimatedDoorToDoorHours).toBe(5.5);
  });

  it("parses a JSON string", () => {
    const r = validateTravelEstimate('{"canTravelSameDayIn":true,"canTravelSameDayOut":true,"estimatedDoorToDoorHours":2,"assumptions":[]}');
    expect(r.valid).toBe(true);
  });

  it("rejects non-JSON / free text", () => {
    expect(validateTravelEstimate("the flight is about 5 hours").valid).toBe(false);
  });

  it("rejects missing booleans", () => {
    expect(validateTravelEstimate({ estimatedDoorToDoorHours: 5 }).valid).toBe(false);
  });

  it("rejects out-of-range hours", () => {
    expect(validateTravelEstimate({ canTravelSameDayIn: true, canTravelSameDayOut: true, estimatedDoorToDoorHours: 99 }).valid).toBe(false);
  });
});

describe("parseHour", () => {
  it("parses 24h and am/pm", () => {
    expect(parseHour("15:00", 0)).toBe(15);
    expect(parseHour("3:00pm", 0)).toBe(15);
    expect(parseHour("3pm", 0)).toBe(15);
    expect(parseHour("9am", 0)).toBe(9);
    expect(parseHour(undefined, 15)).toBe(15);
  });
});
