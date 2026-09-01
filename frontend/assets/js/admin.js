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
const cartoesMobileEl = $("#admin-cards-mobile");
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

// As mesmas 7 chaves com bloco de CSS pronto em variables.css. Uma cor nova
// sempre exige desenhar o CSS antes (não dá pra digitar livre aqui) — é
// esse o limite entre "o site resolve sozinho" e "eu mexo no código".
const TEMAS_DISPONIVEIS = [
  { chave: "", rotulo: "Padrão (roxo)" },
  { chave: "rosa", rotulo: "Rosa" },
  { chave: "verde", rotulo: "Verde" },
  { chave: "azul", rotulo: "Azul" },
  { chave: "celeste", rotulo: "Celeste" },
  { chave: "choque", rotulo: "Choque" },
  { chave: "amarelo", rotulo: "Amarelo" },
  { chave: "laranja", rotulo: "Laranja" },
];

function seletorTema(p) {
  const opcoes = TEMAS_DISPONIVEIS.map(
    (t) =>
      `<option value="${t.chave}" ${(p.tema_personalizado || "") === t.chave ? "selected" : ""}>${t.rotulo}</option>`
  ).join("");
  return `<select class="input tema-select" data-tema-select data-id="${p.id}">${opcoes}</select>`;
}

function badgeAssinatura(status) {
  const rotulo = ROTULO_STATUS[status] || status;
  const classe = status === "active" || status === "trialing" ? "badge-sucesso" : "badge-perigo";
  return `<span class="badge ${classe}">${escaparHtml(rotulo)}</span>`;
}

function linhaPersonal(p) {
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
      <td>${seletorTema(p)}</td>
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

/** Mesmo dado da linha da tabela, só que em card — usado abaixo de 900px
   (a tabela de 8 colunas não cabe numa tela de celular). */
function cartaoPersonal(p) {
  const botaoAlternar =
    p.assinatura_status === "active" || p.assinatura_status === "trialing"
      ? `<button class="btn btn-ghost btn-sm" data-acao="desativar" data-id="${p.id}">Desativar</button>`
      : `<button class="btn btn-primary btn-sm" data-acao="ativar" data-id="${p.id}">Ativar</button>`;

  return `
    <div class="admin-card" data-linha="${p.id}">
      <div class="admin-card-topo">
        <div>
          <strong>${escaparHtml(p.nome)}</strong>${p.is_admin ? ' <span class="badge badge-primaria" style="margin-left:6px;">Admin</span>' : ""}
          <div class="hint-text">${p.email_verificado ? "E-mail confirmado" : "E-mail pendente"}</div>
        </div>
        ${badgeAssinatura(p.assinatura_status)}
      </div>
      <div class="admin-card-email">${escaparHtml(p.email)}</div>
      <div class="admin-card-grid">
        <div><span class="admin-card-rotulo">Tema</span>${seletorTema(p)}</div>
        <div><span class="admin-card-rotulo">Alunos</span>${p.total_alunos}</div>
        <div>
          <span class="admin-card-rotulo">Limite</span>
          <input class="limite-input" type="number" min="0" placeholder="—" value="${p.limite_alunos ?? ""}" data-limite-input data-id="${p.id}" />
        </div>
        <div><span class="admin-card-rotulo">Criado em</span>${formatarDataHora(p.criado_em)}</div>
      </div>
      <div class="admin-card-acoes">${botaoAlternar}</div>
    </div>
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
    cartoesMobileEl.innerHTML = "";
    estadoVazioEl.hidden = false;
    return;
  }
  estadoVazioEl.hidden = true;
  corpoTabelaEl.innerHTML = listaAtual.map(linhaPersonal).join("");
  cartoesMobileEl.innerHTML = listaAtual.map(cartaoPersonal).join("");
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

// Tabela (desktop) e cards (mobile) mostram os mesmos dados de listaAtual,
// então os dois containers recebem os mesmos handlers de clique/troca.
async function aoClicarAcao(evento) {
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
}

async function aoTrocarLimite(evento) {
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
}

async function aoTrocarTema(evento) {
  const select = evento.target.closest("[data-tema-select]");
  if (!select) return;
  const id = Number(select.dataset.id);
  try {
    const atualizado = await api.definirTemaPersonalAdmin(id, select.value || null);
    atualizarLinha(atualizado);
    mostrarToast("Cor da conta atualizada.", "sucesso");
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

for (const el of [corpoTabelaEl, cartoesMobileEl]) {
  el.addEventListener("click", aoClicarAcao);
  el.addEventListener("change", aoTrocarLimite);
  el.addEventListener("change", aoTrocarTema);
}

carregar();
