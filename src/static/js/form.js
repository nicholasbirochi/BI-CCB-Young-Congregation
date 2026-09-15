// Formulário de registro: soma dos totais, seleção em cascata de
// Livro -> Capítulo -> Versículo (só permite combinações que existem de
// verdade) e rascunho automático neste aparelho (localStorage), para não
// perder o preenchimento se a pessoa precisar sair no meio do culto.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form[data-rascunho-chave]");
  if (!form) return;

  const campo = (nome) => form.querySelector(`[name="${nome}"]`);

  // ------------------------------------------------------ totais dos recitativos
  // Auxiliares entra no total: no formulário impresso ela é só mais uma
  // linha do quadro de recitativos (o "Total" de cada coluna já sai somado
  // assim), não um número à parte.
  const camposMeninas = ["meninas_1", "meninas_2", "meninas_3", "meninas_4", "meninas_5", "meninas_6", "auxiliares_femininos"];
  const camposMeninos = ["meninos_1", "meninos_2", "meninos_3", "meninos_4", "meninos_5", "meninos_6", "auxiliares_masculinos"];

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
  const selVersiculoInicio = document.getElementById("versiculo-inicio");
  const selVersiculoFim = document.getElementById("versiculo-fim");
  const rotuloAte = document.getElementById("versiculo-ate-rotulo");
  const versiculoOculto = document.getElementById("versiculo");
  const VALOR_CAPITULO_INTEIRO = "todos";

  function popularOpcoes(select, quantidade, valorSelecionado, rotuloPreenchido) {
    select.innerHTML = "";
    const optVazia = document.createElement("option");
    optVazia.value = "";
    optVazia.textContent = quantidade ? (rotuloPreenchido || "Selecione...") : "—";
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

  // "Capítulo inteiro" é só mais uma opção dentro do próprio select de
  // início (logo depois do "De") — não um campo à parte.
  function popularOpcoesInicio(quantidade, valorSelecionado, capituloInteiro) {
    popularOpcoes(selVersiculoInicio, quantidade, capituloInteiro ? "" : valorSelecionado, "De");
    if (quantidade) {
      const optTodos = document.createElement("option");
      optTodos.value = VALOR_CAPITULO_INTEIRO;
      optTodos.textContent = "Capítulo inteiro";
      optTodos.selected = !!capituloInteiro;
      selVersiculoInicio.insertBefore(optTodos, selVersiculoInicio.options[1] || null);
    }
  }

  // O campo Versículo sempre foi texto livre no banco ("1-10", "todos",
  // "1 a 32", "13 e 14"...) porque cada época/pessoa preencheu do seu jeito
  // no papel — reconhece esses formatos pra pré-selecionar Início/Fim (ou
  // "Capítulo inteiro") certo ao editar um registro antigo.
  function interpretarVersiculo(texto) {
    const bruto = (texto || "").trim();
    if (!bruto) return { inteiro: false, inicio: "", fim: "" };
    if (/^(todos?|tudo|inteiro|completo)$/i.test(bruto)) return { inteiro: true, inicio: "", fim: "" };
    const numeros = bruto.match(/\d+/g);
    if (!numeros || !numeros.length) return { inteiro: false, inicio: "", fim: "" };
    return { inteiro: false, inicio: numeros[0], fim: numeros[numeros.length - 1] };
  }

  // Enquanto o início não é "Capítulo inteiro", o "até" fica esperando pra
  // dizer onde o trecho termina; ao escolher "Capítulo inteiro" ele some
  // (não faz sentido perguntar onde termina algo que já é o capítulo todo).
  function atualizarVisibilidadeFim() {
    const ehCapituloInteiro = selVersiculoInicio.value === VALOR_CAPITULO_INTEIRO;
    selVersiculoFim.hidden = ehCapituloInteiro;
    if (rotuloAte) rotuloAte.hidden = ehCapituloInteiro;
    if (ehCapituloInteiro) selVersiculoFim.value = "";
  }

  function atualizarVersiculoOculto() {
    if (!versiculoOculto) return;
    const inicio = selVersiculoInicio.value;
    if (inicio === VALOR_CAPITULO_INTEIRO) { versiculoOculto.value = "Todos"; return; }
    if (!inicio) { versiculoOculto.value = ""; return; }
    const fim = selVersiculoFim.value;
    versiculoOculto.value = (!fim || fim === inicio) ? inicio : `${inicio}-${fim}`;
  }

  function aoMudarCapitulo(valorVersiculoDesejado) {
    const capitulos = BIBLIA[selLivro.value] || [];
    const capSelecionado = parseInt(selCapitulo.value, 10);
    const totalVersiculos = capitulos[capSelecionado - 1] || 0;
    const alvo = interpretarVersiculo(valorVersiculoDesejado);
    popularOpcoesInicio(totalVersiculos, alvo.inicio, alvo.inteiro);
    popularOpcoes(selVersiculoFim, totalVersiculos, alvo.fim, "até");
    atualizarVisibilidadeFim();
    atualizarVersiculoOculto();
  }

  function aoMudarLivro(valorCapituloDesejado, valorVersiculoDesejado) {
    const capitulos = BIBLIA[selLivro.value] || [];
    popularOpcoes(selCapitulo, capitulos.length, valorCapituloDesejado);
    aoMudarCapitulo(valorVersiculoDesejado);
  }

  if (selLivro && selCapitulo && selVersiculoInicio && selVersiculoFim) {
    selLivro.addEventListener("change", () => aoMudarLivro());
    selCapitulo.addEventListener("change", () => aoMudarCapitulo());
    selVersiculoInicio.addEventListener("change", () => {
      atualizarVisibilidadeFim();
      // Não deixa escolher um "até" antes do "De" (mesma lógica já usada no
      // filtro de período do Análises: trava o campo em vez de deixar
      // inverter e dar um intervalo sem sentido).
      if (!selVersiculoFim.hidden && selVersiculoFim.value &&
          Number(selVersiculoFim.value) < Number(selVersiculoInicio.value)) {
        selVersiculoFim.value = selVersiculoInicio.value;
      }
      atualizarVersiculoOculto();
    });
    selVersiculoFim.addEventListener("change", () => {
      if (selVersiculoInicio.value && selVersiculoInicio.value !== VALOR_CAPITULO_INTEIRO &&
          Number(selVersiculoInicio.value) > Number(selVersiculoFim.value)) {
        selVersiculoInicio.value = selVersiculoFim.value;
      }
      atualizarVersiculoOculto();
    });
    // Estado inicial: preenche capítulo/versículo se já vier de um registro existente.
    aoMudarLivro(registroAtual.capitulo, registroAtual.versiculo);
  }

  // ------------------------------------------------ recitativos individuais (contador)
  // Substitui a setinha nativa do <input type=number> (feia e inconsistente
  // entre navegadores) por dois botões dentro do próprio campo.
  const campoIndividuais = document.getElementById("recitativos_individuais");
  const botaoIndividuaisMenos = document.getElementById("individuais-menos");
  const botaoIndividuaisMais = document.getElementById("individuais-mais");
  if (campoIndividuais && botaoIndividuaisMenos && botaoIndividuaisMais) {
    botaoIndividuaisMenos.addEventListener("click", () => {
      const atual = parseInt(campoIndividuais.value, 10) || 0;
      campoIndividuais.value = Math.max(0, atual - 1);
      campoIndividuais.dispatchEvent(new Event("input", { bubbles: true }));
    });
    botaoIndividuaisMais.addEventListener("click", () => {
      const atual = parseInt(campoIndividuais.value, 10) || 0;
      campoIndividuais.value = atual + 1;
      campoIndividuais.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  // ------------------------------------------- Local/Congregação -> Estado/Cidade
  // Quem manda agora é o Local: Estado e Cidade só retratam onde ele fica e
  // ficam sempre desabilitados (não dá pra "destravar" e escolher um estado
  // que não bate com o que foi digitado no Local — evita os dois campos
  // saírem dessincronizados). Por serem desabilitados, os <select> nunca
  // são enviados no POST — quem carrega o valor de verdade são os campos
  // ocultos (estado-oculto/cidade-oculto), mantidos em dia aqui. A base
  // usada pra descobrir o estado a partir da cidade é a mesma baixada do
  // diretório oficial da CCB (window.LOCALIDADES_CCB, veja
  // services/localidades_ccb.py).
  const LOCALIDADES = window.LOCALIDADES_CCB || {};
  const selEstado = document.getElementById("estado");
  const selCidade = document.getElementById("cidade");
  const selPais = document.getElementById("pais");
  const estadoOculto = document.getElementById("estado-oculto");
  const cidadeOculto = document.getElementById("cidade-oculto");
  const paisOculto = document.getElementById("pais-oculto");
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

  // Depois de qualquer mudança nos <select> (desabilitados, não viajam no
  // POST), copia o valor pros campos ocultos — são eles que de fato chegam
  // no servidor e ficam salvos no registro.
  function sincronizarCamposOcultos() {
    if (estadoOculto) estadoOculto.value = selEstado.value;
    if (cidadeOculto) cidadeOculto.value = selCidade.value;
    if (paisOculto && selPais) paisOculto.value = selPais.value;
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
    sincronizarCamposOcultos();
  }

  function selecionarEstadoCidade(estado, cidade) {
    const estadoValido = estado && [...selEstado.options].some((o) => o.value === estado);
    selEstado.value = estadoValido ? estado : "";
    // A base de localidades (LOCALIDADES_CCB) só tem cidades brasileiras —
    // achou um Estado válido a partir do Local, então o País é Brasil. Fica
    // travado igual o Estado (só a localidade decide); precisa vir antes de
    // popularCidades, que é quem de fato copia os três pros campos ocultos.
    if (estadoValido && selPais) selPais.value = "Brasil";
    popularCidades(selEstado.value, cidade || "");
  }

  // Tenta descobrir Estado/Cidade a partir do texto livre do campo Local —
  // cobre o formato que a própria busca ao vivo gera ("Nome — Cidade"), o
  // formato antigo ("Cidade - Estado") e o caso de já ser só o nome da
  // cidade. Se nada bater com a base oficial de cidades, mas o texto for a
  // localidade padrão desta congregação (ex.: "Batistini", que é bairro, não
  // cidade, então nunca vai bater sozinho), cai no Estado/Cidade padrão
  // configurado em vez de deixar em branco. Só em último caso mesmo é que
  // fica vazio.
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
    if (window.LOCAL_PADRAO && normalizar(texto) === normalizar(window.LOCAL_PADRAO)) {
      selecionarEstadoCidade(window.ESTADO_PADRAO || "", window.CIDADE_PADRAO || "");
      return;
    }
    selecionarEstadoCidade("", "");
  }

  if (selEstado && selCidade && campoLocal) {
    // O servidor já manda o Estado/Cidade salvos de verdade no registro
    // (novo registro já nasce com o padrão desta congregação; edição traz o
    // que estava gravado) — usa isso direto em vez de tentar redescobrir a
    // partir do texto do Local, que pode nem bater com a base oficial.
    if (registroAtual.estado || registroAtual.cidade) {
      selecionarEstadoCidade(registroAtual.estado, registroAtual.cidade);
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

  // --------------------------------- Visitas: chips de igrejas (lista de nomes) ---------------------------------
  // Guarda uma lista de nomes separados por "; ". Devolve a função
  // "adicionar" pra quem quiser plugar a busca ao vivo de localidades também.
  function criarChipsDeNomes({ inputEl, botaoEl, chipsEl, hiddenEl }) {
    if (!inputEl || !chipsEl || !hiddenEl) return null;

    function listaAtual() {
      return hiddenEl.value ? hiddenEl.value.split(";").map((s) => s.trim()).filter(Boolean) : [];
    }

    function renderChips() {
      chipsEl.innerHTML = "";
      listaAtual().forEach((nome, i) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        const texto = document.createElement("span");
        texto.textContent = nome;
        const remover = document.createElement("button");
        remover.type = "button";
        remover.setAttribute("aria-label", `Remover ${nome}`);
        remover.textContent = "×";
        remover.addEventListener("click", () => {
          const nova = listaAtual();
          nova.splice(i, 1);
          hiddenEl.value = nova.join("; ");
          renderChips();
          hiddenEl.dispatchEvent(new Event("input", { bubbles: true }));
        });
        chip.appendChild(texto);
        chip.appendChild(remover);
        chipsEl.appendChild(chip);
      });
    }

    function adicionarNome(nome) {
      if (!nome) return;
      const atual = listaAtual();
      if (!atual.includes(nome)) atual.push(nome);
      hiddenEl.value = atual.join("; ");
      renderChips();
      hiddenEl.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function adicionarDoInput() {
      adicionarNome(inputEl.value.trim());
      inputEl.value = "";
    }

    if (botaoEl) botaoEl.addEventListener("click", adicionarDoInput);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); adicionarDoInput(); }
    });
    renderChips(); // estado inicial (editando um registro existente)

    return { adicionarNome, renderChips };
  }

  const chipsVisitas = criarChipsDeNomes({
    inputEl: document.getElementById("visita-input"),
    botaoEl: document.getElementById("visita-adicionar"),
    chipsEl: document.getElementById("visitas-chips"),
    hiddenEl: document.getElementById("visitas"),
  });
  // Visitas também é alimentado pela base de localidades: a mesma busca ao
  // vivo do campo Local, aqui adicionando direto como chip.
  if (chipsVisitas) {
    const inputVisita = document.getElementById("visita-input");
    ativarBuscaLocalidade(inputVisita, document.getElementById("resultados-visita"), (item) => {
      chipsVisitas.adicionarNome(`${item.nome} — ${item.cidade}`);
      inputVisita.value = "";
    });
  }

  function renderChipsVisitas() { if (chipsVisitas) chipsVisitas.renderChips(); }

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
    if (selLivro && selCapitulo && selVersiculoInicio) {
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
