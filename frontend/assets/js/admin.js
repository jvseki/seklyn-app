// Seklyn — painel de administração (super admin): lista todas as contas de
// Personal cadastradas e permite ativar/desativar assinatura e ajustar o
// limite de alunos, sem precisar entrar na VPS. Só acessível por quem tem
// is_admin=true (checado no backend também, não só escondido aqui).
import { api } from "./api.js";
import { protegerPagina } from "./auth.js";
import { $, escaparHtml, mensagemDeErro, mostrarToast, formatarDataHora } from "./utils.js";
import { confirmarAcao } from "./confirmar.js";
import { adicionarBlobsEm } from "./tema-personalizado.js";

protegerPagina();
adicionarBlobsEm("#painel-hero-admin");

const corpoTabelaEl = $("#tabela-corpo");
const estadoVazioEl = $("#estado-vazio-admin");
const statTotalEl = $("#stat-total");
const statAtivasEl = $("#stat-ativas");
const statInativasEl = $("#stat-inativas");

const ROTULO_STATUS = {
  active: "Ativa",
  trialing: "Em teste",
  inativa: "Inativa",
  past_due: "Atrasada",
  canceled: "Cancelada",
};

function badgeAssinatura(status) {
  const rotulo = ROTULO_STATUS[status] || status;
  const classe = status === "active" || status === "trialing" ? "badge-sucesso" : "badge-perigo";
  return `<span class="badge ${classe}">${escaparHtml(rotulo)}</span>`;
}

function linhaPersonal(p) {
  const temaPonto = p.tema_personalizado
    ? `<span class="tema-ponto" style="background:var(--cor-primaria);" title="${escaparHtml(p.tema_personalizado)}"></span>${escaparHtml(p.tema_personalizado)}`
    : `<span class="hint-text">padrão</span>`;
  const botaoAlternar =
    p.assinatura_status === "active" || p.assinatura_status === "trialing"
      ? `<button class="btn btn-ghost btn-sm" data-acao="desativar" data-id="${p.id}">Desativar</button>`
      : `<button class="btn btn-primary btn-sm" data-acao="ativar" data-id="${p.id}">Ativar</button>`;

  return `
    <tr data-linha="${p.id}">
      <td>
        <strong>${escaparHtml(p.nome)}</strong>${p.is_admin ? ' <span class="badge badge-primaria" style="margin-left:6px;">Admin</span>' : ""}
        <div class="hint-text">${p.email_verificado ? "E-mail confirmado" : "E-mail pendente"}</div>
      </td>
      <td>${escaparHtml(p.email)}</td>
      <td>${temaPonto}</td>
      <td>${p.total_alunos}</td>
      <td>${badgeAssinatura(p.assinatura_status)}</td>
      <td>
        <input class="limite-input" type="number" min="0" placeholder="—" value="${p.limite_alunos ?? ""}" data-limite-input data-id="${p.id}" />
      </td>
      <td>${formatarDataHora(p.criado_em)}</td>
      <td>${botaoAlternar}</td>
    </tr>
  `;
}

function renderizarStats(lista) {
  const ativas = lista.filter((p) => p.assinatura_status === "active" || p.assinatura_status === "trialing").length;
  statTotalEl.textContent = String(lista.length);
  statAtivasEl.textContent = String(ativas);
  statInativasEl.textContent = String(lista.length - ativas);
}

let listaAtual = [];

function renderizar() {
  renderizarStats(listaAtual);
  if (listaAtual.length === 0) {
    corpoTabelaEl.innerHTML = "";
    estadoVazioEl.hidden = false;
    return;
  }
  estadoVazioEl.hidden = true;
  corpoTabelaEl.innerHTML = listaAtual.map(linhaPersonal).join("");
}

async function carregar() {
  try {
    listaAtual = await api.listarPersonaisAdmin();
    renderizar();
  } catch (erro) {
    if (erro?.status === 403) {
      mostrarToast("Essa conta não tem acesso à administração.", "erro");
      window.location.href = "dashboard.html";
      return;
    }
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

function atualizarLinha(atualizado) {
  const indice = listaAtual.findIndex((p) => p.id === atualizado.id);
  if (indice >= 0) listaAtual[indice] = atualizado;
  renderizar();
}

corpoTabelaEl.addEventListener("click", async (evento) => {
  const botaoAtivar = evento.target.closest("[data-acao='ativar']");
  const botaoDesativar = evento.target.closest("[data-acao='desativar']");

  if (botaoAtivar) {
    const id = Number(botaoAtivar.dataset.id);
    try {
      const atualizado = await api.ativarPersonalAdmin(id);
      atualizarLinha(atualizado);
      mostrarToast("Assinatura ativada.", "sucesso");
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
    return;
  }

  if (botaoDesativar) {
    const id = Number(botaoDesativar.dataset.id);
    const ok = await confirmarAcao("Desativar a assinatura dessa conta? O Personal perde acesso a ações que exigem assinatura ativa.", {
      titulo: "Desativar assinatura",
      textoConfirmar: "Desativar",
    });
    if (!ok) return;
    try {
      const atualizado = await api.desativarPersonalAdmin(id);
      atualizarLinha(atualizado);
      mostrarToast("Assinatura desativada.", "sucesso");
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
  }
});

corpoTabelaEl.addEventListener("change", async (evento) => {
  const input = evento.target.closest("[data-limite-input]");
  if (!input) return;
  const id = Number(input.dataset.id);
  const valor = input.value.trim();
  const limite = valor === "" ? null : Number(valor);
  try {
    const atualizado = await api.definirLimitePersonalAdmin(id, limite);
    atualizarLinha(atualizado);
    mostrarToast("Limite de alunos atualizado.", "sucesso");
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
});

carregar();
