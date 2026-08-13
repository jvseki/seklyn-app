// Seklyn — menu lateral (hambúrguer) das páginas do Personal, em telas estreitas.
function alternarMenu(abrir) {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".sidebar-overlay");
  if (!sidebar || !overlay) return;
  sidebar.classList.toggle("aberta", abrir);
  overlay.classList.toggle("visivel", abrir);
  document.body.style.overflow = abrir ? "hidden" : "";
}

function iniciar() {
  const overlay = document.querySelector(".sidebar-overlay");
  document.querySelectorAll("[data-acao='abrir-menu']").forEach((botao) => {
    botao.addEventListener("click", () => alternarMenu(true));
  });
  overlay?.addEventListener("click", () => alternarMenu(false));
  document.querySelectorAll(".sidebar-nav a").forEach((link) => {
    link.addEventListener("click", () => alternarMenu(false));
  });
}

iniciar();
