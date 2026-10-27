import { HAND_MAP } from './hands.js';
import { RARITY_EN, RARITY_LABEL, jokerSellValue } from './jokers.js';
import { BLIND_KINDS, interestOf } from './blinds.js';
import { bi, biText, term } from './terms.js';

const $ = (sel) => document.querySelector(sel);
const fmt = (n) => Number(n || 0).toLocaleString('en-US');

const el = {
  hud: $('#hud'),
  jokers: $('#jokers'),
  stage: $('#stage'),
  hand: $('#hand'),
  handLabel: $('#handLabel'),
  actions: $('#actions'),
  overlay: $('#overlay'),
  sheet: $('#sheet'),
  sub: $('#sheetSub'),
  toastWrap: $('#toastWrap'),
};

let G = null;
let detailUid = null;
let sortMode = 'rank';

export function initUI(game) {
  G = game;
  bindEvents();
  G.subscribe(render);
  render(G.state);
}

function bindEvents() {
  el.hand.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    G.toggleSelect(Number(card.dataset.uid));
  });

  el.actions.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'play') G.playHand();
    if (act === 'discard') G.discardSelected();
    if (act === 'sort') { sortMode = sortMode === 'rank' ? 'suit' : 'rank'; sortHand(); G.emit(); }
  });

  el.hud.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="help"]')) openSub(helpHTML(G.state));
  });

  el.jokers.addEventListener('click', (e) => {
    const node = e.target.closest('[data-joker]');
    if (!node || node.classList.contains('empty')) return;
    detailUid = Number(node.dataset.joker);
    openSub(jokerDetailHTML());
  });

  el.overlay.addEventListener('click', (e) => {
    if (e.target === el.overlay) {
      if (subOpen()) closeSub();
      else if (el.sheet.dataset.closable !== '0') closeSheet();
      return;
    }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const idx = btn.dataset.index != null ? Number(btn.dataset.index) : null;

    if (act === 'start') { closeSub(); closeSheet(); resetUIState(); G.newRun(); }
    if (act === 'restart') { closeSub(); closeSheet(); resetUIState(); G.newRun(); }
    if (act === 'buy') G.buy(idx);
    if (act === 'reroll') G.reroll();
    if (act === 'leave') { closeSub(); closeSheet(); G.leaveShop(); }
    if (act === 'sell') { G.sellJoker(Number(btn.dataset.uid)); closeSub(); }
    if (act === 'detail') { detailUid = Number(btn.dataset.uid); openSub(jokerDetailHTML()); }
    if (act === 'close') { closeSub(); if (el.sheet.dataset.closable !== '0') closeSheet(); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && subOpen()) { closeSub(); return; }
    if (e.key === 'Escape' && el.sheet.dataset.closable !== '0') closeSheet();
    if (e.key === 'Enter' && G.state.phase === 'play' && el.overlay.hidden) G.playHand();
    if (e.key === 'd' && G.state.phase === 'play' && el.overlay.hidden) G.discardSelected();
    if (e.key === 's' && G.state.phase === 'play' && el.overlay.hidden) {
      sortMode = sortMode === 'rank' ? 'suit' : 'rank';
      sortHand();
      G.emit();
    }
  });
}

function resetUIState() {
  seenCards.clear();
  resKey = null;
  lastHint = '';
}

function sortHand() {
  const order = { S: 0, H: 1, C: 2, D: 3 };
  G.state.hand.sort((a, b) => (sortMode === 'rank'
    ? a.rank - b.rank || order[a.suit] - order[b.suit]
    : order[a.suit] - order[b.suit] || a.rank - b.rank));
}

/* ---------------- 渲染 ---------------- */
const seenCards = new Set();
let resKey = null;
let lastHint = '';
let lastMoney = null;

function render(state) {
  if (state.phase === 'menu') { seenCards.clear(); resKey = null; lastMoney = null; }
  const freshRes = markResolution(state);

  renderHud(state);
  renderJokers(state, freshRes);
  renderStage(state, freshRes);
  renderHand(state);
  renderActions(state);
  syncOverlay(state);
  showPendingLog(state);
  flushHint(state);
  showMoneyDelta(state);
}

