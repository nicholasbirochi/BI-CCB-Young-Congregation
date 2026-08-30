# -*- coding: utf-8 -*-
"""
Integração com o diretório oficial de unidades da CCB
(congregacaocristanobrasil.org.br/relatorio).

Duas fontes de dados, cada uma com uma responsabilidade:
  - LOCALIDADES_CCB: estados/cidades, baixados uma única vez e salvos em
    static/dados/localidades_ccb.json — alimenta o Estado/Cidade do
    formulário mesmo sem internet no dia a dia.
  - buscar_localidades_ccb(termo): busca AO VIVO por unidade específica
    pelo nome — só roda quando alguém pesquisa de verdade no formulário,
    nunca em massa, e falha em silêncio sem internet (o campo Local
    continua editável na mão).
"""
import html as html_utils
import json
import os
import re

import requests

from models.database import BASE_DIR

CCB_URL_BASE = "https://congregacaocristanobrasil.org.br"

_PADRAO_LOCALIDADE = re.compile(
    r'data-id="\d+">\s*'
    r'<div[^>]*><strong class="nome-localidade">([^<]*)</strong></div>\s*'
    r'<small[^>]*>([^<]*)</small>\s*'
    r'<div[^>]*>([^<]*)</div>\s*'
    r'<div[^>]*>([^<]*)</div>',
    re.IGNORECASE,
)

_ccb_sessao = {"cookies": None, "token": None}


def _carregar_localidades_ccb():
    """
    Estados e cidades onde a CCB tem unidades, direto do diretório oficial
    (congregacaocristanobrasil.org.br/relatorio) — baixado uma vez e salvo
    localmente, pra o campo "Local" funcionar mesmo sem internet no dia a dia.
    """
    caminho = os.path.join(BASE_DIR, "static", "dados", "localidades_ccb.json")
    try:
        with open(caminho, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


LOCALIDADES_CCB = _carregar_localidades_ccb()


def _sessao_ccb(renovar=False):
    if renovar or not _ccb_sessao["token"]:
        resp = requests.get(f"{CCB_URL_BASE}/relatorio", timeout=6, headers={"User-Agent": "Mozilla/5.0"})
        m = re.search(r'name="__RequestVerificationToken"[^>]*value="([^"]*)"', resp.text)
        _ccb_sessao["token"] = m.group(1) if m else None
        _ccb_sessao["cookies"] = resp.cookies
    return _ccb_sessao["cookies"], _ccb_sessao["token"]


def buscar_localidades_ccb(termo):
    """Pesquisa unidades da CCB pelo nome, direto no site oficial (ao vivo)."""
    for tentativa in (False, True):
        cookies, token = _sessao_ccb(renovar=tentativa)
        if not token:
            continue
        try:
            resp = requests.post(
                f"{CCB_URL_BASE}/service/localidade-relatorio",
                data={"search": termo, "pagina": 1},
                cookies=cookies,
                headers={"AntiForgeryToken": token, "User-Agent": "Mozilla/5.0"},
                timeout=6,
            )
            if resp.status_code != 200:
                continue
            achados = []
            for nome, codigo, cidade, endereco in _PADRAO_LOCALIDADE.findall(resp.text):
                achados.append({
                    "nome": html_utils.unescape(nome.strip()),
                    "codigo": html_utils.unescape(codigo.strip()),
                    "cidade": html_utils.unescape(cidade.strip()),
                    "endereco": html_utils.unescape(endereco.strip()),
                })
            return achados
        except requests.RequestException:
            continue
    return []
