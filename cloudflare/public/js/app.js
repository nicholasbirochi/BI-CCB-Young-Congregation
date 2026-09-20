const app = {
  session: null,
  biblia: null,
  paises: null,
  localidades: null,
  registrosCache: [],
};

const PAPEIS = {
  cooperador: "Cooperador de Jovens",
  contagem: "Irmãos da Contagem",
};

const DEFAULTS = {
  local: "Batistini",
  estado: "São Paulo",
  cidade: "São Bernardo Do Campo",
  pais: "Brasil",
};

const REGISTRO_COLUMNS = [
  "data", "presidencia", "pais", "local", "estado", "cidade",
  "meninas_1", "meninas_2", "meninas_3", "meninas_4", "meninas_5", "meninas_6",
  "meninos_1", "meninos_2", "meninos_3", "meninos_4", "meninos_5", "meninos_6",
  "recitativos_individuais", "testemunhos", "visitas", "auxiliares_presentes",
  "auxiliares_masculinos", "auxiliares_femininos", "oracao_pai_nosso",
  "recitativo_coletivo", "livro", "capitulo", "versiculo", "presidido_por",
];

const NUMERIC_COLUMNS = new Set([
  "meninas_1", "meninas_2", "meninas_3", "meninas_4", "meninas_5", "meninas_6",
  "meninos_1", "meninos_2", "meninos_3", "meninos_4", "meninos_5", "meninos_6",
  "recitativos_individuais", "testemunhos", "auxiliares_masculinos",
  "auxiliares_femininos", "recitativo_coletivo",
]);

const COLUNAS_MENINAS = ["meninas_1", "meninas_2", "meninas_3", "meninas_4", "meninas_5", "meninas_6", "auxiliares_femininos"];
const COLUNAS_MENINOS = ["meninos_1", "meninos_2", "meninos_3", "meninos_4", "meninos_5", "meninos_6", "auxiliares_masculinos"];

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("hashchange", renderRoute);

async function init() {
  await Promise.all([loadStaticData(), refreshSession()]);
  renderRoute();
}

async function loadStaticData() {
  const [biblia, paises, localidades] = await Promise.all([
    fetch("/data/biblia.json").then((r) => r.json()),
    fetch("/data/paises.json").then((r) => r.json()),
    fetch("/data/localidades_ccb.json").then((r) => r.json()),
  ]);
  app.biblia = biblia;
  app.paises = paises;
  app.localidades = localidades;
}

async function refreshSession() {
  const data = await api("/api/session", { authOptional: true });
  app.session = data.session;
}

async function renderRoute() {
  renderNav();
  clearFlash();
  if (!app.session) {
    renderLogin();
    return;
  }

  const route = location.hash.replace(/^#/, "") || "menu";
  const path = route.split("?")[0];
  if (path === "menu") return renderMenu();
  if (path === "novo") return renderForm();
  if (path === "registros") return renderRegistros();
  if (path.startsWith("editar/")) return renderForm(Number(path.split("/")[1]));
  if (path === "dashboard") {
    if (app.session.papel !== "cooperador") {
      showFlash("Essa página é exclusiva do Cooperador de Jovens.", "erro");
      location.hash = "#menu";
      return;
    }
    return renderDashboard();
  }
  location.hash = "#menu";
}

function renderNav() {
  const nav = $("#app-nav");
  if (!app.session) {
    nav.hidden = true;
    nav.innerHTML = "";
    return;
  }
  const route = (location.hash.replace(/^#/, "") || "menu").split("?")[0];
  nav.hidden = false;
  nav.innerHTML = `
    <nav class="topbar-nav">
      <a href="#menu" class="${route === "menu" ? "ativo" : ""}">Menu</a>
      <a href="#novo" class="${route === "novo" ? "ativo" : ""}">Novo registro</a>
      <a href="#registros" class="${route === "registros" || route.startsWith("editar/") ? "ativo" : ""}">Histórico</a>
      ${app.session.papel === "cooperador" ? `<a href="#dashboard" class="${route === "dashboard" ? "ativo" : ""}">Análises</a>` : ""}
    </nav>
    <button class="chip-restrita" type="button" id="logout-btn">${iconSvg("logout")}<span>Sair</span></button>
  `;
  $("#logout-btn").addEventListener("click", logout);
}

function renderLogin() {
  $("#app-root").innerHTML = `
    <div class="login-grid">
      <section class="login-brand">
        <img src="/img/ccb-logo-completo.png" alt="Congregação Cristã no Brasil">
        <div>
          <h1>BI · Jovens e Menores</h1>
          <p class="subtitle">Sistema online de registro e análise da Reunião de Jovens e Menores.</p>
        </div>
      </section>
      <form class="card login-panel" id="login-form">
        <h2>Entrar</h2>
        <div class="role-options">
          <label class="role-option"><input type="radio" name="papel" value="cooperador" checked> <span>Cooperador de Jovens</span></label>
          <label class="role-option"><input type="radio" name="papel" value="contagem"> <span>Irmãos da Contagem</span></label>
        </div>
        <div class="field">
          <label for="senha">Senha</label>
          <input id="senha" name="senha" type="password" required autocomplete="current-password">
        </div>
        <div class="form-actions">
          <button type="submit" class="btn primary">Entrar</button>
        </div>
      </form>
    </div>
  `;
  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await api("/api/login", {
        method: "POST",
        body: { papel: form.get("papel"), senha: form.get("senha") },
        authOptional: true,
      });
      app.session = data.session;
      location.hash = "#menu";
      renderRoute();
    } catch (error) {
      showFlash(error.message, "erro");
    }
  });
}

