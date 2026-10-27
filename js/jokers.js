/* 小丑牌定义（数值参考 docs/03-小丑牌图鉴.md）
 * 每个小丑可以挂载：
 *   card(ctx)   -> 每张计分牌触发一次，返回 { chips, mult, xmult }
 *   joker(ctx)  -> 结算时整体触发一次
 *   onPlay(ctx) / onDiscard(ctx) / onRoundEnd(ctx) / onBlindStart(ctx) 事件
 *   mods        -> 静态修正 { handSize, hands, discards, interest }
 */
import { isAce, isEven, isFace, isOdd } from './cards.js';
import { nextUid, pick } from './rng.js';

const hasPair = (t) => ['pair', 'two_pair', 'full_house', 'four_kind', 'flush_house', 'five_kind', 'flush_five'].includes(t);
const hasTwoPair = (t) => ['two_pair', 'full_house', 'flush_house', 'flush_five'].includes(t);
const hasThree = (t) => ['three_kind', 'full_house', 'flush_house', 'five_kind', 'flush_five'].includes(t);
const hasFour = (t) => ['four_kind', 'flush_house', 'flush_five'].includes(t);
const hasStraight = (t) => ['straight', 'straight_flush'].includes(t);
const hasFlush = (t) => ['flush', 'flush_house', 'straight_flush', 'flush_five'].includes(t);

const FIB = new Set([14, 2, 3, 5, 8]);

