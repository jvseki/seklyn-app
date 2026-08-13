// Seklyn — área do Aluno: lista de treinos, execução (checklist) e
// a aba não-invasiva "Dicas do seu Personal". Tudo em uma única página,
// acessada via link único (?t=<hash_token>), sem login.
import { api } from "./api.js";
import { $, $all, escaparHtml, mensagemDeErro, mostrarToast } from "./utils.js";
import "./tema.js"; // liga o botão de alternar tema (data-acao="alternar-tema") desta página

const parametros = new URLSearchParams(window.location.search);
const token = parametros.get("t");

const els = {
  carregando: $("#carregando"),
  erroLink: $("#erro-link"),
  app: $("#app-conteudo"),
  saudacaoNome: $("#saudacao-nome"),
  saudacaoPersonal: $("#saudacao-personal"),
  secaoLista: $("#secao-lista"),
  secaoExecucao: $("#secao-execucao"),
  secaoDicas: $("#secao-dicas"),
  listaTreinos: $("#lista-treinos-aluno"),
  tabBar: $("#tab-bar"),
  tabTreinos: $("#tab-treinos"),
  tabDicas: $("#tab-dicas"),
  botaoVoltar: $("#botao-voltar-execucao"),
  execucaoTitulo: $("#execucao-titulo"),
  execucaoProgressoBarra: $("#execucao-progresso-barra"),
  execucaoProgressoTexto: $("#execucao-progresso-texto"),
  execucaoFaixaConcluido: $("#execucao-faixa-concluido"),
  execucaoExercicios: $("#execucao-exercicios"),
  listaRecomendacoes: $("#lista-recomendacoes-aluno"),
  estadoVazioDicas: $("#estado-vazio-dicas"),
};

let painelCache = null;
let recomendacoesCarregadas = false;

// --- Navegação entre seções (lista / execução / dicas) ---
function mostrarSecao(nome) {
  els.secaoLista.hidden = nome !== "lista";
  els.secaoExecucao.hidden = nome !== "execucao";
  els.secaoDicas.hidden = nome !== "dicas";
  els.tabBar.hidden = nome === "execucao";

  els.tabTreinos.classList.toggle("ativa", nome === "lista");
  els.tabDicas.classList.toggle("ativa", nome === "dicas");

  if (nome === "dicas" && !recomendacoesCarregadas) {
    carregarRecomendacoes();
  }
}

els.tabTreinos?.addEventListener("click", () => mostrarSecao("lista"));
els.tabDicas?.addEventListener("click", () => mostrarSecao("dicas"));
els.botaoVoltar?.addEventListener("click", () => mostrarSecao("lista"));

// --- Tela: lista de treinos ---
function cardTreino(treino) {
  const rotuloBadge = treino.concluido_hoje
    ? `<span class="badge badge-sucesso">Concluído hoje</span>`
    : treino.series_concluidas_hoje > 0
      ? `<span class="badge badge-neutro">Em andamento</span>`
      : "";
  return `
    <button class="treino-resumo-card" data-treino-id="${treino.id}" style="text-align:left;width:100%;border:1.5px solid var(--cor-borda);cursor:pointer;">
      <div class="treino-resumo-topo">
        <h3>${escaparHtml(treino.nome)}</h3>
        ${rotuloBadge}
      </div>
      <div class="progresso">
        <div class="progresso-preenchimento ${treino.concluido_hoje ? "completo" : ""}" style="width:${treino.progresso_percentual}%;"></div>
      </div>
      <div class="treino-resumo-rodape">
        <span>${treino.series_concluidas_hoje} de ${treino.total_series} séries hoje</span>
        <span>${treino.progresso_percentual}%</span>
      </div>
    </button>
  `;
}

function renderizarListaTreinos(treinos) {
  if (treinos.length === 0) {
    els.listaTreinos.innerHTML = `
      <div class="estado-vazio">
        <div class="icone">🗓️</div>
        <p>Seu Personal ainda não cadastrou nenhum treino para você.</p>
      </div>`;
    return;
  }
  els.listaTreinos.innerHTML = treinos.map(cardTreino).join("");
}

els.listaTreinos?.addEventListener("click", (evento) => {
  const botao = evento.target.closest("[data-treino-id]");
  if (!botao) return;
  abrirExecucaoTreino(Number(botao.dataset.treinoId));
});

// --- Tela: execução do treino (checklist) ---
function linhaSerie(serie) {
  return `
    <div class="checklist-item ${serie.concluida_hoje ? "concluida" : ""}" data-serie-id="${serie.id}">
      <button class="checklist-checkbox" data-acao="alternar-serie" data-serie-id="${serie.id}" aria-label="Marcar série como concluída">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12.5L10 17L19 8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="checklist-info">
        <div class="checklist-titulo">Série ${serie.ordem + 1}</div>
        <div class="checklist-meta">${escaparHtml(serie.repeticoes_alvo)} repetições${serie.carga_alvo ? " · " + escaparHtml(serie.carga_alvo) : ""}</div>
      </div>
    </div>
  `;
}