async function logout() {
  await api("/api/logout", { method: "POST", body: {} });
  app.session = null;
  location.hash = "";
  renderRoute();
}

async function renderMenu() {
  const resumo = await api("/api/summary");
  const linkAcesso = location.origin;
  $("#app-root").innerHTML = `
    <div class="hero">
      <h1>Reunião de Jovens e Menores</h1>
      <p>Congregação Cristã no Brasil - registre os formulários e acompanhe as análises.</p>
      <p class="hero-papel">${escapeHtml(PAPEIS[app.session.papel])}</p>
    </div>

    <div class="card network-banner">
      <div class="info">
        <h3>Acesso online</h3>
        <p>Qualquer aparelho autorizado pode abrir este BI usando o link abaixo - não precisa instalar nada.</p>
        <div class="network-link">
          <span id="link-acesso">${escapeHtml(linkAcesso)}</span>
          <button type="button" data-copy-target="#link-acesso">Copiar</button>
        </div>
      </div>
      <div class="qr-wrap">
        <img src="/img/qrcode.svg" alt="QR code do link de acesso">
      </div>
    </div>

    <div class="menu-grid">
      <a class="card menu-card" href="#novo">
        <h2>Novo registro</h2>
        <p class="subtitle">Cadastrar a reunião pelo formulário digital.</p>
      </a>
      <a class="card menu-card" href="#registros">
        <h2>Histórico</h2>
        <div class="value">${numeroBr(resumo.total_registros)}</div>
        <p class="subtitle">registros salvos</p>
      </a>
      ${app.session.papel === "cooperador" ? `
        <a class="card menu-card" href="#dashboard">
          <h2>Análises</h2>
          <p class="subtitle">Indicadores, gráficos e filtros.</p>
        </a>
      ` : ""}
    </div>

    ${app.session.papel === "cooperador" ? `
      <div class="card toolbar-split">
        <div>
          <h2>Backup</h2>
          <p class="subtitle">Exportação SQL dos registros atuais no D1.</p>
        </div>
        <a class="btn" href="/api/export.sql">Baixar backup</a>
      </div>
    ` : ""}
  `;
  $("#app-root [data-copy-target]").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const target = $(button.dataset.copyTarget);
    if (!target) return;
    await navigator.clipboard.writeText(target.textContent.trim());
    const original = button.textContent;
    button.textContent = "Copiado!";
    setTimeout(() => { button.textContent = original; }, 1500);
  });
}

async function renderRegistros() {
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const busca = params.get("busca") || "";
  const data = await api(`/api/registros?busca=${encodeURIComponent(busca)}`);
  app.registrosCache = data.registros;
  $("#app-root").innerHTML = `
    <div class="page-header">
      <div>
        <h1>Histórico de reuniões</h1>
        <p class="subtitle">${data.registros.length} registro(s)${busca ? ` para "${escapeHtml(busca)}"` : ""}.</p>
      </div>
      <a class="btn primary btn-icone" href="#novo" title="Novo registro" aria-label="Novo registro">${iconSvg("plus")}</a>
    </div>
    <form class="search-row" id="search-form">
      <input type="text" name="busca" value="${escapeAttr(busca)}" placeholder="Buscar por data, presidência, livro, local...">
      <button class="btn btn-icone" type="submit" title="Buscar" aria-label="Buscar">${iconSvg("search")}</button>
      ${busca ? `<a class="btn" href="#registros">Limpar</a>` : ""}
    </form>
    <div class="card table-scroll">
      ${data.registros.length ? tabelaRegistros(data.registros) : `<div class="empty-state">Nenhum registro encontrado. <a href="#novo">Cadastre o primeiro.</a></div>`}
    </div>
  `;
  $("#search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("busca") || "";
    location.hash = `#registros?busca=${encodeURIComponent(value)}`;
  });
  $$("#app-root [data-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;
      await api(`/api/registros/${button.dataset.deleteId}`, { method: "DELETE" });
      showFlash("Registro excluído.", "sucesso");
      renderRegistros();
    });
  });
}

