/**
 * Schematic interaction-tree depth routing.
 *
 * Depth 1 → single-page board. Everything (scene shortcuts + their items)
 *           is collapsed onto the Core Strip; the grid shows ALL items
 *           from ALL enabled scenes flattened.
 * Depth 2 → Scene → Items (the historic default).
 * Depth 3 → Scene → Items → Modifier (forms a 2-word utterance, e.g.
 *           "biscuit + more").
 *
 * The Core Strip is ALWAYS shown regardless of depth.
 */

export type Depth = 1 | 2 | 3;

export interface SceneNode {
  id: string;
  key: string;
  label: string;
  items: ItemNode[];
}

export interface ItemNode {
  id: string;
  key: string;
  label: string;
  modifiers?: ModifierNode[];
}

export interface ModifierNode {
  key: string;
  label: string;
}

export type RouteStep =
  | { kind: "home" }
  | { kind: "scene"; sceneKey: string }
  | { kind: "item"; sceneKey: string; itemKey: string };

export interface ResolvedView {
  /** What the grid should render at this step. */
  cells: Array<{ id: string; key: string; label: string }>;
  /** Breadcrumb labels from Home → current. */
  breadcrumbs: string[];
  /** Whether tapping a cell should descend further (false on a leaf). */
  isLeaf: boolean;
}

/**
 * Pure function — given the scene tree, the active pupil depth, and the
 * current navigation step, return the cells + breadcrumbs to render.
 *
 * Defensive: returns `{ cells: [], isLeaf: true }` when the scene/item
 * referenced by `step` is missing instead of throwing.
 */
export function resolveView(
  scenes: SceneNode[],
  depth: Depth,
  step: RouteStep,
): ResolvedView {
  // Depth 1 collapses everything onto the home board.
  if (depth === 1) {
    const flat = scenes.flatMap((s) => s.items);
    return {
      cells: flat.map((i) => ({ id: i.id, key: i.key, label: i.label })),
      breadcrumbs: ["Home"],
      isLeaf: true,
    };
  }

  if (step.kind === "home") {
    return {
      cells: scenes.map((s) => ({ id: s.id, key: s.key, label: s.label })),
      breadcrumbs: ["Home"],
      isLeaf: false,
    };
  }

  const scene = scenes.find((s) => s.key === step.sceneKey);
  if (!scene) return { cells: [], breadcrumbs: ["Home"], isLeaf: true };

  if (step.kind === "scene") {
    return {
      cells: scene.items.map((i) => ({ id: i.id, key: i.key, label: i.label })),
      breadcrumbs: ["Home", scene.label],
      // At depth 2 the item is the leaf; at depth 3 the modifier is the leaf.
      isLeaf: depth === 2,
    };
  }

  // step.kind === "item" — only meaningful at depth 3
  if (depth !== 3) {
    return {
      cells: scene.items.map((i) => ({ id: i.id, key: i.key, label: i.label })),
      breadcrumbs: ["Home", scene.label],
      isLeaf: true,
    };
  }

  const item = scene.items.find((i) => i.key === step.itemKey);
  if (!item) return { cells: [], breadcrumbs: ["Home", scene.label], isLeaf: true };

  return {
    cells: (item.modifiers ?? []).map((m) => ({ id: `${item.id}:${m.key}`, key: m.key, label: m.label })),
    breadcrumbs: ["Home", scene.label, item.label],
    isLeaf: true,
  };
}

/**
 * Given a tap on a cell at the current step, return the next step.
 * Returns `null` if the next interaction should *not* navigate (i.e. it's a
 * leaf selection that should fire a notification instead).
 */
export function nextStep(current: RouteStep, depth: Depth, cellKey: string): RouteStep | null {
  if (depth === 1) return null;
  if (current.kind === "home") return { kind: "scene", sceneKey: cellKey };
  if (current.kind === "scene") {
    if (depth === 2) return null;
    return { kind: "item", sceneKey: current.sceneKey, itemKey: cellKey };
  }
  return null; // already at item; modifier tap is a leaf
}

/** The 6 always-visible core words. */
export const CORE_STRIP: ReadonlyArray<{ key: string; label: string }> = [
  { key: "core_more", label: "More" },
  { key: "core_stop", label: "Stop" },
  { key: "core_finished", label: "Finished" },
  { key: "core_help", label: "Help" },
  { key: "core_yes", label: "Yes" },
  { key: "core_no", label: "No" },
];
