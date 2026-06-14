/**
 * Eligibility split and the qualification line. Both thresholds are pure
 * **inputs** (never baked in), so the UI can re-split instantly when an admin
 * changes a slider without recomputing raw stats. Boundaries use `>=`
 * (exactly-equal counts as qualified / above the line) per `product.md`.
 */

/** Minimal shape the participation split needs. */
interface HasWarsParticipated {
  readonly stats: { readonly warsParticipated: number };
}

/**
 * Splits players into the qualified pool (`warsParticipated >= minWarParticipation`)
 * and the rest. Input order is preserved within each group; input is not mutated.
 */
export function splitByParticipation<T extends HasWarsParticipated>(
  players: readonly T[],
  minWarParticipation: number
): { readonly qualifiedPool: readonly T[]; readonly notEnoughWars: readonly T[] } {
  const qualifiedPool: T[] = [];
  const notEnoughWars: T[] = [];
  for (const p of players) {
    if (p.stats.warsParticipated >= minWarParticipation) {
      qualifiedPool.push(p);
    } else {
      notEnoughWars.push(p);
    }
  }
  return { qualifiedPool, notEnoughWars };
}

/** Minimal shape the qualification line needs. */
interface HasAttackUsagePct {
  readonly stats: { readonly attackUsagePct: number };
}

/** A qualified-pool player tagged with whether they clear the acceptance line. */
export type Qualified<T> = T & { readonly aboveLine: boolean };

/**
 * Tags each qualified-pool player with `aboveLine = attackUsagePct >= acceptancePct`
 * (CWL-eligible). Returns new objects; the input is not mutated.
 */
export function markQualification<T extends HasAttackUsagePct>(
  qualifiedPool: readonly T[],
  acceptancePct: number
): readonly Qualified<T>[] {
  return qualifiedPool.map((p) => ({
    ...p,
    aboveLine: p.stats.attackUsagePct >= acceptancePct,
  }));
}
