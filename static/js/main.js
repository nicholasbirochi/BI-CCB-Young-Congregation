// Tema claro/escuro + utilidades pequenas usadas em várias páginas.
(function () {
  const THEME_KEY = "ccb-bi-tema";

  function aplicarTema(tema) {
    if (tema === "dark" || tema === "light") {
      document.documentElement.setAttribute("data-theme", tema);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  function temaAtualEfetivo() {
    // O padrão é sempre claro; só muda quando a pessoa clica no botão de tema
    // (não segue a preferência do sistema operacional).
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  }

  aplicarTema(localStorage.getItem(THEME_KEY));

  document.addEventListener("DOMContentLoaded", () => {
    // Se a página carregou com um aviso de sucesso, qualquer rascunho salvo
    // localmente (de novo registro ou de edição) já cumpriu seu papel.
    if (document.querySelector(".flash.sucesso")) {
      Object.keys(localStorage)
        .filter((chave) => chave.startsWith("ccb-bi-rascunho-"))
        .forEach((chave) => localStorage.removeItem(chave));
    }

    const botao = document.getElementById("theme-toggle");
    if (botao) {
      botao.addEventListener("click", () => {
        const novo = temaAtualEfetivo() === "dark" ? "light" : "dark";
        localStorage.setItem(THEME_KEY, novo);
        aplicarTema(novo);
      });
    }

    document.querySelectorAll("[data-copiar]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const alvo = document.querySelector(btn.getAttribute("data-copiar"));
        if (!alvo) return;
        navigator.clipboard.writeText(alvo.textContent.trim()).then(() => {
          const original = btn.textContent;
          btn.textContent = "Copiado!";
          setTimeout(() => (btn.textContent = original), 1500);
        });
      });
    });

    document.querySelectorAll("form[data-confirmar]").forEach((form) => {
      form.addEventListener("submit", (e) => {
        if (!confirm(form.getAttribute("data-confirmar"))) e.preventDefault();
      });
    });
  });
})();
