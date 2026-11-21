import { describe, expect, it } from "vitest";
import { bboxContains, formatBbox, gridStep, normalizeBbox, requestBbox } from "@/lib/geo/bbox";
import { bboxSchema, exploreQuerySchema } from "@/lib/validation/explore";

describe("normalizeBbox", () => {
  it("keeps a normal box", () => {
    expect(normalizeBbox([-10, 40, 10, 60])).toEqual([[-10, 40, 10, 60]]);
  });

  it("splits a box crossing the antimeridian", () => {
    expect(normalizeBbox([170, -20, 190, 0])).toEqual([
      [170, -20, 180, 0],
      [-180, -20, -170, 0],
    ]);
  });

  it("unwraps longitudes beyond ±180 from a wrapped map", () => {
    expect(normalizeBbox([350, 0, 370, 10])).toEqual([[-10, 0, 10, 10]]);
    expect(normalizeBbox([-200, 0, -170, 10])).toEqual([
      [160, 0, 180, 10],
      [-180, 0, -170, 10],
    ]);
  });

  it("treats 360° or more as the whole world and clamps latitudes", () => {
    expect(normalizeBbox([-300, -95, 300, 95])).toEqual([[-180, -90, 180, 90]]);
  });
});

describe("requestBbox", () => {
  it("pads the viewport and snaps outward to the zoom's grid", () => {
    const view: [number, number, number, number] = [-6.4, 53.2, -6.0, 53.5];
    const box = requestBbox(view, 10);
    expect(bboxContains(box, view)).toBe(true);
    const step = gridStep(10);
    for (const n of box) expect(Math.abs(n / step - Math.round(n / step))).toBeLessThan(1e-3);
    // Padded by half the viewport on each side.
    expect(box[0]).toBeLessThanOrEqual(-6.6);
    expect(box[2]).toBeGreaterThanOrEqual(-5.8);
  });

  it("gives nearby viewports the same request (shared cache key)", () => {
    const a = formatBbox(requestBbox([-6.45, 53.22, -6.07, 53.48], 10));
    const b = formatBbox(requestBbox([-6.449, 53.221, -6.069, 53.481], 10));
    expect(a).toBe(b);
  });

  it("covers the world at low zoom", () => {
    expect(requestBbox([-170, -60, 170, 80], 1)).toEqual([-180, -85.06, 180, 85.06]);
  });
});

describe("explore query validation", () => {
  it("parses bbox and zoom", () => {
    expect(exploreQuerySchema.parse({ bbox: "-10,40,10,60", zoom: "5" })).toEqual({
      bbox: [-10, 40, 10, 60],
      zoom: 5,
    });
  });

  it.each(["", "1,2,3", "a,b,c,d", "10,40,-10,60", "0,95,10,96", "0,0,1000,1"])(
    "rejects %j",
    (bbox) => {
      expect(bboxSchema.safeParse(bbox).success).toBe(false);
    },
  );
});