// 金钱变化时提示增减数值，减少玩家对比 HUD 的成本
function showMoneyDelta(s) {
  if (lastMoney == null) { lastMoney = s.money; return; }
  const delta = s.money - lastMoney;
  lastMoney = s.money;
  if (!delta) return;
  if (s.phase !== 'shop' && s.phase !== 'play') return;
  toast(`${delta > 0 ? '+' : '−'}$${fmt(Math.abs(delta))}`, delta > 0 ? 'money' : 'spend');
}

// 只在新的一次结算上播动画，避免任何无关 emit 重放特效
function markResolution(s) {
  const r = s.lastResolution;
  if (!r || r.total == null) return false;
  const key = `${r.total}|${r.chips}|${r.mult}|${r.steps?.length || 0}|${r.level}|${r.win ? 1 : 0}`;
  if (key === resKey) return false;
  resKey = key;
  return true;
}

function flushHint(s) {
  if (s.hint && s.hint !== lastHint) toast(s.hint, 'hint');
  lastHint = s.hint || '';
}

function renderHud(s) {
  const kind = BLIND_KINDS[s.blindIdx];
  const blindName = s.boss
    ? `${bi('Boss', '盲注')} · ${bi(s.boss.en, s.boss.zh)}`
    : bi(kind.en, kind.zh);
  const pct = Math.min(100, (s.roundScore / Math.max(1, s.target)) * 100);
  el.hud.innerHTML = `
    <div class="hud-left">
      <div class="stat"><span class="k">${term('ante')}</span><span class="v">${s.ante}/8</span></div>
      <div class="blind-badge ${s.boss ? 'boss' : ''}"><span class="dot"></span>${blindName}</div>
    </div>
    <div class="hud-right">
      <div class="stat money"><span class="k">${term('money')}</span><span class="v">$${fmt(s.money)}</span></div>
      <div class="stat hands"><span class="k">${term('hand')}</span><span class="v">${s.handsLeft}</span></div>
      <div class="stat discards"><span class="k">${term('discard')}</span><span class="v">${s.discardsLeft}</span></div>
      <button class="icon-btn" data-act="help" aria-label="游戏说明">?</button>
    </div>
    <div class="hud-progress">
      <div class="stat target"><span class="k">${term('target')}</span><span class="v">${fmt(s.target)}</span></div>
      <div class="target-bar"><i style="width:${pct}%"></i></div>
      <div class="stat score"><span class="k">${term('score')}</span><span class="v">${fmt(s.roundScore)}</span></div>
    </div>`;
}

function renderJokers(s, freshRes) {
  const slots = [];
  const trig = freshRes ? new Set(s.lastResolution?.triggered || []) : new Set();
  for (const inst of s.jokers) {
    slots.push(`
      <button class="joker ${inst.def.rarity} ${trig.has(inst.uid) ? 'triggered' : ''}"
        data-joker="${inst.uid}" aria-label="查看 ${biText(inst.def.name, inst.def.zh)}">
        <span class="jn">${esc(inst.def.zh)}</span>
        <span class="jt">${esc(inst.def.text)}</span>
      </button>`);
  }
  const empty = Math.max(0, 5 - s.jokers.length);
  for (let i = 0; i < empty; i += 1) slots.push('<div class="joker empty" aria-hidden="true"></div>');
  el.jokers.innerHTML = slots.join('');
}

function renderStage(s, freshRes) {
  const bits = [];
  if (s.boss) {
    bits.push(`<div class="stage-hint boss">${bi('Boss', '盲注')} · ${bi(s.boss.en, s.boss.zh)} — ${esc(s.boss.desc)}</div>`);
  }

  // 正在选牌时优先展示「将要打出的牌型」，打完牌才回显上一次结算
  const showingPreview = s.phase === 'play' && s.selected.length > 0;
  const r = showingPreview ? null : s.lastResolution;
  if (r && r.total != null) {
    bits.push(`
      <div class="score-bubble ${freshRes ? 'pop' : ''}">
        <span class="chips">${fmt(r.chips)}</span>${term('chips', 'unit')}
        <span class="x">×</span>
        <span class="mult">${fmt(r.mult)}</span>${term('mult', 'unit')}
        <span class="x">=</span>
        <span class="total">${fmt(r.total)}</span>
      </div>`);

    const list = stepChips(s, freshRes);
    if (list) bits.push(list);
    bits.push(`<div class="stage-hint"><span class="res-tag">上一手</span> ${bi(r.labelEn || '', r.label || '')}${r.level ? ` · ${bi(`Lv.${r.level}`, '等级')}` : ''}${r.win ? ` · 过关 +$${r.reward + r.interest}` : ''}</div>`);
  } else {
    bits.push(previewPill(s));
  }

  el.stage.innerHTML = bits.join('');
}

