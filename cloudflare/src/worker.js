const SESSION_COOKIE = "ccb_bi_session";
const SESSION_DAYS = 90;

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

const COLUNAS_MENINAS = ["meninas_1", "meninas_2", "meninas_3", "meninas_4", "meninas_5", "meninas_6"];
const COLUNAS_MENINOS = ["meninos_1", "meninos_2", "meninos_3", "meninos_4", "meninos_5", "meninos_6"];
const COLUNAS_GRAFICO_MENINAS = ["meninas_1", "meninas_2", "meninas_3", "meninas_4"];
const COLUNAS_GRAFICO_MENINOS = ["meninos_1", "meninos_2", "meninos_3", "meninos_4"];
const LABELS_MENINAS = ["Crianças", "Meninas", "Mocinhas", "Moças", "Auxiliares"];
const LABELS_MENINOS = ["Crianças", "Meninos", "Mocinhos", "Moços", "Auxiliares"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
    }

    try {
      return await routeApi(request, env, url);
    } catch (error) {
      console.error(error);
      return json({ erro: "Erro interno no servidor.", detalhe: String(error?.message || error) }, 500);
    }
  },
};

async function routeApi(request, env, url) {
  const path = url.pathname;
  if (path === "/api/session" && request.method === "GET") {
    return json({ session: await readSession(request, env) });
  }
  if (path === "/api/login" && request.method === "POST") return login(request, env);
  if (path === "/api/logout" && request.method === "POST") return logout();

  const session = await readSession(request, env);
  if (!session) return json({ erro: "Login obrigatório." }, 401);

  if (path === "/api/summary" && request.method === "GET") return summary(env);
  if (path === "/api/registros" && request.method === "GET") return listRegistros(env, url);
  if (path === "/api/registros" && request.method === "POST") return saveRegistro(request, env);
  if (path === "/api/dashboard" && request.method === "GET") {
    if (session.papel !== "cooperador") return json({ erro: "Acesso exclusivo do Cooperador de Jovens." }, 403);
    return dashboard(env, url);
  }
  if (path === "/api/export.sql" && request.method === "GET") {
    if (session.papel !== "cooperador") return json({ erro: "Acesso exclusivo do Cooperador de Jovens." }, 403);
    return exportSql(env);
  }

  const match = path.match(/^\/api\/registros\/(\d+)$/);
  if (match && request.method === "GET") return getRegistro(env, Number(match[1]));
  if (match && request.method === "PUT") return saveRegistro(request, env, Number(match[1]));
  if (match && request.method === "DELETE") {
    if (session.papel !== "cooperador") return json({ erro: "Só o Cooperador de Jovens pode excluir." }, 403);
    return deleteRegistro(env, Number(match[1]));
  }

  return json({ erro: "Rota não encontrada." }, 404);
}