export const JOKERS = [
  // ---------- 普通 ----------
  { id: 'joker', name: 'Joker', zh: '小丑', rarity: 'common', cost: 3, text: '+4 Mult(倍率)', joker: () => ({ mult: 4 }) },
  { id: 'lusty_joker', name: 'Lusty Joker', zh: '色欲小丑', rarity: 'common', cost: 5, text: '每张计分红心 +3 Mult(倍率)', card: ({ card }) => (card.suit === 'H' ? { mult: 3 } : null) },
  { id: 'greedy_joker', name: 'Greedy Joker', zh: '贪婪小丑', rarity: 'common', cost: 5, text: '每张计分方块 +3 Mult(倍率)', card: ({ card }) => (card.suit === 'D' ? { mult: 3 } : null) },
  { id: 'wrathful_joker', name: 'Wrathful Joker', zh: '愤怒小丑', rarity: 'common', cost: 5, text: '每张计分黑桃 +3 Mult(倍率)', card: ({ card }) => (card.suit === 'S' ? { mult: 3 } : null) },
  { id: 'gluttonous_joker', name: 'Gluttonous Joker', zh: '暴食小丑', rarity: 'common', cost: 5, text: '每张计分梅花 +3 Mult(倍率)', card: ({ card }) => (card.suit === 'C' ? { mult: 3 } : null) },
  { id: 'jolly_joker', name: 'Jolly Joker', zh: '快活小丑', rarity: 'common', cost: 4, text: '牌型含对子 +8 Mult(倍率)', joker: ({ hand }) => (hasPair(hand.type) ? { mult: 8 } : null) },
  { id: 'zany_joker', name: 'Zany Joker', zh: '滑稽小丑', rarity: 'common', cost: 4, text: '牌型含三条 +12 Mult(倍率)', joker: ({ hand }) => (hasThree(hand.type) ? { mult: 12 } : null) },
  { id: 'mad_joker', name: 'Mad Joker', zh: '疯狂小丑', rarity: 'common', cost: 4, text: '牌型含两对 +10 Mult(倍率)', joker: ({ hand }) => (hasTwoPair(hand.type) ? { mult: 10 } : null) },
  { id: 'crazy_joker', name: 'Crazy Joker', zh: '癫狂小丑', rarity: 'common', cost: 4, text: '牌型含顺子 +12 Mult(倍率)', joker: ({ hand }) => (hasStraight(hand.type) ? { mult: 12 } : null) },
  { id: 'droll_joker', name: 'Droll Joker', zh: '逗趣小丑', rarity: 'common', cost: 4, text: '牌型含同花 +10 Mult(倍率)', joker: ({ hand }) => (hasFlush(hand.type) ? { mult: 10 } : null) },
  { id: 'sly_joker', name: 'Sly Joker', zh: '狡猾小丑', rarity: 'common', cost: 3, text: '牌型含对子 +50 Chips(筹码)', joker: ({ hand }) => (hasPair(hand.type) ? { chips: 50 } : null) },
  { id: 'half_joker', name: 'Half Joker', zh: '半张小丑', rarity: 'common', cost: 5, text: '打出 ≤3 张牌时 +20 Mult(倍率)', joker: ({ cards }) => (cards.length <= 3 ? { mult: 20 } : null) },
  { id: 'banner', name: 'Banner', zh: '旗帜', rarity: 'common', cost: 5, text: '每剩余 1 次弃牌 +30 Chips(筹码)', joker: ({ game }) => ({ chips: 30 * game.discardsLeft }) },
  { id: 'abstract_joker', name: 'Abstract Joker', zh: '抽象小丑', rarity: 'common', cost: 4, text: '每张 Joker(小丑牌) +3 Mult(倍率)', joker: ({ game }) => ({ mult: 3 * game.jokers.length }) },
  { id: 'even_steven', name: 'Even Steven', zh: '偶数史蒂文', rarity: 'common', cost: 4, text: '每张计分偶数牌 +4 Mult(倍率)', card: ({ card }) => (isEven(card) ? { mult: 4 } : null) },
  { id: 'odd_todd', name: 'Odd Todd', zh: '奇数托德', rarity: 'common', cost: 4, text: '每张计分奇数牌 +31 Chips(筹码)', card: ({ card }) => (isOdd(card) ? { chips: 31 } : null) },
  { id: 'scholar', name: 'Scholar', zh: '学者', rarity: 'common', cost: 4, text: '每张计分 A +20 Chips(筹码) 且 +4 Mult(倍率)', card: ({ card }) => (isAce(card) ? { chips: 20, mult: 4 } : null) },
  { id: 'scary_face', name: 'Scary Face', zh: '惊恐面孔', rarity: 'common', cost: 4, text: '每张计分人头牌 +30 Chips(筹码)', card: ({ card }) => (isFace(card) ? { chips: 30 } : null) },
  { id: 'smiley_face', name: 'Smiley Face', zh: '笑脸', rarity: 'common', cost: 4, text: '每张计分人头牌 +5 Mult(倍率)', card: ({ card }) => (isFace(card) ? { mult: 5 } : null) },
  { id: 'blue_joker', name: 'Blue Joker', zh: '蓝色小丑', rarity: 'common', cost: 5, text: '牌库每剩 1 张牌 +2 Chips(筹码)', joker: ({ game }) => ({ chips: 2 * game.deckRemaining() }) },
  { id: 'green_joker', name: 'Green Joker', zh: '绿色小丑', rarity: 'common', cost: 4, text: '每打出 1 手 +1 Mult(倍率)，弃牌 -1', joker: ({ inst }) => ({ mult: inst.mut }), onPlay: ({ inst }) => { inst.mut += 1; }, onDiscard: ({ inst }) => { inst.mut = Math.max(0, inst.mut - 1); } },
  { id: 'supernova', name: 'Supernova', zh: '超新星', rarity: 'common', cost: 5, text: '本局该牌型已打出次数 = Mult(倍率)', joker: ({ hand, game }) => ({ mult: game.handCounts[hand.type] || 0 }) },
  { id: 'ice_cream', name: 'Ice Cream', zh: '冰淇淋', rarity: 'common', cost: 5, text: '+100 Chips(筹码)，每手 -5', joker: ({ inst }) => ({ chips: Math.max(0, 100 - 5 * inst.mut) }), onPlay: ({ inst }) => { inst.mut += 1; } },
  { id: 'square_joker', name: 'Square Joker', zh: '方形小丑', rarity: 'common', cost: 4, text: '打出 4 张牌时 +4 Chips(筹码)（累积）', joker: ({ inst }) => ({ chips: 4 * inst.mut }), onPlay: ({ inst, cards }) => { if (cards.length === 4) inst.mut += 1; } },
  { id: 'runner', name: 'Runner', zh: '奔跑者', rarity: 'common', cost: 5, text: '打出顺子时 +15 Chips(筹码)（累积）', joker: ({ inst }) => ({ chips: 15 * inst.mut }), onPlay: ({ inst, hand }) => { if (hasStraight(hand.type)) inst.mut += 1; } },
  { id: 'fibonacci', name: 'Fibonacci', zh: '斐波那契', rarity: 'common', cost: 6, text: '计分的 A/2/3/5/8 +8 Mult(倍率)', card: ({ card }) => (FIB.has(card.rank) ? { mult: 8 } : null) },
  { id: 'walkie_talkie', name: 'Walkie Talkie', zh: '对讲机', rarity: 'common', cost: 4, text: '计分的 10 或 4 +10 Chips(筹码) +4 Mult(倍率)', card: ({ card }) => (card.rank === 10 || card.rank === 4 ? { chips: 10, mult: 4 } : null) },
  { id: 'photograph', name: 'Photograph', zh: '照片', rarity: 'common', cost: 5, text: '计分的第一张人头牌 ×2 Mult(倍率)', card: ({ card, inst }) => { if (isFace(card) && !inst.done) { inst.done = true; return { xmult: 2 }; } return null; } },
  { id: 'business_card', name: 'Business Card', zh: '名片', rarity: 'common', cost: 4, text: '计分人头牌 1/2 概率 +$2', card: ({ card, game }) => { if (isFace(card) && game.chance(0.5)) { game.addMoney(2); } return null; } },
  { id: 'gros_michel', name: 'Gros Michel', zh: '大香蕉', rarity: 'common', cost: 5, text: '+15 Mult(倍率)；回合结束 1/6 概率摧毁', joker: () => ({ mult: 15 }), onRoundEnd: ({ game, inst }) => { if (game.chance(1 / 6)) game.destroyJoker(inst, 'Gros Michel 烂掉了'); } },
  { id: 'cavendish', name: 'Cavendish', zh: '卡文迪什', rarity: 'common', cost: 4, text: '×3 Mult(倍率)；每次 Round(回合) 结束有 1/1000 概率被摧毁', joker: () => ({ xmult: 3 }), onRoundEnd: ({ game, inst }) => { if (game.chance(1 / 1000)) game.destroyJoker(inst, 'Cavendish 已消失'); } },
  { id: 'bull', name: 'Bull', zh: '公牛', rarity: 'common', cost: 6, text: '每持有 $1 +2 Chips(筹码)', joker: ({ game }) => ({ chips: 2 * game.money }) },
  { id: 'bootstraps', name: 'Bootstraps', zh: '自立', rarity: 'common', cost: 7, text: '每持有 $5 +2 Mult(倍率)', joker: ({ game }) => ({ mult: 2 * Math.floor(game.money / 5) }) },
  { id: 'golden_joker', name: 'Golden Joker', zh: '黄金小丑', rarity: 'common', cost: 6, text: '回合结束 +$4', onRoundEnd: ({ game }) => game.addMoney(4) },

  // ---------- 罕见 ----------
  { id: 'bloodstone', name: 'Bloodstone', zh: '血石', rarity: 'uncommon', cost: 7, text: '计分红心 1/2 概率 ×1.5 Mult(倍率)', card: ({ card, game }) => (card.suit === 'H' && game.chance(0.5) ? { xmult: 1.5 } : null) },
  { id: 'arrowhead', name: 'Arrowhead', zh: '箭头', rarity: 'uncommon', cost: 7, text: '计分黑桃 +50 Chips(筹码)', card: ({ card }) => (card.suit === 'S' ? { chips: 50 } : null) },
  { id: 'onyx_agate', name: 'Onyx Agate', zh: '缟玛瑙', rarity: 'uncommon', cost: 7, text: '计分梅花 +7 Mult(倍率)', card: ({ card }) => (card.suit === 'C' ? { mult: 7 } : null) },
  { id: 'rough_gem', name: 'Rough Gem', zh: '原石', rarity: 'uncommon', cost: 7, text: '计分方块 +$1', card: ({ card, game }) => { if (card.suit === 'D') game.addMoney(1); return null; } },
  { id: 'acrobat', name: 'Acrobat', zh: '杂技演员', rarity: 'uncommon', cost: 6, text: '本回合最后一手牌 ×3 Mult(倍率)', joker: ({ game }) => (game.handsLeft === 1 ? { xmult: 3 } : null) },
  { id: 'flower_pot', name: 'Flower Pot', zh: '花盆', rarity: 'uncommon', cost: 6, text: '四种花色齐全时 ×3 Mult(倍率)', joker: ({ cards }) => (new Set(cards.map((c) => c.suit)).size === 4 ? { xmult: 3 } : null) },
  { id: 'space_joker', name: 'Space Joker', zh: '太空小丑', rarity: 'uncommon', cost: 5, text: '1/4 概率升级打出的牌型', onPlay: ({ game, hand }) => { if (game.chance(0.25)) game.upgradeHand(hand.type); } },
  { id: 'rocket', name: 'Rocket', zh: '火箭', rarity: 'uncommon', cost: 6, text: '回合结束 +$1，每击败 Boss(盲注) 再 +$2', onRoundEnd: ({ game }) => game.addMoney(1 + 2 * game.bossesBeaten) },

  // ---------- 稀有 ----------
  { id: 'the_duo', name: 'The Duo', zh: '双人组', rarity: 'rare', cost: 8, text: '牌型含对子 ×2 Mult(倍率)', joker: ({ hand }) => (hasPair(hand.type) ? { xmult: 2 } : null) },
  { id: 'the_trio', name: 'The Trio', zh: '三人组', rarity: 'rare', cost: 8, text: '牌型含三条 ×3 Mult(倍率)', joker: ({ hand }) => (hasThree(hand.type) ? { xmult: 3 } : null) },
  { id: 'the_family', name: 'The Family', zh: '家族', rarity: 'rare', cost: 8, text: '牌型含四条 ×4 Mult(倍率)', joker: ({ hand }) => (hasFour(hand.type) ? { xmult: 4 } : null) },
  { id: 'the_order', name: 'The Order', zh: '秩序', rarity: 'rare', cost: 8, text: '牌型含顺子 ×3 Mult(倍率)', joker: ({ hand }) => (hasStraight(hand.type) ? { xmult: 3 } : null) },
  { id: 'the_tribe', name: 'The Tribe', zh: '部族', rarity: 'rare', cost: 8, text: '牌型含同花 ×2 Mult(倍率)', joker: ({ hand }) => (hasFlush(hand.type) ? { xmult: 2 } : null) },
  { id: 'baron', name: 'Baron', zh: '男爵', rarity: 'rare', cost: 8, text: '手中每张 K ×1.5 Mult(倍率)', joker: ({ held }) => { const k = held.filter((c) => c.rank === 13).length; return k ? { xmult: Math.pow(1.5, k) } : null; } },
  { id: 'stuntman', name: 'Stuntman', zh: '特技演员', rarity: 'rare', cost: 7, text: '+250 Chips(筹码)，Hand Size(手牌上限) -2', joker: () => ({ chips: 250 }), mods: { handSize: -2 } },
];

