/**
 * Pure blending + decay utilities for the next-card predictor.
 * Kept framework-free so it can be reused on the server (Deno) and tested.
 */

export const HALF_LIFE_DAYS = 14;
export const BLEND_SATURATION = 50; // # of pupil selections needed for w=1

export interface TransitionRow {
  from_card_id: string | null;
  to_card_id: string;
  count: number;
  last_seen_at: string; // ISO
}

export interface BanditRow {
  card_id: string;
  alpha: number;
  beta: number;
}

/** Exponential decay weight given days since event (half-life in days). */
export function decayWeight(daysAgo: number, halfLifeDays = HALF_LIFE_DAYS): number {
  return Math.pow(0.5, daysAgo / halfLifeDays);
}

/** Convert transitions out of `fromCardId` into a smoothed Markov prob vector. */
export function markovDistribution(
  rows: TransitionRow[],
  visibleCardIds: string[],
  fromCardId: string | null,
  now: Date = new Date(),
): Record<string, number> {
  const filtered = rows.filter(
    (r) => (r.from_card_id ?? null) === (fromCardId ?? null) && visibleCardIds.includes(r.to_card_id),
  );
  const decayedCounts: Record<string, number> = {};
  for (const id of visibleCardIds) decayedCounts[id] = 0;
  for (const r of filtered) {
    const days = (now.getTime() - new Date(r.last_seen_at).getTime()) / 86_400_000;
    decayedCounts[r.to_card_id] += r.count * decayWeight(Math.max(0, days));
  }
  // Laplace add-one over the visible vocabulary.
  const k = visibleCardIds.length;
  const total = visibleCardIds.reduce((s, id) => s + decayedCounts[id] + 1, 0);
  const out: Record<string, number> = {};
  for (const id of visibleCardIds) out[id] = (decayedCounts[id] + 1) / (total || k);
  return out;
}

/** Mean of Beta(alpha, beta), normalised across visible cards. */
export function banditDistribution(
  arms: BanditRow[],
  visibleCardIds: string[],
): Record<string, number> {
  const byId = new Map(arms.map((a) => [a.card_id, a]));
  const means: Record<string, number> = {};
  let sum = 0;
  for (const id of visibleCardIds) {
    const a = byId.get(id);
    const alpha = a?.alpha ?? 1;
    const beta = a?.beta ?? 1;
    const m = alpha / (alpha + beta);
    means[id] = m;
    sum += m;
  }
  const out: Record<string, number> = {};
  for (const id of visibleCardIds) out[id] = sum > 0 ? means[id] / sum : 1 / visibleCardIds.length;
  return out;
}

/** Personal-vs-global mixing weight, capped at 1. */
export function pupilWeight(nPupilSelectionsThisScene: number, saturation = BLEND_SATURATION): number {
  return Math.min(1, Math.max(0, nPupilSelectionsThisScene) / saturation);
}

/** p_final = w * p_markov + (1 - w) * p_bandit */
export function blend(
  markov: Record<string, number>,
  bandit: Record<string, number>,
  w: number,
): Record<string, number> {
  const ids = new Set([...Object.keys(markov), ...Object.keys(bandit)]);
  const out: Record<string, number> = {};
  for (const id of ids) {
    out[id] = w * (markov[id] ?? 0) + (1 - w) * (bandit[id] ?? 0);
  }
  return out;
}

export interface TopChoice {
  cardId: string;
  probability: number;
  reason: string;
}

export function topK(
  blended: Record<string, number>,
  markov: Record<string, number>,
  bandit: Record<string, number>,
  w: number,
  k = 3,
  labelByCard: Record<string, string> = {},
  fromCardLabel?: string,
): TopChoice[] {
  return Object.entries(blended)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([cardId, probability]) => {
      const m = markov[cardId] ?? 0;
      const b = bandit[cardId] ?? 0;
      const markovWeighted = w * m;
      const banditWeighted = (1 - w) * b;
      let reason: string;
      if (markovWeighted > banditWeighted && fromCardLabel) {
        reason = `Frequently chosen after '${fromCardLabel}'`;
      } else if (markovWeighted > banditWeighted) {
        reason = `A regular choice for this pupil`;
      } else {
        reason = `Popular among pupils with similar profile`;
      }
      const label = labelByCard[cardId];
      return { cardId, probability, reason: label ? `${reason}` : reason };
    });
}
