// 盲注与 Boss 效果（数值参考 docs/05-商店经济与盲注.md）
export const ANTE_BASE = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];

export const BLIND_KINDS = [
  { id: 'small', zh: '小盲注', en: 'Small Blind', mult: 1, reward: 3 },
  { id: 'big', zh: '大盲注', en: 'Big Blind', mult: 1.5, reward: 4 },
  { id: 'boss', zh: 'Boss 盲注', en: 'Boss Blind', mult: 2, reward: 5 },
];

export function anteBase(ante) {
  if (ante <= ANTE_BASE.length) return ANTE_BASE[ante - 1];
  // 无尽模式近似公式
  const last = ANTE_BASE[ANTE_BASE.length - 1];
  return Math.round(last * Math.pow(1.6 + 0.75 * (ante - 8) / (1 + 0.2 * (ante - 8)), ante - 8));
}

export function blindTarget(ante, kindId, boss) {
  const kind = BLIND_KINDS.find((k) => k.id === kindId) || BLIND_KINDS[0];
  const base = anteBase(ante) * kind.mult;
  const extra = boss && boss.targetMult ? boss.targetMult : 1;
  return Math.round(base * extra);
}

export const BOSSES = [
  { id: 'the_hook', zh: '钩子', en: 'The Hook', minAnte: 1, desc: '每打出 1 次 Hand(出牌) 时，随机弃掉 2 张手牌', onHandEnd: (game) => game.discardRandomFromHand(2) },
  { id: 'the_wall', zh: '高墙', en: 'The Wall', minAnte: 1, desc: 'Target(目标分) 翻倍', targetMult: 2 },
  { id: 'the_club', zh: '棍棒', en: 'The Club', minAnte: 1, desc: '所有梅花牌被削弱', debuffSuit: 'C' },
  { id: 'the_goad', zh: '刺棒', en: 'The Goad', minAnte: 1, desc: '所有黑桃牌被削弱', debuffSuit: 'S' },
  { id: 'the_window', zh: '窗户', en: 'The Window', minAnte: 1, desc: '所有方块牌被削弱', debuffSuit: 'D' },
  { id: 'the_head', zh: '头', en: 'The Head', minAnte: 1, desc: '所有红心牌被削弱', debuffSuit: 'H' },
  { id: 'the_manacle', zh: '镣铐', en: 'The Manacle', minAnte: 1, desc: 'Hand Size(手牌上限) -1', handSize: -1 },
  { id: 'the_water', zh: '水', en: 'The Water', minAnte: 1, desc: '本回合无法使用 Discard(弃牌)', discards: -99 },
  { id: 'the_psychic', zh: '通灵者', en: 'The Psychic', minAnte: 1, desc: '每次出牌必须选择 5 张', requireFive: true },
  { id: 'the_eye', zh: '眼睛', en: 'The Eye', minAnte: 2, desc: '本回合不得重复使用同一牌型', noRepeat: true },
  { id: 'the_mouth', zh: '嘴', en: 'The Mouth', minAnte: 2, desc: '本回合只能使用一种牌型', singleType: true },
  { id: 'the_needle', zh: '针', en: 'The Needle', minAnte: 2, desc: '本回合 Hand(出牌) 次数降为 1', hands: -3 },
  { id: 'the_flint', zh: '燧石', en: 'The Flint', minAnte: 2, desc: '牌型基础 Chips(筹码) 与 Mult(倍率) 减半', halveBase: true },
  { id: 'the_tooth', zh: '牙齿', en: 'The Tooth', minAnte: 3, desc: '每打出 1 张牌损失 $1', onHandEnd: (game, ctx) => game.addMoney(-ctx.playedCount) },
  { id: 'the_arm', zh: '手臂', en: 'The Arm', minAnte: 3, desc: '本回合打出的牌型 Lv.(等级) -1', handLevel: -1 },
];

export function pickBoss(rng, ante, used = []) {
  const pool = BOSSES.filter((b) => b.minAnte <= ante && !used.includes(b.id));
  const list = pool.length ? pool : BOSSES.filter((b) => b.minAnte <= ante);
  return list[Math.floor(rng() * list.length)];
}

export const BLIND_REWARD = { small: 3, big: 4, boss: 5 };

export function interestOf(money, extra = 0) {
  return Math.min(5 + extra, Math.floor(money / 5));
}