export const JOKER_MAP = Object.fromEntries(JOKERS.map((j) => [j.id, j]));

export const RARITY_LABEL = { common: '普通', uncommon: '罕见', rare: '稀有' };
export const RARITY_EN = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare' };
export const RARITY_WEIGHT = { common: 0.7, uncommon: 0.25, rare: 0.05 };

export function makeJokerInstance(defOrId) {
  const def = typeof defOrId === 'string' ? JOKER_MAP[defOrId] : defOrId;
  return { uid: nextUid(), id: def.id, def, mut: 0, done: false };
}

export function randomJoker(rng) {
  const roll = rng();
  let rarity = 'common';
  if (roll > 0.95) rarity = 'rare';
  else if (roll > 0.7) rarity = 'uncommon';
  const pool = JOKERS.filter((j) => j.rarity === rarity);
  return pick(rng, pool.length ? pool : JOKERS);
}

export function jokerSellValue(inst) {
  return Math.max(1, Math.floor(inst.def.cost / 2));
}

export function jokerStaticMods(jokers) {
  const mods = { handSize: 0, hands: 0, discards: 0, interest: 0 };
  for (const j of jokers) {
    if (!j.def.mods) continue;
    for (const [k, v] of Object.entries(j.def.mods)) mods[k] = (mods[k] || 0) + v;
  }
  return mods;
}
