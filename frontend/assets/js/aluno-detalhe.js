// Seklyn — gestão de treinos/exercícios/séries de um aluno específico.
import { api } from "./api.js";
import { protegerPagina } from "./auth.js";
import { $, escaparHtml, mensagemDeErro, mostrarToast, copiarParaAreaDeTransferencia } from "./utils.js";

protegerPagina();

const parametros = new URLSearchParams(window.location.search);
const alunoId = Number(parametros.get("id"));

if (!alunoId) {
  window.location.href = "dashboard.html";
}

const cabecalhoNomeEl = $("#aluno-nome");
const cabecalhoLinkEl = $("#aluno-link");
const listaTreinosEl = $("#lista-treinos-editor");
const formNovoTreino = $("#form-novo-treino");
const analyticsEl = $("#analytics-resumo");

let alunoAtual = null;

function linhaSerie(serie) {
  return `
    <div class="series-linha" data-serie-id="${serie.id}">
      <span>Série ${serie.ordem + 1}: ${escaparHtml(serie.repeticoes_alvo)} reps${serie.carga_alvo ? " · " + escaparHtml(serie.carga_alvo) : ""}</span>
      <button class="btn btn-ghost btn-sm" data-acao="excluir-serie" data-id="${serie.id}" type="button">Remover</button>
    </div>
  `;
}

function blocoExercicio(exercicio) {
  const series = exercicio.series.map(linhaSerie).join("") || `<p class="hint-text" style="padding-left:var(--espaco-6);">Nenhuma série cadastrada ainda.</p>`;
  return `
    <div class="exercicio-bloco" data-exercicio-id="${exercicio.id}">
      <div class="exercicio-linha">
        <span class="exercicio-nome">${escaparHtml(exercicio.nome)}</span>
        <button class="btn btn-ghost btn-sm" data-acao="excluir-exercicio" data-id="${exercicio.id}" type="button">Remover exercício</button>
      </div>
      ${series}
      <form class="form-row" data-acao="form-nova-serie" data-exercicio-id="${exercicio.id}" style="padding-left:var(--espaco-6);margin-top:var(--espaco-2);">
        <div class="form-group" style="flex:1;"><input class="input" name="repeticoes_alvo" placeholder="Repetições (ex: 10-12)" required /></div>
        <div class="form-group" style="flex:1;"><input class="input" name="carga_alvo" placeholder="Carga (opcional)" /></div>
        <div class="form-group" style="flex:0;"><button class="btn btn-secondary btn-sm" type="submit">+ Série</button></div>
      </form>
    </div>
  `;
}

function cardTreino(treino) {
  const exercicios = treino.exercicios.map(blocoExercicio).join("");
  return `
    <div class="card treino-editor-card" data-treino-id="${treino.id}">
      <div class="modal-cabecalho">
        <h3>${escaparHtml(treino.nome)}</h3>
        <button class="btn btn-danger btn-sm" data-acao="excluir-treino" data-id="${treino.id}" type="button">Excluir treino</button>
      </div>
      ${exercicios}
      <form class="form-row" data-acao="form-novo-exercicio" data-treino-id="${treino.id}" style="margin-top:var(--espaco-3);">
        <div class="form-group" style="flex:1;"><input class="input" name="nome" placeholder="Nome do exercício (ex: Supino reto)" required /></div>
        <div class="form-group" style="flex:0;"><button class="btn btn-secondary btn-sm" type="submit">+ Exercício</button></div>
      </form>
    </div>
  `;
}

