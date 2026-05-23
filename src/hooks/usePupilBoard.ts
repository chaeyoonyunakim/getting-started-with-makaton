import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { categories as localCategories } from "@/data/makaton";
import type { BoardSymbol } from "@/components/board/BoardCell";

export interface PupilBoardData {
  coreItems: BoardSymbol[];
  gridItems: BoardSymbol[];
  rows: number;
  cols: number;
}

const CATEGORY_COLOR: Record<string, string> = {
  food: "bg-category-food",
  play: "bg-category-play",
  feelings: "bg-category-feelings",
  toilet: "bg-category-toilet",
  root: "bg-primary",
};

const colorFor = (categoryKey: string | null | undefined) =>
  CATEGORY_COLOR[categoryKey ?? "root"] ?? "bg-primary";

interface CardRow {
  id: string;
  key: string;
  label: string;
  symbol_url: string | null;
  category_key: string | null;
}

/**
 * Typed React Query hook that returns the board configuration for a pupil.
 * - `sceneId` defaults to "root" (categories home screen).
 * - Falls back to local fixtures if the DB returns no rows (defensive).
 */
export function usePupilBoard(pupilId: string | null, sceneId: string | null = "root") {
  return useQuery<PupilBoardData>({
    queryKey: ["pupilBoard", pupilId, sceneId],
    enabled: sceneId !== null,
    queryFn: async () => {
      // Pull pupil settings (grid size) if we have an id; otherwise defaults.
      let gridSize = 6;
      if (pupilId) {
        const { data: pupil } = await supabase
          .from("pupils")
          .select("grid_size")
          .eq("id", pupilId)
          .maybeSingle();
        if (pupil?.grid_size) gridSize = pupil.grid_size;
      }

      const { data: cards } = await supabase
        .from("cards")
        .select("id, key, label, symbol_url, category_key")
        .eq("category_key", sceneId);

      let gridItems: BoardSymbol[] = (cards ?? []).map((c: CardRow) => ({
        id: c.key,
        label: c.label,
        imagePath: c.symbol_url ?? undefined,
        colorClass: colorFor(c.category_key),
      }));

      // Defensive fallback to local data
      if (gridItems.length === 0) {
        if (sceneId === "root") {
          gridItems = localCategories.map((c) => ({
            id: c.id,
            label: c.label,
            imagePath: c.imagePath,
            colorClass: c.colorClass,
          }));
        } else {
          const cat = localCategories.find((c) => c.id === sceneId);
          gridItems =
            cat?.items.map((i) => ({
              id: i.id,
              label: i.label,
              imagePath: i.imagePath,
              colorClass: i.colorClass,
            })) ?? [];
        }
      }

      const cols = gridSize >= 6 ? 2 : 2;
      const rows = Math.ceil(gridItems.length / cols);

      return { coreItems: [], gridItems, rows, cols };
    },
    staleTime: 1000 * 60 * 5,
  });
}
