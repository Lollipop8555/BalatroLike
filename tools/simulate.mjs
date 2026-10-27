/**
 * 平衡性冒烟测试 / 数值研究脚本（Node 直接运行，无第三方依赖）
 *   用法：node tools/simulate.mjs [局数]
 * 一个「傻瓜 AI」：从手牌里枚举 1~5 张的组合，选基础分最高的一手打出，
 * 商店里看到小丑牌就买。用来验证完整对局不会抛异常、并能观察分数曲线。
 */
import { createGame } from '../js/game.js';
import { evaluateHand } from '../js/hands.js';

const RUNS = Number(process.argv[2] || 5);

function allowedTypes(game) {
  const s = game.state;
  if (!s.boss) return null;
  if (s.boss.noRepeat) return new Set(Object.keys(s.levels).filter((t) => !s.playedTypes.includes(t)));
  if (s.boss.singleType && s.playedTypes.length) return new Set([s.playedTypes[0]]);
  return null;
}

function bestCombo(game) {
  const hand = game.state.hand;
  const levels = game.levels();
  const allow = allowedTypes(game);
  let best = null;
  const n = hand.length;
  for (let mask = 1; mask < 1 << n; mask += 1) {
    const pick = [];
    for (let i = 0; i < n; i += 1) if (mask & (1 << i)) pick.push(hand[i]);
    if (pick.length > 5) continue;
    const h = evaluateHand(pick, levels);
    if (!h) continue;
    if (allow && !allow.has(h.type)) continue;
    const score = h.baseChips * h.baseMult;
    if (!best || score > best.score) best = { score, cards: pick };
  }
  return best || { score: 0, cards: [hand[0]] };
}

function playRun(seed) {
  const game = createGame();
  game.newRun(seed);
  let guard = 0;
  let hands = 0;

  while (guard++ < 2000) {
    const s = game.state;
    if (s.phase === 'over' || s.phase === 'win') break;

    if (s.phase === 'shop') {
      for (let i = 0; i < 2; i += 1) {
        const item = s.shop.items[i];
        if (item && !item.sold && item.kind === 'joker' && s.jokers.length < 5 && s.money >= item.price) {
          game.buy(i);
        }
      }
      game.leaveShop();
      continue;
    }

    if (s.phase === 'play') {
      if (s.handsLeft <= 0) break;
      const combo = bestCombo(game);
      const need = (s.target - s.roundScore) / Math.max(1, s.handsLeft);

      // 手牌太弱且还有弃牌时，先换牌
      if (combo.score < need * 0.6 && s.discardsLeft > 0) {
        game.clearSelection();
        const keep = new Set(combo.cards.map((c) => c.uid));
        const junk = s.hand.filter((c) => !keep.has(c.uid)).slice(0, 5);
        for (const c of junk) game.toggleSelect(c.uid);
        game.discardSelected();
        continue;
      }

      game.clearSelection();
      for (const c of combo.cards) game.toggleSelect(c.uid);
      game.playHand();
      hands += 1;
      continue;
    }
    break;
  }

  return {
    seed,
    phase: game.state.phase,
    ante: game.state.ante,
    blind: game.state.blindIdx,
    hands,
    score: game.state.roundScore,
    money: game.state.money,
    jokers: game.state.jokers.map((j) => j.def.zh).join('/'),
    bestHand: game.state.stats.bestHand,
  };
}

const results = [];
for (let i = 0; i < RUNS; i += 1) {
  const seed = 1000 + i * 37;
  results.push(playRun(seed));
}

console.table(results);
const wins = results.filter((r) => r.phase === 'win').length;
console.log(`完成 ${RUNS} 局模拟，通关 ${wins} 局，平均到达 Ante ${(results.reduce((a, r) => a + r.ante, 0) / RUNS).toFixed(2)}`);