function tabelaRegistros(registros) {
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Data</th><th>Presidência</th><th>Local</th>
          <th class="num">Total geral</th><th class="num">Meninas</th><th class="num">Meninos</th>
          <th class="num">Individuais</th><th>Visitas</th><th>Palavra</th><th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${registros.map((r) => `
          <tr>
            <td>${dataBr(r.data)}</td>
            <td>${escapeHtml(r.presidencia || "—")}</td>
            <td>${escapeHtml(r.local || "—")}</td>
            <td class="num"><strong>${numeroBr(r.total_geral)}</strong></td>
            <td class="num">${numeroBr(r.total_meninas)}</td>
            <td class="num">${numeroBr(r.total_meninos)}</td>
            <td class="num">${numeroBr(r.recitativos_individuais)}</td>
            <td class="visitas-list">${escapeHtml((r.visitas_lista || []).join(", ") || "—")}</td>
            <td>${palavra(r)}</td>
            <td>
              <div class="actions">
                <a class="btn small btn-icone" href="#editar/${r.id}" aria-label="Editar registro" title="Editar">
                  ${iconSvg("edit")}
                </a>
                <button class="btn small danger btn-icone" type="button" data-delete-id="${r.id}" aria-label="Excluir registro" title="Excluir">
                  ${iconSvg("trash")}
                </button>
              </div>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function renderForm(id = null) {
  const modo = id ? "editar" : "novo";
  const registro = id ? (await api(`/api/registros/${id}`)).registro : defaultRegistro();
  $("#app-root").innerHTML = `
    <div class="page-header">
      <div>
        <h1>${modo === "editar" ? "Editar registro" : "Novo registro"}</h1>
        <p class="subtitle">Preencha os mesmos campos do formulário impresso da Reunião de Jovens e Menores.</p>
      </div>
    </div>
    <div id="rascunho-banner" class="rascunho-banner" hidden>
      <span>Encontramos um preenchimento não terminado neste aparelho.</span>
      <div class="rascunho-banner-acoes">
        <button type="button" class="btn small primary" id="rascunho-restaurar">Restaurar</button>
        <button type="button" class="btn small" id="rascunho-descartar">Descartar</button>
      </div>
    </div>
    <form class="card" id="registro-form" data-rascunho-chave="${modo}-${id || "novo"}" novalidate>
      ${formDadosReuniao(registro)}
      ${formRecitativos(registro)}
      ${formVisitas(registro)}
      ${formPalavra(registro)}
      <div class="form-actions">
        <span class="rascunho-status" id="rascunho-status"></span>
        <a class="btn" href="${modo === "editar" ? "#registros" : "#menu"}">Cancelar</a>
        <button type="submit" class="btn primary">Salvar registro</button>
      </div>
    </form>
  `;
  setupForm(registro, id);
}

function formDadosReuniao(r) {
  return `
    <div class="form-section">
      <h2>Dados da reunião</h2>
      <div class="field-grid">
        <div class="field">
          <label for="data">Data *</label>
          <input type="date" id="data" name="data" value="${escapeAttr(r.data)}" required max="${todayIso()}">
        </div>
        <div class="field">
          <label for="presidencia">Presidência</label>
          <input type="text" id="presidencia" name="presidencia" value="${escapeAttr(r.presidencia)}" autocomplete="off">
        </div>
        <input type="hidden" name="oracao_pai_nosso" value="${escapeAttr(r.oracao_pai_nosso)}">
        <div class="field">
          <label for="local">Local / Congregação</label>
          <input id="local" name="local" value="${escapeAttr(r.local)}" list="sugestoes-local" autocomplete="off">
          <datalist id="sugestoes-local"></datalist>
        </div>
        <div class="field">
          <label for="pais">País</label>
          <select id="pais" disabled>${paisesOptions(r.pais)}</select>
          <input type="hidden" id="pais-oculto" name="pais" value="${escapeAttr(r.pais)}">
        </div>
        <div class="field">
          <label for="estado">Estado</label>
          <select id="estado" disabled>${estadoOptions(r.estado)}</select>
          <input type="hidden" id="estado-oculto" name="estado" value="${escapeAttr(r.estado)}">
        </div>
        <select id="cidade" hidden><option value="">—</option></select>
        <input type="hidden" id="cidade-oculto" name="cidade" value="${escapeAttr(r.cidade)}">
      </div>
    </div>
  `;
}

function formRecitativos(r) {
  return `
    <div class="form-section">
      <h2>
        <select id="recitativo-coletivo" name="recitativo_coletivo" class="recitativos-modo-select">
          <option value="0" ${!number(r.recitativo_coletivo) ? "selected" : ""}>Recitativos</option>
          <option value="1" ${number(r.recitativo_coletivo) ? "selected" : ""}>Recitativo Coletivo</option>
        </select>
      </h2>
      <div class="recitativos-table">
        <div class="recitativos-col">
          <h3>Irmãs</h3>
          ${recLine("meninas_1", "Crianças", r)}
          ${recLine("meninas_2", "Meninas", r, true)}
          ${recLine("meninas_3", "Mocinhas", r, true)}
          ${recLine("meninas_4", `Moças <span class="hint" id="dica-coletivo-meninas" hidden>(grupo todo)</span>`, r)}
          ${recLine("auxiliares_femininos", "Auxiliares", r, true)}
          <input type="hidden" name="meninas_5" value="${number(r.meninas_5)}">
          <input type="hidden" name="meninas_6" value="${number(r.meninas_6)}">
          <div class="recitativos-total"><span>Total</span><span id="total-meninas">0</span></div>
        </div>
        <div class="recitativos-col">
          <h3>Irmãos</h3>
          ${recLine("meninos_1", "Crianças", r)}
          ${recLine("meninos_2", "Meninos", r, true)}
          ${recLine("meninos_3", "Mocinhos", r, true)}
          ${recLine("meninos_4", `Moços <span class="hint" id="dica-coletivo-meninos" hidden>(grupo todo)</span>`, r)}
          ${recLine("auxiliares_masculinos", "Auxiliares", r, true)}
          <input type="hidden" name="meninos_5" value="${number(r.meninos_5)}">
          <input type="hidden" name="meninos_6" value="${number(r.meninos_6)}">
          <div class="recitativos-total"><span>Total</span><span id="total-meninos">0</span></div>
        </div>
      </div>
      <div class="total-geral-box">
        <div class="value" id="total-geral">0</div>
        <div class="label">Total geral</div>
      </div>
    </div>
  `;
}

function formVisitas(r) {
  return `
    <div class="form-section">
      <h2>Recitativos individuais e visitas</h2>
      <div class="field-grid">
        <div class="field">
          <label for="recitativos_individuais">Recitativos individuais</label>
          <div class="stepper">
            <input type="number" min="0" inputmode="numeric" id="recitativos_individuais" name="recitativos_individuais" value="${number(r.recitativos_individuais)}">
            <div class="stepper-setas">
              <button type="button" class="stepper-seta" id="individuais-mais" aria-label="Aumentar">${iconSvg("chevron-up", 11)}</button>
              <button type="button" class="stepper-seta" id="individuais-menos" aria-label="Diminuir">${iconSvg("chevron-down", 11)}</button>
            </div>
          </div>
        </div>
        <input type="hidden" name="testemunhos" value="${number(r.testemunhos)}">
        <div class="field">
          <label for="visita-input">Visitas <span class="hint">(igrejas que visitaram)</span></label>
          <div class="chip-input-row">
            <input type="text" id="visita-input" list="sugestoes-visitas" autocomplete="off">
            <button type="button" class="btn small" id="visita-adicionar" title="Adicionar visita" aria-label="Adicionar visita">${iconSvg("plus", 14)}</button>
          </div>
          <datalist id="sugestoes-visitas"></datalist>
          <div class="chips" id="visitas-chips"></div>
          <input type="hidden" id="visitas" name="visitas" value="${escapeAttr(r.visitas)}">
        </div>
      </div>
    </div>
  `;
}

function formPalavra(r) {
  return `
    <div class="form-section">
      <h2>Palavra</h2>
      <div class="field-grid">
        <div class="field">
          <label for="livro">Livro</label>
          <select id="livro" name="livro">
            <option value="">Selecione...</option>
            ${app.biblia.livros.map((livro) => `<option value="${escapeAttr(livro)}" ${r.livro === livro ? "selected" : ""}>${escapeHtml(livro)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="capitulo">Capítulo</label>
          <select id="capitulo" name="capitulo" disabled><option value="">—</option></select>
        </div>
        <div class="field">
          <label for="versiculo-inicio">Versículo</label>
          <div class="versiculo-range">
            <select id="versiculo-inicio" disabled><option value="">De</option></select>
            <span class="muted" id="versiculo-ate-rotulo">até</span>
            <select id="versiculo-fim" disabled><option value="">até</option></select>
          </div>
          <input type="hidden" id="versiculo" name="versiculo" value="${escapeAttr(r.versiculo)}">
        </div>
        <div class="field">
          <label for="presidido_por">Presidido por</label>
          <input type="text" id="presidido_por" name="presidido_por" value="${escapeAttr(r.presidido_por)}" list="sugestoes-nomes" autocomplete="off">
          <datalist id="sugestoes-nomes"></datalist>
        </div>
      </div>
    </div>
  `;
}

function setupForm(registro, id) {
  const form = $("#registro-form");
  setupDraft(form);
  setupSugestoes();
  setupTotals();
  setupLocalizacao(registro);
  setupVisitas();
  setupIndividuaisStepper();
  setupBiblia(registro);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    for (const column of REGISTRO_COLUMNS) {
      if (NUMERIC_COLUMNS.has(column)) payload[column] = number(payload[column]);
      else payload[column] = String(payload[column] || "").trim();
    }
    try {
      const response = await api(id ? `/api/registros/${id}` : "/api/registros", {
        method: id ? "PUT" : "POST",
        body: payload,
      });
      localStorage.removeItem(draftKey(form));
      showFlash(id ? "Registro atualizado com sucesso!" : "Registro salvo com sucesso!", "sucesso");
      location.hash = id ? "#registros" : "#novo";
      if (!id) renderForm();
    } catch (error) {
      showFlash(error.message, "erro");
    }
  });
}

function setupTotals() {
  const form = $("#registro-form");
  const campo = (name) => form.querySelector(`[name="${name}"]`);
  const soma = (names) => names.reduce((total, name) => total + number(campo(name)?.value), 0);
  const atualizar = () => {
    const meninas = soma(COLUNAS_MENINAS);
    const meninos = soma(COLUNAS_MENINOS);
    $("#total-meninas").textContent = meninas;
    $("#total-meninos").textContent = meninos;
    $("#total-geral").textContent = meninas + meninos;
  };
  [...COLUNAS_MENINAS, ...COLUNAS_MENINOS].forEach((name) => campo(name)?.addEventListener("input", atualizar));

  const select = $("#recitativo-coletivo");
  const detalhadas = $$("[data-linha-detalhada]");
  const dicas = [$("#dica-coletivo-meninas"), $("#dica-coletivo-meninos")];
  const aplicar = (zerar) => {
    const coletivo = select.value === "1";
    detalhadas.forEach((row) => {
      row.hidden = coletivo;
      if (coletivo && zerar) row.querySelector("input").value = "0";
    });
    dicas.forEach((el) => { if (el) el.hidden = !coletivo; });
    atualizar();
  };
  select.addEventListener("change", () => aplicar(true));
  aplicar(false);
}

function setupLocalizacao(registro) {
  const estado = $("#estado");
  const cidade = $("#cidade");
  const local = $("#local");
  const estadoOculto = $("#estado-oculto");
  const cidadeOculto = $("#cidade-oculto");
  const pais = $("#pais");
  const paisOculto = $("#pais-oculto");
  const cidadeParaEstado = {};
  Object.entries(app.localidades).forEach(([uf, cidades]) => {
    cidades.forEach((nome) => { cidadeParaEstado[normalizar(nome)] = uf; });
  });

  function sync() {
    estadoOculto.value = estado.value;
    cidadeOculto.value = cidade.value;
    paisOculto.value = pais.value;
  }

  function popularCidades(uf, selected) {
    const cidades = app.localidades[uf] || [];
    cidade.innerHTML = `<option value="">—</option>${cidades.map((c) => `<option value="${escapeAttr(c)}" ${c === selected ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}`;
    if (selected && !cidades.includes(selected)) cidade.insertAdjacentHTML("beforeend", `<option value="${escapeAttr(selected)}" selected>${escapeHtml(selected)}</option>`);
    sync();
  }

  function selecionar(uf, city) {
    estado.value = app.localidades[uf] ? uf : "";
    if (estado.value) pais.value = "Brasil";
    popularCidades(estado.value, city || "");
  }

  function derivar(texto) {
    const partes = String(texto || "").split(/—| - /).map((p) => p.trim()).filter(Boolean);
    const candidatos = partes.length > 1 ? [partes.at(-1), partes[0]] : [texto || ""];
    for (const item of candidatos) {
      const limpo = String(item).split(",")[0].trim();
      const uf = cidadeParaEstado[normalizar(limpo)];
      if (uf) return selecionar(uf, limpo);
    }
    if (normalizar(texto) === normalizar(DEFAULTS.local)) return selecionar(DEFAULTS.estado, DEFAULTS.cidade);
    selecionar("", "");
  }

  if (registro.estado || registro.cidade) selecionar(registro.estado, registro.cidade);
  else derivar(local.value);
  local.addEventListener("input", () => derivar(local.value));
}

function setupVisitas() {
  const hidden = $("#visitas");
  const input = $("#visita-input");
  const chips = $("#visitas-chips");
  let visitas = parseVisitas(hidden.value);

  function render() {
    hidden.value = visitas.join("; ");
    chips.innerHTML = visitas.map((nome, index) => `<span class="chip">${escapeHtml(nome)} <button type="button" aria-label="Remover" data-chip="${index}">×</button></span>`).join("");
    chips.querySelectorAll("[data-chip]").forEach((button) => {
      button.addEventListener("click", () => {
        visitas.splice(Number(button.dataset.chip), 1);
        render();
      });
    });
  }

  function add() {
    const value = input.value.trim();
    if (value && !visitas.includes(value)) visitas.push(value);
    input.value = "";
    render();
  }

  $("#visita-adicionar").addEventListener("click", add);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  });
  render();
}

function setupIndividuaisStepper() {
  const input = $("#recitativos_individuais");
  const plus = $("#individuais-mais");
  const minus = $("#individuais-menos");
  if (!input || !plus || !minus) return;

  function step(delta) {
    input.value = Math.max(0, number(input.value) + delta);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  plus.addEventListener("click", () => step(1));
  minus.addEventListener("click", () => step(-1));
}

function setupBiblia(registro) {
  const livro = $("#livro");
  const capitulo = $("#capitulo");
  const inicio = $("#versiculo-inicio");
  const fim = $("#versiculo-fim");
  const ate = $("#versiculo-ate-rotulo");
  const hidden = $("#versiculo");
  const INTEIRO = "todos";

  function popular(select, count, selected, label) {
    select.innerHTML = `<option value="">${count ? label : "—"}</option>`;
    for (let i = 1; i <= count; i++) {
      select.insertAdjacentHTML("beforeend", `<option value="${i}" ${String(selected) === String(i) ? "selected" : ""}>${i}</option>`);
    }
    select.disabled = !count;
  }

  function interpretar(value) {
    const raw = String(value || "").trim();
    if (/^(todos?|tudo|inteiro|completo)$/i.test(raw)) return { inteiro: true, inicio: "", fim: "" };
    const nums = raw.match(/\d+/g);
    return nums ? { inteiro: false, inicio: nums[0], fim: nums.at(-1) } : { inteiro: false, inicio: "", fim: "" };
  }

  function updateHidden() {
    if (inicio.value === INTEIRO) hidden.value = "Todos";
    else if (!inicio.value) hidden.value = "";
    else hidden.value = !fim.value || fim.value === inicio.value ? inicio.value : `${inicio.value}-${fim.value}`;
    const inteiro = inicio.value === INTEIRO;
    fim.hidden = inteiro;
    ate.hidden = inteiro;
  }

  function onCapitulo(versiculo = "") {
    const caps = app.biblia.estrutura[livro.value] || [];
    const total = caps[number(capitulo.value) - 1] || 0;
    const alvo = interpretar(versiculo);
    popular(inicio, total, alvo.inteiro ? "" : alvo.inicio, "De");
    if (total) inicio.insertAdjacentHTML("afterbegin", `<option value="${INTEIRO}" ${alvo.inteiro ? "selected" : ""}>Capítulo inteiro</option>`);
    popular(fim, total, alvo.fim, "até");
    updateHidden();
  }

  function onLivro(cap = "", versiculo = "") {
    const caps = app.biblia.estrutura[livro.value] || [];
    popular(capitulo, caps.length, cap, "Selecione...");
    onCapitulo(versiculo);
  }

  livro.addEventListener("change", () => onLivro());
  capitulo.addEventListener("change", () => onCapitulo());
  inicio.addEventListener("change", updateHidden);
  fim.addEventListener("change", updateHidden);
  onLivro(registro.capitulo, registro.versiculo);
}

function setupSugestoes() {
  api("/api/registros").then(({ registros }) => {
    const locais = new Set();
    const visitas = new Set();
    const nomes = new Set();
    registros.forEach((r) => {
      if (r.local) locais.add(r.local);
      if (r.presidencia) nomes.add(r.presidencia);
      if (r.presidido_por) nomes.add(r.presidido_por);
      (r.visitas_lista || []).forEach((v) => visitas.add(v));
    });
    fillDatalist("#sugestoes-local", locais);
    fillDatalist("#sugestoes-visitas", visitas);
    fillDatalist("#sugestoes-nomes", nomes);
  }).catch(() => {});
}

async function renderDashboard() {
  const params = new URLSearchParams(location.hash.split("?")[1] || "periodo=tudo");
  if (!params.get("periodo")) params.set("periodo", "tudo");
  const data = await api(`/api/dashboard?${params.toString()}`);
  $("#app-root").innerHTML = `
    <div class="page-header"><div><h1>Análises</h1></div></div>
    ${dashboardFilters(data, params)}
    <div class="kpi-row">
      ${stat("Reuniões totais no período", data.kpis.qtd_reunioes)}
      ${stat("Total de recitativos", data.kpis.soma_geral)}
      ${stat("Média de recitativos", data.kpis.media_geral)}
      ${stat("Recitativos individuais", data.kpis.soma_individuais)}
      ${stat("Visitas totais no período", data.kpis.soma_visitas)}
    </div>
    <div class="chart-grid">
      <div class="card"><h2>Recitativos ao longo do tempo</h2><p class="subtitle">Total geral por data da reunião</p><div id="chart-tendencia"></div></div>
      <div class="card"><h2>Irmãs x Irmãos</h2><p class="subtitle">Soma por posição do recitativo</p><div id="chart-categorias"></div></div>
    </div>
    <div class="chart-grid">
      <div class="card"><h2>Individuais x Visitas</h2><p class="subtitle">Evolução por data da reunião</p><div id="chart-individuais"></div></div>
      <div class="card"><h2>Visitas mais recorrentes</h2><p class="subtitle">Igrejas/congregações que mais visitaram no período</p><div id="chart-visitas"></div></div>
    </div>
    <div class="card table-scroll" style="margin-top:16px;">
      <h2>Últimos registros do período</h2>
      ${dashboardTable(data.ultimos)}
    </div>
  `;
  setupDashboardFilters();
  mountCharts(data.dashboard_data);
}

function dashboardFilters(data, params) {
  const p = data.periodo;
  const localidade = data.filtros.localidade || "";
  const presidencia = data.filtros.presidencia || "";
  const link = (periodo) => `#dashboard?periodo=${periodo}&localidade=${encodeURIComponent(localidade)}&presidencia=${encodeURIComponent(presidencia)}`;
  return `
    <div class="filter-row">
      <a class="pill ${p.chave === "tudo" ? "ativo" : ""}" href="${link("tudo")}">Tudo</a>
      <a class="pill ${p.chave === "ano" ? "ativo" : ""}" href="${link("ano")}">Este ano</a>
      <form class="custom-range" data-filter-form>
        <input type="hidden" name="periodo" value="${escapeAttr(p.chave)}">
        <select name="presidencia">
          <option value="">Todos os irmãos na presidência</option>
          ${data.presidencias.map((nome) => `<option value="${escapeAttr(nome)}" ${nome === presidencia ? "selected" : ""}>${escapeHtml(nome)}</option>`).join("")}
        </select>
      </form>
      <form class="custom-range" data-filter-form>
        <input type="hidden" name="periodo" value="${escapeAttr(p.chave)}">
        <select name="localidade">
          <option value="">Todas as localidades</option>
          ${data.localidades.map((nome) => `<option value="${escapeAttr(nome)}" ${nome === localidade ? "selected" : ""}>${escapeHtml(nome)}</option>`).join("")}
        </select>
      </form>
      <form class="custom-range" id="range-form">
        <input type="hidden" name="periodo" value="personalizado">
        <input type="hidden" name="localidade" value="${escapeAttr(localidade)}">
        <input type="hidden" name="presidencia" value="${escapeAttr(presidencia)}">
        <input type="date" name="inicio" value="${p.chave === "personalizado" ? p.inicio : ""}" min="${data.limites.data_min_disponivel}" max="${data.limites.data_max_disponivel}" required>
        <span class="muted">até</span>
        <input type="date" name="fim" value="${p.chave === "personalizado" ? p.fim : ""}" min="${data.limites.data_min_disponivel}" max="${data.limites.data_max_disponivel}" required>
        <button type="submit" class="btn small ${p.chave === "personalizado" ? "primary" : ""}">Aplicar</button>
      </form>
    </div>
  `;
}

function setupDashboardFilters() {
  $$("[data-filter-form] select").forEach((select) => {
    select.addEventListener("change", () => {
      const params = new URLSearchParams(location.hash.split("?")[1] || "");
      params.set(select.name, select.value);
      if (!params.get("periodo")) params.set("periodo", "tudo");
      location.hash = `#dashboard?${params.toString()}`;
    });
  });
  $("#range-form").addEventListener("submit", (event) => {
    event.preventDefault();
    location.hash = `#dashboard?${new URLSearchParams(new FormData(event.currentTarget)).toString()}`;
  });
}

function mountCharts(dashboardData) {
  if (!window.CCBCharts) return;
  const cor = (i) => getComputedStyle(document.documentElement).getPropertyValue(`--series-${i + 1}`).trim();
  CCBCharts.renderLineChart($("#chart-tendencia"), {
    labels: dashboardData.tendencia.labels,
    datasCompletas: dashboardData.tendencia.datasCompletas,
    series: [{ name: "Total geral", color: cor(0), values: dashboardData.tendencia.valores }],
    stepY: 100,
    mostrarTendencia: true,
  });
  CCBCharts.renderPyramidChart($("#chart-categorias"), {
    esquerda: { nome: dashboardData.categorias.series[0].nome, cor: cor(0), valores: dashboardData.categorias.series[0].valores, labels: dashboardData.categorias.series[0].labels },
    direita: { nome: dashboardData.categorias.series[1].nome, cor: cor(1), valores: dashboardData.categorias.series[1].valores, labels: dashboardData.categorias.series[1].labels },
  });
  CCBCharts.renderLineChart($("#chart-individuais"), {
    labels: dashboardData.individuais_visitas.labels,
    datasCompletas: dashboardData.individuais_visitas.datasCompletas,
    series: dashboardData.individuais_visitas.series.map((s, i) => ({ name: s.nome, color: cor(i), values: s.valores })),
  });
  CCBCharts.renderHeatmap($("#chart-visitas"), {
    itens: dashboardData.visitas_recorrentes.labels.map((rotulo, i) => ({ rotulo, valor: dashboardData.visitas_recorrentes.valores[i] })),
  });
}

function setupDraft(form) {
  const key = draftKey(form);
  const banner = $("#rascunho-banner");
  const draft = localStorage.getItem(key);
  if (draft) banner.hidden = false;
  $("#rascunho-restaurar").addEventListener("click", () => {
    const data = JSON.parse(localStorage.getItem(key) || "{}");
    Object.entries(data).forEach(([name, value]) => {
      const el = form.elements[name];
      if (el) el.value = value;
    });
    banner.hidden = true;
    form.querySelectorAll("input, select").forEach((el) => {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
  $("#rascunho-descartar").addEventListener("click", () => {
    localStorage.removeItem(key);
    banner.hidden = true;
  });
  form.addEventListener("input", () => {
    const payload = Object.fromEntries(new FormData(form).entries());
    localStorage.setItem(key, JSON.stringify(payload));
    $("#rascunho-status").textContent = "Rascunho salvo neste aparelho";
  });
}

function defaultRegistro() {
  const r = Object.fromEntries(REGISTRO_COLUMNS.map((column) => [column, NUMERIC_COLUMNS.has(column) ? 0 : ""]));
  r.data = todayIso();
  r.local = DEFAULTS.local;
  r.estado = DEFAULTS.estado;
  r.cidade = DEFAULTS.cidade;
  r.pais = DEFAULTS.pais;
  return r;
}

function recLine(name, label, r, detailed = false) {
  return `
    <div class="recitativos-linha" ${detailed ? "data-linha-detalhada" : ""}>
      <label for="${name}">${label}</label>
      <input type="number" min="0" id="${name}" name="${name}" value="${number(r[name])}">
    </div>
  `;
}

function paisesOptions(selected) {
  return Object.entries(app.paises).map(([continente, lista]) => `
    <optgroup label="${escapeAttr(continente)}">
      ${lista.map((pais) => `<option value="${escapeAttr(pais)}" ${pais === selected ? "selected" : ""}>${escapeHtml(pais)}</option>`).join("")}
    </optgroup>
  `).join("");
}

function estadoOptions(selected) {
  return `<option value="">—</option>${Object.keys(app.localidades).map((uf) => `<option value="${escapeAttr(uf)}" ${uf === selected ? "selected" : ""}>${escapeHtml(uf)}</option>`).join("")}`;
}

function fillDatalist(selector, values) {
  const el = $(selector);
  if (!el) return;
  el.innerHTML = [...values].sort((a, b) => a.localeCompare(b, "pt-BR")).slice(0, 500).map((value) => `<option value="${escapeAttr(value)}"></option>`).join("");
}

function stat(label, value) {
  return `<div class="stat-tile"><div class="label">${escapeHtml(label)}</div><div class="value">${numeroBr(value)}</div></div>`;
}

function dashboardTable(rows) {
  if (!rows.length) return `<div class="empty-state">Nenhum registro no período selecionado.</div>`;
  return `
    <table class="data-table">
      <thead><tr><th>Data</th><th>Presidência</th><th class="num">Total geral</th><th class="num">Individuais</th><th>Visitas</th><th>Palavra</th></tr></thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td><a href="#editar/${r.id}">${dataBr(r.data)}</a></td>
            <td>${escapeHtml(r.presidencia || "—")}</td>
            <td class="num"><strong>${numeroBr(r.total_geral)}</strong></td>
            <td class="num">${numeroBr(r.individuais)}</td>
            <td>${escapeHtml(r.visitas || "—")}</td>
            <td>${escapeHtml(r.livro || "—")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "content-type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    if (response.status === 401 && !options.authOptional) {
      app.session = null;
      renderRoute();
    }
    throw new Error(data.erro || data || "Erro na requisição.");
  }
  return data;
}

function showFlash(text, category = "sucesso") {
  $("#flash-area").innerHTML = `<div class="flash ${category}">${escapeHtml(text)}</div>`;
}

function clearFlash() {
  $("#flash-area").innerHTML = "";
}

function parseVisitas(value) {
  return [...new Set(String(value || "").split(";").map((item) => item.trim()).filter(Boolean))];
}

function palavra(r) {
  if (!r.livro) return "—";
  const inteiro = r.versiculo && ["todos", "todo", "tudo", "inteiro", "completo"].includes(String(r.versiculo).toLowerCase());
  return `${escapeHtml(r.livro)} ${escapeHtml(r.capitulo || "")}${r.versiculo && !inteiro ? `:${escapeHtml(r.versiculo)}` : ""}`;
}

function draftKey(form) {
  return `ccb-bi-draft:${form.dataset.rascunhoChave}`;
}

function normalizar(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function number(value) {
  return parseInt(value || 0, 10) || 0;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dataBr(value) {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : value || "—";
}

function iconSvg(name, size = 16) {
  const icons = {
    "chevron-down": '<path d="M5 9l7 7 7-7"/>',
    "chevron-up": '<path d="M5 15l7-7 7 7"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.35-4.35"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  };
  return `<svg aria-hidden="true" class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ""}</svg>`;
}

function numeroBr(value) {
  return new Intl.NumberFormat("pt-BR").format(number(value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return [...document.querySelectorAll(selector)];
}
