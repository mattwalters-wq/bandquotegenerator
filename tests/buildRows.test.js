import { describe, it, expect } from "vitest";
import { buildRows, EMPTY_SHOW, INITIAL_FORM } from "../lib/constants";
import { POLICY } from "../lib/policy";

const show = (over) => ({ ...EMPTY_SHOW, ...over });
const form = (shows, over = {}) => ({ ...INITIAL_FORM, shows, ...over });

describe("Bug 1 - no rolled-up travel day line (itemised lines are the sole source)", () => {
  it("2 travel days + 1 show day + 1 off day -> exactly one line per engagement plus per diem", () => {
    const f = form(
      [
        show({ engagement: "MSO Hamer Hall", performanceDate: "July 10, 2026", activity: "Performance", performanceFee: 550 }),
        show({ engagement: "Travel day", performanceDate: "July 9, 2026", activity: "Travel Day", performanceFee: POLICY.travelDay }),
        show({ engagement: "Travel day", performanceDate: "July 11, 2026", activity: "Travel Day", performanceFee: POLICY.travelDay }),
        show({ engagement: "Off day", performanceDate: "July 12, 2026", activity: "Off Day", performanceFee: 0 }),
      ],
      // Legacy rollup flags deliberately still set - they must be ignored.
      { hasTravelDay: true, travelDays: 2, perDiem: 89, pdDays: 2 },
    );
    const { rows, total } = buildRows(f);

    // Exactly one line per engagement (4) plus the per diem line = 5.
    expect(rows).toHaveLength(5);

    // No grouped "Travel day x N" rollup: the only travel lines are the
    // itemised per-engagement ones, every fee line has qty 1.
    const travelLines = rows.filter((r) => /travel day/i.test(r.item));
    expect(travelLines).toHaveLength(2);
    travelLines.forEach((r) => {
      expect(r.qty).toBe(1);
      expect(r.item).toMatch(/Travel Day fee - Travel day \(July \d+, 2026\)/);
    });
    expect(rows.some((r) => r.item === "Travel day")).toBe(false);

    // Total is exactly the sum of the itemised lines.
    const sum = rows.reduce((s, r) => s + r.total, 0);
    expect(total).toBe(sum);
    expect(total).toBe(550 + 275 + 275 + 0 + 89 * 2);
  });

  it("ignores legacy hasTravelDay flags entirely when there are no itemised travel entries", () => {
    const f = form(
      [show({ engagement: "Solo show", activity: "Performance", performanceFee: 550 })],
      { hasTravelDay: true, travelDays: 3, pdDays: 0 },
    );
    const { rows, total } = buildRows(f);
    expect(rows).toHaveLength(1);
    expect(total).toBe(550);
  });
});

describe("Bug 2 - per-show rehearsal fee on a show day", () => {
  it("a $550 show with a $200/2hr rehearsal emits two adjacent lines totalling $750", () => {
    const f = form(
      [show({ engagement: "MSO", performanceDate: "July 10, 2026", activity: "Performance", performanceFee: 550, hasRehearsal: true, rehearsalHours: "2", rehearsalFee: 200 })],
      { pdDays: 0 },
    );
    const { rows, total, superBase, superAmount } = buildRows(f);

    expect(rows).toHaveLength(2);
    expect(rows[0].item).toBe("Performance fee");
    expect(rows[0].total).toBe(550);
    // Inserted directly after the performance fee line.
    expect(rows[1].item).toBe("Rehearsal fee (2 hrs)");
    expect(rows[1].amount).toBe(200);
    expect(rows[1].qty).toBe(1);
    expect(rows[1].total).toBe(200);
    expect(total).toBe(750);

    // Super is 12% of $750 (performance + rehearsal), not 12% of $550.
    expect(superBase).toBe(750);
    expect(superAmount).toBe(Math.round(750 * 0.12));
    expect(superAmount).toBe(90);
  });

  it("multi-engagement: rehearsal line sits between its show's fee line and the next engagement, labelled with event and date", () => {
    const f = form(
      [
        show({ engagement: "MSO", performanceDate: "July 10, 2026", activity: "Performance", performanceFee: 550, hasRehearsal: true, rehearsalHours: "2", rehearsalFee: 200 }),
        show({ engagement: "Travel day", performanceDate: "July 11, 2026", activity: "Travel Day", performanceFee: 275 }),
      ],
      { pdDays: 0 },
    );
    const { rows } = buildRows(f);
    expect(rows.map((r) => r.item)).toEqual([
      "Performance fee - MSO (July 10, 2026)",
      "Rehearsal fee (2 hrs) - MSO (July 10, 2026)",
      "Travel Day fee - Travel day (July 11, 2026)",
    ]);
  });

  it("super base excludes travel-day and off-day fees", () => {
    const f = form(
      [
        show({ engagement: "MSO", activity: "Performance", performanceFee: 550, hasRehearsal: true, rehearsalHours: "2", rehearsalFee: 200 }),
        show({ engagement: "Travel day", activity: "Travel Day", performanceFee: 275 }),
        show({ engagement: "Off day", activity: "Off Day", performanceFee: 100 }),
      ],
      { pdDays: 0 },
    );
    const { superBase, superAmount } = buildRows(f);
    expect(superBase).toBe(750); // 550 + 200 only - never 275 or 100
    expect(superAmount).toBe(90);
  });

  it("standalone rehearsal fee (form-level) still counts toward super", () => {
    const f = form(
      [show({ engagement: "MSO", activity: "Performance", performanceFee: 550 })],
      { hasRehearsalFee: true, rehearsalFee: 225, rehearsalNote: "1/2 day rehearsal", pdDays: 0 },
    );
    const { superBase } = buildRows(f);
    expect(superBase).toBe(775);
  });

  it("no rehearsal line when the fee is 0 or the checkbox is off", () => {
    const f = form(
      [show({ engagement: "MSO", activity: "Performance", performanceFee: 550, hasRehearsal: true, rehearsalHours: "2", rehearsalFee: 0 })],
      { pdDays: 0 },
    );
    expect(buildRows(f).rows).toHaveLength(1);
  });
});