function blocoExercicio(exercicio) {
  return `
    <div class="bloco-exercicio" data-exercicio-id="${exercicio.id}">
      <div class="bloco-exercicio-titulo">
        <span>${exercicio.concluido_hoje ? "✅" : "🏋️"}</span>
        <strong>${escaparHtml(exercicio.nome)}</strong>
      </div>
      ${exercicio.observacoes ? `<p class="bloco-exercicio-obs">${escaparHtml(exercicio.observacoes)}</p>` : ""}
      <div class="lista-series">${exercicio.series.map(linhaSerie).join("")}</div>
    </div>
  `;
}

function atualizarCabecalhoProgresso(detalhe) {
  els.execucaoProgressoBarra.style.width = `${detalhe.progresso_percentual}%`;
  els.execucaoProgressoBarra.classList.toggle("completo", detalhe.concluido_hoje);
  els.execucaoProgressoTexto.textContent = `${detalhe.progresso_percentual}% concluído hoje`;
  els.execucaoFaixaConcluido.hidden = !detalhe.concluido_hoje;
}

async function abrirExecucaoTreino(treinoId) {
  mostrarSecao("execucao");
  els.execucaoTitulo.textContent = "Carregando...";
  els.execucaoExercicios.innerHTML = "";
  try {
    const detalhe = await api.detalheTreinoAluno(token, treinoId);
    els.execucaoTitulo.textContent = detalhe.nome;
    els.execucaoExercicios.innerHTML = detalhe.exercicios.map(blocoExercicio).join("");
    atualizarCabecalhoProgresso(detalhe);
    els.execucaoExercicios.dataset.treinoId = treinoId;
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
    mostrarSecao("lista");
  }
}

els.execucaoExercicios?.addEventListener("click", async (evento) => {
  const botao = evento.target.closest("[data-acao='alternar-serie']");
  if (!botao) return;
  const serieId = Number(botao.dataset.serieId);
  const item = botao.closest(".checklist-item");
  botao.disabled = true;

  try {
    const resultado = await api.executarSerie(token, serieId);
    item.classList.toggle("concluida", resultado.concluida_hoje);

    els.execucaoProgressoBarra.style.width = `${resultado.treino_progresso_percentual}%`;
    els.execucaoProgressoBarra.classList.toggle("completo", resultado.treino_concluido_hoje);
    els.execucaoProgressoTexto.textContent = `${resultado.treino_progresso_percentual}% concluído hoje`;

    const jaMostrandoFaixa = !els.execucaoFaixaConcluido.hidden;
    els.execucaoFaixaConcluido.hidden = !resultado.treino_concluido_hoje;
    if (resultado.treino_concluido_hoje && !jaMostrandoFaixa) {
      mostrarToast("Treino concluído! Parabéns 🎉", "sucesso");
    }

    // Recalcula se o exercício desta série ficou 100% concluído (para o ícone ✅).
    const treinoId = Number(els.execucaoExercicios.dataset.treinoId);
    const detalheAtualizado = await api.detalheTreinoAluno(token, treinoId);
    const exercicioAtual = detalheAtualizado.exercicios.find((ex) => ex.series.some((s) => s.id === serieId));
    if (exercicioAtual) {
      const blocoEl = els.execucaoExercicios.querySelector(`[data-exercicio-id="${exercicioAtual.id}"] .bloco-exercicio-titulo span`);
      if (blocoEl) blocoEl.textContent = exercicioAtual.concluido_hoje ? "✅" : "🏋️";
    }
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botao.disabled = false;
  }
});

// --- Tela: Dicas do seu Personal (recomendações / afiliados) ---
function cardRecomendacao(rec) {
  return `
    <a class="recomendacao-card" href="${escaparHtml(rec.url_afiliado)}" target="_blank" rel="noopener noreferrer sponsored">
      <div class="recomendacao-info">
        <div class="titulo">${escaparHtml(rec.titulo)}</div>
        ${rec.descricao ? `<div class="descricao">${escaparHtml(rec.descricao)}</div>` : ""}
      </div>
      <span class="recomendacao-seta">→</span>
    </a>
  `;
}

async function carregarRecomendacoes() {
  try {
    const recomendacoes = await api.recomendacoesAluno(token);
    recomendacoesCarregadas = true;
    if (recomendacoes.length === 0) {
      els.listaRecomendacoes.innerHTML = "";
      els.estadoVazioDicas.hidden = false;
      return;
    }
    els.estadoVazioDicas.hidden = true;
    els.listaRecomendacoes.innerHTML = recomendacoes.map(cardRecomendacao).join("");
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

// --- Inicialização ---
async function iniciar() {
  if (!token) {
    els.carregando.hidden = true;
    els.erroLink.hidden = false;
    return;
  }

  try {
    painelCache = await api.painelAluno(token);
    els.saudacaoNome.textContent = `Olá, ${painelCache.aluno.nome.split(" ")[0]}!`;
    els.saudacaoPersonal.textContent = `Treinos por ${painelCache.aluno.personal_nome}`;
    renderizarListaTreinos(painelCache.treinos);

    els.carregando.hidden = true;
    els.app.hidden = false;
    mostrarSecao("lista");
  } catch {
    els.carregando.hidden = true;
    els.erroLink.hidden = false;
  }
}

iniciar();