// 结算明细：把「基础牌型 → 牌面筹码 → 每张小丑」压成一行行小胶囊
function stepChips(s, freshRes) {
  const raw = s.lastResolution?.steps || [];
  const cardChips = raw.filter((st) => st.kind === 'card').reduce((sum, st) => sum + (st.chips || 0), 0);
  const steps = raw.filter((st) => st.kind !== 'card' && st.kind !== 'total');
  if (!steps.length) return '';

  const items = [];
  for (const st of steps) {
    const d = items.length;
    if (st.kind === 'hand') {
      items.push(`<span class="res-step" style="--d:${d}">${bi(st.labelEn || '', st.label)} ${fmt(st.chips)} × ${fmt(st.mult)}</span>`);
      if (cardChips) items.push(`<span class="res-step" style="--d:${d + 1}">${term('card')} +${fmt(cardChips)}</span>`);
      continue;
    }
    const parts = [];
    if (st.chips) parts.push(`+${fmt(st.chips)}\u00a0${term('chips')}`);
    if (st.mult) parts.push(`+${fmt(st.mult)}\u00a0${term('mult')}`);
    if (st.xmult && st.xmult !== 1) parts.push(`×${st.xmult}\u00a0${term('mult')}`);
    items.push(`<span class="res-step joker" style="--d:${d}">${esc(st.label)} ${parts.join(' ')}</span>`);
  }

  if (items.length > 5) {
    const rest = items.length - 5;
    items.length = 5;
    items.push(`<span class="res-step" style="--d:5">+${rest} 步</span>`);
  }

  return `<div class="res-list ${freshRes ? '' : 'static'}">${items.join('')}</div>`;
}

function previewPill(s) {
  const cards = s.hand.filter((c) => s.selected.includes(c.uid));
  if (!cards.length) {
    return '<div class="preview-pill muted"><span class="tag">预估</span>点按手牌选择 · 最多 5 张</div>';
  }

  const p = G.previewScore();
  if (!p) return '<div class="preview-pill muted">点按手牌选择 · 最多 5 张</div>';

  const reach = p.total >= Math.max(0, s.target - s.roundScore);
  return `<div class="preview-pill ${reach ? 'reach' : ''}">
      <span class="tag">预估</span>
      <span class="hd">${bi(p.labelEn || '', p.label)}</span>
      <span class="lv">${bi(`Lv.${p.level}`, '等级')}</span>
      <span class="calc">
        <b class="chips">${fmt(p.chips)}</b>${term('chips', 'unit')}
        <span class="x">×</span>
        <b class="mult">${fmt(p.mult)}</b>${term('mult', 'unit')}
        <span class="x">=</span>
        <b class="total">${fmt(p.total)}</b>
      </span>
      ${reach ? '<span class="ok">达标</span>' : ''}
    </div>`;
}

function renderHand(s) {
  const selectedCount = s.selected.length;
  el.handLabel.innerHTML = selectedCount
    ? `<span>${term('cards')}</span><span>已选 <b class="sel">${selectedCount}</b> / 5</span>`
    : `<span>${term('cards')}</span><span>点按牌面选择</span>`;

  el.hand.innerHTML = s.hand.map((c, i) => {
    const fresh = !seenCards.has(c.uid);
    if (fresh) seenCards.add(c.uid);
    return cardHTML(c, s.selected.includes(c.uid), fresh, i);
  }).join('');
}

function cardHTML(card, selected, fresh = false, index = 0) {
  return `
    <button class="card ${card.color} ${selected ? 'selected' : ''} ${card.debuff ? 'debuff' : ''} ${fresh ? 'fresh' : ''}"
      style="--i:${index}"
      data-uid="${card.uid}" aria-pressed="${selected}" aria-label="${biText(card.suitEn, card.suitName)} ${card.label}">
      <span class="corner"><span>${card.label}</span><span>${card.symbol}</span></span>
      <span class="pip"><svg viewBox="0 0 24 24"><use href="#${card.icon}"></use></svg></span>
      <span class="corner bottom"><span>${card.label}</span><span>${card.symbol}</span></span>
    </button>`;
}

