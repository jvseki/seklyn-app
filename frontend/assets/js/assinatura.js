// Seklyn — assinatura mensal do Personal, paga pelo Mercado Pago de 3 jeitos:
//   • Crédito: assinatura automática, cobra sozinha todo mês.
//   • Débito / Pix: paga um mês por vez; perto do vencimento aparece um aviso
//     grande em todas as telas (ver auth.js) pra pagar o próximo mês.
// Antes de pagar, a tela mostra as datas (hoje, próxima cobrança / até
// quando vale) e a regra de cancelamento: até N horas depois do pagamento
// devolve o dinheiro; depois disso só para a renovação e o acesso vai até o
// fim do mês pago.
// O cartão é digitado no formulário do próprio Mercado Pago (Card Brick,
// ver cartao-mp.js): só um token de uso único vem pro Seklyn.
import { api } from "./api.js";
import { protegerPagina } from "./auth.js";
import { montarFormularioCartao } from "./cartao-mp.js";
import { confirmarAcao } from "./confirmar.js";
import { $, $all, escaparHtml, formatarDataHora, mensagemDeErro, mostrarToast } from "./utils.js";

protegerPagina();

const statusEl = $("#status-assinatura");
const pagamentoEl = $("#pagamento");
const tituloPagamentoEl = $("#pagamento-titulo");
const resumoEl = $("#resumo-compra");
const botaoContinuar = $("#botao-continuar");
const containerCartao = $("#cartao-brick");
const pixArea = $("#pix-area");
const botaoVoltar = $("#botao-voltar-pagamento");
const botaoCancelar = $("#botao-cancelar-assinatura");
const notaCancelamentoEl = $("#nota-cancelamento");
const notaPagamentoEl = $("#nota-pagamento");
const boasVindasEl = $("#boas-vindas");

const rotulosStatus = {
  active: { texto: "Ativa", classe: "badge-sucesso" },
  trialing: { texto: "Em teste", classe: "badge-sucesso" },
  pendente: { texto: "Aguardando pagamento", classe: "badge-aviso" },
  past_due: { texto: "Cobrança recusada", classe: "badge-aviso" },
  vencida: { texto: "Vencida", classe: "badge-perigo" },
  canceled: { texto: "Cancelada", classe: "badge-perigo" },
  inativa: { texto: "Inativa", classe: "badge-perigo" },
};
const NOMES_FORMA = { credito: "cartão de crédito", debito: "cartão de débito", pix: "Pix" };

const reais = (valor) => Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (d) => formatarDataHora(d instanceof Date ? d.toISOString() : d);
const hora = (d) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** 08/11 + 1 mês = 08/12; 31/01 + 1 mês = último dia de fevereiro. */
function somarUmMes(d) {
  const r = new Date(d);
  const dia = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + 1);
  const ultimoDia = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(dia, ultimoDia));
  return r;
}

if (new URLSearchParams(window.location.search).get("boas-vindas") === "1" && boasVindasEl) {
  boasVindasEl.hidden = false;
}

let assinaturaAtual = null;
let formaEscolhida = null;
let fluxoAberto = false; // formulário de cartão ou Pix na tela
let formularioCartao = null;
let consultaPix = null;

// ---------- Status ----------

function explicacao(a) {
  const fim = a.current_period_end ? data(a.current_period_end) : "";
  if (a.status === "vencida") return `Sua assinatura venceu em ${fim}. Pague pra voltar a criar e editar treinos.`;
  if (a.ativa && a.cancelamento_agendado) return `Cancelada: continua ativa até ${fim} e não será renovada.`;
  if (a.ativa && a.automatica) return `${reais(a.valor_mensal)} por mês no cartão de crédito · próxima cobrança automática em ${fim}.`;
  if (a.ativa && (a.forma_pagamento === "pix" || a.forma_pagamento === "debito")) {
    const dias = a.dias_para_vencer;
    const quando = dias === 0 ? "vence hoje" : `faltam ${dias} dia${dias === 1 ? "" : "s"}`;
    return `Paga com ${NOMES_FORMA[a.forma_pagamento]} até ${fim} (${quando}). Pix e débito não renovam sozinhos: avisamos antes pra você pagar o próximo mês.`;
  }
  if (a.ativa) return "Ativada pelo suporte do Seklyn.";
  if (!a.valor_mensal) return "Seu plano ainda não foi definido. Fale com o suporte pra combinar o valor.";
  if (!a.pagamento_disponivel) return "O pagamento estará disponível em breve. Fale com o suporte.";
  if (a.pagamento_em_andamento) return "Seu pagamento está sendo processado. A tela atualiza quando confirmar.";
  if (a.status === "pendente") return "O Mercado Pago ainda está processando seu pagamento. Atualize a página em instantes.";
  if (a.status === "past_due") return "A última cobrança não passou. Pague de novo (cartão ou Pix) pra reativar.";
  return `Plano de ${reais(a.valor_mensal)} por mês.`;
}

