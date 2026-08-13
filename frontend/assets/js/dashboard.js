// Seklyn — dashboard do Personal: lista e gestão de alunos.
import { api } from "./api.js";
import { protegerPagina } from "./auth.js";
import {
  $,
  $all,
  escaparHtml,
  mensagemDeErro,
  mostrarToast,
  copiarParaAreaDeTransferencia,
  abrirModal,
  fecharModal,
  linkWhatsApp,
} from "./utils.js";

protegerPagina();

const listaEl = $("#lista-alunos");
const estadoVazioEl = $("#estado-vazio-alunos");
const statTotalEl = $("#stat-total-alunos");
const modalAluno = $("#modal-aluno");
const formAluno = $("#form-aluno");
const bannerAssinatura = $("#banner-assinatura");
const bannerEmail = $("#banner-email");
const botaoReenviarConfirmacao = $("#botao-reenviar-confirmacao");

function iniciais(nome) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function cardAluno(aluno) {
  const whatsapp = linkWhatsApp(aluno.telefone);
  return `
    <div class="card card-hover aluno-card" data-id="${aluno.id}">
      <a href="aluno-detalhe.html?id=${aluno.id}" class="aluno-card-topo" style="text-decoration:none;color:inherit;">
        <div class="avatar">${escaparHtml(iniciais(aluno.nome))}</div>
        <div>
          <strong>${escaparHtml(aluno.nome)}</strong>
          <div class="hint-text">${aluno.ativo ? "Ativo" : "Inativo"}</div>
        </div>
      </a>
      <div class="link-copiavel">
        <span>${escaparHtml(aluno.link_acesso)}</span>
      </div>
      <div class="aluno-card-acoes">
        <button class="btn btn-secondary btn-sm" data-acao="copiar" data-link="${escaparHtml(aluno.link_acesso)}">Copiar link</button>
        ${whatsapp ? `<a class="btn btn-secondary btn-sm" href="${whatsapp}" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>` : ""}
        <button class="btn btn-ghost btn-sm" data-acao="regenerar" data-id="${aluno.id}">Novo link</button>
        <button class="btn btn-danger btn-sm" data-acao="excluir" data-id="${aluno.id}">Excluir</button>
      </div>
    </div>
  `;
}

function renderizarAlunos(alunos) {
  statTotalEl.textContent = alunos.length;
  if (alunos.length === 0) {
    listaEl.innerHTML = "";
    estadoVazioEl.hidden = false;
    return;
  }
  estadoVazioEl.hidden = true;
  listaEl.innerHTML = alunos.map(cardAluno).join("");
}

async function carregarAlunos() {
  try {
    const alunos = await api.listarAlunos();
    renderizarAlunos(alunos);
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

async function verificarAssinatura() {
  try {
    const assinatura = await api.statusAssinatura();
    if (!assinatura.ativa) {
      bannerAssinatura.hidden = false;
    }
  } catch {
    // silencioso — a rota protegida vai barrar a criação de alunos se necessário
  }
}

async function verificarEmail() {
  try {
    const personal = await api.me();
    if (!personal.email_verificado) {
      bannerEmail.hidden = false;
    }
  } catch {
    // silencioso
  }
}

botaoReenviarConfirmacao?.addEventListener("click", async () => {
  botaoReenviarConfirmacao.disabled = true;
  try {
    await api.reenviarConfirmacao();
    mostrarToast("E-mail de confirmação reenviado!", "sucesso");
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botaoReenviarConfirmacao.disabled = false;
  }
});

listaEl?.addEventListener("click", async (evento) => {
  const botao = evento.target.closest("button[data-acao]");
  if (!botao) return;
  const acao = botao.dataset.acao;

  if (acao === "copiar") {
    copiarParaAreaDeTransferencia(botao.dataset.link);
    return;
  }

  const id = Number(botao.dataset.id);

  if (acao === "regenerar") {
    if (!confirm("Isso invalida o link atual do aluno. Deseja continuar?")) return;
    try {
      await api.regenerarLinkAluno(id);
      mostrarToast("Novo link gerado!", "sucesso");
      carregarAlunos();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
  }

  if (acao === "excluir") {
    if (!confirm("Tem certeza que deseja excluir este aluno? Essa ação não pode ser desfeita.")) return;
    try {
      await api.excluirAluno(id);
      mostrarToast("Aluno excluído.", "sucesso");
      carregarAlunos();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
  }
});

$("[data-acao='abrir-novo-aluno']")?.addEventListener("click", () => abrirModal(modalAluno));
$all("[data-acao='fechar-modal']", modalAluno).forEach((el) =>
  el.addEventListener("click", () => fecharModal(modalAluno))
);

formAluno?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const botao = $("button[type='submit']", formAluno);
  botao.disabled = true;
  try {
    const dados = {
      nome: formAluno.nome.value.trim(),
      email: formAluno.email.value.trim() || null,
      telefone: formAluno.telefone.value.trim() || null,
    };
    await api.criarAluno(dados);
    mostrarToast("Aluno cadastrado!", "sucesso");
    formAluno.reset();
    fecharModal(modalAluno);
    carregarAlunos();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botao.disabled = false;
  }
});

carregarAlunos();
verificarAssinatura();
verificarEmail();
