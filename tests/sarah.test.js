import { describe, it, expect } from "vitest";
import { buildRows, EMPTY_SHOW, INITIAL_FORM } from "../lib/constants";
import { computeMusician } from "../lib/policy";
import { effectiveRates, getArtist } from "../lib/artists";

const show = (over) => ({ ...EMPTY_SHOW, ...over });

describe("Sarah Grace Buckley - per-artist rates", () => {
  it("effective rates override the shared policy where she differs, inherit the rest", () => {
    const r = effectiveRates("sarah");
    expect(r.showFee).toEqual({ vic: 200, interstate: 200 });
    expect(r.transportCap).toBe(50);
    expect(r.superMode).toBe("inclusive");
    // Travel day and per diem inherit the shared band policy until specified.
    expect(r.travelDay).toBe(275);
    expect(r.perDiem).toBe(89);
  });

  it("Emma's effective rates are unchanged shared policy with super added on top", () => {
    const r = effectiveRates("emma");
    expect(r.showFee).toEqual({ vic: 450, interstate: 550 });
    expect(r.superMode).toBe("additional");
    expect(r.transportCap).toBe(80);
  });

  it("computeMusician with Sarah's rates: $200 fee, $50 petrol, NO super added on top", () => {
    const per = computeMusician({ feeKey: "vic", rates: effectiveRates("sarah") });
    expect(per.showFee).toBe(200);
    expect(per.transport).toBe(50);
    expect(per.super).toBe(0);
    expect(per.superMode).toBe("inclusive");
    expect(per.total).toBe(250); // 200 + 50, nothing added for super
    expect(per.lines.some((l) => /^Super \(/.test(l.label))).toBe(false);
    expect(per.lines[0].label).toBe("Show fee (incl. super)");
    expect(per.lines.some((l) => l.label === "Petrol allowance ($50)")).toBe(true);
  });

  it("computeMusician without rates keeps Emma's behaviour (regression)", () => {
    const per = computeMusician({ feeKey: "interstate" });
    expect(per.showFee).toBe(550);
    expect(per.super).toBe(66); // 12% of 550
    expect(per.total).toBe(550 + 80 + 66);
  });

  it("Jesse's launch-show card: show $200 + $50 petrol, two rehearsals $100 + $50 petrol each", () => {
    const f = {
      ...INITIAL_FORM,
      artist: "sarah",
      pdDays: 0,
      shows: [
        show({ engagement: "Launch Show", performanceDate: "July 27, 2026", activity: "Performance", performanceFee: 200, petrolFee: 50 }),
        show({ engagement: "Rehearsal 1", performanceDate: "July 20, 2026", activity: "Rehearsal", performanceFee: 100, petrolFee: 50 }),
        show({ engagement: "Rehearsal 2", performanceDate: "July 24, 2026", activity: "Rehearsal", performanceFee: 100, petrolFee: 50 }),
      ],
    };
    const { rows, total, superAmount, superMode } = buildRows(f);
    // 3 fee lines + 3 petrol lines
    expect(rows).toHaveLength(6);
    expect(rows.filter((r) => /^Petrol allowance/.test(r.item))).toHaveLength(3);
    expect(total).toBe(200 + 100 + 100 + 50 * 3); // $550
    // Super baked in: nothing added on top.
    expect(superMode).toBe("inclusive");
    expect(superAmount).toBe(0);
  });

  it("trio card (Jacob/Tate/Lozz): $200 show + $50 rehearsal, no petrol line when 0", () => {
    const f = {
      ...INITIAL_FORM,
      artist: "sarah",
      pdDays: 0,
      shows: [show({ engagement: "Launch Show", activity: "Performance", performanceFee: 200, hasRehearsal: true, rehearsalHours: "", rehearsalFee: 50 })],
    };
    const { rows, total, superMode } = buildRows(f);
    expect(rows).toHaveLength(2);
    expect(rows[1].item).toBe("Rehearsal fee");
    expect(total).toBe(250);
    expect(superMode).toBe("inclusive");
  });

  it("petrol never enters the super base (Emma card with petrol, super still on fees only)", () => {
    const f = {
      ...INITIAL_FORM,
      artist: "emma",
      pdDays: 0,
      shows: [show({ engagement: "MSO", activity: "Performance", performanceFee: 550, petrolFee: 50 })],
    };
    const { superBase, superAmount, superMode } = buildRows(f);
    expect(superMode).toBe("additional");
    expect(superBase).toBe(550);
    expect(superAmount).toBe(66);
  });
});