function renderActions(s) {
  const playing = s.phase === 'play';
  const n = s.selected.length;
  const playTip = !playing ? '本局已结束' : (n ? `打出这 ${n} 张牌 · Play hand` : '请先选择 1~5 张牌');
  const discardTip = !playing ? '本局已结束' : (s.discardsLeft <= 0 ? '本回合弃牌次数已用尽' : (n ? `弃掉这 ${n} 张并补牌 · Discard` : '请先选择要弃掉的牌'));

  el.actions.innerHTML = `
    <button class="btn primary" data-act="play" ${playing && n ? '' : 'disabled'} title="${playTip}">
      出牌${n ? ` (${n})` : ''}<kbd>Enter</kbd>
    </button>
    <button class="btn" data-act="discard" ${playing && s.discardsLeft > 0 && n ? '' : 'disabled'} title="${discardTip}">
      弃牌 (${s.discardsLeft})<kbd>D</kbd>
    </button>
    <button class="btn ghost sm" data-act="sort" ${playing ? '' : 'disabled'} title="切换排序方式 · Sort">
      排序<kbd>S</kbd>
    </button>`;
}

/* ---------------- 弹层 ---------------- */
let sheetPhase = null;

function syncOverlay(s) {
  if (detailUid != null) return;
  let html = null;
  if (s.phase === 'shop') html = shopHTML(s);
  else if (s.phase === 'menu') html = menuHTML(s);
  else if (s.phase === 'over') html = endHTML(s, false);
  else if (s.phase === 'win') html = endHTML(s, true);

  if (!html) { hideOverlay(); return; }
  openSheet(html, false, sheetPhase === s.phase);
  sheetPhase = s.phase;
}

function openSheet(html, closable = true, keepScroll = false) {
  const scroll = keepScroll ? el.sheet.scrollTop : 0;
  el.sheet.innerHTML = html;
  el.sheet.dataset.closable = closable ? '1' : '0';
  el.overlay.hidden = false;
  el.sheet.scrollTop = scroll;
}

function hideOverlay() {
  el.overlay.hidden = true;
  el.sheet.innerHTML = '';
  el.sub.hidden = true;
  el.sub.innerHTML = '';
  sheetPhase = null;
  detailUid = null;
}

// 二级浮层：卡牌详情、帮助。叠在主面板上，关掉不会打断下面的商店
function subOpen() {
  return !el.sub.hidden;
}

function openSub(html) {
  el.sub.innerHTML = html;
  el.sub.hidden = false;
  el.overlay.hidden = false;
  el.sub.scrollTop = 0;
}

function closeSub() {
  el.sub.hidden = true;
  el.sub.innerHTML = '';
  detailUid = null;
}

function closeSheet() {
  hideOverlay();
}

// 弹层标题栏：标题 + 英文原词注解 + 一句副标题
function sheetHead(title, en, sub) {
  return `<header class="sheet-head">
      <h2>${title}${en ? `<span class="en">${en}</span>` : ''}</h2>
      ${sub ? `<p class="sub">${sub}</p>` : ''}
    </header>`;
}

function menuHTML(s) {
  return `
    ${sheetHead('BalatroLike', '', '小丑牌风格 roguelike 牌组构筑游戏')}
    <div class="menu-actions">
      <button class="btn gold" data-act="start">开始新游戏</button>
    </div>
    <div class="menu-cards">
      <div class="menu-card">
        <span class="k">游戏目标</span>
        <p>在每个盲注中用有限的 ${term('hand')} 与 ${term('discard')} 组成牌型，
        按 ${term('chips')} × ${term('mult')} = ${term('score')} 结算分数，
        达成本关 ${term('target')}，坚持到 ${term('ante')} 8。</p>
      </div>
      <div class="menu-card">
        <span class="k">成长方式</span>
        <p>每个 ${term('ante')} 包含小盲注、大盲注与 ${bi('Boss Blind', 'Boss 盲注')}。
        关卡结束后进入 ${term('shop')}，购买 ${term('joker')} 或用 ${term('planet')} 提升牌型等级；
        ${term('joker')} 按从左到右的顺序结算。</p>
      </div>
    </div>
    <p class="best">最佳纪录：${term('ante')} ${s.best?.ante || 0} · 单局最高 ${term('score')} ${fmt(s.best?.score || 0)}</p>`;
}

