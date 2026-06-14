/**
 * Deterministically generates a stable war ID from the home clan tag, opponent tag, and preparation start time.
 */
export function getWarId(
  clanTag: string,
  opponentTag: string,
  preparationStartTime: string
): string {
  const cleanClan = clanTag.replace(/#/g, '').toUpperCase();
  const cleanOpponent = opponentTag.replace(/#/g, '').toUpperCase();
  const cleanTime = preparationStartTime.replace(/[^a-zA-Z0-9]/g, '');
  return `${cleanClan}-${cleanOpponent}-${cleanTime}`;
}

/**
 * Deterministically generates a stable attack ID from the attacker tag, defender tag, and the global attack order in the war.
 */
export function getAttackId(attackerTag: string, defenderTag: string, order: number): string {
  const cleanAttacker = attackerTag.replace(/#/g, '').toUpperCase();
  const cleanDefender = defenderTag.replace(/#/g, '').toUpperCase();
  return `${cleanAttacker}-${cleanDefender}-${order}`;
}
