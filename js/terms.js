/**
 * 术语表（Glossary）
 *
 * 原版 Balatro 的机制词都是英文，直接在中文界面里保留原词，
 * 既方便对照 wiki / 原版，又避免"倍率""筹码"各说各的。
 *
 * 渲染约定：英文原词在前，中文译名用括注并缩小一号（.zh），
 * 例如 Chips(筹码)。整段用 .tw 包住，保证窄屏换行时不会把
 * "Chips" 和 "(筹码)" 拆到两行。纯文本场景用 *Text 版本。
 */

export const TERMS = {
  chips: { en: 'Chips', zh: '筹码' },
  mult: { en: 'Mult', zh: '倍率' },
  xmult: { en: 'xMult', zh: '倍率乘数' },
  ante: { en: 'Ante', zh: '底注' },
  blind: { en: 'Blind', zh: '盲注' },
  bossBlind: { en: 'Boss Blind', zh: 'Boss 盲注' },
  smallBlind: { en: 'Small Blind', zh: '小盲注' },
  bigBlind: { en: 'Big Blind', zh: '大盲注' },
  joker: { en: 'Joker', zh: '小丑牌' },
  hand: { en: 'Hand', zh: '出牌' },
  cards: { en: 'Cards', zh: '手牌' },
  handSize: { en: 'Hand Size', zh: '手牌上限' },
  discard: { en: 'Discard', zh: '弃牌' },
  target: { en: 'Target', zh: '目标分' },
  score: { en: 'Score', zh: '得分' },
  money: { en: 'Money', zh: '金钱' },
  level: { en: 'Lv.', zh: '等级' },
  planet: { en: 'Planet', zh: '星球牌' },
  card: { en: 'Card', zh: '牌面' },
  shop: { en: 'Shop', zh: '商店' },
  reroll: { en: 'Reroll', zh: '重掷' },
  round: { en: 'Round', zh: '回合' },
};

/** 中文括注 */
const zhTag = (text) => `<span class="zh">(${text})</span>`;

/** 整段包一层，避免窄屏在英文与括注之间断行 */
const wrap = (html, extra) => `<span class="tw${extra ? ` ${extra}` : ''}">${html}</span>`;

/** 术语 → HTML：Chips(筹码)，extra 可追加样式类（如 unit） */
export function term(key, extra = '') {
  const t = TERMS[key];
  return t ? wrap(`${t.en}${zhTag(t.zh)}`, extra) : '';
}

/** 术语 → 纯文本：Chips(筹码) */
export function termText(key) {
  const t = TERMS[key];
  return t ? `${t.en}(${t.zh})` : '';
}

/** 任意中英对照 → HTML，用于牌型、小丑、Boss 等数据里的名字 */
export function bi(en, zh, extra = '') {
  if (!en) return String(zh || '');
  return wrap(`${en}${zhTag(zh)}`, extra);
}

/** 任意中英对照 → 纯文本 */
export function biText(en, zh) {
  return en ? `${en}(${zh})` : String(zh || '');
}
