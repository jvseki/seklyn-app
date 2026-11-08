// Seklyn — assinatura mensal do Personal, cobrada no cartão pelo Mercado
// Pago. O cartão é digitado no formulário do próprio Mercado Pago (Card
// Brick) embutido aqui: ele vira um token de uso único e só esse token vai
// pro nosso backend — o número do cartão nunca passa pelo Seklyn, e o
// Personal não precisa ter conta no Mercado Pago.
import { api } from "./api.js";
import { protegerPagina } from "./auth.js";
import { montarFormularioCartao } from "./cartao-mp.js";
import { confirmarAcao } from "./confirmar.js";
import { $, escaparHtml, formatarDataHora, mensagemDeErro, mostrarToast } from "./utils.js";

protegerPagina();

const statusEl = $("#status-assinatura");
const botaoAssinar = $("#botao-assinar");
const botaoCancelar = $("#botao-cancelar-assinatura");
const notaPagamentoEl = $("#nota-pagamento");
const containerCartao = $("#cartao-brick");
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

if (new URLSearchParams(window.location.search).get("boas-vindas") === "1" && boasVindasEl) {
  boasVindasEl.hidden = false;
}

let assinaturaAtual = null;
let formularioCartao = null; // controlador do Card Brick montado (pra desmontar depois)

/** Texto de apoio abaixo do status, conforme a situação. */
function explicacao(a) {
  if (a.ativa && a.automatica) {
    return `${reais(a.valor_mensal)} por mês no cartão${a.current_period_end ? ` · próxima cobrança em ${formatarDataHora(a.current_period_end)}` : ""}.`;
  }
  if (a.ativa) return "Ativada pelo suporte do Seklyn.";
  if (!a.valor_mensal) return "Seu plano ainda não foi definido. Fale com o suporte pra combinar o valor.";
  if (!a.pagamento_disponivel) return "O pagamento com cartão estará disponível em breve. Fale com o suporte.";
  if (a.status === "pendente") return "O Mercado Pago ainda está processando seu pagamento. Atualize a página em instantes.";
  if (a.status === "past_due") return "A última cobrança não passou. Assine de novo com outro cartão pra reativar.";
  return `Plano de ${reais(a.valor_mensal)} por mês, cobrado automaticamente no cartão.`;
}

function renderizar(a) {
  assinaturaAtual = a;
  const info = rotulosStatus[a.status] || rotulosStatus.inativa;
  statusEl.innerHTML = `
    <span class="badge ${info.classe}">${info.texto}</span>
    <p class="hint-text" style="margin-top:8px;">${escaparHtml(explicacao(a))}</p>
  `;
  const podeAssinar = !a.ativa && a.status !== "pendente" && Boolean(a.valor_mensal) && a.pagamento_disponivel;
  botaoAssinar.hidden = !podeAssinar || Boolean(formularioCartao);
  botaoAssinar.textContent = `Assinar por ${a.valor_mensal ? reais(a.valor_mensal) : ""}/mês`;
  botaoCancelar.hidden = !(a.ativa && a.automatica);
  notaPagamentoEl.hidden = !podeAssinar && !(a.ativa && a.automatica);
}

async function carregarStatus() {
  try {
    renderizar(await api.statusAssinatura());
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

function fecharFormularioCartao() {
  formularioCartao?.desmontar();
  formularioCartao = null;
  containerCartao.hidden = true;
  containerCartao.innerHTML = "";
}

/** Abre o formulário de cartão do Mercado Pago (ver cartao-mp.js). */
async function abrirFormularioCartao() {
  const a = assinaturaAtual;
  botaoAssinar.hidden = true;
  containerCartao.hidden = false;
  containerCartao.innerHTML = '<div class="spinner" style="margin:var(--espaco-4) auto;"></div>';
  const personal = await api.me().catch(() => null);
  try {
    containerCartao.innerHTML = "";
    formularioCartao = await montarFormularioCartao({
      containerId: "cartao-brick",
      publicKey: a.mp_public_key,
      valor: a.valor_mensal,
      email: personal?.email,
      textoBotao: `Assinar por ${reais(a.valor_mensal)}/mês`,
      aoEnviar: (token) =>
        api
          .assinarComCartao(token)
          .then((assinatura) => {
            fecharFormularioCartao();
            renderizar(assinatura);
            mostrarToast(
              assinatura.ativa ? "Assinatura ativa! Bem-vindo ao Seklyn." : "Pagamento enviado — aguardando confirmação do Mercado Pago.",
              "sucesso"
            );
          })
          .catch((erro) => {
            mostrarToast(mensagemDeErro(erro), "erro");
            throw erro; // devolve o formulário pro estado de edição
          }),
    });
  } catch (erro) {
    console.warn("Não deu pra montar o formulário de cartão:", erro);
    fecharFormularioCartao();
    renderizar(assinaturaAtual);
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

botaoAssinar?.addEventListener("click", abrirFormularioCartao);

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

carregarStatus();
