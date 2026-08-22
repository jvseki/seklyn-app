// Seklyn — área do Aluno: lista de treinos, execução (checklist) e
// a aba não-invasiva "Dicas do seu Personal". Tudo em uma única página,
// acessada via link único (?t=<hash_token>), sem login.
import { api } from "./api.js";
import { $, $all, escaparHtml, mensagemDeErro, mostrarToast } from "./utils.js";
import "./tema.js"; // liga o botão de alternar tema (data-acao="alternar-tema") desta página
import { aplicarTemaPersonalizado } from "./tema-personalizado.js";
import { observarRevelacoes } from "./revelar-ao-rolar.js";
import { icone } from "./icones.js";
import { iconeHalter } from "./icones-treino.js";
import { renderizarPlayerVideo } from "./video-exercicio.js";

const ROTULO_DIA = {
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
  domingo: "Domingo",
};

/** "2026-08-11" → "11/08" */
function formatarDataCurta(isoData) {
  const [, mes, dia] = isoData.split("-");
  return `${dia}/${mes}`;
}

const parametros = new URLSearchParams(window.location.search);
const token = parametros.get("t");

const els = {
  carregando: $("#carregando"),
  erroLink: $("#erro-link"),
  app: $("#app-conteudo"),
  saudacaoNome: $("#saudacao-nome"),
  saudacaoPersonal: $("#saudacao-personal"),
  streakBadge: $("#streak-badge"),
  streakNumero: $("#streak-numero"),
  secaoLista: $("#secao-lista"),
  secaoExecucao: $("#secao-execucao"),
  secaoDicas: $("#secao-dicas"),
  listaTreinos: $("#lista-treinos-aluno"),
  tabBar: $("#tab-bar"),
  tabTreinos: $("#tab-treinos"),
  tabDicas: $("#tab-dicas"),
  botaoVoltar: $("#botao-voltar-execucao"),
  execucaoTitulo: $("#execucao-titulo"),
  execucaoSubtitulo: $("#execucao-subtitulo"),
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
els.botaoVoltar?.addEventListener("click", async () => {
  mostrarSecao("lista");
  // Reflete na semana o que foi marcado/desmarcado na execução.
  try {
    painelCache = await api.painelAluno(token);
    renderizarSemana(painelCache.semana);
  } catch {
    // silencioso — a lista antiga continua visível
  }
});

// --- Tela: semana atual (7 dias com data real, dia por dia) ---
function cardDia(dia) {
  const rotulo = ROTULO_DIA[dia.dia_semana] || dia.dia_semana;
  const dataCurta = formatarDataCurta(dia.data);
  const badgeHoje = dia.hoje ? `<span class="badge badge-primaria">Hoje</span>` : "";

  if (!dia.treino_id) {
    return `
      <div class="treino-resumo-card treino-resumo-card-descanso reveal" style="border:1.5px solid var(--cor-borda);">
        <div class="treino-resumo-topo">
          <h3>${rotulo} <span class="hint-text" style="font-weight:400;">· ${dataCurta}</span></h3>
          ${badgeHoje}
        </div>
        <p class="hint-text">Dia de descanso</p>
      </div>
    `;
  }

  const rotuloBadge = dia.concluido
    ? `<span class="badge badge-sucesso">Concluído</span>`
    : dia.series_concluidas > 0
      ? `<span class="badge badge-neutro">Em andamento</span>`
      : "";

  return `
    <button class="treino-resumo-card reveal" data-treino-id="${dia.treino_id}" data-data="${dia.data}" style="text-align:left;width:100%;border:1.5px solid var(--cor-borda);cursor:pointer;">
      <div class="treino-resumo-topo">
        <h3>${escaparHtml(dia.treino_nome)}</h3>
        ${badgeHoje}${rotuloBadge}
      </div>
      <p class="hint-text" style="margin-top:-8px;margin-bottom:8px;">${rotulo} · ${dataCurta}</p>
      <div class="progresso">
        <div class="progresso-preenchimento ${dia.concluido ? "completo" : ""}" style="width:${dia.progresso_percentual}%;"></div>
      </div>
      <div class="treino-resumo-rodape">
        <span>${dia.series_concluidas} de ${dia.total_series} séries</span>
        <span>${dia.progresso_percentual}%</span>
      </div>
    </button>
  `;
}

function renderizarSemana(semana) {
  els.listaTreinos.innerHTML = semana.map(cardDia).join("");
  observarRevelacoes(els.listaTreinos);
}

els.listaTreinos?.addEventListener("click", (evento) => {
  const botao = evento.target.closest("[data-treino-id]");
  if (!botao) return;
  abrirExecucaoTreino(Number(botao.dataset.treinoId), botao.dataset.data);
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
        <div class="checklist-meta">${escaparHtml(serie.repeticoes_alvo)} repetições${serie.carga_alvo ? " · " + escaparHtml(serie.carga_alvo) : ""}${serie.intervalo_descanso ? " · descanso " + escaparHtml(serie.intervalo_descanso) : ""}</div>
      </div>
    </div>
  `;
}

function blocoExercicio(exercicio) {
  return `
    <div class="bloco-exercicio" data-exercicio-id="${exercicio.id}">
      <div class="bloco-exercicio-titulo">
        <span class="${exercicio.concluido_hoje ? "icone-concluido" : ""}">${exercicio.concluido_hoje ? icone("check", 18) : iconeHalter(18)}</span>
        <strong>${escaparHtml(exercicio.nome)}</strong>
      </div>
      ${exercicio.observacoes ? `<p class="bloco-exercicio-obs">${escaparHtml(exercicio.observacoes)}</p>` : ""}
      ${exercicio.video ? renderizarPlayerVideo(exercicio.video, { altura: 200 }) : ""}
      <div class="lista-series">${exercicio.series.map(linhaSerie).join("")}</div>
    </div>
  `;
}

function atualizarCabecalhoProgresso(detalhe) {
  els.execucaoProgressoBarra.style.width = `${detalhe.progresso_percentual}%`;
  els.execucaoProgressoBarra.classList.toggle("completo", detalhe.concluido_hoje);
  els.execucaoProgressoTexto.textContent = `${detalhe.progresso_percentual}% concluído`;
  els.execucaoFaixaConcluido.hidden = !detalhe.concluido_hoje;
}

async function abrirExecucaoTreino(treinoId, data) {
  mostrarSecao("execucao");
  els.execucaoTitulo.textContent = "Carregando...";
  if (els.execucaoSubtitulo) els.execucaoSubtitulo.textContent = "";
  els.execucaoExercicios.innerHTML = "";
  try {
    const detalhe = await api.detalheTreinoAluno(token, treinoId, data);
    els.execucaoTitulo.textContent = detalhe.nome;
    if (els.execucaoSubtitulo) {
      const rotulo = ROTULO_DIA[detalhe.dia_semana] || detalhe.dia_semana || "";
      els.execucaoSubtitulo.textContent = data ? `${rotulo} · ${formatarDataCurta(data)}` : rotulo;
    }
    els.execucaoExercicios.innerHTML = detalhe.exercicios.map(blocoExercicio).join("");
    atualizarCabecalhoProgresso(detalhe);
    els.execucaoExercicios.dataset.treinoId = treinoId;
    els.execucaoExercicios.dataset.data = data || "";
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

  const treinoId = Number(els.execucaoExercicios.dataset.treinoId);
  const data = els.execucaoExercicios.dataset.data || undefined;

  try {
    const resultado = await api.executarSerie(token, serieId, data);
    item.classList.toggle("concluida", resultado.concluida_hoje);

    els.execucaoProgressoBarra.style.width = `${resultado.treino_progresso_percentual}%`;
    els.execucaoProgressoBarra.classList.toggle("completo", resultado.treino_concluido_hoje);
    els.execucaoProgressoTexto.textContent = `${resultado.treino_progresso_percentual}% concluído`;

    const jaMostrandoFaixa = !els.execucaoFaixaConcluido.hidden;
    els.execucaoFaixaConcluido.hidden = !resultado.treino_concluido_hoje;
    if (resultado.treino_concluido_hoje && !jaMostrandoFaixa) {
      mostrarToast("Treino concluído! Parabéns.", "sucesso");
    }

    // Recalcula se o exercício desta série ficou 100% concluído (para o ícone de check).
    const detalheAtualizado = await api.detalheTreinoAluno(token, treinoId, data);
    const exercicioAtual = detalheAtualizado.exercicios.find((ex) => ex.series.some((s) => s.id === serieId));
    if (exercicioAtual) {
      const blocoEl = els.execucaoExercicios.querySelector(`[data-exercicio-id="${exercicioAtual.id}"] .bloco-exercicio-titulo span`);
      if (blocoEl) blocoEl.innerHTML = exercicioAtual.concluido_hoje ? icone("check", 18) : iconeHalter(18);
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
    aplicarTemaPersonalizado(painelCache.aluno.personal_tema);
    renderizarSemana(painelCache.semana);

    if (painelCache.streak_atual > 0) {
      els.streakNumero.textContent = painelCache.streak_atual;
      els.streakBadge.title = `${painelCache.streak_atual} dia${painelCache.streak_atual > 1 ? "s" : ""} seguido${painelCache.streak_atual > 1 ? "s" : ""} treinando`;
      els.streakBadge.hidden = false;
    }

    els.carregando.hidden = true;
    els.app.hidden = false;
    mostrarSecao("lista");
  } catch {
    els.carregando.hidden = true;
    els.erroLink.hidden = false;
  }
}

iniciar();
