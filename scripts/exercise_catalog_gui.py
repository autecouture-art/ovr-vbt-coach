#!/usr/bin/python3
"""Mac GUI for reviewing and drafting RepVeloCoach exercise catalog cleanup.

The app keeps the TypeScript catalog as the source of truth. This GUI reads it,
lets you edit a draft view, and exports JSON/Markdown that can be applied by an
engineer or future importer without risking an unsafe automatic TS rewrite.
"""

from __future__ import annotations

import json
import re
import tkinter as tk
from dataclasses import asdict, dataclass
from pathlib import Path
from tkinter import messagebox, ttk
from typing import Optional


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "src/constants/exerciseCatalog.ts"
OUTPUT_JSON = ROOT / "tmp/exercise-catalog-draft.json"
OUTPUT_MD = ROOT / "docs/exercise-catalog-alias-plan.md"

CATEGORIES = [
    "squat",
    "bench",
    "deadlift",
    "press",
    "pull",
    "row",
    "vertical_pull",
    "single_leg",
    "quad",
    "hamstring",
    "adductor",
    "glute",
    "triceps",
    "biceps",
    "core",
    "accessory",
]


@dataclass
class ExerciseDraft:
    id: str
    name: str
    category: str
    subcategory: str
    aliases: list[str]


def _extract_seed_array(source: str) -> str:
    marker = "const DEFAULT_EXERCISE_SEEDS"
    start = source.index(marker)
    equals = source.index("=", start)
    bracket_start = source.index("[", equals)
    depth = 0
    in_string = False
    escape = False
    quote = ""

    for index in range(bracket_start, len(source)):
        char = source[index]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == quote:
                in_string = False
            continue

        if char in ("'", '"', "`"):
            in_string = True
            quote = char
        elif char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                return source[bracket_start + 1 : index]

    raise ValueError("DEFAULT_EXERCISE_SEEDS array end was not found")


def _split_object_blocks(array_source: str) -> list[str]:
    blocks: list[str] = []
    depth = 0
    start: Optional[int] = None
    in_string = False
    escape = False
    quote = ""

    for index, char in enumerate(array_source):
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == quote:
                in_string = False
            continue

        if char in ("'", '"', "`"):
            in_string = True
            quote = char
        elif char == "{":
            if depth == 0:
                start = index
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0 and start is not None:
                blocks.append(array_source[start : index + 1])
                start = None

    return blocks


def _read_string(block: str, key: str) -> str:
    match = re.search(rf"{key}:\s*(['\"])(.*?)\1", block, re.S)
    return match.group(2).strip() if match else ""


def _read_aliases(block: str) -> list[str]:
    match = re.search(r"aliases:\s*\[(.*?)\]", block, re.S)
    if not match:
        return []
    return [
        item.strip()
        for _, item in re.findall(r"(['\"])(.*?)\1", match.group(1), re.S)
        if item.strip()
    ]


def load_catalog() -> list[ExerciseDraft]:
    source = CATALOG_PATH.read_text(encoding="utf-8")
    array_source = _extract_seed_array(source)
    drafts: list[ExerciseDraft] = []
    for block in _split_object_blocks(array_source):
        drafts.append(
            ExerciseDraft(
                id=_read_string(block, "id"),
                name=_read_string(block, "name"),
                category=_read_string(block, "category"),
                subcategory=_read_string(block, "subcategory"),
                aliases=_read_aliases(block),
            )
        )
    return [item for item in drafts if item.id and item.name]


class ExerciseCatalogApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("RepVeloCoach Exercise Catalog")
        self.geometry("1180x720")
        self.configure(bg="#15161a")
        self.drafts = load_catalog()
        self.selected_id: Optional[str] = None

        self.search_var = tk.StringVar()
        self.name_var = tk.StringVar()
        self.category_var = tk.StringVar()
        self.subcategory_var = tk.StringVar()
        self.aliases_text: tk.Text

        self._build_ui()
        self._refresh_table()

    def _build_ui(self) -> None:
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("Treeview", rowheight=28, font=("Helvetica", 13))
        style.configure("Treeview.Heading", font=("Helvetica", 12, "bold"))

        toolbar = tk.Frame(self, bg="#15161a")
        toolbar.pack(fill="x", padx=18, pady=(16, 8))

        tk.Label(
            toolbar,
            text="種目カタログ整理",
            fg="#f4f7fb",
            bg="#15161a",
            font=("Helvetica", 24, "bold"),
        ).pack(side="left")

        search = tk.Entry(
            toolbar,
            textvariable=self.search_var,
            width=28,
            bg="#23252d",
            fg="#f4f7fb",
            insertbackground="#f4f7fb",
            relief="flat",
            font=("Helvetica", 14),
        )
        search.pack(side="right", ipady=8)
        search.bind("<KeyRelease>", lambda _event: self._refresh_table())

        main = tk.PanedWindow(self, orient="horizontal", bg="#15161a", sashwidth=8)
        main.pack(fill="both", expand=True, padx=18, pady=8)

        left = tk.Frame(main, bg="#15161a")
        right = tk.Frame(main, bg="#1d1f26")
        main.add(left, width=720)
        main.add(right, width=420)

        columns = ("name", "category", "subcategory", "aliases")
        self.tree = ttk.Treeview(left, columns=columns, show="headings")
        self.tree.heading("name", text="English canonical")
        self.tree.heading("category", text="Category")
        self.tree.heading("subcategory", text="Subcategory")
        self.tree.heading("aliases", text="Aliases")
        self.tree.column("name", width=230)
        self.tree.column("category", width=110)
        self.tree.column("subcategory", width=150)
        self.tree.column("aliases", width=260)
        self.tree.pack(fill="both", expand=True)
        self.tree.bind("<<TreeviewSelect>>", self._select_row)

        self._label(right, "English canonical name").pack(anchor="w", padx=18, pady=(18, 4))
        tk.Entry(
            right,
            textvariable=self.name_var,
            bg="#2a2d36",
            fg="#f4f7fb",
            insertbackground="#f4f7fb",
            relief="flat",
            font=("Helvetica", 14),
        ).pack(fill="x", padx=18, ipady=8)

        self._label(right, "Category").pack(anchor="w", padx=18, pady=(16, 4))
        ttk.Combobox(
            right,
            textvariable=self.category_var,
            values=CATEGORIES,
            state="readonly",
            font=("Helvetica", 13),
        ).pack(fill="x", padx=18, ipady=6)

        self._label(right, "Subcategory").pack(anchor="w", padx=18, pady=(16, 4))
        tk.Entry(
            right,
            textvariable=self.subcategory_var,
            bg="#2a2d36",
            fg="#f4f7fb",
            insertbackground="#f4f7fb",
            relief="flat",
            font=("Helvetica", 14),
        ).pack(fill="x", padx=18, ipady=8)

        self._label(right, "Aliases (one per line)").pack(anchor="w", padx=18, pady=(16, 4))
        self.aliases_text = tk.Text(
            right,
            height=12,
            bg="#2a2d36",
            fg="#f4f7fb",
            insertbackground="#f4f7fb",
            relief="flat",
            font=("Helvetica", 13),
        )
        self.aliases_text.pack(fill="both", expand=True, padx=18)

        buttons = tk.Frame(right, bg="#1d1f26")
        buttons.pack(fill="x", padx=18, pady=18)
        self._button(buttons, "選択行を下書き更新", self._apply_current).pack(
            side="left", padx=(0, 8)
        )
        self._button(buttons, "JSON/MD出力", self._export).pack(side="left")

    def _label(self, parent: tk.Widget, text: str) -> tk.Label:
        return tk.Label(
            parent,
            text=text,
            fg="#aeb5c2",
            bg=parent["bg"],
            font=("Helvetica", 12, "bold"),
        )

    def _button(self, parent: tk.Widget, text: str, command) -> tk.Button:
        return tk.Button(
            parent,
            text=text,
            command=command,
            bg="#3a7afe",
            fg="#ffffff",
            activebackground="#245fd4",
            activeforeground="#ffffff",
            relief="flat",
            font=("Helvetica", 12, "bold"),
            padx=14,
            pady=8,
        )

    def _refresh_table(self) -> None:
        query = self.search_var.get().strip().lower()
        self.tree.delete(*self.tree.get_children())
        for item in self.drafts:
            haystack = " ".join([item.name, item.category, item.subcategory, *item.aliases]).lower()
            if query and query not in haystack:
                continue
            self.tree.insert(
                "",
                "end",
                iid=item.id,
                values=(
                    item.name,
                    item.category,
                    item.subcategory,
                    ", ".join(item.aliases[:4]),
                ),
            )

    def _select_row(self, _event) -> None:
        selection = self.tree.selection()
        if not selection:
            return
        self.selected_id = selection[0]
        item = next((draft for draft in self.drafts if draft.id == self.selected_id), None)
        if not item:
            return
        self.name_var.set(item.name)
        self.category_var.set(item.category)
        self.subcategory_var.set(item.subcategory)
        self.aliases_text.delete("1.0", "end")
        self.aliases_text.insert("1.0", "\n".join(item.aliases))

    def _apply_current(self) -> None:
        if not self.selected_id:
            messagebox.showinfo("未選択", "編集する種目を左の一覧から選んでください。")
            return
        item = next((draft for draft in self.drafts if draft.id == self.selected_id), None)
        if not item:
            return
        aliases = [
            line.strip()
            for line in self.aliases_text.get("1.0", "end").splitlines()
            if line.strip()
        ]
        item.name = self.name_var.get().strip() or item.name
        item.category = self.category_var.get().strip() or item.category
        item.subcategory = self.subcategory_var.get().strip()
        item.aliases = aliases
        self._refresh_table()

    def _export(self) -> None:
        if self.selected_id:
            self._apply_current()

        OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_MD.parent.mkdir(parents=True, exist_ok=True)

        payload = [asdict(item) for item in self.drafts]
        OUTPUT_JSON.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        lines = [
            "# Exercise Catalog Alias Plan",
            "",
            "This file is generated by `python3 scripts/exercise_catalog_gui.py`.",
            "Review changes, then apply safe edits to `src/constants/exerciseCatalog.ts`.",
            "",
            "| English canonical | Category | Subcategory | Aliases |",
            "|---|---|---|---|",
        ]
        for item in self.drafts:
            aliases = "<br>".join(item.aliases) if item.aliases else ""
            lines.append(
                f"| {item.name} | {item.category} | {item.subcategory} | {aliases} |"
            )
        OUTPUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
        messagebox.showinfo(
            "出力完了",
            f"JSON: {OUTPUT_JSON}\nMarkdown: {OUTPUT_MD}",
        )


def main() -> None:
    app = ExerciseCatalogApp()
    app.mainloop()


if __name__ == "__main__":
    main()
