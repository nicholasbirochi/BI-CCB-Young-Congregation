# -*- coding: utf-8 -*-
"""
Listas de sugestão derivadas do que já foi digitado antes — cada uma
alimenta um campo com autocomplete/datalist, reduzindo erro de digitação
sem precisar de nenhum cadastro manual de "quem pode aparecer aqui".
"""
from models.database import lista_visitas


def localidades_conhecidas(conn):
    """Localidades já usadas em algum registro — alimenta o campo Local."""
    linhas = conn.execute(
        "SELECT DISTINCT local FROM registros WHERE local IS NOT NULL AND TRIM(local) != '' ORDER BY local"
    ).fetchall()
    return [r["local"] for r in linhas]


def visitas_conhecidas(conn):
    """Nomes de igrejas/congregações já registrados como visitantes alguma
    vez — alimenta as opções (datalist) do campo Visitas."""
    linhas = conn.execute(
        "SELECT visitas FROM registros WHERE visitas IS NOT NULL AND TRIM(visitas) != ''"
    ).fetchall()
    nomes = set()
    for r in linhas:
        nomes.update(lista_visitas(r["visitas"]))
    return sorted(nomes)


def nomes_conhecidos(conn):
    """Nomes de irmãos já usados em Presidência ou Presidido por — não existe
    uma lista pública dos irmãos no ministério (isso fica atrás da Área
    Restrita do site da CCB, que exige login administrativo), então a
    sugestão aprende sozinha com o que já foi digitado certo antes, pra
    reduzir erro de digitação nas próximas vezes."""
    linhas = conn.execute("SELECT presidencia, presidido_por FROM registros").fetchall()
    nomes = set()
    for r in linhas:
        if r["presidencia"] and r["presidencia"].strip():
            nomes.add(r["presidencia"].strip())
        if r["presidido_por"] and r["presidido_por"].strip():
            nomes.add(r["presidido_por"].strip())
    return sorted(nomes)


def presidencias_conhecidas(conn):
    """Nomes já usados no campo Presidência (do culto) — alimenta o filtro
    "Todos os irmãos na presidência" do Análises. Não mistura com Presidido
    por (esse é quem preside a leitura da Palavra, um papel diferente)."""
    linhas = conn.execute(
        "SELECT DISTINCT presidencia FROM registros WHERE presidencia IS NOT NULL AND TRIM(presidencia) != '' ORDER BY presidencia"
    ).fetchall()
    return [r["presidencia"] for r in linhas]
