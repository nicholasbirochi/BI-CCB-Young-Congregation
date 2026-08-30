# -*- coding: utf-8 -*-
"""Login (duas senhas compartilhadas: Cooperador de Jovens / Irmãos da
Contagem) e os dois decorators de controle de acesso usados pelos outros
controllers."""
from functools import wraps

from flask import Blueprint, flash, redirect, render_template, request, session, url_for

import config
import config_acesso

bp = Blueprint("auth", __name__)


def login_obrigatorio(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not session.get("papel"):
            return redirect(url_for("auth.login", proximo=request.path))
        return view(*args, **kwargs)
    return wrapper


def somente_cooperador(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if session.get("papel") != "cooperador":
            flash("Essa página é exclusiva do Cooperador de Jovens.", "erro")
            return redirect(url_for("menu.menu"))
        return view(*args, **kwargs)
    return wrapper


@bp.route("/login", methods=["GET", "POST"])
def login():
    if session.get("papel"):
        return redirect(url_for("menu.menu"))

    proximo = request.values.get("proximo") or url_for("menu.menu")
    if not proximo.startswith("/") or proximo.startswith("//"):
        proximo = url_for("menu.menu")  # nunca redireciona para fora deste site
    if request.method == "POST":
        papel = request.form.get("papel", "")
        senha = request.form.get("senha", "")
        senha_correta = {
            "cooperador": config_acesso.SENHA_COOPERADOR,
            "contagem": config_acesso.SENHA_CONTAGEM,
        }.get(papel)
        if senha_correta is not None and senha and senha == senha_correta:
            session.clear()
            session["papel"] = papel
            session.permanent = True
            return redirect(proximo or url_for("menu.menu"))
        flash("Senha incorreta. Confira com a liderança e tente novamente.", "erro")

    return render_template("login.html", proximo=proximo, papeis=config.PAPEIS)


@bp.route("/sair")
def sair():
    session.clear()
    return redirect(url_for("auth.login"))