function renderizar(a) {
  assinaturaAtual = a;
  const info = rotulosStatus[a.status] || rotulosStatus.inativa;
  statusEl.innerHTML = `
    <span class="badge ${info.classe}">${info.texto}</span>
    <p class="hint-text" style="margin-top:8px;">${escaparHtml(explicacao(a))}</p>
  `;

  // Formas de pagamento liberadas agora.
  const liberadas = { credito: a.pode_assinar_credito, debito: a.pode_pagar_avulso, pix: a.pode_pagar_avulso };
  const algumaLiberada = Object.values(liberadas).some(Boolean);
  $all(".forma-opcao").forEach((opcao) => {
    opcao.hidden = !liberadas[opcao.dataset.forma];
  });
  if (formaEscolhida && !liberadas[formaEscolhida]) escolherForma(null);
  tituloPagamentoEl.textContent = !a.ativa
    ? "Como você quer pagar?"
    : a.pode_pagar_avulso
      ? "Pagar o próximo mês"
      : "Prefere cobrança automática no crédito?";
  pagamentoEl.hidden = !algumaLiberada || fluxoAberto;

  // Cancelamento.
  const podeCancelar = a.ativa && Boolean(a.forma_pagamento) && !a.cancelamento_agendado && !fluxoAberto;
  botaoCancelar.hidden = !podeCancelar;
  notaCancelamentoEl.hidden = !podeCancelar;
  if (podeCancelar) {
    if (a.reembolso_ate) {
      botaoCancelar.textContent = "Cancelar e receber reembolso";
      notaCancelamentoEl.textContent = `Você pagou há menos de ${a.reembolso_horas}h: cancelando até ${hora(a.reembolso_ate)} de ${data(a.reembolso_ate)}, o valor volta inteiro.`;
    } else {
      botaoCancelar.textContent = a.automatica ? "Cancelar renovação automática" : "Cancelar assinatura";
      notaCancelamentoEl.textContent = `Já passou o prazo de reembolso (${a.reembolso_horas}h depois do pagamento). Cancelando, sua assinatura continua ativa até ${data(a.current_period_end)} e não é renovada.`;
    }
  }
  notaPagamentoEl.hidden = !algumaLiberada && !a.ativa;
  if (formaEscolhida) mostrarResumo();
}

