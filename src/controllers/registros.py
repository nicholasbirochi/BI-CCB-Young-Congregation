# -*- coding: utf-8 -*-
"""Formulário (novo registro / edição / exclusão) e o Histórico."""
from datetime import date

from flask import Blueprint, flash, redirect, render_template, request, url_for

import config
from controllers.auth import login_obrigatorio, somente_cooperador
from models import biblia
from models.database import (
    get_db,
    lista_visitas,
    texto_visitas,
    total_geral,
    total_meninas,
    total_meninos,
)
from models.paises import PAISES_POR_CONTINENTE
from services.localidades_ccb import LOCALIDADES_CCB
from services.sugestoes import (
    auxiliares_conhecidos,
    localidades_conhecidas,
    nomes_conhecidos,
    visitas_conhecidas,
)

bp = Blueprint("registros", __name__)

# Colunas que só existem no caderno antigo (2022/2023): mocinhas/mocinhos,
# continuação e particular. O formulário atual (folha solta, a partir de
# out/2024) só tem crianças/meninas(os)/moças(os) — essas 6 ficam escondidas
# por padrão e só aparecem abertas ao editar um registro antigo que já tem
# algum valor nelas (pra não esconder dado real nem parecer que sumiu).
CAMPOS_RECITATIVOS_ANTIGOS = ["meninas_3", "meninas_5", "meninas_6", "meninos_3", "meninos_5", "meninos_6"]


def _tem_campos_antigos(registro):
    return any(int(registro[c] or 0) for c in CAMPOS_RECITATIVOS_ANTIGOS)


def _campo_int(nome):
    valor = request.form.get(nome, "").strip()
    if valor == "":
        return 0
    try:
        return max(0, int(valor))
    except ValueError:
        return 0


def _dados_do_formulario():
    return {
        "data": request.form.get("data", "").strip(),
        "presidencia": request.form.get("presidencia", "").strip(),
        "pais": request.form.get("pais", "").strip() or config.PAIS_PADRAO,
        "local": request.form.get("local", "").strip(),
        "estado": request.form.get("estado", "").strip(),
        "cidade": request.form.get("cidade", "").strip(),
        "meninas_1": _campo_int("meninas_1"),
        "meninas_2": _campo_int("meninas_2"),
        "meninas_3": _campo_int("meninas_3"),
        "meninas_4": _campo_int("meninas_4"),
        "meninas_5": _campo_int("meninas_5"),
        "meninas_6": _campo_int("meninas_6"),
        "meninos_1": _campo_int("meninos_1"),
        "meninos_2": _campo_int("meninos_2"),
        "meninos_3": _campo_int("meninos_3"),
        "meninos_4": _campo_int("meninos_4"),
        "meninos_5": _campo_int("meninos_5"),
        "meninos_6": _campo_int("meninos_6"),
        "recitativos_individuais": _campo_int("recitativos_individuais"),
        "testemunhos": _campo_int("testemunhos"),
        "visitas": texto_visitas(request.form.get("visitas", "").split(";")),
        "auxiliares_presentes": texto_visitas(request.form.get("auxiliares_presentes", "").split(";")),
        "oracao_pai_nosso": request.form.get("oracao_pai_nosso", "").strip(),
        "livro": request.form.get("livro", "").strip(),
        "capitulo": request.form.get("capitulo", "").strip(),
        "versiculo": request.form.get("versiculo", "").strip(),
        "presidido_por": request.form.get("presidido_por", "").strip(),
    }


def _contexto_formulario(conn, **extra):
    """Dados que toda renderização do formulário precisa (localidades, listas
    de sugestão, estrutura da Bíblia) — pra não repetir em três rotas."""
    # Visitas também é alimentado pela base de localidades (as mesmas
    # congregações já usadas no campo Local podem muito bem aparecer como
    # visitantes um dia) — não só pelo próprio histórico de visitas.
    localidades = localidades_conhecidas(conn)
    contexto = {
        "livros": biblia.LIVROS_DA_BIBLIA,
        "biblia_estrutura": biblia.BIBLIA_ESTRUTURA,
        "localidades": localidades,
        "estados_ccb": list(LOCALIDADES_CCB.keys()),
        "localidades_ccb": LOCALIDADES_CCB,
        "visitas_conhecidas": sorted(set(visitas_conhecidas(conn)) | set(localidades)),
        "nomes_conhecidos": nomes_conhecidos(conn),
        "auxiliares_conhecidos": auxiliares_conhecidos(conn),
        "paises_por_continente": PAISES_POR_CONTINENTE,
        # Passados sempre (não só em registro novo): é o que permite o
        # Estado/Cidade se autopreencherem mesmo quando o Local digitado é
        # um bairro (ex.: "Batistini") que não existe como cidade na base
        # oficial da CCB — nesse caso o JS cai pro padrão desta congregação
        # em vez de deixar os campos em branco.
        "local_padrao": config.LOCAL_PADRAO,
        "estado_padrao": config.ESTADO_PADRAO,
        "cidade_padrao": config.CIDADE_PADRAO,
    }
    contexto.update(extra)
    return contexto


