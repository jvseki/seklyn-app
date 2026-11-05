// Seklyn — assinatura mensal do Personal, cobrada no cartão pelo Mercado
// Pago. O checkout acontece na página do Mercado Pago; a volta pra cá (com
// ?status=retorno) espera o webhook confirmar antes de dizer "ativa".
import { api } from "./api.js";
import { protegerPagina } from "./auth.js";
import { confirmarAcao } from "./confirmar.js";
import { $, escaparHtml, formatarDataHora, mensagemDeErro, mostrarToast } from "./utils.js";

protegerPagina();

const statusEl = $("#status-assinatura");
const botaoAssinar = $("#botao-assinar");
const botaoCancelar = $("#botao-cancelar-assinatura");
const notaPagamentoEl = $("#nota-pagamento");
const boasVindasEl = $("#boas-vindas");

const rotulosStatus = {
  active: { texto: "Ativa", classe: "badge-sucesso" },
  trialing: { texto: "Em teste", classe: "badge-sucesso" },
  pendente: { texto: "Aguardando pagamento", classe: "badge-aviso" },
  past_due: { texto: "Cobrança recusada", classe: "badge-aviso" },
  canceled: { texto: "Cancelada", classe: "badge-perigo" },
  inativa: { texto: "Inativa", classe: "badge-perigo" },
};

const reais = (valor) => Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const parametros = new URLSearchParams(window.location.search);
if (parametros.get("boas-vindas") === "1" && boasVindasEl) {
  boasVindasEl.hidden = false;
}

/** Texto de apoio abaixo do status, conforme a situação. */
function explicacao(a) {
  if (a.ativa && a.automatica) {
    return `${reais(a.valor_mensal)} por mês no cartão${a.current_period_end ? ` · próxima cobrança em ${formatarDataHora(a.current_period_end)}` : ""}.`;
  }
  if (a.ativa) return "Ativada pelo suporte do Seklyn.";
  if (!a.valor_mensal) return "Seu plano ainda não foi definido. Fale com o suporte pra combinar o valor.";
  if (!a.pagamento_disponivel) return "O pagamento com cartão estará disponível em breve. Fale com o suporte.";
  if (a.status === "pendente") return "Seu pagamento ainda não foi confirmado. Se você saiu no meio, é só continuar.";
  if (a.status === "past_due") return "A última cobrança não passou. Assine de novo com outro cartão pra reativar.";
  return `Plano de ${reais(a.valor_mensal)} por mês, cobrado no cartão.`;
}

function renderizar(a) {
  const info = rotulosStatus[a.status] || rotulosStatus.inativa;
  statusEl.innerHTML = `
    <span class="badge ${info.classe}">${info.texto}</span>
    <p class="hint-text" style="margin-top:8px;">${escaparHtml(explicacao(a))}</p>
  `;
  const podeAssinar = !a.ativa && Boolean(a.valor_mensal) && a.pagamento_disponivel;
  botaoAssinar.hidden = !podeAssinar;
  botaoAssinar.textContent =
    a.status === "pendente" ? "Continuar pagamento" : `Assinar por ${a.valor_mensal ? reais(a.valor_mensal) : ""}/mês`;
  botaoCancelar.hidden = !(a.ativa && a.automatica);
  notaPagamentoEl.hidden = !podeAssinar && !(a.ativa && a.automatica);
}

async function carregarStatus() {
  try {
    const assinatura = await api.statusAssinatura();
    renderizar(assinatura);
    return assinatura;
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
    return null;
  }
}

/** Voltou do Mercado Pago: o webhook pode levar alguns segundos pra chegar —
 * consulta de novo por até ~30s antes de desistir de esperar. */
async function aguardarConfirmacao() {
  mostrarToast("Confirmando seu pagamento…", "info");
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const assinatura = await carregarStatus();
    if (assinatura?.ativa) {
      mostrarToast("Assinatura ativa! Bem-vindo ao Seklyn.", "sucesso");
      return;
    }
    await new Promise((resolver) => setTimeout(resolver, 3000));
  }
  mostrarToast("Ainda não recebemos a confirmação — ela aparece aqui assim que o Mercado Pago aprovar.", "info");
}

botaoAssinar?.addEventListener("click", async () => {
  botaoAssinar.disabled = true;
  try {
    const { checkout_url } = await api.iniciarCheckoutAssinatura();
    window.location.href = checkout_url;
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
    botaoAssinar.disabled = false;
  }
});

botaoCancelar?.addEventListener("click", async () => {
  const confirmou = await confirmarAcao(
    "A cobrança mensal para e o acesso de criar/editar treinos é bloqueado. Seus alunos e treinos continuam salvos.",
    { titulo: "Cancelar assinatura?", textoConfirmar: "Cancelar assinatura" }
  );
  if (!confirmou) return;
  botaoCancelar.disabled = true;
  try {
    renderizar(await api.cancelarAssinatura());
    mostrarToast("Assinatura cancelada.", "sucesso");
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botaoCancelar.disabled = false;
  }
});

if (parametros.get("status") === "retorno") {
  history.replaceState(null, "", window.location.pathname); // não repetir a espera num F5
  aguardarConfirmacao();
} else {
  carregarStatus();
}
