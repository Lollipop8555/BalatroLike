import { cardLabel, isFace } from './cards.js';

/**
 * 计分管线（简化自原版 6 阶段）：
 *   牌型基础 -> 逐张计分牌（牌面筹码 + 小丑的逐牌效果）-> 小丑整体效果（从左到右）
 *   xmult 会立即乘到当前 Mult 上，保证结算顺序可见。
 */
export function scoreHand({ hand, jokers, game }) {
  const scoringSet = new Set(hand.scoring.map((c) => c.uid));
  const held = hand.cards.filter((c) => !scoringSet.has(c.uid));

  let chips = hand.baseChips;
  let mult = hand.baseMult;
  const steps = [];
  const triggered = new Set();

  steps.push({ kind: 'hand', label: hand.label, labelEn: hand.labelEn, chips, mult });

  // 1) 逐张计分牌
  for (const card of hand.scoring) {
    if (!card.debuff) {
      chips += card.chips;
      steps.push({ kind: 'card', label: cardLabel(card), chips: card.chips });
    } else {
      steps.push({ kind: 'card', label: cardLabel(card) + '（被削弱）', chips: 0 });
    }

    if (card.debuff) continue;

    for (const inst of jokers) {
      const fn = inst.def.card;
      if (!fn) continue;
      const r = fn({ inst, card, hand, game });
      if (!r) continue;
      if (r.chips) chips += r.chips;
      if (r.mult) mult += r.mult;
      if (r.xmult) mult *= r.xmult;
      triggered.add(inst.uid);
      steps.push({
        kind: 'joker',
        label: inst.def.zh,
        chips: r.chips || 0,
        mult: r.mult || 0,
        xmult: r.xmult || 1,
        chipsAfter: chips,
        multAfter: mult,
      });
    }
  }

  // 2) 小丑整体效果
  for (const inst of jokers) {
    const fn = inst.def.joker;
    if (!fn) continue;
    const r = fn({ inst, hand, cards: hand.scoring, held, game });
    if (!r) continue;
    if (r.chips) chips += r.chips;
    if (r.mult) mult += r.mult;
    if (r.xmult) mult *= r.xmult;
    triggered.add(inst.uid);
    steps.push({
      kind: 'joker',
      label: inst.def.zh,
      chips: r.chips || 0,
      mult: r.mult || 0,
      xmult: r.xmult || 1,
      chipsAfter: chips,
      multAfter: mult,
    });
  }

  const total = Math.round(chips * mult);
  steps.push({ kind: 'total', label: '合计', chips, mult, total });

  return { chips, mult, total, steps, triggered: [...triggered], held, scored: hand.scoring };
}

/** 计分牌里是否存在人头牌（给“坐公交”一类小丑预留） */
export const scoredFaceCards = (cards) => cards.filter(isFace);
