// Seklyn — teste de cobrança real de R$ 1,00 (painel admin), em 3 formas:
//   • Crédito: assinatura de teste SEPARADA (preapproval), cancela e reembolsa.
//   • Débito: cobrança única no cartão de débito, reembolsa.
//   • Pix: QR de R$ 1,00; pago → reembolsa; não pago → cancela o QR.
// Não mexe na assinatura de nenhum Personal: o backend só consulta e
// reembolsa o que tem a marca de teste.
import { api } from "./api.js";
import { montarFormularioCartao } from "./cartao-mp.js";
import { confirmarAcao } from "./confirmar.js";
import { $, escaparHtml, mensagemDeErro, mostrarToast } from "./utils.js";

const CHAVE = "seklyn_teste_cartao_id"; // pra não perder o teste se recarregar a página

const secao = $("#teste-cartao");
const indisponivelEl = $("#teste-cartao-indisponivel");
const inicioEl = $("#teste-cartao-inicio");
const emailInput = $("#teste-cartao-email");
const botaoAbrir = $("#teste-cartao-abrir");
const brickEl = $("#teste-cartao-brick");
const pixEl = $("#teste-cartao-pix");
const botaoVoltar = $("#teste-cartao-voltar");
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
  pending: ["Aguardando pagamento", "badge-aviso"],
  in_process: ["Em análise", "badge-aviso"],
  authorized: ["Autorizado", "badge-aviso"],
  rejected: ["Recusado", "badge-perigo"],
  cancelled: ["Cancelado", "badge-neutro"],
};
const NOMES = { credito: "Crédito", debito: "Débito", pix: "Pix" };
const reais = (v) => `R$ ${Number(v).toFixed(2).replace(".", ",")}`;

let config = null;
let formulario = null;
let atual = null; // { tipo: "credito" | "debito" | "pix", id }
let consultaAutomatica = null;

// ---------- memória do teste em andamento ----------

const guardar = (teste) => {
  try {
    teste ? localStorage.setItem(CHAVE, JSON.stringify(teste)) : localStorage.removeItem(CHAVE);
  } catch {
    /* modo privado: segue sem lembrar */
  }
};
const lembrado = () => {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    return bruto.startsWith("{") ? JSON.parse(bruto) : { tipo: "credito", id: bruto }; // formato antigo
  } catch {
    return null;
  }
};

const formaEscolhida = () => document.querySelector("input[name='teste-forma']:checked")?.value || "credito";

document.querySelectorAll("input[name='teste-forma']").forEach((r) =>
  r.addEventListener("change", () => {
    document
      .querySelectorAll("#teste-cartao .metodo")
      .forEach((o) => o.classList.toggle("selecionado", o.querySelector("input").checked));
    botaoAbrir.textContent = { credito: "Continuar no crédito", debito: "Continuar no débito", pix: "Gerar Pix de R$ 1,00" }[formaEscolhida()];
  })
);

// ---------- resultado ----------

const badge = ([texto, classe]) => `<span class="badge ${classe}">${escaparHtml(texto)}</span>`;

function renderizarAssinatura(teste) {
  const pagamentos = teste.pagamentos || [];
  const linhas = pagamentos.length
    ? pagamentos
        .map(
          (p) => `
          <div class="teste-cartao-pagamento">
            <span>Cobrança ${escaparHtml(p.id)}${p.valor != null ? ` · ${reais(p.valor)}` : ""}</span>
            ${badge(STATUS_PAGAMENTO[p.status] || [p.status || "?", "badge-neutro"])}
          </div>`
        )
        .join("")
    : `<p class="hint-text" style="margin-top:8px;">A primeira cobrança pode levar alguns minutos pra aparecer depois da autorização.</p>`;
  statusEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <strong>Crédito</strong>
      ${badge(STATUS_ASSINATURA[teste.status] || [teste.status || "?", "badge-neutro"])}
      <span class="hint-text">ID ${escaparHtml(teste.preapproval_id)}</span>
    </div>
    ${linhas}`;
  const resolvido =
    teste.status === "cancelled" && pagamentos.every((p) => !["approved", "pending", "in_process"].includes(p.status));
  return resolvido;
}

function renderizarAvulso(p) {
  statusEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <strong>${NOMES[p.tipo] || p.tipo}</strong>
      ${badge(STATUS_PAGAMENTO[p.status] || [p.status || "?", "badge-neutro"])}
      <span class="hint-text">${p.valor != null ? reais(p.valor) + " · " : ""}ID ${escaparHtml(p.pagamento_id)}</span>
    </div>`;
  // Pix pago: some o QR. Pix aberto: QR continua na tela (também depois de recarregar).
  if (p.pix_qr_code_base64) $("#teste-cartao-pix-qr").src = `data:image/png;base64,${p.pix_qr_code_base64}`;
  if (p.pix_qr_code) $("#teste-cartao-pix-codigo").value = p.pix_qr_code;
  pixEl.hidden = !(p.tipo === "pix" && p.status === "pending");
  botaoReembolsar.textContent = p.status === "pending" ? "Cancelar Pix" : "Reembolsar";
  return ["refunded", "cancelled", "rejected"].includes(p.status);
}

