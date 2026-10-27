# BalatroLike

网页版「小丑牌」风格 roguelike deckbuilder 的**开源学习项目**，用于学术研究：
研究牌组构筑类 roguelike 的数值曲线、资源经济与随机性设计，并完整实现一遍可玩原型。

- **纯静态、零第三方依赖**：无 npm、无构建、无 CDN，只有 HTML + CSS + 原生 ES Module。
- **一条 GitHub Actions 流水线直接部署到 GitHub Pages**，只用 GitHub 官方 action。
- **桌面 / 平板 / 手机竖屏三套布局**，手机端针对手指点按单独调过尺寸与换行。

> 本项目不包含原版《Balatro》的任何美术、音频或代码资源，仅整理公开规则与数值用于研究与实现参考。
> 《Balatro》版权归 LocalThunk / Playstack 所有；界面与图标为纯 CSS / 内联 SVG 自制。

---

## 快速开始

```bash
# 任意静态服务器即可（ES Module 不能用 file:// 直接打开）
python3 -m http.server 8000
# 然后访问 http://localhost:8000
```

## 部署到 GitHub Pages

1. 把仓库推到 GitHub（默认分支 `main` 或 `master`）。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。
3. 推送后 [`.github/workflows/pages.yml`](.github/workflows/pages.yml) 会自动：
   - `node --check` 校验全部 JS 语法；
   - 运行 [`tools/check_site.py`](tools/check_site.py) 做「零外部依赖 + 模块引用完整 + JSON 合法」自检；
   - 上传仓库根目录并用官方 `deploy-pages` 发布。
4. 站点地址形如 `https://<用户名>.github.io/BalatroLike/`。

项目根目录已放 `.nojekyll`，避免 Jekyll 处理 `js/`、`data/` 等目录。

## 怎么玩

| 操作 | 说明 |
| --- | --- |
| 点按手牌 | 选中 / 取消，最多 5 张（手牌区顶部显示已选数量） |
| 出牌 `Enter` | 结算 `Chips × Mult`，扣 1 次出牌机会 |
| 弃牌 `D` | 丢掉选中的牌并补满手牌，扣 1 次弃牌机会 |
| 排序 `S` | 在「点数 / 花色」排序之间切换 |
| `Esc` | 关闭弹层 |

牌桌会实时给出反馈：

- 选中手牌时显示「预估」胶囊：牌型、等级、`Chips × Mult = 总分`，总分随选牌即时变化，
  够分达标时变绿提示；预估跑的是同一条计分管线但不写状态、不消耗随机数，
  概率型小丑（名片、血石等）按不触发计算，因此是**保底值**。
- 出牌后显示 `Chips × Mult = 总分` 与分步明细（牌型基础 → 牌面筹码 → 每张小丑的加成），
  并标注「上一手」，避免和当前选择混淆；触发的小丑牌会闪一下。
- 非法操作（如超过 5 张、Boss 限制）以底部胶囊提示出现，不挤占牌桌空间。

### 术语对照（Glossary）

游戏内的机制词统一写作 **英文原词(中文译名)**，例如 `Chips(筹码)`、`Mult(倍率)`、
`Ante(底注)`、`Blind(盲注)`、`Joker(小丑牌)`。中文用于理解，英文原词用于对照原版
Balatro 与官方 wiki，避免同一概念出现多种译法。

- 术语表集中在 `js/terms.js`（`TERMS` + `term()` / `bi()`），改词只改这一处；
- 覆盖范围：HUD、牌桌结算气泡、预估胶囊、分步明细、牌型名（`High Card(高牌)`）、
  盲注与 Boss、小丑名与效果文本、商店、帮助与结算页；
- 牌型、小丑、Boss 的英文名来自各自数据里的 `en` / `name` 字段，不硬编码在 UI。

一局流程：**小盲注 → 大盲注 → Boss 盲注** 为一个 Ante，共 8 个 Ante。
每关达到目标分即过关并进商店，用金钱买小丑牌（最多 5 张）或星球牌升级牌型；
Boss 盲注会带特殊限制（如禁止重复牌型、削弱特定花色、削减出牌次数等）。

