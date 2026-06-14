import { describe, it, expect } from 'vitest';
import { getWarId, getAttackId } from './identity';

describe('getWarId', () => {
  it('should generate a stable deterministic warId from clan tag, opponent tag, and preparationStartTime', () => {
    const clanTag = '#2PGQYPQ';
    const opponentTag = '#OPPONENT1';
    const prepStart = '2026-06-14T19:00:00.000Z';

    const id1 = getWarId(clanTag, opponentTag, prepStart);
    const id2 = getWarId(clanTag, opponentTag, prepStart);

    expect(id1).toBe(id2);
    expect(id1).toBe('2PGQYPQ-OPPONENT1-20260614T190000000Z');
  });

  it('should generate different warIds for different opponents', () => {
    const clanTag = '#2PGQYPQ';
    const opponentTagA = '#OPPONENT_A';
    const opponentTagB = '#OPPONENT_B';
    const prepStart = '2026-06-14T19:00:00.000Z';

    const idA = getWarId(clanTag, opponentTagA, prepStart);
    const idB = getWarId(clanTag, opponentTagB, prepStart);

    expect(idA).not.toBe(idB);
  });

  it('should generate different warIds for different preparationStartTime even with same opponent', () => {
    const clanTag = '#2PGQYPQ';
    const opponentTag = '#OPPONENT1';
    const prepStart1 = '2026-06-14T19:00:00.000Z';
    const prepStart2 = '2026-07-14T19:00:00.000Z';

    const id1 = getWarId(clanTag, opponentTag, prepStart1);
    const id2 = getWarId(clanTag, opponentTag, prepStart2);

    expect(id1).not.toBe(id2);
  });
});

describe('getAttackId', () => {
  it('should generate a stable deterministic attackId from attacker tag and order', () => {
    const attackerTag = '#MEMBER1';
    const order = 5;

    const id1 = getAttackId(attackerTag, order);
    const id2 = getAttackId(attackerTag, order);

    expect(id1).toBe(id2);
    expect(id1).toBe('MEMBER1-5');
  });

  it('should generate different attackIds for different order/attacks of same member', () => {
    const attackerTag = '#MEMBER1';
    const id1 = getAttackId(attackerTag, 1);
    const id2 = getAttackId(attackerTag, 2);

    expect(id1).not.toBe(id2);
  });
});
