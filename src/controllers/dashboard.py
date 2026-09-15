# -*- coding: utf-8 -*-
"""Painel de Análises (BI): KPIs e os dados dos gráficos, com filtro por
período, localidade e presidência."""
from datetime import date, timedelta

from flask import Blueprint, render_template, request

from controllers.auth import login_obrigatorio, somente_cooperador
from models.database import (
    COLUNAS_GRAFICO_MENINAS,
    COLUNAS_GRAFICO_MENINOS,
    RECITATIVOS_LABELS_MENINAS,
    RECITATIVOS_LABELS_MENINOS,
    get_db,
    lista_visitas,
    total_geral,
    total_meninas,
    total_meninos,
)
from services.localidades_ccb import LOCALIDADES_CCB
from services.sugestoes import (
    localidades_conhecidas,
    nomes_conhecidos,
    presidencias_conhecidas,
    visitas_conhecidas,
)
from utils.formatacao import data_br, data_curta

bp = Blueprint("dashboard", __name__)


def _periodo_do_filtro():
    """Lê o filtro de período da querystring e devolve (inicio, fim, rotulo, chave)."""
    hoje = date.today()
    chave = request.args.get("periodo", "ano")
    inicio_custom = request.args.get("inicio", "")
    fim_custom = request.args.get("fim", "")

    if chave == "personalizado" and inicio_custom and fim_custom:
        # O <input type="date" max="..."> já trava isso no navegador, mas
        # alguém digitando a data direto na URL passaria por cima — trava de
        # novo aqui: não deixa filtrar período que ainda nem chegou.
        inicio_custom = min(inicio_custom, hoje.isoformat())
        fim_custom = min(fim_custom, hoje.isoformat())
        # Nem período "de trás pra frente" (fim antes do início) — se vier
        # assim, inverte em vez de dar erro.
        if fim_custom < inicio_custom:
            inicio_custom, fim_custom = fim_custom, inicio_custom
        return inicio_custom, fim_custom, "Personalizado", chave
    if chave == "tudo":
        return "0000-01-01", "9999-12-31", "Todo o histórico", chave
    if chave == "ano":
        inicio = date(hoje.year, 1, 1)
        return inicio.isoformat(), hoje.isoformat(), "Este ano", chave
    try:
        dias = int(chave)
    except ValueError:
        inicio = date(hoje.year, 1, 1)
        return inicio.isoformat(), hoje.isoformat(), "Este ano", "ano"
    inicio = hoje - timedelta(days=dias)
    rotulo = f"Últimos {dias} dias"
    return inicio.isoformat(), hoje.isoformat(), rotulo, chave


