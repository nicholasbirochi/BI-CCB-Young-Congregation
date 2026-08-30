// Utilidades pequenas usadas em várias páginas.
(function () {
  document.addEventListener("DOMContentLoaded", () => {
    // Se a página carregou com um aviso de sucesso, qualquer rascunho salvo
    // localmente (de novo registro ou de edição) já cumpriu seu papel.
    if (document.querySelector(".flash.sucesso")) {
      Object.keys(localStorage)
        .filter((chave) => chave.startsWith("ccb-bi-rascunho-"))
        .forEach((chave) => localStorage.removeItem(chave));
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
