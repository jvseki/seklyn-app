// Seklyn — teste de cobrança real no cartão (painel admin). Cria uma
// assinatura de teste de R$ 1,00 SEPARADA (não mexe na assinatura de nenhum
// Personal), mostra o que o Mercado Pago fez e permite cancelar e reembolsar
// tudo. O backend só reembolsa assinaturas marcadas como teste.
import { api } from "./api.js";
import { montarFormularioCartao } from "./cartao-mp.js";
import { confirmarAcao } from "./confirmar.js";
import { $, escaparHtml, mensagemDeErro, mostrarToast } from "./utils.js";

const CHAVE_ID = "seklyn_teste_cartao_id"; // pra não perder o teste se recarregar a página

const secao = $("#teste-cartao");
const indisponivelEl = $("#teste-cartao-indisponivel");
const inicioEl = $("#teste-cartao-inicio");
const emailInput = $("#teste-cartao-email");
const botaoAbrir = $("#teste-cartao-abrir");
const brickEl = $("#teste-cartao-brick");
const resultadoEl = $("#teste-cartao-resultado");
const statusEl = $("#teste-cartao-status");
const botaoAtualizar = $("#teste-cartao-atualizar");
const botaoReembolsar = $("#teste-cartao-reembolsar");

const STATUS_ASSINATURA = {
  authorized: ["Assinatura de teste ativa", "badge-sucesso"],
  pending: ["Processando", "badge-aviso"],
  paused: ["Pausada", "badge-aviso"],
  cancelled: ["Cancelada", "badge-neutro"],
};
const STATUS_PAGAMENTO = {
  approved: ["Cobrado", "badge-sucesso"],
  refunded: ["Reembolsado", "badge-neutro"],
  pending: ["Processando", "badge-aviso"],
  in_process: ["Em análise", "badge-aviso"],
  authorized: ["Autorizado", "badge-aviso"],
  rejected: ["Recusado", "badge-perigo"],
  cancelled: ["Cancelado", "badge-neutro"],
};

let config = null;
let formulario = null;
let idAtual = null;
let consultaAutomatica = null;

const guardar = (id) => {
  try {
    id ? localStorage.setItem(CHAVE_ID, id) : localStorage.removeItem(CHAVE_ID);
  } catch {
    /* modo privado: segue sem lembrar */
  }
};
const lembrado = () => {
  try {
    return localStorage.getItem(CHAVE_ID);
  } catch {
    return null;
  }
};

function badge([texto, classe]) {
  return `<span class="badge ${classe}">${escaparHtml(texto)}</span>`;
}

function renderizar(teste) {
  const pagamentos = teste.pagamentos || [];
  const linhas = pagamentos.length
    ? pagamentos
        .map(
          (p) => `
          <div class="teste-cartao-pagamento">
            <span>Cobrança ${escaparHtml(p.id)}${p.valor != null ? ` · R$ ${Number(p.valor).toFixed(2).replace(".", ",")}` : ""}</span>
            ${badge(STATUS_PAGAMENTO[p.status] || [p.status || "?", "badge-neutro"])}
          </div>`
        )
        .join("")
    : `<p class="hint-text" style="margin-top:8px;">A primeira cobrança pode levar alguns minutos pra aparecer depois da autorização.</p>`;
  statusEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      ${badge(STATUS_ASSINATURA[teste.status] || [teste.status || "?", "badge-neutro"])}
      <span class="hint-text">ID ${escaparHtml(teste.preapproval_id)}</span>
    </div>
    ${linhas}
  `;
  const tudoResolvido = teste.status === "cancelled" && pagamentos.every((p) => p.status !== "approved" && p.status !== "pending" && p.status !== "in_process");
  botaoReembolsar.hidden = tudoResolvido;
  if (tudoResolvido) {
    pararConsultaAutomatica();
    guardar(null);
    inicioEl.hidden = false; // libera um teste novo
  }
}

async function consultar() {
  if (!idAtual) return;
  try {
    renderizar(await api.consultarTesteCartaoAdmin(idAtual));
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

function pararConsultaAutomatica() {
  clearInterval(consultaAutomatica);
  consultaAutomatica = null;
}

/** A cobrança aparece alguns segundos/minutos depois — consulta sozinho por ~2min. */
function consultarSozinho() {
  pararConsultaAutomatica();
  let vezes = 0;
  consultaAutomatica = setInterval(() => {
    vezes += 1;
    if (vezes > 24) return pararConsultaAutomatica();
    consultar();
  }, 5000);
}

function mostrarResultado(id) {
  idAtual = id;
  guardar(id);
  inicioEl.hidden = true;
  brickEl.hidden = true;
  resultadoEl.hidden = false;
  consultar();
  consultarSozinho();
}

botaoAbrir?.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!emailInput.checkValidity() || !email) {
    mostrarToast("Informe um e-mail válido pro pagador.", "erro");
    return;
  }
  inicioEl.hidden = true;
  brickEl.hidden = false;
  brickEl.innerHTML = "";
  try {
    formulario = await montarFormularioCartao({
      containerId: "teste-cartao-brick",
      publicKey: config.public_key,
      valor: config.valor,
      email,
      textoBotao: "Cobrar R$ 1,00 de teste",
      aoEnviar: (token) =>
        api
          .criarTesteCartaoAdmin(token, email)
          .then((criado) => {
            formulario?.desmontar();
            formulario = null;
            mostrarToast("Cartão aprovado! Assinatura de teste criada.", "sucesso");
            mostrarResultado(criado.preapproval_id);
          })
          .catch((erro) => {
            mostrarToast(mensagemDeErro(erro), "erro");
            throw erro; // volta o formulário pra edição
          }),
    });
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
    brickEl.hidden = true;
    inicioEl.hidden = false;
  }
});

botaoAtualizar?.addEventListener("click", consultar);

botaoReembolsar?.addEventListener("click", async () => {
  const confirmou = await confirmarAcao(
    "Cancela a assinatura de teste (sem novas cobranças) e devolve pro cartão o que já foi cobrado.",
    { titulo: "Cancelar e reembolsar?", textoConfirmar: "Cancelar e reembolsar", perigo: false }
  );
  if (!confirmou) return;
  botaoReembolsar.disabled = true;
  try {
    const r = await api.reembolsarTesteCartaoAdmin(idAtual);
    if (r.reembolsados.length) {
      mostrarToast(`Reembolso pedido (${r.reembolsados.length} cobrança). Volta pro cartão em alguns dias, conforme o banco.`, "sucesso");
    } else if (r.aguardando) {
      mostrarToast("Cancelada. A cobrança ainda está processando — clique de novo em alguns minutos pra reembolsar.", "info");
    } else {
      mostrarToast("Cancelada antes de qualquer cobrança — nada a reembolsar.", "sucesso");
    }
    await consultar();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botaoReembolsar.disabled = false;
  }
});

async function iniciar() {
  try {
    config = await api.configTesteCartaoAdmin();
  } catch {
    secao.hidden = true; // não é admin (o backend também bloqueia)
    return;
  }
  if (!config.disponivel) {
    indisponivelEl.hidden = false;
    return;
  }
  emailInput.value = config.email_sugerido;
  const idPendente = lembrado();
  if (idPendente) mostrarResultado(idPendente);
  else inicioEl.hidden = false;
}

iniciar();
