import { Category } from "@/types/choiceBoard";

/**
 * Makaton choice board data.
 *
 * Images are stored locally under /public/symbols/[name].png.
 * If an image isn't available yet BoardCell calls resolveSymbol (ARASAAC → Mulberry → Sclera).
 */

const symbolPath = (name: string) => `/symbols/${name}.png`;

export const categories: Category[] = [
  {
    id: "food",
    label: "Food",
    makatonId: 3300,
    imagePath: symbolPath("food"),
    colorClass: "bg-category-food",
    items: [
      { id: "apple", label: "Apple", makatonId: 3301, imagePath: symbolPath("apple"), colorClass: "bg-category-food" },
      { id: "biscuit", label: "Biscuit", makatonId: 3302, imagePath: symbolPath("biscuit"), colorClass: "bg-category-food" },
      { id: "water", label: "Water", makatonId: 3303, imagePath: symbolPath("water"), colorClass: "bg-category-food" },
      { id: "bread", label: "Bread", makatonId: 3304, imagePath: symbolPath("bread"), colorClass: "bg-category-food" },
    ],
  },
  {
    id: "play",
    label: "Play",
    makatonId: 3310,
    imagePath: symbolPath("play"),
    colorClass: "bg-category-play",
    items: [
      { id: "game", label: "Game", makatonId: 3311, imagePath: symbolPath("game"), colorClass: "bg-category-play" },
      { id: "blocks", label: "Blocks", makatonId: 3312, imagePath: symbolPath("blocks"), colorClass: "bg-category-play" },
      { id: "book", label: "Book", makatonId: 3313, imagePath: symbolPath("book"), colorClass: "bg-category-play" },
      { id: "music", label: "Music", makatonId: 3314, imagePath: symbolPath("music"), colorClass: "bg-category-play" },
    ],
  },
  {
    id: "feelings",
    label: "Feelings",
    makatonId: 3320,
    imagePath: symbolPath("feelings"),
    colorClass: "bg-category-feelings",
    items: [
      { id: "happy", label: "Happy", makatonId: 3321, imagePath: symbolPath("happy"), colorClass: "bg-category-feelings" },
      { id: "sad", label: "Sad", makatonId: 3322, imagePath: symbolPath("sad"), colorClass: "bg-category-feelings" },
      { id: "love", label: "Love", makatonId: 3323, imagePath: symbolPath("love"), colorClass: "bg-category-feelings" },
      { id: "good", label: "Good", makatonId: 3324, imagePath: symbolPath("good"), colorClass: "bg-category-feelings" },
    ],
  },
  {
    id: "toilet",
    label: "Toilet",
    makatonId: 3330,
    imagePath: symbolPath("toilet"),
    colorClass: "bg-category-toilet",
    items: [
      { id: "toilet", label: "Toilet", makatonId: 3331, imagePath: symbolPath("toilet"), colorClass: "bg-category-toilet" },
      { id: "wash", label: "Wash Hands", makatonId: 3332, imagePath: symbolPath("wash hands"), colorClass: "bg-category-toilet" },
      { id: "help", label: "Help", makatonId: 3333, imagePath: symbolPath("help"), colorClass: "bg-category-toilet" },
      { id: "change", label: "Change", makatonId: 3334, imagePath: symbolPath("change"), colorClass: "bg-category-toilet" },
    ],
  },
];
