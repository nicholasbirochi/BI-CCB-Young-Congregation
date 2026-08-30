# -*- coding: utf-8 -*-
"""Chave de sessão: gerada uma vez por instalação e reaproveitada dali em
diante, pra assinar os cookies de login sem depender de nenhum segredo
digitado à mão."""
import os
import secrets


def obter_secret_key(base_dir):
    """Gera (uma vez) e reaproveita uma chave própria deste computador,
    para assinar os cookies de sessão do login."""
    caminho = os.path.join(base_dir, "dados", ".chave_sessao")
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    if os.path.exists(caminho):
        with open(caminho, "r") as f:
            chave = f.read().strip()
            if chave:
                return chave
    chave = secrets.token_hex(32)
    with open(caminho, "w") as f:
        f.write(chave)
    return chave
