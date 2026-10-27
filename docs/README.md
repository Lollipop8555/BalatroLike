# BalatroLike 规则文档

本项目是**非商业性质的开源学习项目**，用于研究 roguelike deckbuilder 的数值设计与系统结构。
本文档整理《Balatro》（小丑牌）的公开游戏规则、道具与数值，作为实现参考。

## 文档索引

| 文件 | 内容 |
| --- | --- |
| [01-核心规则.md](./01-核心规则.md) | 游戏循环、回合流程、基础数值、经济系统、商店与补充包 |
| [02-牌型与计分.md](./02-牌型与计分.md) | 12 种牌型、升级曲线、判定规则、计分顺序 |
| [03-小丑牌图鉴.md](./03-小丑牌图鉴.md) | 全部 150 张小丑牌（普通 61 / 罕见 64 / 稀有 20 / 传奇 5） |
| [04-消耗牌与卡牌修正.md](./04-消耗牌与卡牌修正.md) | 塔罗 22 张、星球 12 张、幻影 18 张、强化/版本/蜡封 |
| [05-商店经济与盲注.md](./05-商店经济与盲注.md) | 价格公式、重掷、利息、30 种盲注、Ante 需求表 |
| [06-牌组难度与标签.md](./06-牌组难度与标签.md) | 15 种牌组、8 级难度、32 张代金券、24 种标签 |

## 结构化数据

`data/` 目录下为可直接被代码读取的 JSON（字段设计见各文件内注释字段）：

| 文件 | 内容 |
| --- | --- |
| [poker-hands.json](../data/poker-hands.json) | 12 种牌型基础值与升级增量、点数筹码、计分阶段 |
| [jokers-common.json](../data/jokers-common.json) | 普通小丑 61 张 |
| [jokers-uncommon.json](../data/jokers-uncommon.json) | 罕见小丑 64 张 |
| [jokers-rare.json](../data/jokers-rare.json) | 稀有小丑 20 张 |
| [jokers-legendary.json](../data/jokers-legendary.json) | 传奇小丑 5 张 |
| [consumables-tarot.json](../data/consumables-tarot.json) | 塔罗牌 22 张 |
| [consumables-planet.json](../data/consumables-planet.json) | 星球牌 12 张 |
| [consumables-spectral.json](../data/consumables-spectral.json) | 幻影牌 18 张 |
| [blinds.json](../data/blinds.json) | 30 种盲注效果与各 Ante 分数需求 |
| [decks-stakes.json](../data/decks-stakes.json) | 15 种牌组、8 级难度、4 种贴纸 |
| [vouchers-tags.json](../data/vouchers-tags.json) | 32 张代金券、24 种标签 |

> 小丑牌按稀有度拆分，便于按需加载；字段为 `id / name / zh / cost / effect / unlock`，
> `unlock: "unknown"` 表示维基页面未渲染明确解锁条件。

## 数据来源与声明

- 数据整理自社区维基 **Balatro Wiki**（https://balatrowiki.org），抓取日期 **2026-10-27**。
- 原文采用 **CC BY-NC-SA 3.0** 许可，本项目同样以非商业学习目的使用，并保留署名。
- 游戏版本以 **1.0.1f** 为主（含 1.0.1o-FULL 的已知差异），部分概率/价格以当前正式版为准。
- 《Balatro》及其美术、名称版权归 **LocalThunk / Playstack** 所有。本项目**不包含**任何原版美术资源，仅整理规则与数值用于学术研究。
- 标注 `⚠️` 的条目为社区推测或版本间存在差异，实现时应以可玩性为准做取舍。

## 文档约定

- **Chips（筹码）** 记作 `+Chips`，**Mult（倍率）** 加法记作 `+Mult`，乘法记作 `×Mult`。
- 数值格式统一为「Chips × Mult」，例如 `100 × 8`。
- 未特别说明时，价格为商店**基础售价**。
