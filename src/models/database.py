# -*- coding: utf-8 -*-
"""
Camada de acesso ao banco de dados (SQLite).
Um arquivo único (dados/ccb.db) guarda todos os registros do formulário
"Reunião de Jovens e Menores". Não depende de nenhum servidor externo.

get_db()/close_db() seguem o padrão oficial do próprio tutorial do Flask
para conexão por requisição (guardada em flask.g) — é a única parte deste
módulo que conhece o Flask; o resto é SQL puro.
"""
import os
import sqlite3

from flask import g

# BASE_DIR é a raiz do projeto (um nível acima deste pacote models/), onde
# ficam as pastas dados/ e static/.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "dados", "ccb.db")

# Colunas numéricas do quadro de RECITATIVOS, na ordem impressa no formulário.
COLUNAS_MENINAS = ["meninas_1", "meninas_2", "meninas_3", "meninas_4", "meninas_5"]
COLUNAS_MENINOS = ["meninos_1", "meninos_2", "meninos_3", "meninos_4", "meninos_5"]
COLUNAS_RECITATIVOS = COLUNAS_MENINAS + COLUNAS_MENINOS

RECITATIVOS_LABELS = [
    "1º (crianças)",
    "2º (meninas/meninos)",
    "3º (mocinhas/mocinhos)",
    "4º (moças/moços)",
    "5º (auxiliares)",
]
RECITATIVOS_LABELS_CURTOS = ["Crianças", "Meninos(as)", "Mocinhos(as)", "Moços(as)", "Auxiliares"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    presidencia TEXT,
    local TEXT,
    meninas_1 INTEGER NOT NULL DEFAULT 0,
    meninas_2 INTEGER NOT NULL DEFAULT 0,
    meninas_3 INTEGER NOT NULL DEFAULT 0,
    meninas_4 INTEGER NOT NULL DEFAULT 0,
    meninas_5 INTEGER NOT NULL DEFAULT 0,
    meninos_1 INTEGER NOT NULL DEFAULT 0,
    meninos_2 INTEGER NOT NULL DEFAULT 0,
    meninos_3 INTEGER NOT NULL DEFAULT 0,
    meninos_4 INTEGER NOT NULL DEFAULT 0,
    meninos_5 INTEGER NOT NULL DEFAULT 0,
    recitativos_individuais INTEGER NOT NULL DEFAULT 0,
    visitas TEXT NOT NULL DEFAULT '',
    livro TEXT,
    capitulo TEXT,
    versiculo TEXT,
    presidido_por TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    atualizado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_registros_data ON registros(data);
"""


def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_connection()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def get_db():
    """Uma conexão por requisição, guardada em flask.g e fechada sozinha
    no final (veja close_db, registrado em app.py via teardown_appcontext)."""
    if "db" not in g:
        g.db = get_connection()
    return g.db


def close_db(exception=None):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def total_meninas(row):
    return sum(int(row[c] or 0) for c in COLUNAS_MENINAS)


def total_meninos(row):
    return sum(int(row[c] or 0) for c in COLUNAS_MENINOS)


def total_geral(row):
    return total_meninas(row) + total_meninos(row)


# "Visitas" guarda os NOMES das igrejas/congregações que visitaram (texto
# separado por ";"), não uma quantidade digitada — a quantidade é derivada
# contando os nomes da lista.
SEPARADOR_VISITAS = ";"


def lista_visitas(valor):
    """Converte o texto salvo em "visitas" numa lista de nomes de igrejas."""
    if not valor:
        return []
    return [v.strip() for v in valor.split(SEPARADOR_VISITAS) if v.strip()]


def texto_visitas(nomes):
    """Junta uma lista de nomes de volta no texto salvo em "visitas"."""
    return f"{SEPARADOR_VISITAS} ".join(dict.fromkeys(n.strip() for n in nomes if n.strip()))