@bp.route("/dashboard")
@login_obrigatorio
@somente_cooperador
def dashboard():
    conn = get_db()
    inicio, fim, rotulo_periodo, chave_periodo = _periodo_do_filtro()
    localidade = request.args.get("localidade", "").strip()
    presidencia_filtro = request.args.get("presidencia", "").strip()

    linhas = conn.execute(
        """SELECT * FROM registros
           WHERE data BETWEEN ? AND ? AND (? = '' OR local = ?) AND (? = '' OR presidencia = ?)
           ORDER BY data ASC, id ASC""",
        (inicio, fim, localidade, localidade, presidencia_filtro, presidencia_filtro),
    ).fetchall()

    # ---- KPIs -------------------------------------------------------
    qtd_reunioes = len(linhas)
    soma_geral = sum(total_geral(r) for r in linhas)
    soma_individuais = sum(r["recitativos_individuais"] or 0 for r in linhas)
    soma_visitas = sum(len(lista_visitas(r["visitas"])) for r in linhas)
    media_geral = round(soma_geral / qtd_reunioes) if qtd_reunioes else 0

    # ---- Série temporal: total geral de recitativos por data --------
    por_data = {}
    for r in linhas:
        por_data.setdefault(r["data"], {"meninas": 0, "meninos": 0})
        por_data[r["data"]]["meninas"] += total_meninas(r)
        por_data[r["data"]]["meninos"] += total_meninos(r)
    datas_ordenadas = sorted(por_data.keys())
    serie_labels = [data_curta(d) for d in datas_ordenadas]
    # Rótulo do eixo é só dd/mm (pra não ocupar espaço à toa), mas o
    # tooltip do gráfico mostra a data completa — sem isso, pontos de anos
    # diferentes com o mesmo dd/mm ficam ambíguos ao passar o mouse.
    serie_datas_completas = [data_br(d) for d in datas_ordenadas]
    serie_total = [por_data[d]["meninas"] + por_data[d]["meninos"] for d in datas_ordenadas]

    # ---- Irmãs x Irmãos por posição do recitativo --------------------
    # Usa as 4 posições do formulário ATUAL (crianças, meninas/meninos,
    # mocinhas/mocinhos, moças/moços) — Continuação e Particular (posições
    # 5 e 6) só existiam no formulário antigo e ficam de fora deste gráfico
    # específico para não misturar os dois modelos. Depois soma uma 5ª
    # posição "Auxiliares", que vem de colunas próprias (auxiliares_femininos/
    # auxiliares_masculinos) em vez de meninas_5/meninos_5 — apesar de contar
    # no Total de cada coluna (total_meninas/total_meninos), Auxiliares tem
    # campo próprio no formulário, não é uma posição do quadro de recitativos.
    soma_meninas_pos = [0] * len(COLUNAS_GRAFICO_MENINAS)
    soma_meninos_pos = [0] * len(COLUNAS_GRAFICO_MENINOS)
    for r in linhas:
        for i, c in enumerate(COLUNAS_GRAFICO_MENINAS):
            soma_meninas_pos[i] += r[c] or 0
        for i, c in enumerate(COLUNAS_GRAFICO_MENINOS):
            soma_meninos_pos[i] += r[c] or 0
    soma_meninas_pos.append(sum(r["auxiliares_femininos"] or 0 for r in linhas))
    soma_meninos_pos.append(sum(r["auxiliares_masculinos"] or 0 for r in linhas))
    labels_meninas = RECITATIVOS_LABELS_MENINAS + ["Auxiliares"]
    labels_meninos = RECITATIVOS_LABELS_MENINOS + ["Auxiliares"]

    # ---- Individuais x Visitas ao longo do tempo ---------------------
    por_data_extra = {}
    for r in linhas:
        por_data_extra.setdefault(r["data"], {"individuais": 0, "visitas": 0})
        por_data_extra[r["data"]]["individuais"] += r["recitativos_individuais"] or 0
        por_data_extra[r["data"]]["visitas"] += len(lista_visitas(r["visitas"]))
    serie_individuais = [por_data_extra[d]["individuais"] for d in datas_ordenadas]
    serie_visitas = [por_data_extra[d]["visitas"] for d in datas_ordenadas]

    # ---- Igrejas que mais visitaram ------------------------------------
    contagem_visitas = {}
    for r in linhas:
        for nome in lista_visitas(r["visitas"]):
            contagem_visitas[nome] = contagem_visitas.get(nome, 0) + 1
    ranking_visitas = sorted(contagem_visitas.items(), key=lambda x: x[1], reverse=True)[:8]

    # ---- Últimos registros do período ---------------------------------
    ultimos = []
    for r in list(linhas)[-8:][::-1]:
        ultimos.append({
            "id": r["id"],
            "data": r["data"],
            "presidencia": r["presidencia"],
            "total_geral": total_geral(r),
            "individuais": r["recitativos_individuais"],
            "visitas": ", ".join(lista_visitas(r["visitas"])),
            "livro": r["livro"],
        })

    dashboard_data = {
        "tendencia": {"labels": serie_labels, "datasCompletas": serie_datas_completas, "valores": serie_total},
        "categorias": {
            "series": [
                {"nome": "Irmãs", "valores": soma_meninas_pos, "labels": labels_meninas},
                {"nome": "Irmãos", "valores": soma_meninos_pos, "labels": labels_meninos},
            ],
        },
        "individuais_visitas": {
            "labels": serie_labels,
            "datasCompletas": serie_datas_completas,
            "series": [
                {"nome": "Recitativos individuais", "valores": serie_individuais},
                {"nome": "Visitas", "valores": serie_visitas},
            ],
        },
        "visitas_recorrentes": {
            "labels": [item[0] for item in ranking_visitas],
            "valores": [item[1] for item in ranking_visitas],
        },
    }

    return render_template(
        "dashboard.html",
        kpis={
            "qtd_reunioes": qtd_reunioes,
            "soma_geral": soma_geral,
            "media_geral": media_geral,
            "soma_individuais": soma_individuais,
            "soma_visitas": soma_visitas,
        },
        dashboard_data=dashboard_data,
        ultimos=ultimos,
        rotulo_periodo=rotulo_periodo,
        chave_periodo=chave_periodo,
        # Pré-preenche os campos de data com o período em uso — só fica em
        # branco no "Tudo", já que 0000-01-01/9999-12-31 não é uma data real.
        inicio=inicio if chave_periodo != "tudo" else "",
        fim=fim if chave_periodo != "tudo" else "",
        # Trava o calendário: não deixa escolher período que ainda não
        # chegou (veja o <input max="..."> e o form.js do filtro).
        hoje=date.today().isoformat(),
        localidades=localidades_conhecidas(conn),
        estados_ccb=list(LOCALIDADES_CCB.keys()), localidades_ccb=LOCALIDADES_CCB,
        visitas_conhecidas=visitas_conhecidas(conn), nomes_conhecidos=nomes_conhecidos(conn),
        localidade_selecionada=localidade,
        presidencias=presidencias_conhecidas(conn),
        presidencia_selecionada=presidencia_filtro,
    )
