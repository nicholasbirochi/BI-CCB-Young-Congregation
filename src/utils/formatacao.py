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


def numero_br(valor):
    """Formata um inteiro com ponto de milhar, do jeito brasileiro (12345 -> "12.345")."""
    try:
        return f"{int(valor):,}".replace(",", ".")
    except (TypeError, ValueError):
        return valor


def decimal_br(valor):
    """Formata um decimal com vírgula, do jeito brasileiro (96.5 -> "96,5")."""
    try:
        inteiro, frac = f"{float(valor):,.1f}".split(".")
        return f"{inteiro.replace(',', '.')},{frac}"
    except (TypeError, ValueError):
        return valor
