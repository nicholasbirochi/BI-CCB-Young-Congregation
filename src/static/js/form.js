// Formulário de registro: soma dos totais, seleção em cascata de
// Livro -> Capítulo -> Versículo (só permite combinações que existem de
// verdade) e rascunho automático neste aparelho (localStorage), para não
// perder o preenchimento se a pessoa precisar sair no meio do culto.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form[data-rascunho-chave]");
  if (!form) return;

  const campo = (nome) => form.querySelector(`[name="${nome}"]`);

  // ------------------------------------------------------ totais dos recitativos
  const camposMeninas = ["meninas_1", "meninas_2", "meninas_3", "meninas_4", "meninas_5"];
  const camposMeninos = ["meninos_1", "meninos_2", "meninos_3", "meninos_4", "meninos_5"];

  function soma(nomes) {
    return nomes.reduce((acc, nome) => {
      const el = campo(nome);
      const v = el ? parseInt(el.value, 10) : 0;
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
  }

  function atualizarTotais() {
    const totalMeninas = soma(camposMeninas);
    const totalMeninos = soma(camposMeninos);
    const elMeninas = document.getElementById("total-meninas");
    const elMeninos = document.getElementById("total-meninos");
    const elGeral = document.getElementById("total-geral");
    if (elMeninas) elMeninas.textContent = totalMeninas;
    if (elMeninos) elMeninos.textContent = totalMeninos;
    if (elGeral) elGeral.textContent = totalMeninas + totalMeninos;
  }

  [...camposMeninas, ...camposMeninos].forEach((nome) => {
    const el = campo(nome);
    if (el) el.addEventListener("input", atualizarTotais);
  });
  atualizarTotais();

  // ------------------------------------------------- cascata Livro > Capítulo > Versículo
  const BIBLIA = window.BIBLIA_ESTRUTURA || {};
  const registroAtual = window.REGISTRO_ATUAL || {};
  const selLivro = document.getElementById("livro");
  const selCapitulo = document.getElementById("capitulo");
  const selVersiculo = document.getElementById("versiculo");

  function popularOpcoes(select, quantidade, valorSelecionado) {
    select.innerHTML = "";
    const optVazia = document.createElement("option");
    optVazia.value = "";
    optVazia.textContent = quantidade ? "Selecione..." : "—";
    select.appendChild(optVazia);
    for (let i = 1; i <= quantidade; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      if (String(valorSelecionado) === String(i)) opt.selected = true;
      select.appendChild(opt);
    }
    select.disabled = quantidade === 0;
  }

  function aoMudarCapitulo(valorVersiculoDesejado) {
    const capitulos = BIBLIA[selLivro.value] || [];
    const capSelecionado = parseInt(selCapitulo.value, 10);
    const totalVersiculos = capitulos[capSelecionado - 1] || 0;
    popularOpcoes(selVersiculo, totalVersiculos, valorVersiculoDesejado);
  }

  function aoMudarLivro(valorCapituloDesejado, valorVersiculoDesejado) {
    const capitulos = BIBLIA[selLivro.value] || [];
    popularOpcoes(selCapitulo, capitulos.length, valorCapituloDesejado);
    aoMudarCapitulo(valorVersiculoDesejado);
  }

  if (selLivro && selCapitulo && selVersiculo) {
    selLivro.addEventListener("change", () => aoMudarLivro());
    selCapitulo.addEventListener("change", () => aoMudarCapitulo());
    // Estado inicial: preenche capítulo/versículo se já vier de um registro existente.
    aoMudarLivro(registroAtual.capitulo, registroAtual.versiculo);
  }

  // ------------------------------------------- Local/Congregação -> Estado/Cidade
  // Quem manda agora é o Local: Estado e Cidade só retratam onde ele fica e
  // ficam sempre desabilitados (não dá pra "destravar" e escolher um estado
  // que não bate com o que foi digitado no Local — evita os dois campos
  // saírem dessincronizados). A base usada pra descobrir o estado a partir
  // da cidade é a mesma baixada do diretório oficial da CCB
  // (window.LOCALIDADES_CCB, veja services/localidades_ccb.py).
  const LOCALIDADES = window.LOCALIDADES_CCB || {};
  const selEstado = document.getElementById("estado");
  const selCidade = document.getElementById("cidade");
  const campoLocal = document.getElementById("local");

  function normalizar(texto) {
    return (texto || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().trim();
  }

  const CIDADE_PARA_ESTADO = {};
  Object.keys(LOCALIDADES).forEach((estado) => {
    (LOCALIDADES[estado] || []).forEach((cidade) => {
      CIDADE_PARA_ESTADO[normalizar(cidade)] = estado;
    });
  });

  // A busca ao vivo devolve a cidade às vezes com a UF colada no fim
  // ("Cidade/SP", "Cidade - SP") — tira isso antes de comparar com a base.
  function limparSufixoUF(cidade) {
    return (cidade || "").replace(/\s*[\/\-]\s*[A-Za-z]{2}$/, "").trim();
  }

  function popularCidades(estado, cidadeSelecionada) {
    const cidades = LOCALIDADES[estado] || [];
    selCidade.innerHTML = "";
    const optVazia = document.createElement("option");
    optVazia.value = "";
    optVazia.textContent = "—";
    selCidade.appendChild(optVazia);
    cidades.forEach((cidade) => {
      const opt = document.createElement("option");
      opt.value = cidade;
      opt.textContent = cidade;
      if (cidadeSelecionada && cidade === cidadeSelecionada) opt.selected = true;
      selCidade.appendChild(opt);
    });
    // Congregação nova/base ainda não atualizada: mostra a cidade mesmo sem
    // estar na lista baixada, só pra não ficar em branco à toa.
    if (cidadeSelecionada && !cidades.includes(cidadeSelecionada)) {
      const opt = document.createElement("option");
      opt.value = cidadeSelecionada;
      opt.textContent = cidadeSelecionada;
      opt.selected = true;
      selCidade.appendChild(opt);
    }
  }

  function selecionarEstadoCidade(estado, cidade) {
    const estadoValido = estado && [...selEstado.options].some((o) => o.value === estado);
    selEstado.value = estadoValido ? estado : "";
    popularCidades(selEstado.value, cidade || "");
  }

  // Tenta descobrir Estado/Cidade a partir do texto livre do campo Local —
  // cobre o formato que a própria busca ao vivo gera ("Nome — Cidade"), o
  // formato antigo ("Cidade - Estado") e o caso de já ser só o nome da
  // cidade. Se nada bater, deixa os dois em branco: o que de fato é salvo
  // é sempre o texto do campo Local, isso aqui é só um retrato dele.
  function derivarLocalizacao(texto) {
    const partes = (texto || "").split(/—| - /).map((p) => p.trim()).filter(Boolean);
    const candidatos = partes.length > 1 ? [partes[partes.length - 1], partes[0]] : [(texto || "").trim()];
    for (const candidato of candidatos) {
      const estado = CIDADE_PARA_ESTADO[normalizar(candidato)];
      if (estado) {
        selecionarEstadoCidade(estado, candidato);
        return;
      }
    }
    selecionarEstadoCidade("", "");
  }

  if (selEstado && selCidade && campoLocal) {
    // Se o servidor já marcou a localidade padrão desta congregação
    // (registro novo, sem erro de validação), usa Estado/Cidade padrão
    // direto; senão tenta derivar do que já está escrito (edição).
    if (selEstado.value && window.CIDADE_PADRAO) {
      popularCidades(selEstado.value, window.CIDADE_PADRAO);
    } else {
      derivarLocalizacao(campoLocal.value);
    }
    campoLocal.addEventListener("input", () => derivarLocalizacao(campoLocal.value));
  }

  // --------------------------- busca ao vivo na base de localidades (oficial da CCB) ---------------------------
  // Mesmo mecanismo pros dois campos alimentados pela base de localidades:
  // Local (a igreja da própria reunião) e Visitas (igrejas que vieram
  // visitar) — os dois buscam ao vivo no diretório oficial da CCB
  // (/api/localidade-busca) e caem pra digitação livre sem internet.
  function ativarBuscaLocalidade(inputEl, resultadosEl, aoEscolher) {
    if (!inputEl || !resultadosEl) return;
    let temporizadorBusca = null;

    function mostrarResultados(resultados) {
      resultadosEl.innerHTML = "";
      if (resultados === null) {
        const aviso = document.createElement("div");
        aviso.className = "aviso";
        aviso.textContent = "Não foi possível buscar agora (sem internet?). Pode digitar o nome direto.";
        resultadosEl.appendChild(aviso);
      } else if (resultados.length === 0) {
        const aviso = document.createElement("div");
        aviso.className = "aviso";
        aviso.textContent = "Nada encontrado com esse nome — pode continuar digitando na mão.";
        resultadosEl.appendChild(aviso);
      } else {
        resultados.forEach((item) => {
          const btn = document.createElement("button");
          btn.type = "button";
          const nome = document.createElement("strong");
          nome.textContent = item.nome;
          const cidade = document.createElement("span");
          cidade.textContent = item.cidade;
          btn.appendChild(nome);
          btn.appendChild(cidade);
          btn.addEventListener("click", () => {
            aoEscolher(item);
            resultadosEl.hidden = true;
          });
          resultadosEl.appendChild(btn);
        });
      }
      resultadosEl.hidden = false;
    }

    inputEl.addEventListener("input", () => {
      clearTimeout(temporizadorBusca);
      const termo = inputEl.value.trim();
      if (termo.length < 3) {
        resultadosEl.hidden = true;
        return;
      }
      temporizadorBusca = setTimeout(() => {
        fetch(`/api/localidade-busca?q=${encodeURIComponent(termo)}`)
          .then((r) => r.json())
          .then((dados) => mostrarResultados(dados.resultados || []))
          .catch(() => mostrarResultados(null));
      }, 400);
    });

    document.addEventListener("click", (e) => {
      if (e.target !== inputEl && !resultadosEl.contains(e.target)) {
        resultadosEl.hidden = true;
      }
    });
  }

  const listaResultadosLocal = document.getElementById("resultados-localidade");
  ativarBuscaLocalidade(campoLocal, listaResultadosLocal, (item) => {
    campoLocal.value = `${item.nome} — ${item.cidade}`;
    derivarLocalizacao(limparSufixoUF(item.cidade));
    agendarSalvamento();
  });

  // --------------------------------- Visitas: chips de igrejas (em vez de um número) ---------------------------------
  const inputVisita = document.getElementById("visita-input");
  const btnVisitaAdicionar = document.getElementById("visita-adicionar");
  const chipsVisitas = document.getElementById("visitas-chips");
  const hiddenVisitas = document.getElementById("visitas");
  const resultadosVisita = document.getElementById("resultados-visita");

  function listaVisitasAtual() {
    return hiddenVisitas.value ? hiddenVisitas.value.split(";").map((s) => s.trim()).filter(Boolean) : [];
  }

  function renderChipsVisitas() {
    if (!chipsVisitas) return;
    chipsVisitas.innerHTML = "";
    listaVisitasAtual().forEach((nome, i) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      const texto = document.createElement("span");
      texto.textContent = nome;
      const remover = document.createElement("button");
      remover.type = "button";
      remover.setAttribute("aria-label", `Remover ${nome}`);
      remover.textContent = "×";
      remover.addEventListener("click", () => {
        const nova = listaVisitasAtual();
        nova.splice(i, 1);
        hiddenVisitas.value = nova.join("; ");
        renderChipsVisitas();
        hiddenVisitas.dispatchEvent(new Event("input", { bubbles: true }));
      });
      chip.appendChild(texto);
      chip.appendChild(remover);
      chipsVisitas.appendChild(chip);
    });
  }

  // Usada tanto pelo botão "+"/Enter (nome digitado à mão) quanto pela
  // busca ao vivo na base de localidades (nome escolhido de um resultado
  // real do diretório oficial da CCB).
  function adicionarNomeVisita(nome) {
    if (!nome) return;
    const atual = listaVisitasAtual();
    if (!atual.includes(nome)) atual.push(nome);
    hiddenVisitas.value = atual.join("; ");
    renderChipsVisitas();
    hiddenVisitas.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function adicionarVisita() {
    adicionarNomeVisita(inputVisita.value.trim());
    inputVisita.value = "";
  }

  if (inputVisita && btnVisitaAdicionar && chipsVisitas && hiddenVisitas) {
    btnVisitaAdicionar.addEventListener("click", adicionarVisita);
    inputVisita.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); adicionarVisita(); }
    });
    // Visitas também é alimentado pela base de localidades: a mesma busca
    // ao vivo do campo Local, aqui adicionando direto como chip.
    ativarBuscaLocalidade(inputVisita, resultadosVisita, (item) => {
      adicionarNomeVisita(`${item.nome} — ${item.cidade}`);
      inputVisita.value = "";
    });
    renderChipsVisitas(); // estado inicial (editando um registro existente)
  }

  // ------------------------------------------------------------- rascunho automático
  const chave = "ccb-bi-rascunho-" + form.getAttribute("data-rascunho-chave");
  const banner = document.getElementById("rascunho-banner");
  const statusEl = document.getElementById("rascunho-status");
  let restaurando = false;

  function salvarRascunho() {
    if (restaurando) return;
    const dados = {};
    form.querySelectorAll("[name]").forEach((el) => { dados[el.name] = el.value; });
    localStorage.setItem(chave, JSON.stringify(dados));
    if (statusEl) {
      const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      statusEl.textContent = `Rascunho salvo neste aparelho às ${hora}`;
    }
  }

  let temporizador = null;
  function agendarSalvamento() {
    clearTimeout(temporizador);
    temporizador = setTimeout(salvarRascunho, 500);
  }

  function aplicarRascunho(dados) {
    restaurando = true;
    form.querySelectorAll("[name]").forEach((el) => {
      if (el.name === "capitulo" || el.name === "versiculo") return;
      if (dados[el.name] !== undefined) el.value = dados[el.name];
    });
    if (selLivro && selCapitulo && selVersiculo) {
      aoMudarLivro(dados.capitulo, dados.versiculo);
    }
    if (campoLocal) derivarLocalizacao(campoLocal.value);
    renderChipsVisitas();
    atualizarTotais();
    restaurando = false;
    salvarRascunho();
  }

  const rascunhoSalvo = localStorage.getItem(chave);
  if (rascunhoSalvo && banner) {
    try {
      const dados = JSON.parse(rascunhoSalvo);
      const temConteudo = Object.keys(dados).some((k) => dados[k]);
      if (temConteudo) {
        banner.hidden = false;
        const btnRestaurar = document.getElementById("rascunho-restaurar");
        const btnDescartar = document.getElementById("rascunho-descartar");
        if (btnRestaurar) btnRestaurar.addEventListener("click", () => {
          aplicarRascunho(dados);
          banner.hidden = true;
        });
        if (btnDescartar) btnDescartar.addEventListener("click", () => {
          localStorage.removeItem(chave);
          banner.hidden = true;
        });
      }
    } catch (e) {
      localStorage.removeItem(chave);
    }
  }

  form.addEventListener("input", agendarSalvamento);
  form.addEventListener("change", agendarSalvamento);
});