function shopHTML(s) {
  const items = s.shop?.items || [];
  const money = s.money;
  const rerollCost = s.shop?.rerollCost ?? 5;
  const interest = interestOf(money);
  const full = s.jokers.length >= 5;
  const kind = BLIND_KINDS[s.blindIdx];

  const dots = Array.from({ length: 5 }, (_, i) => `<i class="slot-dot ${i < s.jokers.length ? 'on' : ''}"></i>`).join('');

  const wares = items.map((it, i) => {
    if (it.sold) return '<div class="shop-card sold" aria-hidden="true"><span class="sold-mark">已售出</span></div>';

    const isJoker = it.kind === 'joker';
    const broke = money < it.price;
    const blocked = broke || (isJoker && full);
    const cta = broke ? `尚差 $${it.price - money}` : (isJoker && full ? '槽位已满' : '购买');
    const tag = isJoker ? bi(RARITY_EN[it.def.rarity], RARITY_LABEL[it.def.rarity]) : term('planet');
    const name = isJoker
      ? `${esc(it.def.name)} <em>${esc(it.def.zh)}</em>`
      : `${esc(it.hand.en)} <em>${esc(it.hand.zh)}</em>`;
    const desc = isJoker
      ? esc(it.def.text)
      : `「${esc(it.hand.zh)}」等级 +1 · 当前 ${bi(`Lv.${s.levels[it.hand.id] || 1}`, '等级')}`;
    const tone = isJoker ? it.def.rarity : 'planet';

    return `
      <button class="shop-card ${tone} ${blocked ? 'cant' : ''}" data-act="buy" data-index="${i}" ${blocked ? 'disabled' : ''}>
        <span class="tag">${tag}</span>
        <span class="nm">${name}</span>
        <span class="ds">${desc}</span>
        <span class="buy">
          <span class="price">$${it.price}</span>
          <span class="cta">${cta}</span>
        </span>
      </button>`;
  }).join('');

  const owned = Array.from({ length: 5 }, (_, i) => {
    const j = s.jokers[i];
    if (!j) return '<div class="owned-slot empty" aria-hidden="true"><span>空</span></div>';
    return `
      <button class="owned-slot ${j.def.rarity}" data-act="detail" data-uid="${j.uid}"
        aria-label="查看 ${biText(j.def.name, j.def.zh)}">
        <span class="jn">${esc(j.def.zh)}</span>
        <span class="je">${esc(j.def.name)}</span>
        <span class="sell">+$${jokerSellValue(j)}</span>
      </button>`;
  }).join('');

  return `
    ${sheetHead('商店', 'Shop', `${term('ante')} ${s.ante} · 已通过 ${bi(kind.en, kind.zh)}`)}
    <div class="wallet">
      <div class="purse">
        <span class="k">${term('money')}</span>
        <b class="amount">$${fmt(money)}</b>
      </div>
      <div class="wallet-meta">
        <span class="chip" title="每持有 $5 获得 $1 利息，上限 $5">
          利息 <b>+$${interest}</b>
        </span>
        <span class="chip">${term('joker')} <i class="slot-dots">${dots}</i> ${s.jokers.length}/5</span>
      </div>
    </div>

    <section class="shelf">
      <h3 class="shelf-title">商品 <small>点击卡片购买</small></h3>
      <div class="shop-grid">${wares}</div>
    </section>

    <section class="shelf">
      <h3 class="shelf-title">我的${term('joker')} <small>${full ? '槽位已满，需先出售一张' : '点击查看详情与出售'}</small></h3>
      <div class="owned-row">${owned}</div>
    </section>

    <footer class="shop-foot">
      <button class="btn accent sm" data-act="reroll" ${money < rerollCost ? 'disabled' : ''}>
        ${term('reroll')} $${rerollCost}
      </button>
      <button class="btn gold" data-act="leave">
        ${s.blindIdx === 2 ? `进入 ${term('ante')} ${s.ante + 1}` : '进入下一关'}
      </button>
    </footer>`;
}

