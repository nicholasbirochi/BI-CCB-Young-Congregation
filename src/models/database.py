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

# Colunas numéricas do quadro de RECITATIVOS, na ordem impressa nas fotos
# do caderno: crianças, meninas/meninos, mocinhas/mocinhos, moças/moços,
# continuação e particular.
COLUNAS_MENINAS = ["meninas_1", "meninas_2", "meninas_3", "meninas_4", "meninas_5", "meninas_6"]
COLUNAS_MENINOS = ["meninos_1", "meninos_2", "meninos_3", "meninos_4", "meninos_5", "meninos_6"]
COLUNAS_RECITATIVOS = COLUNAS_MENINAS + COLUNAS_MENINOS

RECITATIVOS_LABELS = [
    "1º (crianças)",
    "2º (meninas/meninos)",
    "3º (mocinhas/mocinhos)",
    "4º (moças/moços)",
    "Continuação",
    "Particular",
]

# O gráfico "Irmãs x Irmãos" segue o formulário ATUAL da congregação:
# crianças, meninas/meninos, mocinhas/mocinhos, moças/moços — as 4 posições
# que continuam sendo digitadas hoje. "Continuação" e "Particular" (posições
# 5 e 6) não fazem mais parte do formulário atual; ficam de fora do gráfico
# mas continuam 100% guardados no banco (contam nos KPIs de total). O
# gráfico ainda ganha uma 5ª posição "Auxiliares" (controllers/dashboard.py),
# somada à parte porque vem de colunas próprias (auxiliares_masculinos/
# auxiliares_femininos), não do quadro de recitativos.
COLUNAS_GRAFICO_MENINAS = ["meninas_1", "meninas_2", "meninas_3", "meninas_4"]
COLUNAS_GRAFICO_MENINOS = ["meninos_1", "meninos_2", "meninos_3", "meninos_4"]
RECITATIVOS_LABELS_MENINAS = ["Crianças", "Meninas", "Mocinhas", "Moças"]
RECITATIVOS_LABELS_MENINOS = ["Crianças", "Meninos", "Mocinhos", "Moços"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    presidencia TEXT,
    pais TEXT NOT NULL DEFAULT 'Brasil',
    local TEXT,
    estado TEXT,
    cidade TEXT,
    meninas_1 INTEGER NOT NULL DEFAULT 0,
    meninas_2 INTEGER NOT NULL DEFAULT 0,
    meninas_3 INTEGER NOT NULL DEFAULT 0,
    meninas_4 INTEGER NOT NULL DEFAULT 0,
    meninas_5 INTEGER NOT NULL DEFAULT 0,
    meninas_6 INTEGER NOT NULL DEFAULT 0,
    meninos_1 INTEGER NOT NULL DEFAULT 0,
    meninos_2 INTEGER NOT NULL DEFAULT 0,
    meninos_3 INTEGER NOT NULL DEFAULT 0,
    meninos_4 INTEGER NOT NULL DEFAULT 0,
    meninos_5 INTEGER NOT NULL DEFAULT 0,
    meninos_6 INTEGER NOT NULL DEFAULT 0,
    recitativos_individuais INTEGER NOT NULL DEFAULT 0,
    testemunhos INTEGER NOT NULL DEFAULT 0,
    visitas TEXT NOT NULL DEFAULT '',
    auxiliares_presentes TEXT NOT NULL DEFAULT '',
    auxiliares_masculinos INTEGER NOT NULL DEFAULT 0,
    auxiliares_femininos INTEGER NOT NULL DEFAULT 0,
    oracao_pai_nosso TEXT,
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
        _garantir_colunas_recitativos(conn)
        _garantir_colunas_localizacao(conn)
        _garantir_colunas_formulario_atual(conn)
        conn.commit()
    finally:
        conn.close()


def _garantir_colunas_recitativos(conn):
    """Atualiza bancos antigos sem apagar registros já digitados."""
    existentes = {row["name"] for row in conn.execute("PRAGMA table_info(registros)").fetchall()}
    for coluna in COLUNAS_RECITATIVOS:
        if coluna not in existentes:
            conn.execute(f"ALTER TABLE registros ADD COLUMN {coluna} INTEGER NOT NULL DEFAULT 0")


def _garantir_colunas_localizacao(conn):
    """Bancos criados antes do campo Estado/Cidade existir também ganham as
    colunas sem perder nada do que já foi digitado (mesma lógica de
    _garantir_colunas_recitativos, só que pra colunas de texto)."""
    existentes = {row["name"] for row in conn.execute("PRAGMA table_info(registros)").fetchall()}
    for coluna in ("estado", "cidade"):
        if coluna not in existentes:
            conn.execute(f"ALTER TABLE registros ADD COLUMN {coluna} TEXT")


def _garantir_colunas_formulario_atual(conn):
    """Bancos criados antes do formulário atual (folha solta, a partir de
    out/2024) ganhar os campos Auxiliares Presentes/Oração Pai
    Nosso/Testemunhos também ganham as colunas, sem apagar nada."""
    existentes = {row["name"] for row in conn.execute("PRAGMA table_info(registros)").fetchall()}
    if "auxiliares_presentes" not in existentes:
        conn.execute("ALTER TABLE registros ADD COLUMN auxiliares_presentes TEXT NOT NULL DEFAULT ''")
    if "auxiliares_masculinos" not in existentes:
        conn.execute("ALTER TABLE registros ADD COLUMN auxiliares_masculinos INTEGER NOT NULL DEFAULT 0")
    if "auxiliares_femininos" not in existentes:
        conn.execute("ALTER TABLE registros ADD COLUMN auxiliares_femininos INTEGER NOT NULL DEFAULT 0")
    if "oracao_pai_nosso" not in existentes:
        conn.execute("ALTER TABLE registros ADD COLUMN oracao_pai_nosso TEXT NOT NULL DEFAULT ''")
    if "testemunhos" not in existentes:
        conn.execute("ALTER TABLE registros ADD COLUMN testemunhos INTEGER NOT NULL DEFAULT 0")


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
