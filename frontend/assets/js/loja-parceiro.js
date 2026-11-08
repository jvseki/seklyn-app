// Seklyn — loja do parceiro (TESTE, só admin). O cliente paga por Pix na
// conta Mercado Pago do dono; o backend lê a taxa real e divide o líquido
// pelo percentual do parceiro. O repasse é um Pix "copia e cola" com a chave
// e o valor do parceiro já preenchidos (o Mercado Pago não envia Pix sozinho
// pra chave de terceiros) — o dono escaneia no app e marca como repassado.
import { api } from "./api.js";
import { protegerPagina } from "./auth.js";
import { confirmarAcao } from "./confirmar.js";
import { $, escaparHtml, formatarDataHoraCompleta, mensagemDeErro, mostrarToast } from "./utils.js";

protegerPagina();

const reais = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const STATUS_VENDA = {
  aguardando: ["Aguardando Pix", "badge-aviso"],
  paga: ["Paga", "badge-sucesso"],
  reembolsada: ["Reembolsada", "badge-neutro"],
  expirada: ["Expirada", "badge-neutro"],
};

let painel = null;
let consultaVenda = null;
let vendaDoRepasse = null;

// ---------- Painel ----------

async function carregar() {
  try {
    painel = await api.painelLojaAdmin();
  } catch (erro) {
    if (erro?.status === 403) window.location.href = "dashboard.html";
    mostrarToast(mensagemDeErro(erro), "erro");
    return;
  }
  const p = painel.parceiro;
  const nome = p?.nome || "parceiro";
  $("#loja-vendido").textContent = reais(painel.total_vendido);
  $("#loja-taxas").textContent = reais(painel.total_taxas);
  $("#loja-a-repassar").textContent = reais(painel.a_repassar);
  $("#loja-rotulo-repassar").textContent = `A repassar ao ${nome}`;
  $("#loja-liquido").textContent = reais(painel.liquido_dono);
  if (p && !$("#form-parceiro").dataset.preenchido) {
    $("#parceiro-nome").value = p.nome;
    $("#parceiro-tipo").value = p.chave_pix_tipo;
    $("#parceiro-chave").value = p.chave_pix;
    $("#parceiro-cidade").value = p.cidade;
    $("#parceiro-percentual").value = p.percentual_parceiro;
    $("#form-parceiro").dataset.preenchido = "1";
  }
  simular();
  renderizarVendas();
}

function renderizarVendas() {
  const lista = $("#lista-vendas");
  const nome = escaparHtml(painel.parceiro?.nome || "parceiro");
  if (!painel.vendas.length) {
    lista.innerHTML = `<p class="hint-text">Nenhuma venda ainda. ${painel.parceiro ? "Gere um Pix de teste ao lado." : "Cadastre o parceiro primeiro."}</p>`;
    return;
  }
  lista.innerHTML = painel.vendas
    .map((v) => {
      const [texto, classe] = STATUS_VENDA[v.status] || [v.status, "badge-neutro"];
      const paga = v.status === "paga";
      const divisao = v.parte_parceiro != null
        ? `<div class="venda-divisao">
            <span>Taxa MP <strong>${reais(v.taxa_mp)}</strong></span>
            <span>${nome} (${v.percentual_parceiro}%) <strong>${reais(v.parte_parceiro)}</strong></span>
            <span>Você <strong>${reais(v.parte_dono)}</strong></span>
          </div>`
        : "";
      const repasse = paga
        ? v.repasse_status === "feito"
          ? `<span class="badge badge-sucesso">Repassado ${v.repassado_em ? "em " + formatarDataHoraCompleta(v.repassado_em) : ""}</span>`
          : `<button class="btn btn-primary btn-sm" data-repassar="${v.id}">Repassar ${reais(v.parte_parceiro)} ao ${nome}</button>`
        : "";
      return `
        <article class="venda-item">
          <div class="venda-topo">
            <div>
              <strong>${escaparHtml(v.produto)}</strong> · ${reais(v.valor)}
              <div class="hint-text">#${v.id} · ${formatarDataHoraCompleta(v.criado_em)}</div>
            </div>
            <span class="badge ${classe}">${texto}</span>
          </div>
          ${divisao}
          ${paga ? `<div class="venda-acoes">${repasse}<button class="btn btn-ghost btn-sm" data-reembolsar="${v.id}">Reembolsar (teste)</button></div>` : ""}
        </article>`;
    })
    .join("");
}

// ---------- Parceiro ----------

$("#form-parceiro").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api.salvarParceiroAdmin({
      nome: $("#parceiro-nome").value.trim(),
      chave_pix_tipo: $("#parceiro-tipo").value,
      chave_pix: $("#parceiro-chave").value.trim(),
      cidade: $("#parceiro-cidade").value.trim() || "Andradina",
      percentual_parceiro: Number($("#parceiro-percentual").value || 50),
    });
    delete $("#form-parceiro").dataset.preenchido;
    mostrarToast("Parceiro salvo.", "sucesso");
    carregar();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
});

// ---------- Simulação antes de vender ----------

