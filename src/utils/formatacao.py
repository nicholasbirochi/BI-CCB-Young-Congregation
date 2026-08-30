# -*- coding: utf-8 -*-
"""Formatação de datas para exibição — texto puro, sem depender do Flask
(o filtro de template é registrado em app.py, que é quem conhece o Flask)."""
from datetime import datetime


def data_curta(iso):
    """dd/mm — usada nos rótulos dos gráficos, onde o ano só ocuparia espaço."""
    try:
        d = datetime.strptime(iso, "%Y-%m-%d")
        return d.strftime("%d/%m")
    except ValueError:
        return iso


def data_br(iso):
    """Formata uma data ISO (aaaa-mm-dd) como dd/mm/aaaa, do jeito brasileiro."""
    try:
        return datetime.strptime(iso, "%Y-%m-%d").strftime("%d/%m/%Y")
    except (TypeError, ValueError):
        return iso or ""
