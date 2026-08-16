// Seklyn — efeito "spotlight": brilho na cor da marca que acompanha o
// cursor (mouse) ou o toque, com leve elevação de profundidade. Usa
// Pointer Events — cobre mouse e touch com o mesmo código, sem tratar
// os dois separadamente.
export function ativarSpotlight(seletor = ".spotlight-card", raiz = document) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  raiz.querySelectorAll(seletor).forEach((el) => {
    if (el.dataset.spotlightLigado) return; // evita ligar duas vezes no mesmo elemento
    el.dataset.spotlightLigado = "1";

    function mover(evento) {
      const rect = el.getBoundingClientRect();
      const x = ((evento.clientX - rect.left) / rect.width) * 100;
      const y = ((evento.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--spot-x", `${x}%`);
      el.style.setProperty("--spot-y", `${y}%`);
    }

    el.addEventListener("pointerenter", (evento) => {
      el.classList.add("spot-ativo");
      el.style.setProperty("--spot-opacidade", "1");
      mover(evento);
    });
    el.addEventListener("pointermove", mover);
    el.addEventListener("pointerleave", () => {
      el.classList.remove("spot-ativo");
      el.style.setProperty("--spot-opacidade", "0");
    });
    // No touch, o dedo solta antes do "pointerleave" disparar em alguns
    // navegadores — garante que o brilho não fica "grudado" depois.
    el.addEventListener(
      "touchend",
      () => {
        el.classList.remove("spot-ativo");
        el.style.setProperty("--spot-opacidade", "0");
      },
      { passive: true }
    );
  });
}

ativarSpotlight();
