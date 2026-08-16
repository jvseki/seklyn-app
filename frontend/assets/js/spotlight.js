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

/** Inclinação 3D real (perspective + rotateX/rotateY) que segue o mouse —
 * só no mouse mesmo, o toque já tem o "afundar" físico do :active
 * (inclinar junto com o dedo em cima do botão ficaria estranho). */
export function ativarTiltBotoes(seletor = ".btn-primary", raiz = document) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  raiz.querySelectorAll(seletor).forEach((el) => {
    if (el.dataset.tiltLigado) return;
    el.dataset.tiltLigado = "1";

    el.addEventListener("pointermove", (evento) => {
      if (evento.pointerType !== "mouse") return;
      const rect = el.getBoundingClientRect();
      const px = (evento.clientX - rect.left) / rect.width - 0.5;
      const py = (evento.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty("--tilt-x", `${(-py * 10).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(px * 10).toFixed(2)}deg`);
    });
    el.addEventListener("pointerleave", (evento) => {
      if (evento.pointerType !== "mouse") return;
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
    });
  });
}

ativarSpotlight();
ativarTiltBotoes();
