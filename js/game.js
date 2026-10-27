import { createDeck } from './cards.js';
import { HAND_TYPES, HAND_MAP, evaluateHand } from './hands.js';
import {
  JOKER_MAP, jokerSellValue, jokerStaticMods, makeJokerInstance, randomJoker,
} from './jokers.js';
import { scoreHand } from './scoring.js';
import { BLIND_KINDS, blindTarget, pickBoss, interestOf, BLIND_REWARD } from './blinds.js';
import { makeRng, pick, randomSeed, shuffle } from './rng.js';

const BASE_HAND_SIZE = 8;
const BASE_HANDS = 4;
const BASE_DISCARDS = 3;
const JOKER_SLOTS = 5;
const START_MONEY = 4;
const BEST_KEY = 'balatrolike.best.v1';

export function createGame() {
  const listeners = new Set();

  const state = {
    phase: 'menu', // menu | play | shop | over | win
    seed: 0,
    round: 0,
    ante: 1,
    blindIdx: 0,
    boss: null,
    bossUsed: [],
    bossesBeaten: 0,
    money: START_MONEY,
    deck: [],
    drawPile: [],
    discardPile: [],
    hand: [],
    selected: [],
    jokers: [],
    handSize: BASE_HAND_SIZE,
    handsLeft: BASE_HANDS,
    discardsLeft: BASE_DISCARDS,
    roundScore: 0,
    target: 0,
    levels: Object.fromEntries(HAND_TYPES.map((h) => [h.id, 1])),
    handCounts: {},
    playedTypes: [],
    lastResolution: null,
    shop: null,
    log: [],
    stats: { handsPlayed: 0, discardsUsed: 0, bestHand: 0, antesCleared: 0 },
    best: loadBest(),
    hint: '',
  };

  let rng = makeRng(randomSeed());

  const api = {
    state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit() { listeners.forEach((fn) => fn(state)); },

    // 小丑牌效果读取的只读视图
    get jokers() { return state.jokers; },
    get money() { return state.money; },
    get handsLeft() { return state.handsLeft; },
    get discardsLeft() { return state.discardsLeft; },
    get handCounts() { return state.handCounts; },

    // ---------- 生命周期 ----------
    newRun(seed = randomSeed()) {
      rng = makeRng(seed);
      state.seed = seed;
      state.phase = 'play';
      state.ante = 1;
      state.blindIdx = 0;
      state.boss = null;
      state.bossUsed = [];
      state.bossesBeaten = 0;
      state.money = START_MONEY;
      state.jokers = [];
      state.levels = Object.fromEntries(HAND_TYPES.map((h) => [h.id, 1]));
      state.handCounts = {};
      state.playedTypes = [];
      state.lastResolution = null;
      state.log = [];
      state.stats = { handsPlayed: 0, discardsUsed: 0, bestHand: 0, antesCleared: 0 };
      state.deck = shuffle(rng, createDeck());
      startBlind();
      return api;
    },

    // ---------- 盲注 ----------
    startBlind() {
      const kind = BLIND_KINDS[state.blindIdx];
      const mods = api.mods();
      state.boss = kind.id === 'boss' ? pickBoss(rng, state.ante, state.bossUsed) : null;
      state.target = blindTarget(state.ante, kind.id, state.boss);
      state.handSize = Math.max(3, BASE_HAND_SIZE + mods.handSize + (state.boss?.handSize || 0));
      state.handsLeft = Math.max(1, BASE_HANDS + mods.hands + (state.boss?.hands || 0));
      state.discardsLeft = Math.max(0, BASE_DISCARDS + mods.discards + (state.boss?.discards || 0));
      state.roundScore = 0;
      state.playedTypes = [];
      state.selected = [];
      state.lastResolution = null;
      state.hint = '';
      state.round += 1;
      state.phase = 'play';

      for (const card of state.deck) card.debuff = false;
      if (state.boss?.debuffSuit) {
        for (const card of state.deck) if (card.suit === state.boss.debuffSuit) card.debuff = true;
      }

      state.drawPile = shuffle(rng, state.deck);
      state.discardPile = [];
      state.hand = [];
      api.draw(state.handSize);
      for (const j of state.jokers) j.done = false;
      api.emit();
    },

    // ---------- 手牌操作 ----------
    draw(n) {
      for (let i = 0; i < n; i += 1) {
        if (state.hand.length >= state.handSize) break;
        if (state.drawPile.length === 0) {
          if (state.discardPile.length === 0) break;
          state.drawPile = shuffle(rng, state.discardPile);
          state.discardPile = [];
        }
        state.hand.push(state.drawPile.pop());
      }
    },

    toggleSelect(uid) {
      if (state.phase !== 'play') return;
      const i = state.selected.indexOf(uid);
      if (i >= 0) {
        state.selected.splice(i, 1);
        state.hint = '';
      } else if (state.selected.length < 5) {
        state.selected.push(uid);
        state.hint = '';
      } else {
        state.hint = '最多只能选择 5 张牌';
      }
      api.emit();
    },

    clearSelection() { state.selected = []; api.emit(); },

    selectedCards() {
      return state.hand.filter((c) => state.selected.includes(c.uid));
    },

    previewHand() {
      const cards = api.selectedCards();
      if (!cards.length) return null;
      return evaluateHand(cards, api.levels());
    },

    // 带 Boss 修正的实际牌型（出牌与预览共用）
    effectiveHand(cards) {
      const hand = evaluateHand(cards, api.levels());
      if (!state.boss?.halveBase) return hand;
      return {
        ...hand,
        baseChips: Math.max(1, Math.floor(hand.baseChips / 2)),
        baseMult: Math.max(1, Math.floor(hand.baseMult / 2)),
      };
    },

    // 结算预估：跑同一条计分管线，但不写状态、不消耗随机数
    previewScore() {
      const cards = api.selectedCards();
      if (!cards.length) return null;
      const hand = api.effectiveHand(cards);

      const dry = Object.create(api);
      dry.chance = () => false;
      dry.addMoney = () => {};

      const res = scoreHand({ hand, jokers: state.jokers, game: dry });
      return { ...res, label: hand.label, labelEn: hand.labelEn, level: hand.level };
    },

    levels() {
      const delta = state.boss?.handLevel || 0;
      if (!delta) return state.levels;
      const out = { ...state.levels };
      for (const k of Object.keys(out)) out[k] = Math.max(1, out[k] + delta);
      return out;
    },

    validate(cards) {
      const boss = state.boss;
      if (!cards.length) return '请选择 1~5 张牌';
      if (boss?.requireFive && cards.length !== 5) return '通灵者：必须打出 5 张牌';
      const hand = evaluateHand(cards, api.levels());
      if (boss?.noRepeat && state.playedTypes.includes(hand.type)) return '眼睛：本回合不能重复使用同一牌型';
      if (boss?.singleType && state.playedTypes.length && !state.playedTypes.includes(hand.type)) return '嘴：本回合只能使用一种牌型';
      return null;
    },

    // ---------- 出牌 ----------
    playHand() {
      if (state.phase !== 'play' || state.handsLeft <= 0) return;
      const cards = api.selectedCards();
      const err = api.validate(cards);
      if (err) { state.hint = err; api.emit(); return; }

      const hand = api.effectiveHand(cards);

      for (const j of state.jokers) j.done = false;
      const res = scoreHand({ hand, jokers: state.jokers, game: api });

      state.roundScore += res.total;
      state.handCounts[hand.type] = (state.handCounts[hand.type] || 0) + 1;
      state.playedTypes.push(hand.type);
      state.stats.handsPlayed += 1;
      state.stats.bestHand = Math.max(state.stats.bestHand, res.total);
      state.lastResolution = { ...res, label: hand.label, labelEn: hand.labelEn, level: hand.level };

      const playedUids = new Set(cards.map((c) => c.uid));
      state.hand = state.hand.filter((c) => !playedUids.has(c.uid));
      state.discardPile.push(...cards);
      state.selected = [];
      state.handsLeft -= 1;

      for (const inst of state.jokers) inst.def.onPlay?.({ inst, hand, cards: hand.scoring, game: api });
      state.boss?.onHandEnd?.(api, { playedCount: cards.length });

      api.draw(state.handSize - state.hand.length);

      if (state.roundScore >= state.target) api.winBlind();
      else if (state.handsLeft <= 0) api.lose();
      else { state.hint = ''; api.emit(); }
    },

    discardSelected() {
      if (state.phase !== 'play') return;
      if (state.discardsLeft <= 0) { state.hint = '本回合弃牌次数已用尽'; api.emit(); return; }
      const cards = api.selectedCards();
      if (!cards.length) { state.hint = '请先选择要弃掉的牌'; api.emit(); return; }

      const uids = new Set(cards.map((c) => c.uid));
      state.hand = state.hand.filter((c) => !uids.has(c.uid));
      state.discardPile.push(...cards);
      state.discardsLeft -= 1;
      state.selected = [];
      state.stats.discardsUsed += 1;
      for (const inst of state.jokers) inst.def.onDiscard?.({ inst, cards, game: api });
      api.draw(state.handSize - state.hand.length);
      state.hint = '';
      api.emit();
    },

    // ---------- 结算 ----------
    winBlind() {
      const kind = BLIND_KINDS[state.blindIdx];
      const reward = BLIND_REWARD[kind.id];
      const interest = interestOf(state.money, api.mods().interest);
      state.money += reward + interest;
      state.lastResolution = { ...(state.lastResolution || {}), win: true, reward, interest };

      if (kind.id === 'boss') {
        state.bossesBeaten += 1;
        if (state.boss) state.bossUsed.push(state.boss.id);
        state.stats.antesCleared = state.ante;
      }
      for (const inst of state.jokers) inst.def.onRoundEnd?.({ inst, game: api });

      if (kind.id === 'boss' && state.ante >= 8) {
        api.finish('win');
        return;
      }
      state.phase = 'shop';
      api.buildShop();
      api.emit();
    },

    lose() {
      api.finish('over');
    },

    finish(kind) {
      state.phase = kind;
      const score = state.best?.score || 0;
      if (!state.best || state.roundScore > score || state.ante > (state.best.ante || 0)) {
        state.best = { ante: Math.max(state.ante, state.best?.ante || 0), score: Math.max(state.roundScore, score) };
        saveBest(state.best);
      }
      api.emit();
    },

    nextBlind() {
      if (state.blindIdx < 2) state.blindIdx += 1;
      else { state.ante += 1; state.blindIdx = 0; }
      state.shop = null;
      api.startBlind();
    },

    // ---------- 商店 ----------
    buildShop() {
      const items = [];
      for (let i = 0; i < 2; i += 1) {
        if (rng() < 0.72) {
          const def = randomJoker(rng);
          items.push({ kind: 'joker', id: def.id, def, price: def.cost });
        } else {
          const pool = HAND_TYPES.filter((h) => !h.secret || (state.handCounts[h.id] || 0) > 0);
          const handDef = pick(rng, pool);
          items.push({ kind: 'planet', id: handDef.id, hand: handDef, price: 3 });
        }
      }
      // 槽位未满时保证商品中至少有一张小丑牌，避免只提供星球牌
      if (!items.some((it) => it.kind === 'joker') && state.jokers.length < JOKER_SLOTS) {
        const def = randomJoker(rng);
        items[0] = { kind: 'joker', id: def.id, def, price: def.cost };
      }
      state.shop = { items, rerolls: 0, rerollCost: 5 };
    },

    buy(index) {
      const item = state.shop?.items[index];
      if (!item || item.sold) return;
      if (state.money < item.price) { state.hint = '金钱不足'; api.emit(); return; }
      if (item.kind === 'joker' && state.jokers.length >= JOKER_SLOTS) {
        state.hint = '小丑牌槽位已满，请先出售一张'; api.emit(); return;
      }
      state.money -= item.price;
      if (item.kind === 'joker') {
        state.jokers.push(makeJokerInstance(item.def));
      } else {
        api.upgradeHand(item.id);
      }
      item.sold = true;
      state.hint = '';
      api.emit();
    },

    reroll() {
      if (!state.shop) return;
      const cost = state.shop.rerollCost;
      if (state.money < cost) { state.hint = '金钱不足，无法重掷'; api.emit(); return; }
      state.money -= cost;
      const times = state.shop.rerolls + 1;
      api.buildShop();
      state.shop.rerolls = times;
      state.shop.rerollCost = 5 + times;
      state.hint = '';
      api.emit();
    },

    sellJoker(uid) {
      const idx = state.jokers.findIndex((j) => j.uid === uid);
      if (idx < 0) return;
      const [inst] = state.jokers.splice(idx, 1);
      state.money += jokerSellValue(inst);
      state.hint = '';
      api.emit();
    },

    leaveShop() {
      state.shop = null;
      api.nextBlind();
    },

    // ---------- 供小丑牌调用的能力 ----------
    mods() {
      const m = jokerStaticMods(state.jokers);
      return { handSize: m.handSize || 0, hands: m.hands || 0, discards: m.discards || 0, interest: m.interest || 0 };
    },
    chance(p) { return rng() < p; },
    randomInt(min, max) { return min + Math.floor(rng() * (max - min + 1)); },
    addMoney(n) { state.money = Math.max(0, state.money + n); },
    deckRemaining() { return state.drawPile.length; },
    upgradeHand(typeId) {
      state.levels[typeId] = (state.levels[typeId] || 1) + 1;
    },
    destroyJoker(inst, why) {
      const i = state.jokers.indexOf(inst);
      if (i >= 0) state.jokers.splice(i, 1);
      state.log.push(why || '一张小丑牌被摧毁');
    },
    discardRandomFromHand(n) {
      for (let i = 0; i < n && state.hand.length; i += 1) {
        const idx = Math.floor(rng() * state.hand.length);
        state.discardPile.push(state.hand.splice(idx, 1)[0]);
      }
    },
  };

  function startBlind() { api.startBlind(); }

  return api;
}

function loadBest() {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    return raw ? JSON.parse(raw) : { ante: 0, score: 0 };
  } catch { return { ante: 0, score: 0 }; }
}

function saveBest(best) {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch { /* 忽略隐私模式限制 */ }
}
