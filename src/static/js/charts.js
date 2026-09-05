/* ==========================================================================
   CCBCharts — mini biblioteca de gráficos SVG, sem dependências externas.
   Segue os padrões: cor categórica fixa, eixo único, grade "hairline"
   recessiva, marcas finas com pontas arredondadas, legenda a partir de
   2 séries, tooltip/crosshair no hover.
   ========================================================================== */
(function (global) {
  const NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs || {}) node.setAttribute(k, attrs[k]);
    return node;
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  let _medidorCtx = null;
  function medirTexto(texto, fonte) {
    if (!_medidorCtx) _medidorCtx = document.createElement("canvas").getContext("2d");
    _medidorCtx.font = fonte;
    return _medidorCtx.measureText(texto).width;
  }

  // Encurta um rótulo com "…" até caber em maxWidth; o nome completo sempre
  // continua disponível no tooltip ao passar o mouse — nunca some de vez.
  function truncarRotulo(texto, maxWidth, fonte) {
    if (medirTexto(texto, fonte) <= maxWidth) return texto;
    let cortado = texto;
    while (cortado.length > 1 && medirTexto(cortado + "…", fonte) > maxWidth) {
      cortado = cortado.slice(0, -1);
    }
    return cortado + "…";
  }

  function niceMax(value) {
    if (value <= 0) return 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const norm = value / magnitude;
    let step;
    if (norm <= 1) step = 1;
    else if (norm <= 2) step = 2;
    else if (norm <= 5) step = 5;
    else step = 10;
    return step * magnitude;
  }

  function niceTicks(max, count) {
    const top = niceMax(max);
    const ticks = [];
    for (let i = 0; i <= count; i++) {
      ticks.push(Math.round((top / count) * i));
    }
    return ticks;
  }

  function formatNum(v) {
    return new Intl.NumberFormat("pt-BR").format(v);
  }

  function ensureTooltip(container) {
    let tip = container.querySelector(".viz-tooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "viz-tooltip";
      container.style.position = "relative";
      container.appendChild(tip);
    }
    return tip;
  }

  function showTooltip(container, tip, x, y, rowsHtml) {
    tip.innerHTML = "";
    rowsHtml.forEach((row) => {
      const line = document.createElement("div");
      if (row.color) {
        const key = document.createElement("span");
        key.style.display = "inline-block";
        key.style.width = "8px";
        key.style.height = "2px";
        key.style.background = row.color;
        key.style.marginRight = "6px";
        key.style.verticalAlign = "middle";
        line.appendChild(key);
      }
      const strong = document.createElement("strong");
      strong.textContent = row.value;
      line.appendChild(strong);
      const muted = document.createElement("span");
      muted.className = "muted";
      muted.textContent = row.label;
      line.appendChild(muted);
      tip.appendChild(line);
    });
    tip.style.left = x + "px";
    tip.style.top = y + "px";
    tip.classList.add("visivel");
  }

  function hideTooltip(tip) {
    tip.classList.remove("visivel");
  }

  function buildLegend(container, series) {
    if (series.length < 2) return;
    const legend = document.createElement("div");
    legend.className = "legend";
    series.forEach((s) => {
      const item = document.createElement("span");
      item.className = "item";
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = s.color;
      const label = document.createElement("span");
      label.textContent = s.name;
      item.appendChild(swatch);
      item.appendChild(label);
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }

  function topRoundedPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    if (h <= 0) return `M ${x} ${y + h} L ${x + w} ${y + h} Z`;
    return [
      `M ${x} ${y + h}`,
      `L ${x} ${y + r}`,
      `Q ${x} ${y} ${x + r} ${y}`,
      `L ${x + w - r} ${y}`,
      `Q ${x + w} ${y} ${x + w} ${y + r}`,
      `L ${x + w} ${y + h}`,
      `Z`,
    ].join(" ");
  }

  function rightRoundedPath(x, y, w, h, r) {
    r = Math.min(r, h / 2, Math.max(w, 1));
    if (w <= 0) return `M ${x} ${y} L ${x} ${y + h} Z`;
    return [
      `M ${x} ${y}`,
      `L ${x + w - r} ${y}`,
      `Q ${x + w} ${y} ${x + w} ${y + r}`,
      `L ${x + w} ${y + h - r}`,
      `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
      `L ${x} ${y + h}`,
      `Z`,
    ].join(" ");
  }

  function leftRoundedPath(x, y, w, h, r) {
    r = Math.min(r, h / 2, Math.max(w, 1));
    if (w <= 0) return `M ${x} ${y} L ${x} ${y + h} Z`;
    return [
      `M ${x + w} ${y}`,
      `L ${x + r} ${y}`,
      `Q ${x} ${y} ${x} ${y + r}`,
      `L ${x} ${y + h - r}`,
      `Q ${x} ${y + h} ${x + r} ${y + h}`,
      `L ${x + w} ${y + h}`,
      `Z`,
    ].join(" ");
  }

  // ------------------------------------------------------------------ line
  function renderLineChart(container, opts) {
    container.innerHTML = "";
    const labels = opts.labels || [];
    const series = opts.series || [];
    const height = opts.height || 230;

    if (!labels.length || series.every((s) => s.values.every((v) => !v))) {
      container.innerHTML = '<div class="empty-state">Sem dados no período selecionado.</div>';
      return;
    }

    const width = Math.max(container.clientWidth || 560, 280);
    const padL = 40, padR = 16, padT = 14, padB = 26;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const maxVal = Math.max(1, ...series.flatMap((s) => s.values));
    const ticks = niceTicks(maxVal, 4);
    const top = ticks[ticks.length - 1];

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img" });

    const xFor = (i) => (labels.length === 1 ? padL + plotW / 2 : padL + (plotW * i) / (labels.length - 1));
    const yFor = (v) => padT + plotH - (plotH * v) / top;

    // grade horizontal + rótulos do eixo Y
    ticks.forEach((t) => {
      const y = yFor(t);
      svg.appendChild(el("line", { x1: padL, x2: padL + plotW, y1: y, y2: y, stroke: cssVar("--grid-line"), "stroke-width": 1 }));
      const label = el("text", { x: padL - 8, y: y + 4, "text-anchor": "end", fill: cssVar("--text-muted"), "font-size": 11 });
      label.textContent = formatNum(t);
      svg.appendChild(label);
    });
    // linha de base
    svg.appendChild(el("line", { x1: padL, x2: padL + plotW, y1: padT + plotH, y2: padT + plotH, stroke: cssVar("--axis-line"), "stroke-width": 1 }));

    // rótulos do eixo X — distribuídos em espaçamento uniforme (sempre
    // incluindo o primeiro e o último) em vez de "a cada N", que deixava
    // sobra apertada no final e dois rótulos colados um no outro.
    const maxLabels = Math.max(2, Math.floor(plotW / 46));
    const qtdRotulos = Math.min(labels.length, maxLabels);
    const indicesRotulos = new Set();
    for (let k = 0; k < qtdRotulos; k++) {
      indicesRotulos.add(Math.round((k * (labels.length - 1)) / Math.max(1, qtdRotulos - 1)));
    }
    labels.forEach((lab, i) => {
      if (!indicesRotulos.has(i)) return;
      const t = el("text", { x: xFor(i), y: height - 6, "text-anchor": "middle", fill: cssVar("--text-muted"), "font-size": 11 });
      t.textContent = lab;
      svg.appendChild(t);
    });

    // área pintada sob cada série (a "base") + a linha por cima
    series.forEach((s) => {
      const pts = s.values.map((v, i) => [xFor(i), yFor(v)]);
      const areaPath = ["M", pts[0][0], padT + plotH, ...pts.flatMap((p) => ["L", p[0], p[1]]), "L", pts[pts.length - 1][0], padT + plotH, "Z"].join(" ");
      svg.appendChild(el("path", { d: areaPath, fill: s.color, opacity: 0.1 }));
      const linePath = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + " " + p[1]).join(" ");
      svg.appendChild(el("path", { d: linePath, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }));
      const last = pts[pts.length - 1];
      svg.appendChild(el("circle", { cx: last[0], cy: last[1], r: 5, fill: s.color, stroke: cssVar("--surface-1"), "stroke-width": 2 }));
    });

    // crosshair + tooltip
    const crosshair = el("line", { x1: 0, x2: 0, y1: padT, y2: padT + plotH, stroke: cssVar("--axis-line"), "stroke-width": 1, opacity: 0 });
    svg.appendChild(crosshair);
    const hitLayer = el("rect", { x: padL, y: padT, width: plotW, height: plotH, fill: "transparent", cursor: "crosshair" });
    svg.appendChild(hitLayer);

    container.appendChild(svg);
    const tip = ensureTooltip(container);

    function updateAt(i) {
      const x = xFor(i);
      crosshair.setAttribute("x1", x);
      crosshair.setAttribute("x2", x);
      crosshair.setAttribute("opacity", 1);
      const rows = series.map((s) => ({ color: s.color, value: formatNum(s.values[i]), label: s.name }));
      showTooltip(container, tip, x, yFor(Math.max(...series.map((s) => s.values[i]))) - 10, rows);
    }

    hitLayer.addEventListener("pointermove", (e) => {
      const rect = svg.getBoundingClientRect();
      const scale = width / rect.width;
      const relX = (e.clientX - rect.left) * scale;
      let i = Math.round(((relX - padL) / plotW) * (labels.length - 1));
      i = Math.max(0, Math.min(labels.length - 1, i));
      updateAt(i);
    });
    hitLayer.addEventListener("pointerleave", () => {
      crosshair.setAttribute("opacity", 0);
      hideTooltip(tip);
    });

    buildLegend(container, series);
  }

  // -------------------------------------------------------------- pirâmide
  // Gráfico "pirâmide etária": duas séries em espelho (uma pra cada lado),
  // com a categoria no meio — mesma escala nos dois lados pra comparação ser
  // honesta — e o percentual de cada lado exibido acima do gráfico.
  function renderPyramidChart(container, opts) {
    container.innerHTML = "";
    const labels = opts.labels || [];
    const esquerda = opts.esquerda || { nome: "", cor: "", valores: [] };
    const direita = opts.direita || { nome: "", cor: "", valores: [] };

    const hasData = labels.length && (esquerda.valores.some((v) => v) || direita.valores.some((v) => v));
    if (!hasData) {
      container.innerHTML = '<div class="empty-state">Sem dados no período selecionado.</div>';
      return;
    }

    // ---- resumo de percentual acima do gráfico ----
    const totalEsq = esquerda.valores.reduce((a, b) => a + b, 0);
    const totalDir = direita.valores.reduce((a, b) => a + b, 0);
    const totalGeral = totalEsq + totalDir;
    const pctEsq = totalGeral ? Math.round((1000 * totalEsq) / totalGeral) / 10 : 0;
    const pctDir = totalGeral ? Math.round((1000 * totalDir) / totalGeral) / 10 : 0;

    // O nome de cada lado (Meninas/Meninos) já entra aqui, junto com a
    // bolinha de cor — por isso não repetimos a mesma bolinha numa legenda
    // separada embaixo do gráfico (era redundante: duas bolinhas para o
    // mesmo par de séries).
    const resumo = document.createElement("div");
    resumo.className = "piramide-resumo";
    [[esquerda, pctEsq, totalEsq], [direita, pctDir, totalDir]].forEach(([serie, pct, total]) => {
      const item = document.createElement("div");
      item.className = "piramide-resumo-item";
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = serie.cor;
      const texto = document.createElement("span");
      texto.className = "piramide-resumo-texto";
      const nome = document.createElement("span");
      nome.className = "nome";
      nome.textContent = serie.nome;
      const valores = document.createElement("span");
      valores.className = "valores";
      const valor = document.createElement("strong");
      valor.textContent = `${pct}%`;
      valores.appendChild(valor);
      const totalEl = document.createElement("span");
      totalEl.className = "muted";
      totalEl.textContent = ` (${formatNum(total)})`;
      valores.appendChild(totalEl);
      texto.appendChild(nome);
      texto.appendChild(valores);
      item.appendChild(swatch);
      item.appendChild(texto);
      resumo.appendChild(item);
    });
    container.appendChild(resumo);

    const chartEl = document.createElement("div");
    container.appendChild(chartEl);

    const width = Math.max(container.clientWidth || 560, 280);
    const rowH = 40;
    const height = labels.length * rowH + 20;
    const padT = 10, padB = 10;
    // sem rótulo no meio — só um respiro entre os dois lados (a legenda e o
    // subtítulo do cartão já dizem qual é cada posição).
    const gutter = 16;
    const sidePad = 30; // só o respiro mínimo pro rótulo do valor (2-3 dígitos)
    const plotH = height - padT - padB;
    const centerX = width / 2;
    const halfWidth = width / 2 - gutter / 2 - sidePad;

    const maxVal = Math.max(1, ...esquerda.valores, ...direita.valores);
    // escala direto no maior valor (sem "arredondar pra cima" como nos eixos
    // numéricos) — a barra mais longa ocupa ~85% da metade do gráfico,
    // deixando uns 15% de respiro pro rótulo do valor.
    const escala = (halfWidth * 0.85) / maxVal;

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img" });
    const tip = ensureTooltip(chartEl);

    labels.forEach((lab, i) => {
      const y = padT + i * rowH;
      const barH = Math.min(24, rowH - 14);
      const barY = y + (rowH - barH) / 2;

      const valEsq = esquerda.valores[i] || 0;
      const valDir = direita.valores[i] || 0;
      const wEsq = valEsq * escala;
      const wDir = valDir * escala;
      const axisEsq = centerX - gutter / 2;
      const axisDir = centerX + gutter / 2;

      const pathEsq = el("path", { d: leftRoundedPath(axisEsq - wEsq, barY, wEsq, barH, 4), fill: esquerda.cor });
      const pathDir = el("path", { d: rightRoundedPath(axisDir, barY, wDir, barH, 4), fill: direita.cor });
      svg.appendChild(pathEsq);
      svg.appendChild(pathDir);

      const labelEsq = el("text", { x: axisEsq - wEsq - 8, y: barY + barH / 1.5, "text-anchor": "end", fill: cssVar("--text-primary"), "font-size": 12, "font-weight": 700 });
      labelEsq.textContent = formatNum(valEsq);
      svg.appendChild(labelEsq);

      const labelDir = el("text", { x: axisDir + wDir + 8, y: barY + barH / 1.5, "text-anchor": "start", fill: cssVar("--text-primary"), "font-size": 12, "font-weight": 700 });
      labelDir.textContent = formatNum(valDir);
      svg.appendChild(labelDir);

      const hit = el("rect", { x: 0, y, width, height: rowH, fill: "transparent", cursor: "default" });
      hit.addEventListener("pointerenter", () => { pathEsq.setAttribute("opacity", 0.82); pathDir.setAttribute("opacity", 0.82); });
      hit.addEventListener("pointerleave", () => { pathEsq.setAttribute("opacity", 1); pathDir.setAttribute("opacity", 1); hideTooltip(tip); });
      hit.addEventListener("pointermove", (e) => {
        const rect = chartEl.getBoundingClientRect();
        showTooltip(chartEl, tip, e.clientX - rect.left, e.clientY - rect.top - 14, [
          { color: esquerda.cor, value: formatNum(valEsq), label: `${esquerda.nome} · ${lab}` },
          { color: direita.cor, value: formatNum(valDir), label: `${direita.nome} · ${lab}` },
        ]);
      });
      svg.appendChild(hit);
    });

    chartEl.appendChild(svg);
  }

  // ------------------------------------------------------------------- bar
  function renderBarChart(container, opts) {
    container.innerHTML = "";
    const labels = opts.labels || [];
    const series = opts.series || [];
    const horizontal = !!opts.horizontal;
    const heightOpt = opts.height;

    const hasData = labels.length && series.some((s) => s.values.some((v) => v));
    if (!hasData) {
      container.innerHTML = '<div class="empty-state">Sem dados no período selecionado.</div>';
      return;
    }

    const width = Math.max(container.clientWidth || 560, 280);
    const maxVal = Math.max(1, ...series.flatMap((s) => s.values));
    const ticks = niceTicks(maxVal, 4);
    const top = ticks[ticks.length - 1];

    const tip = ensureTooltip(container);

    if (horizontal) {
      const rowH = 30;
      const height = heightOpt || labels.length * rowH + 20;
      const padR = 40, padT = 10, padB = 10;
      const fonteRotulo = "12px system-ui, -apple-system, sans-serif";
      // a coluna de rótulos cresce pro nome mais longo, mas nunca passa de
      // ~42% da largura — o que não couber ali é encurtado com "…" (o nome
      // completo continua no tooltip ao passar o mouse, nunca some de vez).
      const maiorRotulo = Math.max(...labels.map((l) => medirTexto(l, fonteRotulo)));
      const padL = Math.min(Math.max(70, Math.ceil(maiorRotulo) + 22), Math.round(width * 0.42));
      const plotW = width - padL - padR;
      const plotH = height - padT - padB;
      const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img" });
      const xFor = (v) => (plotW * v) / top;

      labels.forEach((lab, i) => {
        const y = padT + i * (plotH / labels.length);
        const bandH = plotH / labels.length;
        const barH = Math.min(22, bandH - 8);
        const barY = y + (bandH - barH) / 2;
        const val = series[0].values[i];
        const barW = Math.max(2, xFor(val));

        const label = el("text", { x: padL - 10, y: barY + barH / 1.5, "text-anchor": "end", fill: cssVar("--text-secondary"), "font-size": 12 });
        label.textContent = truncarRotulo(lab, padL - 18, fonteRotulo);
        svg.appendChild(label);

        const path = el("path", { d: rightRoundedPath(padL, barY, barW, barH, 4), fill: series[0].color });
        svg.appendChild(path);

        const valLabel = el("text", { x: padL + barW + 8, y: barY + barH / 1.5, "text-anchor": "start", fill: cssVar("--text-primary"), "font-size": 12, "font-weight": 700 });
        valLabel.textContent = formatNum(val);
        svg.appendChild(valLabel);

        const hit = el("rect", { x: padL, y: y, width: plotW, height: bandH, fill: "transparent", cursor: "pointer" });
        hit.addEventListener("pointerenter", () => path.setAttribute("opacity", 0.82));
        hit.addEventListener("pointerleave", () => { path.setAttribute("opacity", 1); hideTooltip(tip); });
        hit.addEventListener("pointermove", (e) => {
          const rect = container.getBoundingClientRect();
          showTooltip(container, tip, e.clientX - rect.left, e.clientY - rect.top - 14, [{ color: series[0].color, value: formatNum(val), label: lab }]);
        });
        svg.appendChild(hit);
      });

      container.appendChild(svg);
      return;
    }

    // ----- gráfico de colunas verticais (agrupado) -----
    const height = heightOpt || 240;
    const padL = 36, padR = 12, padT = 14, padB = 30;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img" });

    const yFor = (v) => padT + plotH - (plotH * v) / top;

    ticks.forEach((t) => {
      const y = yFor(t);
      svg.appendChild(el("line", { x1: padL, x2: padL + plotW, y1: y, y2: y, stroke: cssVar("--grid-line"), "stroke-width": 1 }));
      const label = el("text", { x: padL - 8, y: y + 4, "text-anchor": "end", fill: cssVar("--text-muted"), "font-size": 11 });
      label.textContent = formatNum(t);
      svg.appendChild(label);
    });
    svg.appendChild(el("line", { x1: padL, x2: padL + plotW, y1: padT + plotH, y2: padT + plotH, stroke: cssVar("--axis-line"), "stroke-width": 1 }));

    const bandW = plotW / labels.length;
    const maxBar = 24;
    const groupPad = 10;
    const barW = Math.min(maxBar, (bandW - groupPad * 2) / series.length - 2);

    labels.forEach((lab, i) => {
      const bandX = padL + i * bandW;
      const groupW = barW * series.length + 2 * (series.length - 1);
      const groupX = bandX + (bandW - groupW) / 2;

      series.forEach((s, si) => {
        const val = s.values[i];
        const barH = (plotH * val) / top;
        const x = groupX + si * (barW + 2);
        const y = padT + plotH - barH;
        const path = el("path", { d: topRoundedPath(x, y, barW, barH, 4), fill: s.color });
        svg.appendChild(path);

        const hit = el("rect", { x: x - 1, y: padT, width: barW + 2, height: plotH, fill: "transparent", cursor: "pointer" });
        hit.addEventListener("pointerenter", () => path.setAttribute("opacity", 0.82));
        hit.addEventListener("pointerleave", () => { path.setAttribute("opacity", 1); hideTooltip(tip); });
        hit.addEventListener("pointermove", (e) => {
          const rect = container.getBoundingClientRect();
          showTooltip(container, tip, e.clientX - rect.left, e.clientY - rect.top - 14, [{ color: s.color, value: formatNum(val), label: `${s.name} · ${lab}` }]);
        });
        svg.appendChild(hit);
      });

      const t = el("text", { x: bandX + bandW / 2, y: height - 8, "text-anchor": "middle", fill: cssVar("--text-muted"), "font-size": 11 });
      t.textContent = lab;
      svg.appendChild(t);
    });

    container.appendChild(svg);
    buildLegend(container, series);
  }

  // --------------------------------------------------------------- heatmap
  // Ranking em formato de mapa de calor: um bloco por item, cor mais forte
  // = valor mais alto (escala sequencial de um hue só, igual à do resto do
  // BI). Sem hover/clique — o valor já fica escrito no próprio bloco.
  const ESCALA_SEQUENCIAL = [
    { fundo: "#cde2fb", texto: "escuro" },
    { fundo: "#9ec5f4", texto: "escuro" },
    { fundo: "#6da7ec", texto: "escuro" },
    { fundo: "#3987e5", texto: "claro" },
    { fundo: "#256abf", texto: "claro" },
    { fundo: "#184f95", texto: "claro" },
    { fundo: "#0d366b", texto: "claro" },
  ];

  function renderHeatmap(container, opts) {
    container.innerHTML = "";
    const itens = opts.itens || []; // [{ rotulo, valor }]

    if (!itens.length) {
      container.innerHTML = '<div class="empty-state">Sem dados no período selecionado.</div>';
      return;
    }

    const valores = itens.map((i) => i.valor);
    const minVal = Math.min(...valores);
    const maxVal = Math.max(...valores);

    const grade = document.createElement("div");
    grade.className = "heatmap-grade";

    itens.forEach((item) => {
      const t = maxVal === minVal ? 1 : (item.valor - minVal) / (maxVal - minVal);
      const passo = ESCALA_SEQUENCIAL[Math.round(t * (ESCALA_SEQUENCIAL.length - 1))];

      const bloco = document.createElement("div");
      bloco.className = "heatmap-bloco";
      bloco.style.background = passo.fundo;
      bloco.style.color = passo.texto === "claro" ? "#ffffff" : cssVar("--text-primary");
      bloco.style.cursor = "default";

      const valor = document.createElement("div");
      valor.className = "heatmap-valor";
      valor.textContent = formatNum(item.valor);

      const rotulo = document.createElement("div");
      rotulo.className = "heatmap-rotulo";
      rotulo.textContent = item.rotulo;

      bloco.appendChild(valor);
      bloco.appendChild(rotulo);
      grade.appendChild(bloco);
    });

    container.appendChild(grade);
  }

  global.CCBCharts = { renderLineChart, renderBarChart, renderPyramidChart, renderHeatmap };
})(window);
