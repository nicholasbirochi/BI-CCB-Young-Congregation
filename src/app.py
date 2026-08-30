# -*- coding: utf-8 -*-
"""
BI - Reunião de Jovens e Menores (Congregação Cristã no Brasil)

Aplicativo local: roda no computador da igreja e fica disponível para
qualquer aparelho conectado na mesma rede Wi-Fi/local através de um link.

Como usar: dê dois cliques em "Iniciar.bat" (Windows) ou "Iniciar.command"
(Mac). Não precisa de internet depois da primeira configuração.

Este arquivo é só o "ponto de composição" do app: cria o Flask, registra
os Blueprints de cada área (controllers/) e sobe o servidor. As rotas e
regras de negócio de verdade moram em controllers/, services/ e models/
— veja o README para o mapa completo da estrutura MVC.
"""
import threading
from datetime import timedelta

from flask import Flask

import config
from models import database as db
from utils.formatacao import data_br
from utils.rede import abrir_navegador, get_lan_ip
from utils.seguranca import obter_secret_key

app = Flask(__name__)
app.permanent_session_lifetime = timedelta(days=90)
app.secret_key = obter_secret_key(db.BASE_DIR)
app.teardown_appcontext(db.close_db)
app.template_filter("data_br")(data_br)

# Controllers (Blueprints) — importados depois que `app` já existe acima,
# porque cada um usa @bp.route (não @app.route direto) e é registrado aqui.
from controllers.auth import bp as auth_bp  # noqa: E402
from controllers.dashboard import bp as dashboard_bp  # noqa: E402
from controllers.localidade_api import bp as localidade_api_bp  # noqa: E402
from controllers.menu import bp as menu_bp  # noqa: E402
from controllers.registros import bp as registros_bp  # noqa: E402

app.register_blueprint(auth_bp)
app.register_blueprint(menu_bp)
app.register_blueprint(localidade_api_bp)
app.register_blueprint(registros_bp)
app.register_blueprint(dashboard_bp)


if __name__ == "__main__":
    db.init_db()
    ip = get_lan_ip()
    print("")
    print("=" * 60)
    print("  BI - Reunião de Jovens e Menores (CCB)")
    print("=" * 60)
    print(f"  Neste computador .... http://127.0.0.1:{config.PORT}")
    print(f"  Na rede local ........ http://{ip}:{config.PORT}")
    print("")
    print("  Compartilhe o link 'Na rede local' com quem estiver")
    print("  conectado no mesmo Wi-Fi para acessar por celular/tablet.")
    print("  Para encerrar, feche esta janela ou pressione CTRL+C.")
    print("=" * 60)
    print("")
    threading.Timer(1.2, abrir_navegador, args=[config.PORT]).start()
    app.run(host="0.0.0.0", port=config.PORT, debug=False, threaded=True)
