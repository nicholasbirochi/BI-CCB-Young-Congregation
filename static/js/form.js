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

  // ------------------------------------------------- cascata Estado > Cidade (Local)
  const LOCALIDADES = window.LOCALIDADES_CCB || {};
  const selEstado = document.getElementById("estado");
  const selCidade = document.getElementById("cidade");
  const campoLocal = document.getElementById("local");

  function popularCidades(estado) {
    const cidades = LOCALIDADES[estado] || [];
    selCidade.innerHTML = "";
    const optVazia = document.createElement("option");
    optVazia.value = "";
    optVazia.textContent = cidades.length ? "Selecione..." : "—";
    selCidade.appendChild(optVazia);
    cidades.forEach((cidade) => {
      const opt = document.createElement("option");
      opt.value = cidade;
      opt.textContent = cidade;
      selCidade.appendChild(opt);
    });
    selCidade.disabled = cidades.length === 0;
  }

  if (selEstado && selCidade && campoLocal) {
    selEstado.addEventListener("change", () => popularCidades(selEstado.value));
    selCidade.addEventListener("change", () => {
      if (!selCidade.value) return;
      campoLocal.value = `${selCidade.value} - ${selEstado.value}`;
      // dispara o autosave de rascunho, que já escuta o campo Local
      campoLocal.dispatchEvent(new Event("input", { bubbles: true }));
    });
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
