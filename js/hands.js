// 牌型定义与判定（数值来源：docs/02-牌型与计分.md）
export const HAND_TYPES = [
  { id: 'flush_five',     zh: '同花五条',   en: 'Flush Five',     chips: 160, mult: 16, cg: 50, mg: 3, priority: 13, secret: true },
  { id: 'flush_house',    zh: '同花葫芦',   en: 'Flush House',    chips: 140, mult: 14, cg: 40, mg: 4, priority: 12, secret: true },
  { id: 'five_kind',      zh: '五条',       en: 'Five of a Kind', chips: 120, mult: 12, cg: 35, mg: 3, priority: 11, secret: true },
  { id: 'straight_flush', zh: '同花顺',     en: 'Straight Flush', chips: 100, mult: 8,  cg: 40, mg: 4, priority: 10 },
  { id: 'four_kind',      zh: '四条',       en: 'Four of a Kind', chips: 60,  mult: 7,  cg: 30, mg: 3, priority: 9 },
  { id: 'full_house',     zh: '葫芦',       en: 'Full House',     chips: 40,  mult: 4,  cg: 25, mg: 2, priority: 8 },
  { id: 'flush',          zh: '同花',       en: 'Flush',          chips: 35,  mult: 4,  cg: 15, mg: 2, priority: 7 },
  { id: 'straight',       zh: '顺子',       en: 'Straight',       chips: 30,  mult: 4,  cg: 30, mg: 3, priority: 6 },
  { id: 'three_kind',     zh: '三条',       en: 'Three of a Kind', chips: 30, mult: 3,  cg: 20, mg: 2, priority: 5 },
  { id: 'two_pair',       zh: '两对',       en: 'Two Pair',       chips: 20,  mult: 2,  cg: 20, mg: 1, priority: 3 },
  { id: 'pair',           zh: '对子',       en: 'Pair',           chips: 10,  mult: 2,  cg: 15, mg: 1, priority: 2 },
  { id: 'high_card',      zh: '高牌',       en: 'High Card',      chips: 5,   mult: 1,  cg: 10, mg: 1, priority: 1 },
];

export const HAND_MAP = Object.fromEntries(HAND_TYPES.map((h) => [h.id, h]));

export function levelStats(typeId, level = 1) {
  const def = HAND_MAP[typeId] || HAND_MAP.high_card;
  const lv = Math.max(1, level);
  return {
    level: lv,
    chips: def.chips + (lv - 1) * def.cg,
    mult: def.mult + (lv - 1) * def.mg,
  };
}

function groupByRank(cards) {
  const map = new Map();
  for (const c of cards) {
    if (!map.has(c.rank)) map.set(c.rank, []);
    map.get(c.rank).push(c);
  }
  return [...map.entries()]
    .map(([rank, list]) => ({ rank, cards: list, size: list.length }))
    .sort((a, b) => b.size - a.size || b.rank - a.rank);
}

function isFlush(cards) {
  return cards.length === 5 && cards.every((c) => c.suit === cards[0].suit);
}

function isStraight(cards) {
  if (cards.length !== 5) return false;
  const ranks = [...new Set(cards.map((c) => c.rank))].sort((a, b) => a - b);
  if (ranks.length !== 5) return false;
  if (ranks[4] - ranks[0] === 4) return true;
  // A-2-3-4-5 轮子顺
  return ranks.join(',') === '2,3,4,5,14';
}

/**
 * 判定牌型，返回最高优先级的可成立牌型
 * @param {Array} cards 已选出的 1~5 张牌
 * @param {Object} levels 牌型等级表 { [typeId]: level }
 */
export function evaluateHand(cards, levels = {}) {
  if (!cards || cards.length === 0) return null;

  const groups = groupByRank(cards);
  const flush = isFlush(cards);
  const straight = isStraight(cards);
  const sizes = groups.map((g) => g.size);
  const top = groups[0];

  let typeId = 'high_card';
  let scoring = [cards.slice().sort((a, b) => b.rank - a.rank)[0]];

  if (sizes[0] === 5) {
    typeId = flush ? 'flush_five' : 'five_kind';
    scoring = cards;
  } else if (sizes[0] === 3 && sizes[1] === 2) {
    typeId = flush ? 'flush_house' : 'full_house';
    scoring = cards;
  } else if (sizes[0] === 4) {
    typeId = 'four_kind';
    scoring = top.cards;
  } else if (flush && straight) {
    typeId = 'straight_flush';
    scoring = cards;
  } else if (flush) {
    typeId = 'flush';
    scoring = cards;
  } else if (straight) {
    typeId = 'straight';
    scoring = cards;
  } else if (sizes[0] === 3) {
    typeId = 'three_kind';
    scoring = top.cards;
  } else if (sizes[0] === 2 && sizes[1] === 2) {
    typeId = 'two_pair';
    const pairRanks = groups.filter((g) => g.size === 2).slice(0, 2);
    scoring = pairRanks.flatMap((g) => g.cards);
  } else if (sizes[0] === 2) {
    typeId = 'pair';
    scoring = top.cards;
  }

  const stats = levelStats(typeId, levels[typeId] || 1);
  return {
    type: typeId,
    def: HAND_MAP[typeId],
    label: HAND_MAP[typeId].zh,
    labelEn: HAND_MAP[typeId].en,
    level: stats.level,
    baseChips: stats.chips,
    baseMult: stats.mult,
    scoring,
    cards: cards.slice(),
  };
}

export function nextHandLevels(levels, typeId) {
  return { ...levels, [typeId]: (levels[typeId] || 1) + 1 };
}
