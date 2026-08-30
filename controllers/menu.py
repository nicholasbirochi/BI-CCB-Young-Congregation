# -*- coding: utf-8 -*-
"""Tela de menu e o QR code do link de acesso pela rede local."""
import io

from flask import Blueprint, Response, render_template

import config
from controllers.auth import login_obrigatorio
from models.database import get_db
from utils.rede import get_lan_ip

bp = Blueprint("menu", __name__)


@bp.route("/")
@login_obrigatorio
def menu():
    conn = get_db()
    total_registros = conn.execute("SELECT COUNT(*) AS n FROM registros").fetchone()["n"]
    ultimo = conn.execute(
        "SELECT data FROM registros ORDER BY data DESC, id DESC LIMIT 1"
    ).fetchone()
    ip = get_lan_ip()
    link_rede = f"http://{ip}:{config.PORT}"
    return render_template(
        "menu.html",
        total_registros=total_registros,
        ultima_reuniao=ultimo["data"] if ultimo else None,
        link_rede=link_rede,
    )


@bp.route("/qrcode.svg")
@login_obrigatorio
def qrcode_svg():
    """Gera um QR code (SVG) com o link de acesso na rede, sem precisar de internet."""
    import qrcode
    import qrcode.image.svg

    ip = get_lan_ip()
    link = f"http://{ip}:{config.PORT}"
    factory = qrcode.image.svg.SvgPathImage
    img = qrcode.make(link, image_factory=factory, box_size=10, border=2)
    buf = io.BytesIO()
    img.save(buf)
    return Response(buf.getvalue(), mimetype="image/svg+xml")
