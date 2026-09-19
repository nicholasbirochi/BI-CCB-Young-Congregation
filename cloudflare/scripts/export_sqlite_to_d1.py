#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Exporta o banco SQLite local do app Flask para um SQL compatível com D1.

Uso:
  python3 scripts/export_sqlite_to_d1.py ../src/data/ccb.db private/seed/current_data.sql
"""
import json
import sqlite3
import sys
from pathlib import Path


def sql_quote(value):
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def main():
    if len(sys.argv) != 3:
        raise SystemExit("uso: export_sqlite_to_d1.py <ccb.db> <saida.sql>")

    db_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    cols = [row["name"] for row in conn.execute("PRAGMA table_info(registros)").fetchall()]
    rows = conn.execute("SELECT * FROM registros ORDER BY id").fetchall()

    lines = [
        "-- Dados exportados do SQLite local para Cloudflare D1.",
        "-- Rode depois de aplicar migrations/0001_schema.sql.",
        "DELETE FROM registros;",
    ]
    for row in rows:
        values = ", ".join(sql_quote(row[col]) for col in cols)
        lines.append(f"INSERT INTO registros ({', '.join(cols)}) VALUES ({values});")
    lines.append("")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")

    summary = conn.execute("SELECT COUNT(*), MIN(data), MAX(data), MIN(id), MAX(id) FROM registros").fetchone()
    summary_path = out_path.with_name("export-summary.json")
    summary_path.write_text(json.dumps({
        "registros": summary[0],
        "primeira_data": summary[1],
        "ultima_data": summary[2],
        "primeiro_id": summary[3],
        "ultimo_id": summary[4],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Exportados {len(rows)} registros para {out_path}")


if __name__ == "__main__":
    main()
