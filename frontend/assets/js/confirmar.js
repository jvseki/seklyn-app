// Seklyn — substitui o confirm() feio e genérico do navegador por um modal
// com a cara do site. Uso: `if (await confirmarAcao("Excluir isso?")) { ... }`

let modalEl = null;

function garantirModal() {
  if (modalEl) return modalEl;

  modalEl = document.createElement("div");
  modalEl.className = "modal-fundo";
  modalEl.hidden = true;
  modalEl.innerHTML = `
    <div class="modal" style="max-width:400px;">
      <div class="modal-cabecalho">
        <h3 data-papel="titulo">Confirmar ação</h3>
      </div>
      <p class="hint-text" data-papel="mensagem" style="margin-bottom:var(--espaco-5);"></p>
      <div class="modal-acoes">
        <button class="btn btn-ghost" data-papel="cancelar" type="button">Cancelar</button>
        <button class="btn btn-danger" data-papel="ok" type="button">Confirmar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);
  return modalEl;
}

/**
 * Mostra um modal de confirmação e retorna uma Promise<boolean> — true se
 * confirmou, false se cancelou (equivalente ao confirm() nativo, mas bonito).
 */
export function confirmarAcao(mensagem, { titulo = "Confirmar ação", textoConfirmar = "Confirmar", perigo = true } = {}) {
  const modal = garantirModal();
  const tituloEl = modal.querySelector("[data-papel='titulo']");
  const mensagemEl = modal.querySelector("[data-papel='mensagem']");
  const okEl = modal.querySelector("[data-papel='ok']");
  const cancelarEl = modal.querySelector("[data-papel='cancelar']");

  tituloEl.textContent = titulo;
  mensagemEl.textContent = mensagem;
  okEl.textContent = textoConfirmar;
  okEl.className = `btn ${perigo ? "btn-danger" : "btn-primary"}`;

  return new Promise((resolve) => {
    function limpar(resultado) {
      modal.hidden = true;
      okEl.removeEventListener("click", aoConfirmar);
      cancelarEl.removeEventListener("click", aoCancelar);
      modal.removeEventListener("click", aoClicarFundo);
      resolve(resultado);
    }
    function aoConfirmar() {
      limpar(true);
    }
    function aoCancelar() {
      limpar(false);
    }
    function aoClicarFundo(evento) {
      if (evento.target === modal) limpar(false);
    }

    okEl.addEventListener("click", aoConfirmar);
    cancelarEl.addEventListener("click", aoCancelar);
    modal.addEventListener("click", aoClicarFundo);
    modal.hidden = false;
  });
}