@bp.route("/novo", methods=["GET", "POST"])
@login_obrigatorio
def novo_registro():
    conn = get_db()
    if request.method == "POST":
        dados = _dados_do_formulario()
        erro = None
        if not dados["data"]:
            erro = "Informe a data da reunião antes de salvar."
        else:
            ok, erro_biblia = biblia.valida_referencia_biblica(dados["livro"], dados["capitulo"], dados["versiculo"])
            if not ok:
                erro = erro_biblia
        if erro:
            flash(erro, "erro")
            return render_template(
                "formulario.html",
                **_contexto_formulario(conn, registro=dados, modo="novo", tem_campos_antigos=_tem_campos_antigos(dados)),
            )
        colunas = ", ".join(dados.keys())
        marcadores = ", ".join(["?"] * len(dados))
        conn.execute(
            f"INSERT INTO registros ({colunas}) VALUES ({marcadores})",
            list(dados.values()),
        )
        conn.commit()
        flash("Registro salvo com sucesso!", "sucesso")
        return redirect(url_for("registros.novo_registro"))

    vazio = {
        "data": date.today().isoformat(),
        "presidencia": "", "pais": config.PAIS_PADRAO, "local": config.LOCAL_PADRAO,
        "estado": config.ESTADO_PADRAO, "cidade": config.CIDADE_PADRAO,
        "meninas_1": "", "meninas_2": "", "meninas_3": "", "meninas_4": "", "meninas_5": "", "meninas_6": "",
        "meninos_1": "", "meninos_2": "", "meninos_3": "", "meninos_4": "", "meninos_5": "", "meninos_6": "",
        "recitativos_individuais": "", "testemunhos": "", "visitas": "",
        "auxiliares_presentes": "", "oracao_pai_nosso": "",
        "livro": "", "capitulo": "", "versiculo": "", "presidido_por": "",
    }
    return render_template(
        "formulario.html",
        **_contexto_formulario(conn, registro=vazio, modo="novo", tem_campos_antigos=False),
    )


@bp.route("/registros/<int:registro_id>/editar", methods=["GET", "POST"])
@login_obrigatorio
def editar_registro(registro_id):
    conn = get_db()
    if request.method == "POST":
        dados = _dados_do_formulario()
        erro = None
        if not dados["data"]:
            erro = "Informe a data da reunião antes de salvar."
        else:
            ok, erro_biblia = biblia.valida_referencia_biblica(dados["livro"], dados["capitulo"], dados["versiculo"])
            if not ok:
                erro = erro_biblia
        if erro:
            flash(erro, "erro")
            return render_template(
                "formulario.html",
                **_contexto_formulario(
                    conn, registro=dados, modo="editar", registro_id=registro_id,
                    tem_campos_antigos=_tem_campos_antigos(dados),
                ),
            )
        campos = ", ".join(f"{c} = ?" for c in dados.keys())
        conn.execute(
            f"UPDATE registros SET {campos}, atualizado_em = datetime('now','localtime') WHERE id = ?",
            list(dados.values()) + [registro_id],
        )
        conn.commit()
        flash("Registro atualizado com sucesso!", "sucesso")
        return redirect(url_for("registros.registros"))

    registro = conn.execute("SELECT * FROM registros WHERE id = ?", (registro_id,)).fetchone()
    if registro is None:
        flash("Registro não encontrado.", "erro")
        return redirect(url_for("registros.registros"))
    return render_template(
        "formulario.html",
        **_contexto_formulario(
            conn, registro=registro, modo="editar", registro_id=registro_id,
            tem_campos_antigos=_tem_campos_antigos(registro),
        ),
    )


@bp.route("/registros/<int:registro_id>/excluir", methods=["POST"])
@login_obrigatorio
@somente_cooperador
def excluir_registro(registro_id):
    conn = get_db()
    conn.execute("DELETE FROM registros WHERE id = ?", (registro_id,))
    conn.commit()
    flash("Registro excluído.", "sucesso")
    return redirect(url_for("registros.registros"))


@bp.route("/registros")
@login_obrigatorio
def registros():
    conn = get_db()
    busca = request.args.get("busca", "").strip()
    query = "SELECT * FROM registros"
    params = []
    if busca:
        query += """ WHERE data LIKE ? OR presidencia LIKE ? OR livro LIKE ?
                      OR presidido_por LIKE ? OR local LIKE ?"""
        curinga = f"%{busca}%"
        params = [curinga] * 5
    query += " ORDER BY data DESC, id DESC"
    linhas = conn.execute(query, params).fetchall()

    registros_view = []
    for r in linhas:
        registros_view.append({
            "id": r["id"],
            "data": r["data"],
            "presidencia": r["presidencia"],
            "local": r["local"],
            "total_meninas": total_meninas(r),
            "total_meninos": total_meninos(r),
            "total_geral": total_geral(r),
            "recitativos_individuais": r["recitativos_individuais"],
            "testemunhos": r["testemunhos"],
            "visitas": lista_visitas(r["visitas"]),
            "livro": r["livro"],
            "capitulo": r["capitulo"],
            "versiculo": r["versiculo"],
        })

    return render_template("registros.html", registros=registros_view, busca=busca)
