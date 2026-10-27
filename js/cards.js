import { nextUid } from './rng.js';

export const SUITS = [
  { id: 'S', name: '黑桃', en: 'Spades', symbol: '♠', color: 'black', icon: 'i-spade' },
  { id: 'H', name: '红心', en: 'Hearts', symbol: '♥', color: 'red', icon: 'i-heart' },
  { id: 'D', name: '方块', en: 'Diamonds', symbol: '♦', color: 'red', icon: 'i-diamond' },
  { id: 'C', name: '梅花', en: 'Clubs', symbol: '♣', color: 'black', icon: 'i-club' },
];

export const SUIT_MAP = Object.fromEntries(SUITS.map((s) => [s.id, s]));

// 点数与基础筹码（A=11，人头牌=10）
export const RANKS = [
  { rank: 2, label: '2', chips: 2 },
  { rank: 3, label: '3', chips: 3 },
  { rank: 4, label: '4', chips: 4 },
  { rank: 5, label: '5', chips: 5 },
  { rank: 6, label: '6', chips: 6 },
  { rank: 7, label: '7', chips: 7 },
  { rank: 8, label: '8', chips: 8 },
  { rank: 9, label: '9', chips: 9 },
  { rank: 10, label: '10', chips: 10 },
  { rank: 11, label: 'J', chips: 10 },
  { rank: 12, label: 'Q', chips: 10 },
  { rank: 13, label: 'K', chips: 10 },
  { rank: 14, label: 'A', chips: 11 },
];

export const RANK_MAP = Object.fromEntries(RANKS.map((r) => [r.rank, r]));

export function makeCard(suitId, rank) {
  const s = SUIT_MAP[suitId];
  const r = RANK_MAP[rank];
  return {
    uid: nextUid(),
    suit: s.id,
    suitName: s.name,
    suitEn: s.en,
    symbol: s.symbol,
    color: s.color,
    icon: s.icon,
    rank: r.rank,
    label: r.label,
    chips: r.chips,
    enh: null,
    debuff: false,
  };
}

export function createDeck(suitIds = SUITS.map((s) => s.id)) {
  const deck = [];
  for (const sid of suitIds) {
    for (const r of RANKS) deck.push(makeCard(sid, r.rank));
  }
  return deck;
}

export const isFace = (card) => card.rank >= 11 && card.rank <= 13;
export const isEven = (card) => card.rank % 2 === 0;
export const isOdd = (card) => card.rank % 2 === 1;
export const isAce = (card) => card.rank === 14;

export function cardLabel(card) {
  return card.label + card.symbol;
}

export function sortByRank(cards) {
  return cards.slice().sort((a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit));
}

export function sortBySuit(cards) {
  const order = { S: 0, H: 1, C: 2, D: 3 };
  return cards.slice().sort((a, b) => order[a.suit] - order[b.suit] || a.rank - b.rank);
}
