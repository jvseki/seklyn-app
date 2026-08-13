// Seklyn — status da assinatura e início do checkout do Stripe.
import { api } from "./api.js";
import { protegerPagina } from "./auth.js";
import { $, formatarDataHora, mensagemDeErro, mostrarToast } from "./utils.js";

protegerPagina();

const statusEl = $("#status-assinatura");
const botaoAssinar = $("#botao-assinar");
const boasVindasEl = $("#boas-vindas");

const rotulosStatus = {
  active: { texto: "Ativa", classe: "badge-sucesso" },
  trialing: { texto: "Em teste", classe: "badge-sucesso" },
  past_due: { texto: "Pagamento pendente", classe: "badge-aviso" },
  canceled: { texto: "Cancelada", classe: "badge-perigo" },
  inativa: { texto: "Inativa", classe: "badge-perigo" },
};

const parametros = new URLSearchParams(window.location.search);
if (parametros.get("boas-vindas") === "1" && boasVindasEl) {
  boasVindasEl.hidden = false;
}
if (parametros.get("status") === "sucesso") {
  mostrarToast("Assinatura confirmada! Pode levar alguns segundos para atualizar.", "sucesso");
}

async function carregarStatus() {
  try {
    const assinatura = await api.statusAssinatura();
    const info = rotulosStatus[assinatura.status] || rotulosStatus.inativa;
    statusEl.innerHTML = `
      <span class="badge ${info.classe}">${info.texto}</span>
      ${assinatura.current_period_end ? `<p class="hint-text" style="margin-top:8px;">Renova em ${formatarDataHora(assinatura.current_period_end)}</p>` : ""}
    `;
    botaoAssinar.hidden = assinatura.ativa;
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

botaoAssinar?.addEventListener("click", async () => {
  botaoAssinar.disabled = true;
  try {
    const resultado = await api.criarCheckoutSession();
    window.location.href = resultado.checkout_url;
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
    botaoAssinar.disabled = false;
  }
});

carregarStatus();