async function consultar() {
  if (!atual) return;
  try {
    const resolvido =
      atual.tipo === "credito"
        ? renderizarAssinatura(await api.consultarTesteCartaoAdmin(atual.id))
        : renderizarAvulso(await api.consultarTestePagamentoAdmin(atual.id));
    botaoReembolsar.hidden = resolvido;
    if (resolvido) finalizar();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

function finalizar() {
  pararConsultaAutomatica();
  guardar(null);
  atual = null;
  pixEl.hidden = true;
  inicioEl.hidden = false; // libera um teste novo
}

function pararConsultaAutomatica() {
  clearInterval(consultaAutomatica);
  consultaAutomatica = null;
}

/** A cobrança/o Pix confirma alguns segundos ou minutos depois: consulta sozinho. */
function consultarSozinho() {
  pararConsultaAutomatica();
  let vezes = 0;
  consultaAutomatica = setInterval(() => {
    if (++vezes > 120) return pararConsultaAutomatica();
    consultar();
  }, 5000);
}

function mostrarResultado(teste) {
  atual = teste;
  guardar(teste);
  inicioEl.hidden = true;
  brickEl.hidden = true;
  botaoVoltar.hidden = true;
  resultadoEl.hidden = false;
  botaoReembolsar.textContent = teste.tipo === "credito" ? "Cancelar e reembolsar" : "Reembolsar";
  consultar();
  consultarSozinho();
}

// ---------- início do teste ----------

function voltarAoInicio() {
  formulario?.desmontar();
  formulario = null;
  brickEl.hidden = true;
  brickEl.innerHTML = "";
  botaoVoltar.hidden = true;
  inicioEl.hidden = false;
}
botaoVoltar?.addEventListener("click", voltarAoInicio);

botaoAbrir?.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!emailInput.checkValidity() || !email) {
    mostrarToast("Informe um e-mail válido pro pagador.", "erro");
    return;
  }
  const tipo = formaEscolhida();

  if (tipo === "pix") {
    botaoAbrir.disabled = true;
    try {
      const pix = await api.criarTestePixAdmin(email);
      $("#teste-cartao-pix-qr").src = `data:image/png;base64,${pix.pix_qr_code_base64}`;
      $("#teste-cartao-pix-codigo").value = pix.pix_qr_code || "";
      mostrarResultado({ tipo: "pix", id: pix.pagamento_id });
      pixEl.hidden = false;
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    } finally {
      botaoAbrir.disabled = false;
    }
    return;
  }

  inicioEl.hidden = true;
  brickEl.hidden = false;
  brickEl.innerHTML = "";
  botaoVoltar.hidden = false;
  try {
    formulario = await montarFormularioCartao({
      containerId: "teste-cartao-brick",
      publicKey: config.public_key,
      valor: config.valor,
      email,
      textoBotao: `Cobrar R$ 1,00 no ${tipo === "debito" ? "débito" : "crédito"}`,
      tiposExcluidos: tipo === "debito" ? ["credit_card", "prepaid_card"] : ["debit_card", "prepaid_card"],
      aoEnviar: (token, dados) => {
        const pedido =
          tipo === "credito"
            ? api.criarTesteCartaoAdmin(token, email).then((c) => ({ tipo: "credito", id: c.preapproval_id }))
            : api
                .criarTesteDebitoAdmin({
                  card_token: token,
                  payer_email: email,
                  payment_method_id: dados?.payment_method_id,
                  issuer_id: dados?.issuer_id != null ? String(dados.issuer_id) : null,
                  documento_tipo: dados?.payer?.identification?.type || null,
                  documento_numero: dados?.payer?.identification?.number || null,
                })
                .then((p) => ({ tipo: "debito", id: p.pagamento_id }));
        return pedido
          .then((teste) => {
            formulario?.desmontar();
            formulario = null;
            mostrarToast(`Cartão aprovado no ${NOMES[tipo].toLowerCase()}!`, "sucesso");
            mostrarResultado(teste);
          })
          .catch((erro) => {
            mostrarToast(mensagemDeErro(erro), "erro");
            throw erro; // volta o formulário pra edição
          });
      },
    });
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
    voltarAoInicio();
  }
});

$("#teste-cartao-pix-copiar")?.addEventListener("click", async () => {
  const campo = $("#teste-cartao-pix-codigo");
  try {
    await navigator.clipboard.writeText(campo.value);
  } catch {
    campo.select();
    document.execCommand("copy");
  }
  mostrarToast("Código Pix copiado!", "sucesso");
});

botaoAtualizar?.addEventListener("click", consultar);

botaoReembolsar?.addEventListener("click", async () => {
  const credito = atual?.tipo === "credito";
  const confirmou = await confirmarAcao(
    credito
      ? "Cancela a assinatura de teste (sem novas cobranças) e devolve pro cartão o que já foi cobrado."
      : "Devolve o R$ 1,00 do teste (se o Pix ainda não foi pago, só cancela o QR).",
    { titulo: credito ? "Cancelar e reembolsar?" : "Reembolsar o teste?", textoConfirmar: "Confirmar", perigo: false }
  );
  if (!confirmou) return;
  botaoReembolsar.disabled = true;
  try {
    if (credito) {
      const r = await api.reembolsarTesteCartaoAdmin(atual.id);
      if (r.reembolsados.length) mostrarToast("Reembolso pedido. Volta pro cartão em alguns dias, conforme o banco.", "sucesso");
      else if (r.aguardando) mostrarToast("Cancelada. A cobrança ainda está processando: clique de novo em alguns minutos.", "info");
      else mostrarToast("Cancelada antes de qualquer cobrança: nada a reembolsar.", "sucesso");
    } else {
      const p = await api.reembolsarTestePagamentoAdmin(atual.id);
      mostrarToast(p.status === "refunded" ? "Reembolso feito!" : p.status === "cancelled" ? "Pix cancelado." : "Pedido enviado.", "sucesso");
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
  const pendente = lembrado();
  if (pendente) mostrarResultado(pendente);
  else inicioEl.hidden = false;
}

iniciar();