## 代码结构

```
.
├── index.html                  # 单页骨架 + 内联 SVG 符号表
├── assets/style.css            # 全部样式：主题变量、卡片、响应式断点
├── assets/favicon.svg          # 站点图标：深底 + 斜置扑克牌 + 红心
├── js/
│   ├── main.js                 # 入口：创建 game 并挂载 UI
│   ├── game.js                 # 状态机：盲注/商店/结算/存档
│   ├── scoring.js              # 6 阶段计分管线（手牌→计分牌→持有牌→小丑→游戏）
│   ├── hands.js                # 12 种牌型判定 + 升级曲线
│   ├── jokers.js               # 小丑牌效果（事件钩子：手牌/计分牌/持有牌/弃牌…）
│   ├── cards.js                # 牌堆构造、花色点数、筹码值
│   ├── blinds.js               # 盲注目标曲线、Boss 效果、利息与奖励
│   ├── rng.js                  # 可复现随机数（mulberry32 + 种子）
│   └── ui.js                   # 渲染与事件绑定（无框架）
├── data/                       # 规则与数值 JSON（文档研究产物）
├── docs/                       # 规则与数值设计文档
├── tools/
│   ├── check_site.py           # 部署前自检（零外部依赖 / 引用完整性）
│   └── simulate.mjs            # 平衡性模拟：AI 自动跑完整对局
└── .github/workflows/pages.yml  # Pages 部署流水线
```

设计上刻意把**纯逻辑**（`game/scoring/hands/jokers/blinds`）与**渲染**（`ui.js`）分开：
逻辑层不碰 DOM，因此可以直接在 Node 里跑模拟（见下）。

## 平衡性研究

```bash
node tools/simulate.mjs 20     # 用「贪婪 AI」跑 20 局，输出到达的 Ante 与得分
python3 tools/check_site.py    # 部署前自检
```

模拟脚本会枚举所有 1~5 张组合、在需要时弃牌换牌、并在商店买小丑牌，
用于快速验证数值曲线是否会「卡死在某个 Ante」。

## 实现范围

- 已实现：Ante 1-8 主循环、12 种牌型与等级升级、Chips×Mult 计分管线、
  基础经济（过关奖励 + 利息 + 重掷涨价）、商店（小丑 / 星球牌 / 出售）、
  40+ 张小丑牌效果、Boss 盲注限制、最佳记录本地存档。
- 未实现（后续计划）：消耗牌（塔罗/幻影）、补充包、标签与代金券、
  卡牌强化/蜡封/版本、牌组与难度解锁、无尽模式。

## 规则与数值文档

| 文件 | 内容 |
| --- | --- |
| [`docs/01-核心规则.md`](docs/01-核心规则.md) | 游戏循环、回合流程、经济与商店 |
| [`docs/02-牌型与计分.md`](docs/02-牌型与计分.md) | 12 种牌型、升级曲线、计分顺序 |
| [`docs/03-小丑牌图鉴.md`](docs/03-小丑牌图鉴.md) | 150 张小丑牌 + 数值设计分析 |
| [`docs/04-消耗牌与卡牌修正.md`](docs/04-消耗牌与卡牌修正.md) | 塔罗 / 星球 / 幻影、强化 / 蜡封 / 版本 |
| [`docs/05-商店经济与盲注.md`](docs/05-商店经济与盲注.md) | 价格公式、30 种盲注、Ante 需求 |
| [`docs/06-牌组难度与标签.md`](docs/06-牌组难度与标签.md) | 牌组、难度、代金券、标签 |
| [`docs/README.md`](docs/README.md) | 文档索引与 `data/*.json` 字段说明 |

## 数据可靠性

- 数值来自社区维基 **Balatro Wiki**（<https://balatrowiki.org>），抓取日期 **2026-10-27**。
- 原文许可 **CC BY-NC-SA 3.0**，本项目沿用相同许可。
- 文档中 `⚠️` 标记表示版本差异或社区推测，实现时以可玩性为准调整。
