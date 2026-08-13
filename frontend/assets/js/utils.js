// Seklyn — utilidades compartilhadas pelo frontend.

export function $(seletor, escopo = document) {
  return escopo.querySelector(seletor);
}

export function $all(seletor, escopo = document) {
  return Array.from(escopo.querySelectorAll(seletor));
}

export function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

export function formatarDataHora(isoString) {
  if (!isoString) return "";
  const data = new Date(isoString);
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Mostra uma notificação temporária no canto da tela. */
export function mostrarToast(mensagem, tipo = "info") {
  let container = $(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${tipo === "erro" ? "erro" : tipo === "sucesso" ? "sucesso" : ""}`.trim();
  toast.textContent = mensagem;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

export async function copiarParaAreaDeTransferencia(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    mostrarToast("Link copiado!", "sucesso");
  } catch {
    mostrarToast("Não foi possível copiar automaticamente. Copie manualmente.", "erro");
  }
}

/**
 * Monta o link de WhatsApp (wa.me) a partir de um telefone com DDD.
 * Assume Brasil (+55) quando o número não vem com código do país.
 * Retorna null se não houver dígitos suficientes pra ser um telefone válido.
 */
export function linkWhatsApp(telefone) {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const comCodigoPais = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${comCodigoPais}`;
}

/** Extrai a mensagem de erro amigável de um erro lançado pelo api.js. */
export function mensagemDeErro(erro) {
  return erro?.message || "Ocorreu um erro inesperado. Tente novamente.";
}

/** Preenche um <select> com {value, label}[] */
export function preencherSelect(elemento, opcoes, valorSelecionado) {
  elemento.innerHTML = "";
  for (const { valor, rotulo } of opcoes) {
    const option = document.createElement("option");
    option.value = valor;
    option.textContent = rotulo;
    if (valor === valorSelecionado) option.selected = true;
    elemento.appendChild(option);
  }
}

/** Alterna a exibição de um modal (elemento com classe .modal-fundo). */
export function abrirModal(modalEl) {
  modalEl.hidden = false;
}

export function fecharModal(modalEl) {
  modalEl.hidden = true;
}