function helpHTML(s) {
  const tips = [
    ['i-spade', '出牌', `每手最多选择 5 张牌，出牌后按 ${term('chips')} × ${term('mult')} 结算；弃牌后立即补满手牌，次数有限。`],
    ['i-heart', '小丑', `${term('joker')} 按从左到右的顺序结算，最多持有 5 张；点击卡面查看详情，可出售。`],
    ['i-diamond', '商店', `关卡结束后进入 ${term('shop')}，可购买 ${term('joker')} 或用 ${term('planet')} 提升牌型等级；每持有 $5 获得 $1 利息，上限 $5。`],
    ['i-club', '盲注', `每个 ${term('ante')} 包含小盲注、大盲注与 ${bi('Boss Blind', 'Boss 盲注')}，Boss 盲注附带特殊限制。`],
  ];

  return `
    ${sheetHead('游戏说明', 'How to Play', `${term('ante')} ${s.ante}/8 · ${term('target')} ${fmt(s.target)}`)}
    <div class="tips">
      ${tips.map(([icon, t, d]) => `
        <div class="tip">
          <svg class="tip-icon"><use href="#${icon}"></use></svg>
          <div class="tip-body"><b>${t}</b><p>${d}</p></div>
        </div>`).join('')}
    </div>
    <p class="keys">快捷键：<b>Enter</b> 出牌 · <b>D</b> 弃牌 · <b>S</b> 切换排序 · <b>Esc</b> 关闭弹层</p>
    <p class="keys">机制词采用「英文原词(中文译名)」写法，便于对照原版 Balatro 与本项目文档。</p>
    <div class="row">
      <button class="btn ghost" data-act="close">关闭</button>
    </div>`;
}

function jokerDetailHTML() {
  const inst = G.state.jokers.find((j) => j.uid === detailUid);
  if (!inst) return '';
  const d = inst.def;
  return `
    <div class="detail-top">
      <span class="rarity ${d.rarity}">${bi(RARITY_EN[d.rarity], RARITY_LABEL[d.rarity])}</span>
      <button class="icon-btn" data-act="close" aria-label="关闭详情">✕</button>
    </div>
    <h2>${esc(d.name)}</h2>
    <p class="sub">${esc(d.zh)} · 购入 $${d.cost}</p>
    <p class="detail-text">${esc(d.text)}</p>
    <div class="row">
      <button class="btn gold" data-act="sell" data-uid="${inst.uid}">出售 +$${jokerSellValue(inst)}</button>
      <button class="btn ghost" data-act="close">关闭</button>
    </div>`;
}

function endHTML(s, win) {
  const kind = BLIND_KINDS[s.blindIdx];
  const ratio = s.target ? s.roundScore / s.target : 0;
  const pct = Math.round(ratio * 100);
  const grade = `${win ? '已达成' : '未达成'} ${term('target')} · ${pct}%`;
  const sub = `${term('ante')} ${s.ante} · ${bi(kind.en, kind.zh)}${s.boss ? ` · ${bi(s.boss.en, s.boss.zh)}` : ''}`;

  return `
    ${sheetHead(win ? '通关' : '游戏结束', '', sub)}
    <div class="result ${win ? 'win' : ''}">
      <div class="result-score">
        <span class="k">${term('score')}</span>
        <b>${fmt(s.roundScore)}</b>
        <span class="of">/ ${fmt(s.target)}</span>
      </div>
      <div class="result-bar"><i style="width:${Math.min(100, pct)}%"></i></div>
      <span class="grade">${grade}</span>
    </div>
    <div class="stat-grid">
      <div><span class="k">${term('hand')}</span><b>${s.stats.handsPlayed}</b></div>
      <div><span class="k">${term('discard')}</span><b>${s.stats.discardsUsed}</b></div>
      <div><span class="k">单${term('hand')}最高</span><b>${fmt(s.stats.bestHand)}</b></div>
      <div><span class="k">${term('joker')}</span><b>${s.jokers.length}</b></div>
    </div>
    <div class="row" style="margin-top:18px">
      <button class="btn gold" data-act="restart">重新开始</button>
    </div>`;
}

/* ---------------- Toast ---------------- */
let lastLogLen = 0;
function showPendingLog(s) {
  if (s.log.length > lastLogLen) {
    const fresh = s.log.slice(lastLogLen);
    lastLogLen = s.log.length;
    fresh.forEach((msg) => toast(msg));
  } else if (s.log.length < lastLogLen) {
    lastLogLen = s.log.length;
  }
}

export function toast(msg, kind = 'info') {
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.textContent = msg;
  el.toastWrap.appendChild(node);
  setTimeout(() => node.remove(), 2000);
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