async function recarregarTreinos() {
  try {
    const treinos = await api.listarTreinos(alunoId);
    listaTreinosEl.innerHTML =
      treinos.map(cardTreino).join("") ||
      `<div class="estado-vazio"><p>Nenhum treino cadastrado ainda. Crie o primeiro treino acima.</p></div>`;
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

async function carregarAluno() {
  try {
    alunoAtual = await api.obterAluno(alunoId);
    cabecalhoNomeEl.textContent = alunoAtual.nome;
    cabecalhoLinkEl.textContent = alunoAtual.link_acesso;
    cabecalhoLinkEl.dataset.link = alunoAtual.link_acesso;
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

async function carregarAnalytics() {
  try {
    const dados = await api.analyticsAluno(alunoId, 30);
    if (dados.dias_com_algum_treino === 0) {
      analyticsEl.innerHTML = `<p class="hint-text">Ainda não há dados suficientes nos últimos 30 dias.</p>`;
      return;
    }
    const pulados = dados.exercicios_mais_pulados
      .slice(0, 5)
      .map(
        (e) =>
          `<li>${escaparHtml(e.exercicio_nome)} <span class="hint-text">(${escaparHtml(e.treino_nome)})</span> — ${e.percentual_aderencia}% de aderência</li>`
      )
      .join("");
    analyticsEl.innerHTML = `
      <p><strong>${dados.percentual_geral_aderencia}%</strong> de aderência geral nos últimos ${dados.periodo_dias} dias (${dados.dias_com_algum_treino} dias treinados).</p>
      ${pulados ? `<p style="margin-top:var(--espaco-3);">Exercícios com mais aderência a melhorar:</p><ul style="margin-top:var(--espaco-2);padding-left:var(--espaco-5);list-style:disc;">${pulados}</ul>` : ""}
    `;
  } catch (erro) {
    analyticsEl.innerHTML = `<p class="hint-text">Não foi possível carregar os analytics agora.</p>`;
  }
}

cabecalhoLinkEl?.addEventListener("click", () => {
  if (cabecalhoLinkEl.dataset.link) copiarParaAreaDeTransferencia(cabecalhoLinkEl.dataset.link);
});

formNovoTreino?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const nome = formNovoTreino.nome.value.trim();
  if (!nome) return;
  try {
    await api.criarTreino(alunoId, { nome, ordem: 0 });
    formNovoTreino.reset();
    mostrarToast("Treino criado!", "sucesso");
    recarregarTreinos();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
});

listaTreinosEl?.addEventListener("submit", async (evento) => {
  const alvo = evento.target;

  if (alvo.dataset.acao === "form-novo-exercicio") {
    evento.preventDefault();
    const treinoId = Number(alvo.dataset.treinoId);
    const nome = alvo.nome.value.trim();
    if (!nome) return;
    try {
      await api.criarExercicio(treinoId, { nome, ordem: 0 });
      mostrarToast("Exercício adicionado!", "sucesso");
      recarregarTreinos();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
  }

  if (alvo.dataset.acao === "form-nova-serie") {
    evento.preventDefault();
    const exercicioId = Number(alvo.dataset.exercicioId);
    const repeticoesAlvo = alvo.repeticoes_alvo.value.trim();
    const cargaAlvo = alvo.carga_alvo.value.trim() || null;
    if (!repeticoesAlvo) return;
    try {
      await api.criarSerie(exercicioId, { ordem: 0, repeticoes_alvo: repeticoesAlvo, carga_alvo: cargaAlvo });
      mostrarToast("Série adicionada!", "sucesso");
      recarregarTreinos();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
  }
});

listaTreinosEl?.addEventListener("click", async (evento) => {
  const botao = evento.target.closest("button[data-acao]");
  if (!botao) return;
  const id = Number(botao.dataset.id);
  const acao = botao.dataset.acao;

  const confirmacoes = {
    "excluir-treino": "Excluir este treino e todos os seus exercícios/séries?",
    "excluir-exercicio": "Excluir este exercício e suas séries?",
    "excluir-serie": "Remover esta série?",
  };
  if (confirmacoes[acao] && !confirm(confirmacoes[acao])) return;

  try {
    if (acao === "excluir-treino") await api.excluirTreino(id);
    if (acao === "excluir-exercicio") await api.excluirExercicio(id);
    if (acao === "excluir-serie") await api.excluirSerie(id);
    recarregarTreinos();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
});

carregarAluno();
recarregarTreinos();
carregarAnalytics();
