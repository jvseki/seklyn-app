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

/** Mostra uma notificação temporária no topo da tela. Um toast por vez —
 * o novo substitui o anterior em vez de empilhar (ex: "Vídeo reusado." não
 * fica preso em cima do botão "Salvar" por vários segundos). */
export function mostrarToast(mensagem, tipo = "info") {
  let container = $(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  container.innerHTML = ""; // substitui qualquer toast anterior ainda visível
  const toast = document.createElement("div");
  toast.className = `toast ${tipo === "erro" ? "erro" : tipo === "sucesso" ? "sucesso" : ""}`.trim();
  toast.textContent = mensagem;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

/**
 * Copia texto pra área de transferência. Tenta a API moderna primeiro; se
 * falhar por qualquer motivo (permissão, contexto, navegador antigo), cai
 * pro método antigo (textarea invisível + execCommand), que funciona quase
 * sempre. Se passar o botão que disparou a cópia, mostra "Copiado!" nele
 * por um instante — feedback visível ali mesmo, sem depender só do toast.
 */
export async function copiarParaAreaDeTransferencia(texto, botaoOrigem = null) {
  let sucesso = false;

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texto);
      sucesso = true;
    } catch {
      sucesso = false;
    }
  }

  if (!sucesso) {
    try {
      const campo = document.createElement("textarea");
      campo.value = texto;
      campo.style.position = "fixed";
      campo.style.top = "-1000px";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.focus();
      campo.select();
      sucesso = document.execCommand("copy");
      document.body.removeChild(campo);
    } catch {
      sucesso = false;
    }
  }

  if (sucesso) {
    mostrarToast("Link copiado!", "sucesso");
    if (botaoOrigem) {
      const conteudoOriginal = botaoOrigem.textContent;
      botaoOrigem.textContent = "Copiado!";
      setTimeout(() => {
        botaoOrigem.textContent = conteudoOriginal;
      }, 1600);
    }
  } else {
    mostrarToast("Não foi possível copiar automaticamente. Selecione o link e copie manualmente.", "erro");
  }

  return sucesso;
}

/**
 * Monta o link de WhatsApp (wa.me) a partir de um telefone com DDD.
 * Assume Brasil (+55) quando o número não vem com código do país.
 * Retorna null se não houver dígitos suficientes pra ser um telefone válido.
 */
export function linkWhatsApp(telefone, mensagem = null) {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const comCodigoPais = digitos.startsWith("55") ? digitos : `55${digitos}`;
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : "";
  return `https://wa.me/${comCodigoPais}${texto}`;
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

// Trava o scroll do body enquanto algum modal tá aberto — sem isso, no iOS,
// o teclado abrindo faz o conteúdo por trás da página rolar e o modal fica
// descolado do fundo escurecido. `scrollTravadoEm` guarda a posição pra
// restaurar exatamente onde a página tava; fica null quando destravado.
let scrollTravadoEm = null;

/** Alterna a exibição de um modal (elemento com classe .modal-fundo). */
export function abrirModal(modalEl) {
  modalEl.hidden = false;
  if (scrollTravadoEm === null) {
    scrollTravadoEm = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollTravadoEm}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
  }
}

export function fecharModal(modalEl) {
  modalEl.hidden = true;
  // Só destrava se não sobrou nenhum outro modal aberto (ex: confirmarAcao()
  // por cima de um form) — todos usam a mesma classe .modal-fundo.
  const aindaTemModalAberto = document.querySelector(".modal-fundo:not([hidden])");
  if (!aindaTemModalAberto && scrollTravadoEm !== null) {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    window.scrollTo(0, scrollTravadoEm);
    scrollTravadoEm = null;
  }
}

// Quando um input/textarea/select dentro de um modal recebe foco, garante
// que ele fica visível mesmo com o teclado do celular aberto — sem isso,
// no iOS o campo (e o botão de confirmar) some atrás do teclado. `focus`
// não borbulha, por isso a escuta é na fase de captura.
document.addEventListener(
  "focus",
  (evento) => {
    const alvo = evento.target;
    if (!alvo.matches?.("input, textarea, select")) return;
    if (!alvo.closest(".modal-fundo")) return;
    setTimeout(() => alvo.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
  },
  true
);
