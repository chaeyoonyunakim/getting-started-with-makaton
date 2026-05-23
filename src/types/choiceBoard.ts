export interface ChoiceItem {
  id: string;
  label: string;
  /** Makaton Asset Bank asset ID (Category 3257) */
  makatonId: number;
  /** Resolved image URL from asset bank. Falls back to placeholder when image can't load. */
  imagePath?: string;
  colorClass: string;
}

export interface Category extends ChoiceItem {
  items: ChoiceItem[];
}

/** Base URL for the Makaton Asset Bank (Category 3257) */
export const MAKATON_ASSET_BANK_BASE =
  "https://makaton.assetbank-server.com/assetbank-makaton";

/** Build the view URL for a specific Makaton asset */
export function makatonAssetUrl(makatonId: number): string {
  return `${MAKATON_ASSET_BANK_BASE}/action/viewAsset?id=${makatonId}`;
}

