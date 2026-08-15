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

/** Alterna a exibição de um modal (elemento com classe .modal-fundo). */
export function abrirModal(modalEl) {
  modalEl.hidden = false;
}

export function fecharModal(modalEl) {
  modalEl.hidden = true;
}
