import { describe, it, expect } from "vitest";
import {
  resolveView,
  nextStep,
  type SceneNode,
  type Depth,
  type RouteStep,
} from "@/lib/depthRouter";

const scenes: SceneNode[] = [
  {
    id: "s-food",
    key: "food",
    label: "Food",
    items: [
      {
        id: "i-biscuit",
        key: "biscuit",
        label: "Biscuit",
        modifiers: [
          { key: "more", label: "More" },
          { key: "stop", label: "Stop" },
        ],
      },
      { id: "i-apple", key: "apple", label: "Apple", modifiers: [] },
    ],
  },
  {
    id: "s-play",
    key: "play",
    label: "Play",
    items: [{ id: "i-book", key: "book", label: "Book" }],
  },
];

const HOME: RouteStep = { kind: "home" };
const FOOD: RouteStep = { kind: "scene", sceneKey: "food" };
const BISCUIT: RouteStep = { kind: "item", sceneKey: "food", itemKey: "biscuit" };

describe("resolveView — depth 1 (single page)", () => {
  it("flattens all items onto one screen, marked as leaf", () => {
    const v = resolveView(scenes, 1, HOME);
    expect(v.cells.map((c) => c.key)).toEqual(["biscuit", "apple", "book"]);
    expect(v.isLeaf).toBe(true);
    expect(v.breadcrumbs).toEqual(["Home"]);
  });

  it("ignores the requested step at depth 1", () => {
    const v = resolveView(scenes, 1, FOOD);
    expect(v.cells).toHaveLength(3);
  });
});

describe("resolveView — depth 2 (scene → item)", () => {
  it("shows scenes at home", () => {
    const v = resolveView(scenes, 2, HOME);
    expect(v.cells.map((c) => c.key)).toEqual(["food", "play"]);
    expect(v.isLeaf).toBe(false);
  });

  it("shows items inside a scene as leaves", () => {
    const v = resolveView(scenes, 2, FOOD);
    expect(v.cells.map((c) => c.key)).toEqual(["biscuit", "apple"]);
    expect(v.breadcrumbs).toEqual(["Home", "Food"]);
    expect(v.isLeaf).toBe(true);
  });
});

describe("resolveView — depth 3 (scene → item → modifier)", () => {
  it("descends into modifiers as the final leaf", () => {
    const v = resolveView(scenes, 3, BISCUIT);
    expect(v.cells.map((c) => c.key)).toEqual(["more", "stop"]);
    expect(v.breadcrumbs).toEqual(["Home", "Food", "Biscuit"]);
    expect(v.isLeaf).toBe(true);
  });

  it("scene step is NOT a leaf at depth 3", () => {
    const v = resolveView(scenes, 3, FOOD);
    expect(v.isLeaf).toBe(false);
  });
});

describe("resolveView — edge cases", () => {
  it("missing scene returns empty cells", () => {
    const v = resolveView(scenes, 2, { kind: "scene", sceneKey: "nope" });
    expect(v.cells).toEqual([]);
    expect(v.isLeaf).toBe(true);
  });

  it("missing item at depth 3 returns empty cells", () => {
    const v = resolveView(scenes, 3, { kind: "item", sceneKey: "food", itemKey: "ghost" });
    expect(v.cells).toEqual([]);
    expect(v.breadcrumbs).toEqual(["Home", "Food"]);
  });

  it("item with no modifiers at depth 3 returns empty leaf", () => {
    const v = resolveView(scenes, 3, { kind: "item", sceneKey: "food", itemKey: "apple" });
    expect(v.cells).toEqual([]);
    expect(v.isLeaf).toBe(true);
  });

  it("empty scene list returns empty home", () => {
    const v = resolveView([], 2, HOME);
    expect(v.cells).toEqual([]);
  });
});

describe("nextStep navigation", () => {
  it("depth 1 never navigates", () => {
    expect(nextStep(HOME, 1 as Depth, "food")).toBeNull();
  });

  it("depth 2: home → scene, scene → null (leaf select)", () => {
    expect(nextStep(HOME, 2, "food")).toEqual({ kind: "scene", sceneKey: "food" });
    expect(nextStep(FOOD, 2, "biscuit")).toBeNull();
  });

  it("depth 3: scene → item, then item is terminal", () => {
    expect(nextStep(FOOD, 3, "biscuit")).toEqual({
      kind: "item",
      sceneKey: "food",
      itemKey: "biscuit",
    });
    expect(nextStep(BISCUIT, 3, "more")).toBeNull();
  });
});