async function login(request, env) {
  const body = await request.json().catch(() => ({}));
  const papel = String(body.papel || "");
  const senha = String(body.senha || "");
  const senhaCorreta = {
    cooperador: env.SENHA_COOPERADOR || "troque-esta-senha-1",
    contagem: env.SENHA_CONTAGEM || "troque-esta-senha-2",
  }[papel];

  if (!senhaCorreta || !senha || senha !== senhaCorreta) {
    return json({ erro: "Senha incorreta. Confira com a liderança e tente novamente." }, 401);
  }

  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const token = await signSession({ papel, exp: expires }, env);
  return json(
    { session: { papel, exp: expires } },
    200,
    { "Set-Cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}` },
  );
}

function logout() {
  return json({ ok: true }, 200, {
    "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  });
}

async function summary(env) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS total_registros, MAX(data) AS ultima_reuniao FROM registros",
  ).first();
  return json(row || { total_registros: 0, ultima_reuniao: null });
}

async function listRegistros(env, url) {
  const busca = (url.searchParams.get("busca") || "").trim();
  let sql = "SELECT * FROM registros";
  let params = [];
  if (busca) {
    sql += " WHERE data LIKE ? OR presidencia LIKE ? OR livro LIKE ? OR presidido_por LIKE ? OR local LIKE ? OR visitas LIKE ?";
    params = Array(6).fill(`%${busca}%`);
  }
  sql += " ORDER BY data DESC, id DESC";
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({ registros: (results || []).map(toViewRegistro), busca });
}

async function getRegistro(env, id) {
  const row = await env.DB.prepare("SELECT * FROM registros WHERE id = ?").bind(id).first();
  if (!row) return json({ erro: "Registro não encontrado." }, 404);
  return json({ registro: normalizeRegistro(row) });
}

async function saveRegistro(request, env, id = null) {
  const body = await request.json().catch(() => ({}));
  const data = normalizeRegistro(body);
  if (!data.data) return json({ erro: "Informe a data da reunião antes de salvar." }, 400);

  if (id) {
    const sets = REGISTRO_COLUMNS.map((column) => `${column} = ?`).join(", ");
    await env.DB.prepare(`UPDATE registros SET ${sets}, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(...REGISTRO_COLUMNS.map((column) => data[column]), id)
      .run();
    return json({ ok: true, id });
  }

  const columns = REGISTRO_COLUMNS.join(", ");
  const marks = REGISTRO_COLUMNS.map(() => "?").join(", ");
  const result = await env.DB.prepare(`INSERT INTO registros (${columns}) VALUES (${marks})`)
    .bind(...REGISTRO_COLUMNS.map((column) => data[column]))
    .run();
  return json({ ok: true, id: result.meta.last_row_id }, 201);
}

async function deleteRegistro(env, id) {
  await env.DB.prepare("DELETE FROM registros WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function dashboard(env, url) {
  const limites = await env.DB.prepare("SELECT MIN(data) AS minimo, MAX(data) AS maximo FROM registros").first();
  const today = todayIso();
  const dataMin = limites?.minimo || today;
  const dataMax = limites?.maximo || today;
  const periodo = periodFromParams(url, dataMin, dataMax, today);
  const localidade = (url.searchParams.get("localidade") || "").trim();
  const presidencia = (url.searchParams.get("presidencia") || "").trim();

  const { results } = await env.DB.prepare(
    `SELECT * FROM registros
     WHERE data BETWEEN ? AND ? AND (? = '' OR local = ?) AND (? = '' OR presidencia = ?)
     ORDER BY data ASC, id ASC`,
  ).bind(periodo.inicio, periodo.fim, localidade, localidade, presidencia, presidencia).all();

  const rows = (results || []).map(normalizeRegistro);
  const qtd = rows.length;
  const somaGeral = rows.reduce((acc, row) => acc + totalGeral(row), 0);
  const somaIndividuais = rows.reduce((acc, row) => acc + number(row.recitativos_individuais), 0);
  const somaVisitas = rows.reduce((acc, row) => acc + listaVisitas(row.visitas).length, 0);

  const porData = {};
  const porDataExtra = {};
  const meninasPos = Array(COLUNAS_GRAFICO_MENINAS.length).fill(0);
  const meninosPos = Array(COLUNAS_GRAFICO_MENINOS.length).fill(0);
  const contagemVisitas = {};

  for (const row of rows) {
    porData[row.data] ||= { meninas: 0, meninos: 0 };
    porData[row.data].meninas += totalMeninas(row);
    porData[row.data].meninos += totalMeninos(row);
    porDataExtra[row.data] ||= { individuais: 0, visitas: 0 };
    porDataExtra[row.data].individuais += number(row.recitativos_individuais);
    const visitas = listaVisitas(row.visitas);
    porDataExtra[row.data].visitas += visitas.length;
    visitas.forEach((nome) => { contagemVisitas[nome] = (contagemVisitas[nome] || 0) + 1; });
    COLUNAS_GRAFICO_MENINAS.forEach((column, i) => { meninasPos[i] += number(row[column]); });
    COLUNAS_GRAFICO_MENINOS.forEach((column, i) => { meninosPos[i] += number(row[column]); });
  }
  meninasPos.push(rows.reduce((acc, row) => acc + number(row.auxiliares_femininos), 0));
  meninosPos.push(rows.reduce((acc, row) => acc + number(row.auxiliares_masculinos), 0));

  const datas = Object.keys(porData).sort();
  const rankingVisitas = Object.entries(contagemVisitas).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const localidades = await distinct(env, "local");
  const presidencias = await distinct(env, "presidencia");

  return json({
    periodo,
    filtros: { localidade, presidencia },
    limites: { data_min_disponivel: dataMin, data_max_disponivel: minIso(dataMax, today), hoje: today },
    localidades,
    presidencias,
    kpis: {
      qtd_reunioes: qtd,
      soma_geral: somaGeral,
      media_geral: qtd ? Math.round(somaGeral / qtd) : 0,
      soma_individuais: somaIndividuais,
      soma_visitas: somaVisitas,
    },
    dashboard_data: {
      tendencia: {
        labels: datas.map(dataCurta),
        datasCompletas: datas.map(dataBr),
        valores: datas.map((data) => porData[data].meninas + porData[data].meninos),
      },
      categorias: {
        series: [
          { nome: "Irmãs", valores: meninasPos, labels: LABELS_MENINAS },
          { nome: "Irmãos", valores: meninosPos, labels: LABELS_MENINOS },
        ],
      },
      individuais_visitas: {
        labels: datas.map(dataCurta),
        datasCompletas: datas.map(dataBr),
        series: [
          { nome: "Recitativos individuais", valores: datas.map((data) => porDataExtra[data].individuais) },
          { nome: "Visitas", valores: datas.map((data) => porDataExtra[data].visitas) },
        ],
      },
      visitas_recorrentes: {
        labels: rankingVisitas.map(([nome]) => nome),
        valores: rankingVisitas.map(([, valor]) => valor),
      },
    },
    ultimos: rows.slice(-8).reverse().map((row) => ({
      id: row.id,
      data: row.data,
      presidencia: row.presidencia,
      total_geral: totalGeral(row),
      individuais: number(row.recitativos_individuais),
      visitas: listaVisitas(row.visitas).join(", "),
      livro: row.livro,
    })),
  });
}

async function exportSql(env) {
  const { results } = await env.DB.prepare("SELECT * FROM registros ORDER BY id").all();
  const allColumns = ["id", ...REGISTRO_COLUMNS, "criado_em", "atualizado_em"];
  const lines = [
    "-- Backup gerado pelo BI CCB online.",
    "DELETE FROM registros;",
    ...(results || []).map((row) => `INSERT INTO registros (${allColumns.join(", ")}) VALUES (${allColumns.map((column) => sqlValue(row[column])).join(", ")});`),
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "application/sql; charset=utf-8",
      "content-disposition": `attachment; filename="ccb-bi-backup-${todayIso()}.sql"`,
    },
  });
}

async function distinct(env, column) {
  const { results } = await env.DB.prepare(`SELECT DISTINCT ${column} AS valor FROM registros WHERE ${column} IS NOT NULL AND ${column} <> '' ORDER BY ${column}`).all();
  return (results || []).map((row) => row.valor);
}

function normalizeRegistro(input) {
  const out = {};
  for (const column of REGISTRO_COLUMNS) {
    if (NUMERIC_COLUMNS.has(column)) out[column] = Math.max(0, parseInt(input[column] ?? 0, 10) || 0);
    else out[column] = String(input[column] ?? "").trim();
  }
  out.pais ||= "Brasil";
  out.visitas = textoVisitas(String(out.visitas || "").split(";"));
  if ("id" in input) out.id = number(input.id);
  if ("criado_em" in input) out.criado_em = input.criado_em;
  if ("atualizado_em" in input) out.atualizado_em = input.atualizado_em;
  return out;
}

function toViewRegistro(row) {
  const normalized = normalizeRegistro(row);
  return {
    ...normalized,
    total_meninas: totalMeninas(normalized),
    total_meninos: totalMeninos(normalized),
    total_geral: totalGeral(normalized),
    visitas_lista: listaVisitas(normalized.visitas),
  };
}

function totalMeninas(row) {
  return COLUNAS_MENINAS.reduce((acc, column) => acc + number(row[column]), 0) + number(row.auxiliares_femininos);
}

function totalMeninos(row) {
  return COLUNAS_MENINOS.reduce((acc, column) => acc + number(row[column]), 0) + number(row.auxiliares_masculinos);
}

function totalGeral(row) {
  return totalMeninas(row) + totalMeninos(row);
}

function listaVisitas(value) {
  return String(value || "").split(";").map((item) => item.trim()).filter(Boolean);
}

function textoVisitas(values) {
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))].join("; ");
}

function periodFromParams(url, dataMin, dataMax, today) {
  const chave = url.searchParams.get("periodo") || "ano";
  if (chave === "personalizado") {
    let inicio = clampIso(url.searchParams.get("inicio") || dataMin, dataMin, minIso(dataMax, today));
    let fim = clampIso(url.searchParams.get("fim") || minIso(dataMax, today), dataMin, minIso(dataMax, today));
    if (fim < inicio) [inicio, fim] = [fim, inicio];
    return { inicio, fim, rotulo: "Personalizado", chave };
  }
  if (chave === "tudo") return { inicio: "0000-01-01", fim: "9999-12-31", rotulo: "Todo o histórico", chave };
  if (chave === "ano") return { inicio: `${today.slice(0, 4)}-01-01`, fim: today, rotulo: "Este ano", chave };
  const days = parseInt(chave, 10);
  if (!Number.isFinite(days)) return { inicio: `${today.slice(0, 4)}-01-01`, fim: today, rotulo: "Este ano", chave: "ano" };
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days);
  return { inicio: start.toISOString().slice(0, 10), fim: today, rotulo: `Últimos ${days} dias`, chave };
}

async function readSession(request, env) {
  try {
    const token = parseCookies(request.headers.get("Cookie") || "")[SESSION_COOKIE];
    if (!token) return null;
    const [payload64, signature] = token.split(".");
    if (!payload64 || !signature) return null;
    const expected = await hmac(payload64, sessionSecret(env));
    if (signature !== expected) return null;
    const payload = JSON.parse(textDecoder().decode(base64UrlDecode(payload64)));
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (!["cooperador", "contagem"].includes(payload.papel)) return null;
    return { papel: payload.papel, exp: payload.exp };
  } catch {
    return null;
  }
}

async function signSession(payload, env) {
  const payload64 = base64UrlEncode(textEncoder().encode(JSON.stringify(payload)));
  const signature = await hmac(payload64, sessionSecret(env));
  return `${payload64}.${signature}`;
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

function sessionSecret(env) {
  return env.SESSION_SECRET || "dev-only-change-me";
}

function parseCookies(header) {
  return Object.fromEntries(header.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function number(value) {
  return parseInt(value ?? 0, 10) || 0;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dataCurta(value) {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}/${month}` : value;
}

function dataBr(value) {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function minIso(a, b) {
  return a < b ? a : b;
}

function clampIso(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function base64UrlEncode(bytes) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function textEncoder() {
  return new TextEncoder();
}

function textDecoder() {
  return new TextDecoder();
}
