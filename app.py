# -*- coding: utf-8 -*-
"""
BI - Reunião de Jovens e Menores (Congregação Cristã no Brasil)

Aplicativo local: roda no computador da igreja e fica disponível para
qualquer aparelho conectado na mesma rede Wi-Fi/local através de um link.

Como usar: dê dois cliques em "Iniciar.bat" (Windows) ou "Iniciar.command"
(Mac). Não precisa de internet depois da primeira configuração.
"""
import html as html_utils
import io
import json
import os
import re
import secrets
import socket
import threading
import webbrowser
from datetime import date, datetime, timedelta
from functools import wraps

import requests
from flask import Flask, flash, g, redirect, render_template, request, session, url_for

import config_acesso
from nucleo import database as db

app = Flask(__name__)
app.permanent_session_lifetime = timedelta(days=90)

PORT = 8000

# Localidade padrão desta congregação — pré-preenche o formulário de um
# registro novo pra não precisar escolher de novo toda semana.
LOCAL_PADRAO = "Batistini"
ESTADO_PADRAO = "São Paulo"
CIDADE_PADRAO = "São Bernardo Do Campo"

PAPEIS = {
    "cooperador": "Cooperador de Jovens",
    "contagem": "Irmãos da Contagem",
}


def _carregar_localidades_ccb():
    """
    Estados e cidades onde a CCB tem unidades, direto do diretório oficial
    (congregacaocristanobrasil.org.br/relatorio) — baixado uma vez e salvo
    localmente, pra o campo "Local" funcionar mesmo sem internet no dia a dia.
    """
    caminho = os.path.join(db.BASE_DIR, "static", "dados", "localidades_ccb.json")
    try:
        with open(caminho, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


LOCALIDADES_CCB = _carregar_localidades_ccb()


# --------------------------------------------------------------------------
# Busca ao vivo de unidades específicas no diretório oficial da CCB
# (só roda quando alguém realmente pesquisa no formulário — nunca em massa —
# e falha em silêncio sem internet, o campo Local continua editável na mão).
# --------------------------------------------------------------------------
CCB_URL_BASE = "https://congregacaocristanobrasil.org.br"
_ccb_sessao = {"cookies": None, "token": None}

_PADRAO_LOCALIDADE = re.compile(
    r'data-id="\d+">\s*'
    r'<div[^>]*><strong class="nome-localidade">([^<]*)</strong></div>\s*'
    r'<small[^>]*>([^<]*)</small>\s*'
    r'<div[^>]*>([^<]*)</div>\s*'
    r'<div[^>]*>([^<]*)</div>',
    re.IGNORECASE,
)


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


def _obter_secret_key():
    """Gera (uma vez) e reaproveita uma chave própria deste computador,
    para assinar os cookies de sessão do login."""
    caminho = os.path.join(db.BASE_DIR, "dados", ".chave_sessao")
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


app.secret_key = _obter_secret_key()


# --------------------------------------------------------------------------
# Login (duas senhas compartilhadas: Cooperador de Jovens / Irmãos da Contagem)
# --------------------------------------------------------------------------
def login_obrigatorio(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not session.get("papel"):
            return redirect(url_for("login", proximo=request.path))
        return view(*args, **kwargs)
    return wrapper


def somente_cooperador(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if session.get("papel") != "cooperador":
            flash("Essa página é exclusiva do Cooperador de Jovens.", "erro")
            return redirect(url_for("menu"))
        return view(*args, **kwargs)
    return wrapper


@app.route("/login", methods=["GET", "POST"])
def login():
    if session.get("papel"):
        return redirect(url_for("menu"))

    proximo = request.values.get("proximo") or url_for("menu")
    if not proximo.startswith("/") or proximo.startswith("//"):
        proximo = url_for("menu")  # nunca redireciona para fora deste site
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
            return redirect(proximo or url_for("menu"))
        flash("Senha incorreta. Confira com a liderança e tente novamente.", "erro")

    return render_template("login.html", proximo=proximo, papeis=PAPEIS)


@app.route("/sair")
def sair():
    session.clear()
    return redirect(url_for("login"))


# --------------------------------------------------------------------------
# Banco de dados
# --------------------------------------------------------------------------
def get_db():
    if "db" not in g:
        g.db = db.get_connection()
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------
def get_lan_ip():
    """Descobre o IP deste computador na rede local (não precisa de internet)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


def campo_int(nome):
    valor = request.form.get(nome, "").strip()
    if valor == "":
        return 0
    try:
        return max(0, int(valor))
    except ValueError:
        return 0


def dados_do_formulario():
    return {
        "data": request.form.get("data", "").strip(),
        "presidencia": request.form.get("presidencia", "").strip(),
        "local": request.form.get("local", "").strip(),
        "meninas_1": campo_int("meninas_1"),
        "meninas_2": campo_int("meninas_2"),
        "meninas_3": campo_int("meninas_3"),
        "meninas_4": campo_int("meninas_4"),
        "meninas_5": campo_int("meninas_5"),
        "meninos_1": campo_int("meninos_1"),
        "meninos_2": campo_int("meninos_2"),
        "meninos_3": campo_int("meninos_3"),
        "meninos_4": campo_int("meninos_4"),
        "meninos_5": campo_int("meninos_5"),
        "recitativos_individuais": campo_int("recitativos_individuais"),
        "visitas": db.texto_visitas(request.form.get("visitas", "").split(db.SEPARADOR_VISITAS)),
        "livro": request.form.get("livro", "").strip(),
        "capitulo": request.form.get("capitulo", "").strip(),
        "versiculo": request.form.get("versiculo", "").strip(),
        "presidido_por": request.form.get("presidido_por", "").strip(),
    }


def localidades_conhecidas(conn):
    """Localidades já usadas em algum registro — alimenta o campo Local."""
    linhas = conn.execute(
        "SELECT DISTINCT local FROM registros WHERE local IS NOT NULL AND TRIM(local) != '' ORDER BY local"
    ).fetchall()
    return [r["local"] for r in linhas]


def visitas_conhecidas(conn):
    """Nomes de igrejas/congregações já registrados como visitantes alguma
    vez — alimenta as opções (datalist) do campo Visitas."""
    linhas = conn.execute(
        "SELECT visitas FROM registros WHERE visitas IS NOT NULL AND TRIM(visitas) != ''"
    ).fetchall()
    nomes = set()
    for r in linhas:
        nomes.update(db.lista_visitas(r["visitas"]))
    return sorted(nomes)


def nomes_conhecidos(conn):
    """Nomes de irmãos já usados em Presidência ou Presidido por — não existe
    uma lista pública dos irmãos no ministério (isso fica atrás da Área
    Restrita do site da CCB, que exige login administrativo), então a
    sugestão aprende sozinha com o que já foi digitado certo antes, pra
    reduzir erro de digitação nas próximas vezes."""
    linhas = conn.execute("SELECT presidencia, presidido_por FROM registros").fetchall()
    nomes = set()
    for r in linhas:
        if r["presidencia"] and r["presidencia"].strip():
            nomes.add(r["presidencia"].strip())
        if r["presidido_por"] and r["presidido_por"].strip():
            nomes.add(r["presidido_por"].strip())
    return sorted(nomes)


def presidencias_conhecidas(conn):
    """Nomes já usados no campo Presidência (do culto) — alimenta o filtro
    "Todos os irmãos na presidência" do Análises. Não mistura com Presidido
    por (esse é quem preside a leitura da Palavra, um papel diferente)."""
    linhas = conn.execute(
        "SELECT DISTINCT presidencia FROM registros WHERE presidencia IS NOT NULL AND TRIM(presidencia) != '' ORDER BY presidencia"
    ).fetchall()
    return [r["presidencia"] for r in linhas]


def periodo_do_filtro():
    """Lê o filtro de período da querystring e devolve (inicio, fim, rotulo, chave)."""
    hoje = date.today()
    chave = request.args.get("periodo", "ano")
    inicio_custom = request.args.get("inicio", "")
    fim_custom = request.args.get("fim", "")

    if chave == "personalizado" and inicio_custom and fim_custom:
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


# --------------------------------------------------------------------------
# Rotas — Menu
# --------------------------------------------------------------------------
@app.route("/")
@login_obrigatorio
def menu():
    conn = get_db()
    total_registros = conn.execute("SELECT COUNT(*) AS n FROM registros").fetchone()["n"]
    ultimo = conn.execute(
        "SELECT data FROM registros ORDER BY data DESC, id DESC LIMIT 1"
    ).fetchone()
    ip = get_lan_ip()
    link_rede = f"http://{ip}:{PORT}"
    return render_template(
        "menu.html",
        total_registros=total_registros,
        ultima_reuniao=ultimo["data"] if ultimo else None,
        link_rede=link_rede,
    )


@app.route("/qrcode.svg")
@login_obrigatorio
def qrcode_svg():
    """Gera um QR code (SVG) com o link de acesso na rede, sem precisar de internet."""
    import qrcode
    import qrcode.image.svg
    from flask import Response

    ip = get_lan_ip()
    link = f"http://{ip}:{PORT}"
    factory = qrcode.image.svg.SvgPathImage
    img = qrcode.make(link, image_factory=factory, box_size=10, border=2)
    buf = io.BytesIO()
    img.save(buf)
    return Response(buf.getvalue(), mimetype="image/svg+xml")


@app.route("/api/localidade-busca")
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


# --------------------------------------------------------------------------
# Rotas — Formulário (novo registro / edição)
# --------------------------------------------------------------------------
@app.route("/novo", methods=["GET", "POST"])
@login_obrigatorio
def novo_registro():
    conn = get_db()
    if request.method == "POST":
        dados = dados_do_formulario()
        erro = None
        if not dados["data"]:
            erro = "Informe a data da reunião antes de salvar."
        else:
            ok, erro_biblia = db.valida_referencia_biblica(dados["livro"], dados["capitulo"], dados["versiculo"])
            if not ok:
                erro = erro_biblia
        if erro:
            flash(erro, "erro")
            return render_template(
                "formulario.html", registro=dados, livros=db.LIVROS_DA_BIBLIA,
                biblia_estrutura=db.BIBLIA_ESTRUTURA, localidades=localidades_conhecidas(conn),
                estados_ccb=list(LOCALIDADES_CCB.keys()), localidades_ccb=LOCALIDADES_CCB,
                visitas_conhecidas=visitas_conhecidas(conn), nomes_conhecidos=nomes_conhecidos(conn), modo="novo",
            )
        colunas = ", ".join(dados.keys())
        marcadores = ", ".join(["?"] * len(dados))
        conn.execute(
            f"INSERT INTO registros ({colunas}) VALUES ({marcadores})",
            list(dados.values()),
        )
        conn.commit()
        flash("Registro salvo com sucesso!", "sucesso")
        return redirect(url_for("novo_registro"))

    vazio = {
        "data": date.today().isoformat(),
        "presidencia": "", "local": LOCAL_PADRAO,
        "meninas_1": "", "meninas_2": "", "meninas_3": "", "meninas_4": "", "meninas_5": "",
        "meninos_1": "", "meninos_2": "", "meninos_3": "", "meninos_4": "", "meninos_5": "",
        "recitativos_individuais": "", "visitas": "",
        "livro": "", "capitulo": "", "versiculo": "", "presidido_por": "",
    }
    return render_template(
        "formulario.html", registro=vazio, livros=db.LIVROS_DA_BIBLIA,
        biblia_estrutura=db.BIBLIA_ESTRUTURA, localidades=localidades_conhecidas(conn),
        estados_ccb=list(LOCALIDADES_CCB.keys()), localidades_ccb=LOCALIDADES_CCB,
        estado_padrao=ESTADO_PADRAO, cidade_padrao=CIDADE_PADRAO,
                visitas_conhecidas=visitas_conhecidas(conn), nomes_conhecidos=nomes_conhecidos(conn), modo="novo",
    )


@app.route("/registros/<int:registro_id>/editar", methods=["GET", "POST"])
@login_obrigatorio
def editar_registro(registro_id):
    conn = get_db()
    if request.method == "POST":
        dados = dados_do_formulario()
        erro = None
        if not dados["data"]:
            erro = "Informe a data da reunião antes de salvar."
        else:
            ok, erro_biblia = db.valida_referencia_biblica(dados["livro"], dados["capitulo"], dados["versiculo"])
            if not ok:
                erro = erro_biblia
        if erro:
            flash(erro, "erro")
            return render_template(
                "formulario.html", registro=dados, livros=db.LIVROS_DA_BIBLIA,
                biblia_estrutura=db.BIBLIA_ESTRUTURA, localidades=localidades_conhecidas(conn),
                estados_ccb=list(LOCALIDADES_CCB.keys()), localidades_ccb=LOCALIDADES_CCB,
                visitas_conhecidas=visitas_conhecidas(conn), nomes_conhecidos=nomes_conhecidos(conn),
                modo="editar", registro_id=registro_id,
            )
        campos = ", ".join(f"{c} = ?" for c in dados.keys())
        conn.execute(
            f"UPDATE registros SET {campos}, atualizado_em = datetime('now','localtime') WHERE id = ?",
            list(dados.values()) + [registro_id],
        )
        conn.commit()
        flash("Registro atualizado com sucesso!", "sucesso")
        return redirect(url_for("registros"))

    registro = conn.execute("SELECT * FROM registros WHERE id = ?", (registro_id,)).fetchone()
    if registro is None:
        flash("Registro não encontrado.", "erro")
        return redirect(url_for("registros"))
    return render_template(
        "formulario.html", registro=registro, livros=db.LIVROS_DA_BIBLIA,
        biblia_estrutura=db.BIBLIA_ESTRUTURA, localidades=localidades_conhecidas(conn),
        estados_ccb=list(LOCALIDADES_CCB.keys()), localidades_ccb=LOCALIDADES_CCB,
                visitas_conhecidas=visitas_conhecidas(conn), nomes_conhecidos=nomes_conhecidos(conn),
        modo="editar", registro_id=registro_id,
    )


@app.route("/registros/<int:registro_id>/excluir", methods=["POST"])
@login_obrigatorio
@somente_cooperador
def excluir_registro(registro_id):
    conn = get_db()
    conn.execute("DELETE FROM registros WHERE id = ?", (registro_id,))
    conn.commit()
    flash("Registro excluído.", "sucesso")
    return redirect(url_for("registros"))


# --------------------------------------------------------------------------
# Rotas — Histórico
# --------------------------------------------------------------------------
@app.route("/registros")
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
            "total_meninas": db.total_meninas(r),
            "total_meninos": db.total_meninos(r),
            "total_geral": db.total_geral(r),
            "recitativos_individuais": r["recitativos_individuais"],
            "visitas": db.lista_visitas(r["visitas"]),
            "livro": r["livro"],
            "capitulo": r["capitulo"],
            "versiculo": r["versiculo"],
        })

    return render_template("registros.html", registros=registros_view, busca=busca)


# --------------------------------------------------------------------------
# Rotas — Dashboard (BI)
# --------------------------------------------------------------------------
@app.route("/dashboard")
@login_obrigatorio
@somente_cooperador
def dashboard():
    conn = get_db()
    inicio, fim, rotulo_periodo, chave_periodo = periodo_do_filtro()
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
    soma_geral = sum(db.total_geral(r) for r in linhas)
    soma_individuais = sum(r["recitativos_individuais"] or 0 for r in linhas)
    soma_visitas = sum(len(db.lista_visitas(r["visitas"])) for r in linhas)
    media_geral = round(soma_geral / qtd_reunioes, 1) if qtd_reunioes else 0

    # ---- Série temporal: total geral de recitativos por data --------
    por_data = {}
    for r in linhas:
        por_data.setdefault(r["data"], {"meninas": 0, "meninos": 0})
        por_data[r["data"]]["meninas"] += db.total_meninas(r)
        por_data[r["data"]]["meninos"] += db.total_meninos(r)
    datas_ordenadas = sorted(por_data.keys())
    serie_labels = [_data_curta(d) for d in datas_ordenadas]
    serie_total = [por_data[d]["meninas"] + por_data[d]["meninos"] for d in datas_ordenadas]

    # ---- Meninas x Meninos por posição do recitativo -----------------
    soma_meninas_pos = [0, 0, 0, 0, 0]
    soma_meninos_pos = [0, 0, 0, 0, 0]
    for r in linhas:
        for i, c in enumerate(db.COLUNAS_MENINAS):
            soma_meninas_pos[i] += r[c] or 0
        for i, c in enumerate(db.COLUNAS_MENINOS):
            soma_meninos_pos[i] += r[c] or 0

    # ---- Individuais x Visitas ao longo do tempo ---------------------
    por_data_extra = {}
    for r in linhas:
        por_data_extra.setdefault(r["data"], {"individuais": 0, "visitas": 0})
        por_data_extra[r["data"]]["individuais"] += r["recitativos_individuais"] or 0
        por_data_extra[r["data"]]["visitas"] += len(db.lista_visitas(r["visitas"]))
    serie_individuais = [por_data_extra[d]["individuais"] for d in datas_ordenadas]
    serie_visitas = [por_data_extra[d]["visitas"] for d in datas_ordenadas]

    # ---- Livros mais lidos --------------------------------------------
    contagem_livros = {}
    for r in linhas:
        livro = (r["livro"] or "").strip()
        if livro:
            contagem_livros[livro] = contagem_livros.get(livro, 0) + 1
    ranking_livros = sorted(contagem_livros.items(), key=lambda x: x[1], reverse=True)[:8]

    # ---- Igrejas que mais visitaram ------------------------------------
    contagem_visitas = {}
    for r in linhas:
        for nome in db.lista_visitas(r["visitas"]):
            contagem_visitas[nome] = contagem_visitas.get(nome, 0) + 1
    ranking_visitas = sorted(contagem_visitas.items(), key=lambda x: x[1], reverse=True)[:8]

    # ---- Últimos registros do período ---------------------------------
    ultimos = []
    for r in list(linhas)[-8:][::-1]:
        ultimos.append({
            "id": r["id"],
            "data": r["data"],
            "presidencia": r["presidencia"],
            "total_geral": db.total_geral(r),
            "individuais": r["recitativos_individuais"],
            "visitas": ", ".join(db.lista_visitas(r["visitas"])),
            "livro": r["livro"],
        })

    dashboard_data = {
        "tendencia": {"labels": serie_labels, "valores": serie_total},
        "categorias": {
            "labels": db.RECITATIVOS_LABELS_CURTOS,
            "series": [
                {"nome": "Meninas", "valores": soma_meninas_pos},
                {"nome": "Meninos", "valores": soma_meninos_pos},
            ],
        },
        "individuais_visitas": {
            "labels": serie_labels,
            "series": [
                {"nome": "Recitativos individuais", "valores": serie_individuais},
                {"nome": "Visitas", "valores": serie_visitas},
            ],
        },
        "livros": {
            "labels": [item[0] for item in ranking_livros],
            "valores": [item[1] for item in ranking_livros],
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
        localidades=localidades_conhecidas(conn),
                estados_ccb=list(LOCALIDADES_CCB.keys()), localidades_ccb=LOCALIDADES_CCB,
                visitas_conhecidas=visitas_conhecidas(conn), nomes_conhecidos=nomes_conhecidos(conn),
        localidade_selecionada=localidade,
        presidencias=presidencias_conhecidas(conn),
        presidencia_selecionada=presidencia_filtro,
    )


def _data_curta(iso):
    try:
        d = datetime.strptime(iso, "%Y-%m-%d")
        return d.strftime("%d/%m")
    except ValueError:
        return iso


@app.template_filter("data_br")
def data_br(iso):
    """Formata uma data ISO (aaaa-mm-dd) como dd/mm/aaaa, do jeito brasileiro."""
    try:
        return datetime.strptime(iso, "%Y-%m-%d").strftime("%d/%m/%Y")
    except (TypeError, ValueError):
        return iso or ""


# --------------------------------------------------------------------------
# Inicialização
# --------------------------------------------------------------------------
def abrir_navegador():
    webbrowser.open(f"http://127.0.0.1:{PORT}")


if __name__ == "__main__":
    db.init_db()
    ip = get_lan_ip()
    print("")
    print("=" * 60)
    print("  BI - Reunião de Jovens e Menores (CCB)")
    print("=" * 60)
    print(f"  Neste computador .... http://127.0.0.1:{PORT}")
    print(f"  Na rede local ........ http://{ip}:{PORT}")
    print("")
    print("  Compartilhe o link 'Na rede local' com quem estiver")
    print("  conectado no mesmo Wi-Fi para acessar por celular/tablet.")
    print("  Para encerrar, feche esta janela ou pressione CTRL+C.")
    print("=" * 60)
    print("")
    threading.Timer(1.2, abrir_navegador).start()
    app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)
