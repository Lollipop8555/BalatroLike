#!/usr/bin/env python3
"""部署前自检：确保站点零外部依赖、模块引用可解析、数据 JSON 合法。

只使用 Python 标准库，CI 与本地都能直接跑：python3 tools/check_site.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errors: list[str] = []
notes: list[str] = []

REQUIRED = [
    "index.html",
    "assets/style.css",
    "js/main.js",
    "js/game.js",
    "js/ui.js",
    "js/scoring.js",
    "js/hands.js",
    "js/jokers.js",
    "js/cards.js",
    "js/blinds.js",
    "js/rng.js",
    "docs/README.md",
]


def check_required() -> None:
    for rel in REQUIRED:
        if not (ROOT / rel).is_file():
            errors.append(f"缺少文件：{rel}")


def check_no_external() -> None:
    """静态站点必须自包含：不允许 CDN / 外链脚本与样式。"""
    pattern = re.compile(r"""(?:src|href)\s*=\s*["'](https?:)?//""", re.I)
    import_pattern = re.compile(r"""from\s+["'](https?:)?//""", re.I)
    css_import = re.compile(r"""@import\s+(?:url\()?["']?(https?:)?//""", re.I)

    for rel in ("index.html",):
        text = (ROOT / rel).read_text(encoding="utf-8")
        for m in pattern.finditer(text):
            errors.append(f"{rel} 存在外部资源引用：{m.group(0)!r}")

    for path in (ROOT / "js").glob("*.js"):
        text = path.read_text(encoding="utf-8")
        if import_pattern.search(text):
            errors.append(f"{path.name} 从外部 URL 导入模块")
    for path in (ROOT / "assets").glob("*.css"):
        text = path.read_text(encoding="utf-8")
        if css_import.search(text):
            errors.append(f"{path.name} 通过 @import 引用了外部样式")


def check_modules() -> None:
    """校验相对路径的 ES Module 导入是否都指向真实文件。"""
    imp = re.compile(r"""from\s+["'](\.{1,2}/[^"']+)["']""")
    for path in sorted((ROOT / "js").glob("*.js")):
        for rel in imp.findall(path.read_text(encoding="utf-8")):
            target = (path.parent / rel).resolve()
            if not target.is_file():
                errors.append(f"{path.name} 导入了不存在的模块：{rel}")


def check_html_assets() -> None:
    text = (ROOT / "index.html").read_text(encoding="utf-8")
    for rel in re.findall(r"""(?:src|href)\s*=\s*["']([^"'#]+)["']""", text):
        if rel.startswith("data:"):
            continue
        if not (ROOT / rel).is_file():
            errors.append(f"index.html 引用了不存在的资源：{rel}")


def check_data() -> None:
    files = sorted((ROOT / "data").glob("*.json"))
    if not files:
        errors.append("data/ 目录为空")
    for path in files:
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            errors.append(f"{path.name} JSON 解析失败：{exc}")
    notes.append(f"data/*.json 共 {len(files)} 个文件校验通过")


def main() -> int:
    check_required()
    check_no_external()
    check_modules()
    check_html_assets()
    check_data()

    if errors:
        print("✗ 自检未通过：")
        for e in errors:
            print("  -", e)
        return 1

    print("✓ 自检通过：零外部依赖、模块引用完整、数据 JSON 合法")
    for n in notes:
        print("  ·", n)
    return 0


if __name__ == "__main__":
    sys.exit(main())
