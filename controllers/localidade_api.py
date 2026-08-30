# -*- coding: utf-8 -*-
"""Busca ao vivo de unidades da CCB pelo nome, usada pelo campo Local do
formulário (veja services/localidades_ccb.py pela integração de verdade)."""
from flask import Blueprint, request

from controllers.auth import login_obrigatorio
from services.localidades_ccb import buscar_localidades_ccb

bp = Blueprint("localidade_api", __name__)


@bp.route("/api/localidade-busca")
@login_obrigatorio
def api_localidade_busca():
    """Busca ao vivo, no diretório oficial da CCB, por unidades pelo nome.
    Só é chamada quando alguém digita na busca do formulário; sem internet
    simplesmente devolve uma lista vazia (o campo Local continua editável)."""
    termo = request.args.get("q", "").strip()
    if len(termo) < 3:
        return {"resultados": []}
    try:
        resultados = buscar_localidades_ccb(termo)
    except Exception:
        resultados = []
    return {"resultados": resultados[:8]}