function simular() {
  const valor = Number($("#venda-valor").value || 0);
  const pct = Number($("#parceiro-percentual").value || 50);
  const nome = escaparHtml($("#parceiro-nome").value || "Parceiro");
  if (!valor || !painel) {
    $("#venda-simulacao").innerHTML = "";
    return;
  }
  const taxa = Math.round(valor * painel.taxa_pix_estimada * 100) / 100;
  const liquido = valor - taxa;
  const parceiro = Math.round(liquido * pct) / 100;
  $("#venda-simulacao").innerHTML = `
    <div class="resumo-linha"><span>Venda</span><strong>${reais(valor)}</strong></div>
    <div class="resumo-linha"><span>Taxa Pix estimada (${(painel.taxa_pix_estimada * 100).toFixed(2).replace(".", ",")}%)</span><strong>− ${reais(taxa)}</strong></div>
    <div class="resumo-linha"><span>${nome} (${pct}%)</span><strong>${reais(parceiro)}</strong></div>
    <div class="resumo-linha"><span>Você</span><strong>${reais(liquido - parceiro)}</strong></div>
    <p class="resumo-nota">A taxa real é lida do Mercado Pago quando o Pix for pago.</p>`;
}
["#venda-valor", "#parceiro-percentual", "#parceiro-nome"].forEach((s) => $(s).addEventListener("input", simular));

// ---------- Venda ----------

function pararConsulta() {
  clearInterval(consultaVenda);
  consultaVenda = null;
}

$("#form-venda").addEventListener("submit", async (e) => {
  e.preventDefault();
  const botao = $("#venda-gerar");
  botao.disabled = true;
  try {
    const r = await api.criarVendaLojaAdmin({
      produto: $("#venda-produto").value.trim(),
      valor: Number($("#venda-valor").value).toFixed(2),
      email_pagador: $("#venda-email").value.trim(),
    });
    $("#venda-pix-qr").src = `data:image/png;base64,${r.pix_qr_code_base64}`;
    $("#venda-pix-codigo").value = r.pix_qr_code;
    $("#form-venda").hidden = true;
    $("#venda-pix").hidden = false;
    carregar();
    pararConsulta();
    let vezes = 0;
    consultaVenda = setInterval(async () => {
      if (++vezes > 300) return pararConsulta();
      try {
        const v = await api.consultarVendaLojaAdmin(r.venda.id);
        if (v.status !== "aguardando") {
          pararConsulta();
          fecharPixVenda();
          if (v.status === "paga") mostrarToast(`Pix recebido! ${reais(v.parte_parceiro)} pro parceiro, ${reais(v.parte_dono)} pra você.`, "sucesso");
          carregar();
        }
      } catch {
        /* tenta de novo */
      }
    }, 4000);
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botao.disabled = false;
  }
});

function fecharPixVenda() {
  $("#venda-pix").hidden = true;
  $("#form-venda").hidden = false;
}
$("#venda-pix-fechar").addEventListener("click", () => {
  pararConsulta();
  fecharPixVenda();
  carregar();
});

// ---------- Repasse e reembolso ----------

$("#lista-vendas").addEventListener("click", async (e) => {
  const repassar = e.target.closest("[data-repassar]");
  const reembolsar = e.target.closest("[data-reembolsar]");
  if (repassar) abrirRepasse(Number(repassar.dataset.repassar));
  if (reembolsar) {
    const id = Number(reembolsar.dataset.reembolsar);
    const ok = await confirmarAcao("Devolve o valor da venda pra quem pagou. Se você já repassou ao parceiro, combine a devolução com ele.", {
      titulo: "Reembolsar venda?",
      textoConfirmar: "Reembolsar",
    });
    if (!ok) return;
    try {
      await api.reembolsarVendaLojaAdmin(id);
      mostrarToast("Reembolso pedido ao Mercado Pago.", "sucesso");
      carregar();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
  }
});

async function abrirRepasse(id) {
  try {
    const r = await api.repasseLojaAdmin(id);
    vendaDoRepasse = id;
    $("#repasse-titulo").textContent = `Repassar ${reais(r.valor)} ao ${r.nome}`;
    $("#repasse-texto").innerHTML = `Pix pra chave <strong>${escaparHtml(r.chave)}</strong> (${escaparHtml(r.nome)}), valor <strong>${reais(r.valor)}</strong>.`;
    $("#repasse-codigo").value = r.pix_copia_e_cola;
    const alvo = $("#repasse-qr");
    if (typeof window.qrcode === "function") {
      const qr = window.qrcode(0, "M");
      qr.addData(r.pix_copia_e_cola);
      qr.make();
      alvo.innerHTML = qr.createImgTag(6, 12, "QR code do Pix de repasse");
    } else {
      alvo.innerHTML = '<p class="hint-text">Não deu pra desenhar o QR. Use o "copia e cola" abaixo.</p>';
    }
    $("#modal-repasse").hidden = false;
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

$("#repasse-fechar").addEventListener("click", () => ($("#modal-repasse").hidden = true));
$("#modal-repasse").addEventListener("click", (e) => {
  if (e.target.id === "modal-repasse") $("#modal-repasse").hidden = true;
});
$("#repasse-confirmar").addEventListener("click", async () => {
  try {
    await api.marcarRepassadoLojaAdmin(vendaDoRepasse);
    $("#modal-repasse").hidden = true;
    mostrarToast("Repasse registrado.", "sucesso");
    carregar();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
});

document.addEventListener("click", async (e) => {
  const botao = e.target.closest("[data-copiar]");
  if (!botao) return;
  const campo = $(`#${botao.dataset.copiar}`);
  try {
    await navigator.clipboard.writeText(campo.value);
  } catch {
    campo.select();
    document.execCommand("copy");
  }
  mostrarToast("Copiado! Cole no app do banco em Pix copia e cola.", "sucesso");
});

carregar();