async function carregarStatus() {
  try {
    renderizar(await api.statusAssinatura());
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

// ---------- Escolha + resumo (antes de finalizar) ----------

function escolherForma(forma) {
  formaEscolhida = forma;
  $all(".forma-opcao").forEach((opcao) => {
    const ativa = opcao.dataset.forma === forma;
    opcao.classList.toggle("selecionada", ativa);
    opcao.querySelector("input").checked = ativa;
  });
  resumoEl.hidden = !forma;
  botaoContinuar.hidden = !forma;
  if (forma) mostrarResumo();
}

function mostrarResumo() {
  const a = assinaturaAtual;
  const hoje = new Date();
  // Ainda tem mês pago? O próximo começa quando ele acabar (ninguém perde dias).
  const fimAtual = a.ativa && a.current_period_end ? new Date(a.current_period_end) : null;
  const base = fimAtual && fimAtual > hoje ? fimAtual : hoje;
  const proxima = somarUmMes(base);
  const valor = reais(a.valor_mensal);
  const linhas = [`<div class="resumo-linha"><span>Hoje</span><strong>${data(hoje)}</strong></div>`];
  let cobraAgora = true;
  let fimSeCancelar = proxima;

  if (formaEscolhida === "credito") {
    if (base > hoje) {
      cobraAgora = false;
      fimSeCancelar = base;
      linhas.push(`<div class="resumo-linha"><span>Cobrado agora</span><strong>nada — você já tem até ${data(base)}</strong></div>`);
      linhas.push(`<div class="resumo-linha"><span>1ª cobrança automática</span><strong>${data(base)} · ${valor}</strong></div>`);
    } else {
      fimSeCancelar = proxima;
      linhas.push(`<div class="resumo-linha"><span>Cobrado agora</span><strong>${valor}</strong></div>`);
      linhas.push(`<div class="resumo-linha"><span>Próxima cobrança automática</span><strong>${data(proxima)} · ${valor}</strong></div>`);
    }
    linhas.push(`<p class="resumo-nota">Depois, todo mês no mesmo dia, sem você precisar fazer nada.</p>`);
  } else {
    linhas.push(`<div class="resumo-linha"><span>Pago agora</span><strong>${valor} (1 mês)</strong></div>`);
    linhas.push(`<div class="resumo-linha"><span>Seu acesso vai até</span><strong>${data(proxima)}</strong></div>`);
    linhas.push(
      `<p class="resumo-nota">${formaEscolhida === "pix" ? "Pix" : "Débito"} não renova sozinho: alguns dias antes de ${data(proxima)} aparece um aviso pra você pagar o próximo mês.</p>`
    );
  }
  if (a.reembolso_horas > 0 && cobraAgora) {
    linhas.push(
      `<p class="resumo-nota resumo-cancelamento"><strong>Cancelamento:</strong> em até ${a.reembolso_horas}h depois do pagamento, você recebe o valor de volta. Depois disso, a assinatura fica ativa até ${data(fimSeCancelar)} e não renova.</p>`
    );
  } else {
    linhas.push(
      `<p class="resumo-nota resumo-cancelamento"><strong>Cancelamento:</strong> pode cancelar quando quiser; a assinatura fica ativa até o fim do mês já pago e não renova.</p>`
    );
  }
  resumoEl.innerHTML = linhas.join("");
  botaoContinuar.textContent =
    formaEscolhida === "pix" ? `Gerar Pix de ${valor}` : formaEscolhida === "debito" ? `Pagar ${valor} no débito` : cobraAgora ? `Assinar por ${valor}/mês` : "Ativar cobrança automática";
}

$all(".forma-opcao input").forEach((input) => input.addEventListener("change", () => escolherForma(input.value)));

// ---------- Fluxos de pagamento ----------

function abrirFluxo() {
  fluxoAberto = true;
  pagamentoEl.hidden = true;
  botaoCancelar.hidden = true;
  notaCancelamentoEl.hidden = true;
  botaoVoltar.hidden = false;
}

function fecharFluxo() {
  fluxoAberto = false;
  formularioCartao?.desmontar();
  formularioCartao = null;
  containerCartao.hidden = true;
  containerCartao.innerHTML = "";
  pixArea.hidden = true;
  clearInterval(consultaPix);
  consultaPix = null;
  botaoVoltar.hidden = true;
}

function sucesso(a, antes) {
  fecharFluxo();
  escolherForma(null);
  renderizar(a);
  const renovou = antes?.ativa;
  mostrarToast(renovou ? "Pagamento confirmado! Mais um mês garantido." : "Assinatura ativa! Bem-vindo ao Seklyn.", "sucesso");
}

/** Pix/débito em processamento: consulta a cada 5s até confirmar (até ~30 min). */
function aguardarConfirmacao(antes) {
  clearInterval(consultaPix);
  let vezes = 0;
  consultaPix = setInterval(async () => {
    vezes += 1;
    if (vezes > 360) return clearInterval(consultaPix);
    try {
      const a = await api.statusAssinatura();
      if (!a.pagamento_em_andamento) {
        clearInterval(consultaPix);
        if (a.ativa && a.current_period_end !== antes?.current_period_end) sucesso(a, antes);
        else {
          fecharFluxo();
          renderizar(a);
          mostrarToast("O pagamento não foi concluído (Pix expirado ou recusado). Tente de novo.", "erro");
        }
      }
    } catch {
      /* rede instável: tenta na próxima */
    }
  }, 5000);
}

async function pagarComCartao() {
  const a = assinaturaAtual;
  const forma = formaEscolhida;
  abrirFluxo();
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
      textoBotao: botaoContinuar.textContent,
      tiposExcluidos: forma === "credito" ? ["debit_card", "prepaid_card"] : ["credit_card", "prepaid_card"],
      aoEnviar: (token, dados) => {
        const extras =
          forma === "debito"
            ? {
                payment_method_id: dados?.payment_method_id,
                issuer_id: dados?.issuer_id != null ? String(dados.issuer_id) : null,
                documento_tipo: dados?.payer?.identification?.type || null,
                documento_numero: dados?.payer?.identification?.number || null,
              }
            : {};
        return api
          .assinarComCartao(token, forma, extras)
          .then((resultado) => {
            if (resultado.pagamento_em_andamento && !resultado.ativa) {
              formularioCartao?.desmontar();
              formularioCartao = null;
              containerCartao.hidden = true;
              renderizar(resultado);
              mostrarToast("Pagamento em análise pelo banco — a tela atualiza sozinha quando confirmar.", "info");
              aguardarConfirmacao(a);
              return;
            }
            sucesso(resultado, a);
          })
          .catch((erro) => {
            mostrarToast(mensagemDeErro(erro), "erro");
            throw erro; // devolve o formulário pro estado de edição
          });
      },
    });
  } catch (erro) {
    console.warn("Não deu pra montar o formulário de cartão:", erro);
    fecharFluxo();
    renderizar(assinaturaAtual);
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

async function pagarComPix() {
  const antes = assinaturaAtual;
  abrirFluxo();
  botaoContinuar.disabled = true;
  try {
    const pix = await api.gerarPixAssinatura();
    $("#pix-qr").src = `data:image/png;base64,${pix.qr_code_base64}`;
    $("#pix-codigo").value = pix.qr_code;
    $("#pix-expira").textContent = pix.expira_em ? `Esse Pix vale até ${hora(pix.expira_em)} de ${data(pix.expira_em)}.` : "";
    pixArea.hidden = false;
    aguardarConfirmacao(antes);
  } catch (erro) {
    fecharFluxo();
    renderizar(assinaturaAtual);
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botaoContinuar.disabled = false;
  }
}

botaoContinuar?.addEventListener("click", () => {
  if (!formaEscolhida) return;
  if (formaEscolhida === "pix") pagarComPix();
  else pagarComCartao();
});

botaoVoltar?.addEventListener("click", () => {
  fecharFluxo();
  carregarStatus();
});

$("#pix-copiar")?.addEventListener("click", async () => {
  const codigo = $("#pix-codigo").value;
  try {
    await navigator.clipboard.writeText(codigo);
  } catch {
    $("#pix-codigo").select();
    document.execCommand("copy");
  }
  mostrarToast("Código Pix copiado! Cole no app do seu banco.", "sucesso");
});

// ---------- Cancelamento ----------

botaoCancelar?.addEventListener("click", async () => {
  const a = assinaturaAtual;
  const comReembolso = Boolean(a.reembolso_ate);
  const confirmou = await confirmarAcao(
    comReembolso
      ? `Você recebe ${reais(a.valor_mensal)} de volta (o prazo do estorno depende do seu banco) e o acesso de criar/editar treinos é bloqueado. Seus alunos e treinos continuam salvos.`
      : `Sem reembolso (passou de ${a.reembolso_horas}h do pagamento). Sua assinatura continua ativa até ${data(a.current_period_end)} e depois não renova. Seus alunos e treinos continuam salvos.`,
    { titulo: comReembolso ? "Cancelar e receber reembolso?" : "Cancelar assinatura?", textoConfirmar: "Cancelar assinatura" }
  );
  if (!confirmou) return;
  botaoCancelar.disabled = true;
  try {
    const depois = await api.cancelarAssinatura();
    renderizar(depois);
    mostrarToast(
      depois.ativa ? `Cancelada. Você continua usando até ${data(depois.current_period_end)}.` : comReembolso ? "Cancelada e reembolso pedido." : "Assinatura cancelada.",
      "sucesso"
    );
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botaoCancelar.disabled = false;
  }
});

carregarStatus();
