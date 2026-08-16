// Seklyn — gestão de treinos/exercícios/séries de um aluno específico.
import { api, API_BASE_URL, obterToken } from "./api.js";
import { protegerPagina } from "./auth.js";
import {
  $,
  $all,
  escaparHtml,
  mensagemDeErro,
  mostrarToast,
  copiarParaAreaDeTransferencia,
  linkWhatsApp,
  abrirModal,
  fecharModal,
} from "./utils.js";
import { listaCompletaExercicios, CATEGORIAS_TREINO, obterCategoria } from "./catalogo-exercicios.js";
import { confirmarAcao } from "./confirmar.js";
import { icone } from "./icones.js";
import { iconeCategoriaTreino, iconeHalter } from "./icones-treino.js";

protegerPagina();

// <datalist> com sugestões de exercícios comuns de academia — o Personal
// continua podendo digitar qualquer nome que não esteja na lista.
function criarDatalistExercicios() {
  const datalist = document.createElement("datalist");
  datalist.id = "lista-exercicios";
  datalist.innerHTML = listaCompletaExercicios()
    .map((nome) => `<option value="${escaparHtml(nome)}"></option>`)
    .join("");
  document.body.appendChild(datalist);
}
criarDatalistExercicios();

const parametros = new URLSearchParams(window.location.search);
const alunoId = Number(parametros.get("id"));

if (!alunoId) {
  window.location.href = "dashboard.html";
}

const linkVerMaisEl = $("#link-ver-mais-analytics");
if (linkVerMaisEl) linkVerMaisEl.href = `aluno-analytics.html?id=${alunoId}`;

const cabecalhoNomeEl = $("#aluno-nome");
const cabecalhoLinkEl = $("#aluno-link");
const whatsappEl = $("#aluno-whatsapp");
const linkWhatsappEl = $("#aluno-link-whatsapp");
const fichaWhatsappEl = $("#aluno-ficha-whatsapp");
const listaTreinosEl = $("#lista-treinos-editor");
const gradeSemanaEl = $("#grade-semana");
const analyticsEl = $("#analytics-resumo");
const avaliacaoProgressoEl = $("#avaliacao-progresso");
const avaliacaoHistoricoEl = $("#avaliacao-historico");
const fichaImpressaoEl = $("#ficha-impressao");
const modalNovaAvaliacao = $("#modal-nova-avaliacao");
const formNovaAvaliacao = $("#form-nova-avaliacao");
const modalEditarAluno = $("#modal-editar-aluno");
const formEditarAluno = $("#form-editar-aluno");
const avisoMetaSemPesoEl = $("#aviso-meta-sem-peso");
const modalEditarItem = $("#modal-editar-item");
const formEditarItem = $("#form-editar-item");
const editarItemTitulo = $("#editar-item-titulo");
const editarItemCampos = $("#editar-item-campos");
const modalMontarTreino = $("#modal-montar-treino");
const montarTreinoTitulo = $("#montar-treino-titulo");
const passosIndicadorEl = $("#passos-indicador");
const passoCategoriaEl = $("#montar-treino-passo-categoria");
const passoExerciciosEl = $("#montar-treino-passo-exercicios");
const passoConfigEl = $("#montar-treino-passo-config");
const gradeCategoriasEl = $("#grade-categorias");
const montarTreinoNomeInput = $("#montar-treino-nome");
const listaExerciciosSugeridosEl = $("#lista-exercicios-sugeridos");
const outroExercicioInput = $("#montar-treino-outro-exercicio");
const configGruposEl = $("#config-grupos");

let alunoAtual = null;
let treinosCache = []; // guarda os dados carregados pra preencher os modais de edição sem outra chamada à API
let avaliacoesCache = []; // histórico de peso do aluno, mais recente primeiro (vem assim da API)
let montarTreinoDia = null; // dia da semana sendo montado no modal assistido
let categoriasSelecionadas = []; // chaves das categorias escolhidas no passo 1 (pode ser mais de uma)
let itensSelecionados = []; // [{ nome, incluido, categoria, categoriaChave }] — exercícios sugeridos das categorias escolhidas
let configPorGrupo = {}; // chave da categoria (ou "manual") → { series, repeticoes, descanso }

const OPCOES_SERIES = [2, 3, 4, 5, 6];
const OPCOES_REPETICOES = ["6-8", "8-10", "10-12", "12-15", "15-20"];
const OPCOES_DESCANSO = ["30s", "45s", "60s", "90s", "2min"];
const OPCOES_TEMPO = ["10 min", "15 min", "20 min", "30 min", "45 min"];

const DIAS_SEMANA = [
  { chave: "segunda", rotulo: "Segunda" },
  { chave: "terca", rotulo: "Terça" },
  { chave: "quarta", rotulo: "Quarta" },
  { chave: "quinta", rotulo: "Quinta" },
  { chave: "sexta", rotulo: "Sexta" },
  { chave: "sabado", rotulo: "Sábado" },
  { chave: "domingo", rotulo: "Domingo" },
];

const ROTULO_DIA = Object.fromEntries(DIAS_SEMANA.map((d) => [d.chave, d.rotulo]));
const ICONE_HALTERES = iconeHalter(16);
const ICONE_LIXEIRA = icone("lixeira", 16);

function linhaSerie(serie) {
  return `
    <div class="series-linha" data-serie-id="${serie.id}">
      <span>Série ${serie.ordem + 1}: ${escaparHtml(serie.repeticoes_alvo)} reps${serie.carga_alvo ? " · " + escaparHtml(serie.carga_alvo) : ""}${serie.intervalo_descanso ? " · descanso " + escaparHtml(serie.intervalo_descanso) : ""}</span>
      <button class="btn btn-ghost btn-sm" data-acao="editar-serie" data-id="${serie.id}" type="button">Editar</button>
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
        <button class="btn btn-ghost btn-sm" data-acao="editar-exercicio" data-id="${exercicio.id}" type="button">Editar</button>
        <button class="btn btn-ghost btn-sm" data-acao="excluir-exercicio" data-id="${exercicio.id}" type="button">Remover exercício</button>
      </div>
      ${series}
      <form class="form-row" data-acao="form-nova-serie" data-exercicio-id="${exercicio.id}" style="padding-left:var(--espaco-6);margin-top:var(--espaco-2);">
        <div class="form-group" style="flex:1;"><input class="input" name="repeticoes_alvo" placeholder="Repetições (ex: 10-12)" maxlength="60" required /></div>
        <div class="form-group" style="flex:1;"><input class="input" name="carga_alvo" placeholder="Carga (opcional)" maxlength="60" /></div>
        <div class="form-group" style="flex:1;"><input class="input" name="intervalo_descanso" placeholder="Descanso (ex: 60s)" maxlength="20" /></div>
        <div class="form-group" style="flex:0;"><button class="btn btn-secondary btn-sm" type="submit">+ Série</button></div>
      </form>
    </div>
  `;
}

function cardTreino(treino) {
  const exercicios = treino.exercicios.map(blocoExercicio).join("");
  const badgeDia = treino.dia_semana
    ? `<span class="badge badge-neutro" style="margin-left:var(--espaco-2);">${ROTULO_DIA[treino.dia_semana] || treino.dia_semana}</span>`
    : "";
  return `
    <div class="card treino-editor-card" data-treino-id="${treino.id}">
      <div class="modal-cabecalho">
        <h3>${escaparHtml(treino.nome)}${badgeDia}</h3>
        <div style="display:flex;gap:var(--espaco-2);">
          <button class="btn btn-ghost btn-sm" data-acao="editar-treino" data-id="${treino.id}" type="button">Editar</button>
          <button class="btn btn-danger btn-sm" data-acao="excluir-treino" data-id="${treino.id}" type="button">Excluir treino</button>
        </div>
      </div>
      ${exercicios}
      <form class="form-row" data-acao="form-novo-exercicio" data-treino-id="${treino.id}" style="margin-top:var(--espaco-3);">
        <div class="form-group" style="flex:1;"><input class="input" name="nome" list="lista-exercicios" placeholder="Nome do exercício (ex: Supino reto)" required /></div>
        <div class="form-group" style="flex:0;"><button class="btn btn-secondary btn-sm" type="submit">+ Exercício</button></div>
      </form>
    </div>
  `;
}

function linhaDiaSemana(dia, treinoDoDia) {
  const temTreino = Boolean(treinoDoDia);
  return `
    <div class="dia-linha ${temTreino ? "tem-treino" : ""}" data-dia="${dia.chave}">
      <span class="dia-nome">${dia.rotulo}</span>
      <span class="dia-treino-nome ${temTreino ? "" : "dia-treino-vazio"}">${
        temTreino ? escaparHtml(treinoDoDia.nome) : "Dia de descanso"
      }</span>
      <div class="dia-acoes">
        ${
          temTreino
            ? `<button class="btn btn-ghost btn-sm" data-acao="montar-treino" data-dia="${dia.chave}" type="button" title="Refazer este dia com o montador">${ICONE_HALTERES} Refazer</button>
               <button class="btn btn-ghost btn-sm" data-acao="excluir-dia" data-dia="${dia.chave}" data-id="${treinoDoDia.id}" type="button" title="Remover treino deste dia">${ICONE_LIXEIRA}</button>`
            : `<button class="btn btn-primary btn-sm" data-acao="montar-treino" data-dia="${dia.chave}" type="button">${ICONE_HALTERES} Montar treino</button>`
        }
      </div>
    </div>
  `;
}

function renderizarGradeSemana() {
  gradeSemanaEl.innerHTML = DIAS_SEMANA.map((dia) => {
    const treinoDoDia = treinosCache.find((t) => t.dia_semana === dia.chave);
    return linhaDiaSemana(dia, treinoDoDia);
  }).join("");
}

async function recarregarTreinos() {
  try {
    treinosCache = await api.listarTreinos(alunoId);
    renderizarGradeSemana();
    listaTreinosEl.innerHTML =
      treinosCache.map(cardTreino).join("") ||
      `<p class="hint-text">Nenhum treino com exercícios ainda — preencha um dia na semana acima pra começar.</p>`;
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

/** Acha um treino/exercício/série no cache local pelo id, pra pré-preencher o modal de edição. */
function encontrarNoCache(tipo, id) {
  for (const treino of treinosCache) {
    if (tipo === "treino" && treino.id === id) return treino;
    for (const exercicio of treino.exercicios) {
      if (tipo === "exercicio" && exercicio.id === id) return exercicio;
      for (const serie of exercicio.series) {
        if (tipo === "serie" && serie.id === id) return serie;
      }
    }
  }
  return null;
}

const CAMPOS_POR_TIPO = {
  treino: {
    titulo: "Editar treino",
    campos: (item) => `
      <div class="form-group">
        <label class="label" for="editar-item-nome">Nome do treino</label>
        <input class="input" id="editar-item-nome" name="nome" value="${escaparHtml(item.nome)}" required />
      </div>
    `,
    montarPayload: (form) => ({ nome: form.nome.value.trim() }),
    salvar: (id, payload) => api.atualizarTreino(id, payload),
  },
  exercicio: {
    titulo: "Editar exercício",
    campos: (item) => `
      <div class="form-group">
        <label class="label" for="editar-item-nome">Nome do exercício</label>
        <input class="input" id="editar-item-nome" name="nome" list="lista-exercicios" value="${escaparHtml(item.nome)}" required />
      </div>
      <div class="form-group">
        <label class="label" for="editar-item-observacoes">Observações (opcional)</label>
        <textarea class="textarea" id="editar-item-observacoes" name="observacoes">${escaparHtml(item.observacoes || "")}</textarea>
      </div>
    `,
    montarPayload: (form) => ({ nome: form.nome.value.trim(), observacoes: form.observacoes.value.trim() || null }),
    salvar: (id, payload) => api.atualizarExercicio(id, payload),
  },
  serie: {
    titulo: "Editar série",
    campos: (item) => `
      <div class="form-row">
        <div class="form-group">
          <label class="label" for="editar-item-repeticoes">Repetições</label>
          <input class="input" id="editar-item-repeticoes" name="repeticoes_alvo" maxlength="60" value="${escaparHtml(item.repeticoes_alvo)}" required />
        </div>
        <div class="form-group">
          <label class="label" for="editar-item-carga">Carga (opcional)</label>
          <input class="input" id="editar-item-carga" name="carga_alvo" maxlength="60" value="${escaparHtml(item.carga_alvo || "")}" />
        </div>
      </div>
      <div class="form-group">
        <label class="label" for="editar-item-intervalo">Descanso (opcional)</label>
        <input class="input" id="editar-item-intervalo" name="intervalo_descanso" maxlength="20" placeholder="ex: 60s" value="${escaparHtml(item.intervalo_descanso || "")}" />
      </div>
    `,
    montarPayload: (form) => ({
      repeticoes_alvo: form.repeticoes_alvo.value.trim(),
      carga_alvo: form.carga_alvo.value.trim() || null,
      intervalo_descanso: form.intervalo_descanso.value.trim() || null,
    }),
    salvar: (id, payload) => api.atualizarSerie(id, payload),
  },
};

function abrirEdicaoItem(tipo, id) {
  const item = encontrarNoCache(tipo, id);
  if (!item) return;
  const config = CAMPOS_POR_TIPO[tipo];
  editarItemTitulo.textContent = config.titulo;
  editarItemCampos.innerHTML = config.campos(item);
  formEditarItem.dataset.tipo = tipo;
  formEditarItem.dataset.id = id;
  abrirModal(modalEditarItem);
}

async function carregarAluno() {
  try {
    alunoAtual = await api.obterAluno(alunoId);
    cabecalhoNomeEl.textContent = alunoAtual.nome;
    cabecalhoLinkEl.textContent = alunoAtual.link_acesso;
    cabecalhoLinkEl.dataset.link = alunoAtual.link_acesso;
    atualizarBotoesWhatsapp();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

/** Atualiza os dois botões de WhatsApp (chamar direto / mandar o link do treino) com os dados atuais do aluno. */
function atualizarBotoesWhatsapp() {
  const whatsapp = linkWhatsApp(alunoAtual.telefone);
  whatsappEl.hidden = !whatsapp;
  if (whatsapp) whatsappEl.href = whatsapp;

  const mensagemLink = `Oi ${alunoAtual.nome}! Aqui está o link do seu treino: ${alunoAtual.link_acesso}`;
  const linkComMensagem = linkWhatsApp(alunoAtual.telefone, mensagemLink);
  linkWhatsappEl.hidden = !linkComMensagem;
  if (linkComMensagem) linkWhatsappEl.href = linkComMensagem;

  // Mesmo link, só que no grupo de botões ao lado de Imprimir/Excel — o
  // WhatsApp não deixa anexar arquivo por link (wa.me só manda texto), então
  // a "ficha" que dá pra mandar por lá é o link de acesso mesmo.
  fichaWhatsappEl.hidden = !linkComMensagem;
  if (linkComMensagem) fichaWhatsappEl.href = linkComMensagem;
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

// --- Peso e meta: histórico de avaliações + progresso até a meta cadastrada no aluno ---

function formatarData(isoData) {
  const [ano, mes, dia] = isoData.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** A partir do histórico (mais antigo → mais recente), calcula quanto já foi andado até a meta. */
function calcularProgressoPeso(avaliacoes, metaKg) {
  if (avaliacoes.length === 0) return null;
  const ordenadas = [...avaliacoes].sort((a, b) => a.data.localeCompare(b.data));
  const inicial = ordenadas[0].peso_kg;
  const atual = ordenadas[ordenadas.length - 1].peso_kg;
  if (!metaKg) return { atual, inicial, meta: null, percentual: null };

  const totalNecessario = inicial - metaKg; // positivo = meta é emagrecer, negativo = meta é ganhar peso
  const jaAndado = inicial - atual;
  const percentual = totalNecessario !== 0 ? (jaAndado / totalNecessario) * 100 : atual === metaKg ? 100 : 0;
  return { atual, inicial, meta: metaKg, percentual: Math.max(0, Math.min(100, percentual)) };
}

function renderizarAvaliacaoProgresso() {
  const meta = alunoAtual?.peso_meta_kg ?? null;
  const progresso = calcularProgressoPeso(avaliacoesCache, meta);

  if (!progresso) {
    avaliacaoProgressoEl.innerHTML = `<p class="hint-text">Nenhum peso registrado ainda.${meta ? ` Meta cadastrada: ${meta}kg.` : " Registre o peso atual e, se quiser, uma meta em \"Editar aluno\"."}</p>`;
    return;
  }

  if (progresso.meta === null) {
    avaliacaoProgressoEl.innerHTML = `
      <p><strong>${progresso.atual}kg</strong> registrado por último.</p>
      <p class="hint-text">Defina uma meta de peso em "Editar aluno" pra acompanhar o progresso aqui.</p>
    `;
    return;
  }

  const diferenca = Math.round(Math.abs(progresso.atual - progresso.meta) * 10) / 10;
  const faltaTexto = diferenca === 0 ? "Meta alcançada!" : `Faltam ${diferenca}kg para a meta de ${progresso.meta}kg.`;

  avaliacaoProgressoEl.innerHTML = `
    <p><strong>${progresso.atual}kg</strong> atualmente <span class="hint-text">(começou com ${progresso.inicial}kg)</span></p>
    <div class="barra-progresso"><div class="barra-progresso-preenchida" style="width:${progresso.percentual}%;"></div></div>
    <p class="hint-text" style="margin-top:var(--espaco-2);">${faltaTexto}</p>
  `;
}

function renderizarAvaliacaoHistorico() {
  if (avaliacoesCache.length === 0) {
    avaliacaoHistoricoEl.innerHTML = "";
    return;
  }
  avaliacaoHistoricoEl.innerHTML = `
    <details>
      <summary class="hint-text" style="cursor:pointer;font-weight:700;">Ver histórico (${avaliacoesCache.length})</summary>
      <div style="display:flex;flex-direction:column;gap:var(--espaco-2);margin-top:var(--espaco-2);">
        ${avaliacoesCache
          .map(
            (a) => `
              <div class="series-linha" data-avaliacao-id="${a.id}">
                <span>${formatarData(a.data)} — <strong>${a.peso_kg}kg</strong>${a.observacoes ? " · " + escaparHtml(a.observacoes) : ""}</span>
                <button class="btn btn-ghost btn-sm" data-acao="excluir-avaliacao" data-id="${a.id}" type="button">${ICONE_LIXEIRA}</button>
              </div>
            `
          )
          .join("")}
      </div>
    </details>
  `;
}

let avaliacoesRequisicaoId = 0; // evita que uma resposta antiga (fora de ordem) sobrescreva uma mais nova

async function carregarAvaliacoes() {
  const idDestaRequisicao = ++avaliacoesRequisicaoId;
  try {
    const dados = await api.listarAvaliacoes(alunoId);
    if (idDestaRequisicao !== avaliacoesRequisicaoId) return; // chegou depois de uma requisição mais nova, ignora
    avaliacoesCache = dados;
    renderizarAvaliacaoProgresso();
    renderizarAvaliacaoHistorico();
  } catch (erro) {
    if (idDestaRequisicao !== avaliacoesRequisicaoId) return;
    avaliacaoProgressoEl.innerHTML = `<p class="hint-text">Não foi possível carregar o histórico de peso agora.</p>`;
  }
}

$("[data-acao='abrir-nova-avaliacao']")?.addEventListener("click", () => {
  formNovaAvaliacao.reset();
  formNovaAvaliacao.data.value = new Date().toISOString().slice(0, 10);
  abrirModal(modalNovaAvaliacao);
});

document
  .querySelectorAll("[data-acao='fechar-modal-avaliacao']")
  .forEach((el) => el.addEventListener("click", () => fecharModal(modalNovaAvaliacao)));

formNovaAvaliacao?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const botao = $("button[type='submit']", formNovaAvaliacao);
  botao.disabled = true;
  try {
    await api.criarAvaliacao(alunoId, {
      data: formNovaAvaliacao.data.value || null,
      peso_kg: Number(formNovaAvaliacao.peso_kg.value),
      observacoes: formNovaAvaliacao.observacoes.value.trim() || null,
    });
    mostrarToast("Peso registrado!", "sucesso");
    fecharModal(modalNovaAvaliacao);
    carregarAvaliacoes();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botao.disabled = false;
  }
});

avaliacaoHistoricoEl?.addEventListener("click", async (evento) => {
  const botao = evento.target.closest("[data-acao='excluir-avaliacao']");
  if (!botao) return;
  const confirmou = await confirmarAcao("Remover esse registro de peso?", {
    titulo: "Remover registro",
    textoConfirmar: "Remover",
  });
  if (!confirmou) return;
  try {
    await api.excluirAvaliacao(Number(botao.dataset.id));
    mostrarToast("Registro removido.", "sucesso");
    carregarAvaliacoes();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
});

// --- Imprimir ficha (janela de impressão) e baixar Excel profissional ---

/**
 * Agrupa séries idênticas (mesma repetição/carga/descanso) numa linha só —
 * ex: 4 séries de "10-12" viram "4x 10-12" em vez de 4 linhas repetidas.
 * Deixa a ficha impressa curta (poucas páginas) mesmo com o treino inteiro.
 */
function agruparSeriesParaImpressao(series) {
  const grupos = [];
  for (const serie of series) {
    const chave = `${serie.repeticoes_alvo}|${serie.carga_alvo || ""}|${serie.intervalo_descanso || ""}`;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.chave === chave) {
      ultimo.quantidade += 1;
    } else {
      grupos.push({
        chave,
        quantidade: 1,
        repeticoes: serie.repeticoes_alvo,
        carga: serie.carga_alvo,
        descanso: serie.intervalo_descanso,
      });
    }
  }
  return grupos;
}

function montarFichaImpressao() {
  const dataEmissao = new Date().toLocaleDateString("pt-BR");

  const blocosTreino =
    treinosCache
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map((treino) => {
        const linhas = treino.exercicios
          .flatMap((exercicio) => {
            const grupos = agruparSeriesParaImpressao(exercicio.series);
            if (grupos.length === 0) {
              return [`<tr><td>${escaparHtml(exercicio.nome)}</td><td colspan="3">Sem séries cadastradas.</td></tr>`];
            }
            return grupos.map(
              (g, indice) => `
                <tr>
                  <td>${indice === 0 ? escaparHtml(exercicio.nome) : ""}</td>
                  <td>${g.quantidade > 1 ? `${g.quantidade}x ` : ""}${escaparHtml(g.repeticoes)}</td>
                  <td>${g.carga ? escaparHtml(g.carga) : "—"}</td>
                  <td>${g.descanso ? escaparHtml(g.descanso) : "—"}</td>
                </tr>
              `
            );
          })
          .join("");
        return `
          <div class="ficha-treino">
            <h3>${treino.dia_semana ? ROTULO_DIA[treino.dia_semana] + " — " : ""}${escaparHtml(treino.nome)}</h3>
            <table class="ficha-tabela">
              <thead><tr><th>Exercício</th><th>Séries x Repetições</th><th>Carga</th><th>Descanso</th></tr></thead>
              <tbody>${linhas || `<tr><td colspan="4">Sem exercícios cadastrados.</td></tr>`}</tbody>
            </table>
          </div>
        `;
      })
      .join("") || "<p>Nenhum treino cadastrado ainda.</p>";

  const ultimoPeso = [...avaliacoesCache].sort((a, b) => b.data.localeCompare(a.data))[0];
  const infoPeso = ultimoPeso
    ? `<p class="ficha-peso"><strong>Peso atual:</strong> ${ultimoPeso.peso_kg}kg (registrado em ${formatarData(ultimoPeso.data)})${
        alunoAtual.peso_meta_kg ? ` &nbsp;·&nbsp; <strong>Meta:</strong> ${alunoAtual.peso_meta_kg}kg` : ""
      }</p>`
    : "";

  fichaImpressaoEl.innerHTML = `
    <div class="ficha-cabecalho">
      <div class="ficha-logo">Sek<span>lyn</span></div>
      <div class="ficha-meta">
        <p><strong>Aluno:</strong> ${escaparHtml(alunoAtual.nome)}</p>
        <p><strong>Emitido em:</strong> ${dataEmissao}</p>
      </div>
    </div>
    ${infoPeso}
    ${blocosTreino}
    <p class="ficha-rodape">Ficha gerada pelo Seklyn — seklyn.com.br</p>
  `;
}

$("[data-acao='imprimir-ficha']")?.addEventListener("click", () => {
  if (!alunoAtual) return;
  montarFichaImpressao();
  window.print();
});

$("[data-acao='baixar-excel']")?.addEventListener("click", async (evento) => {
  const botao = evento.currentTarget;
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = "Gerando...";
  try {
    const resposta = await fetch(`${API_BASE_URL}/personal/alunos/${alunoId}/exportar-excel`, {
      headers: { Authorization: `Bearer ${obterToken()}` },
    });
    if (!resposta.ok) throw new Error("Não foi possível gerar o Excel agora. Tente de novo em instantes.");
    const blob = await resposta.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `seklyn-${(alunoAtual?.nome || "aluno").toLowerCase().replace(/\s+/g, "-")}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
});

// --- Montador assistido de treino: 1) categorias (pode escolher várias) →
// 2) exercícios sugeridos → 3) séries/repetições/descanso em botões prontos.

function mostrarPassoMontagem(numero) {
  passoCategoriaEl.hidden = numero !== 1;
  passoExerciciosEl.hidden = numero !== 2;
  passoConfigEl.hidden = numero !== 3;
  $all(".passo-bolha", passosIndicadorEl).forEach((bolha) => {
    const n = Number(bolha.dataset.passo);
    bolha.classList.toggle("ativo", n === numero);
    bolha.classList.toggle("concluido", n < numero);
  });
}

function renderizarGradeCategorias() {
  gradeCategoriasEl.innerHTML = CATEGORIAS_TREINO.map(
    (cat) => `
      <button class="categoria-chip ${categoriasSelecionadas.includes(cat.chave) ? "selecionada" : ""}" type="button" data-categoria="${cat.chave}">
        <span class="emoji">${iconeCategoriaTreino(cat.chave)}</span>
        <span>${cat.rotulo}</span>
      </button>
    `
  ).join("");
}

/** Junta os exercícios de todas as categorias escolhidas, sem repetir nome. */
function montarItensDasCategorias() {
  const vistos = new Set();
  const itens = [];
  for (const chave of categoriasSelecionadas) {
    const categoria = obterCategoria(chave);
    if (!categoria) continue;
    for (const ex of categoria.exercicios) {
      if (vistos.has(ex.nome)) continue;
      vistos.add(ex.nome);
      itens.push({ nome: ex.nome, incluido: ex.recomendado, categoria: categoria.rotulo, categoriaChave: chave });
    }
  }
  return itens;
}

/** Agrupa os exercícios marcados por categoria, na ordem em que foram escolhidas (manuais por último). */
function gruposAtivos() {
  const porChave = new Map();
  itensSelecionados.forEach((item) => {
    if (!item.incluido) return;
    const chave = item.categoriaChave || "manual";
    const rotulo = item.categoria || "Adicionados manualmente";
    if (!porChave.has(chave)) porChave.set(chave, { chave, rotulo, itens: [] });
    porChave.get(chave).itens.push(item);
  });
  const ordem = [...categoriasSelecionadas, "manual"];
  return Array.from(porChave.values()).sort((a, b) => ordem.indexOf(a.chave) - ordem.indexOf(b.chave));
}

function renderizarChecklistExercicios() {
  const grupos = new Map();
  itensSelecionados.forEach((item, indice) => {
    const chaveGrupo = item.categoria || "Adicionados manualmente";
    if (!grupos.has(chaveGrupo)) grupos.set(chaveGrupo, []);
    grupos.get(chaveGrupo).push({ ...item, indice });
  });

  listaExerciciosSugeridosEl.innerHTML = Array.from(grupos.entries())
    .map(
      ([grupo, itens]) => `
        <div>
          <p class="hint-text" style="font-weight:700;margin:var(--espaco-2) 0 4px;">${escaparHtml(grupo)}</p>
          ${itens
            .map(
              (item) => `
                <label class="exercicio-sugerido ${item.incluido ? "selecionado" : ""}" style="margin-bottom:var(--espaco-2);">
                  <input type="checkbox" data-indice="${item.indice}" ${item.incluido ? "checked" : ""} />
                  <span class="exercicio-sugerido-nome">${escaparHtml(item.nome)}</span>
                </label>
              `
            )
            .join("")}
        </div>
      `
    )
    .join("");
}

function renderizarChipsConfig(container, opcoes, valorAtual, grupo, permitirPersonalizado = true) {
  const chipsPreset = opcoes
    .map(
      (op) =>
        `<button class="chip-opcao ${String(op) === String(valorAtual) ? "selecionado" : ""}" type="button" data-grupo="${grupo}" data-valor="${op}">${op}</button>`
    )
    .join("");
  const chipOutro = permitirPersonalizado
    ? `<button class="chip-opcao ${valorAtual === "outro" ? "selecionado" : ""}" type="button" data-grupo="${grupo}" data-valor="outro">Personalizado</button>`
    : "";
  container.innerHTML = chipsPreset + chipOutro;
}

function renderizarPassoConfig() {
  const grupos = gruposAtivos();
  configPorGrupo = {};

  const rotulos = categoriasSelecionadas.map((c) => obterCategoria(c)?.rotulo).filter(Boolean);
  montarTreinoNomeInput.value = `Treino - ${rotulos.join(" e ")}`;

  configGruposEl.innerHTML = grupos
    .map(({ chave, rotulo, itens }) => {
      const tipoConfig = chave === "manual" ? "series" : obterCategoria(chave)?.tipoConfig || "series";
      const contagem = `<span class="hint-text">(${itens.length} exercício${itens.length > 1 ? "s" : ""})</span>`;

      if (tipoConfig === "tempo") {
        // Cardio não tem série/repetição — só o tempo do exercício.
        return `
          <div class="config-grupo">
            <p class="config-grupo-titulo">${escaparHtml(rotulo)} ${contagem}</p>
            <div class="form-group">
              <span class="label">Tempo</span>
              <div class="grade-chips" data-chips="tempo" data-grupo-config="${chave}"></div>
              <input class="input" data-campo="tempo-personalizado" data-grupo-config="${chave}" placeholder="Ex: 25 min" maxlength="60" hidden style="margin-top:var(--espaco-2);" />
            </div>
          </div>
        `;
      }

      return `
        <div class="config-grupo">
          <p class="config-grupo-titulo">${escaparHtml(rotulo)} ${contagem}</p>
          <div class="form-group">
            <span class="label">Quantas séries</span>
            <div class="grade-chips" data-chips="series" data-grupo-config="${chave}"></div>
          </div>
          <div class="form-group">
            <span class="label">Repetições por série</span>
            <div class="grade-chips" data-chips="repeticoes" data-grupo-config="${chave}"></div>
            <input class="input" data-campo="repeticoes-personalizado" data-grupo-config="${chave}" placeholder="Ex: 10-12" maxlength="60" hidden style="margin-top:var(--espaco-2);" />
          </div>
          <div class="form-group">
            <span class="label">Descanso entre séries</span>
            <div class="grade-chips" data-chips="descanso" data-grupo-config="${chave}"></div>
            <input class="input" data-campo="descanso-personalizado" data-grupo-config="${chave}" placeholder="Ex: 60s" maxlength="20" hidden style="margin-top:var(--espaco-2);" />
          </div>
          <div class="form-group">
            <label class="label">Carga (opcional)</label>
            <input class="input" data-campo="carga" data-grupo-config="${chave}" placeholder="Deixe em branco se variar por aluno" maxlength="60" />
          </div>
        </div>
      `;
    })
    .join("");

  grupos.forEach(({ chave }) => {
    const categoria = chave === "manual" ? null : obterCategoria(chave);
    const tipoConfig = categoria?.tipoConfig || "series";
    const padrao = categoria?.padrao || { repeticoes_alvo: "10-12", intervalo_descanso: "60s" };

    if (tipoConfig === "tempo") {
      configPorGrupo[chave] = { tipo: "tempo", tempo: padrao.repeticoes_alvo };
      renderizarChipsConfig(
        configGruposEl.querySelector(`[data-chips="tempo"][data-grupo-config="${chave}"]`),
        OPCOES_TEMPO,
        configPorGrupo[chave].tempo,
        `${chave}__tempo`
      );
      return;
    }

    configPorGrupo[chave] = {
      tipo: "series",
      series: 3,
      repeticoes: padrao.repeticoes_alvo,
      descanso: padrao.intervalo_descanso || "60s",
    };

    renderizarChipsConfig(
      configGruposEl.querySelector(`[data-chips="series"][data-grupo-config="${chave}"]`),
      OPCOES_SERIES,
      configPorGrupo[chave].series,
      `${chave}__series`,
      false
    );
    renderizarChipsConfig(
      configGruposEl.querySelector(`[data-chips="repeticoes"][data-grupo-config="${chave}"]`),
      OPCOES_REPETICOES,
      configPorGrupo[chave].repeticoes,
      `${chave}__repeticoes`
    );
    renderizarChipsConfig(
      configGruposEl.querySelector(`[data-chips="descanso"][data-grupo-config="${chave}"]`),
      OPCOES_DESCANSO,
      configPorGrupo[chave].descanso,
      `${chave}__descanso`
    );
  });
}

/** Lê a config de uma categoria no momento de salvar, resolvendo os campos "Personalizado". */
function resolverConfigGrupo(chave) {
  const cfg = configPorGrupo[chave];

  if (cfg.tipo === "tempo") {
    const tempo =
      cfg.tempo === "outro"
        ? (configGruposEl.querySelector(`[data-campo="tempo-personalizado"][data-grupo-config="${chave}"]`)?.value.trim() || "")
        : String(cfg.tempo);
    return { repeticoes: tempo, descanso: null, numeroSeries: 1, carga: null };
  }

  const repeticoes =
    cfg.repeticoes === "outro"
      ? (configGruposEl.querySelector(`[data-campo="repeticoes-personalizado"][data-grupo-config="${chave}"]`)?.value.trim() || "")
      : String(cfg.repeticoes);
  const descanso =
    cfg.descanso === "outro"
      ? (configGruposEl.querySelector(`[data-campo="descanso-personalizado"][data-grupo-config="${chave}"]`)?.value.trim() || "")
      : String(cfg.descanso);
  const numeroSeries = Number(cfg.series) || 3;
  const carga = configGruposEl.querySelector(`[data-campo="carga"][data-grupo-config="${chave}"]`)?.value.trim() || null;
  return { repeticoes, descanso, numeroSeries, carga };
}

function abrirMontarTreino(dia) {
  montarTreinoDia = dia;
  const jaTemTreino = treinosCache.some((t) => t.dia_semana === dia);
  montarTreinoTitulo.textContent = jaTemTreino
    ? `Refazer treino de ${ROTULO_DIA[dia]}`
    : `Montar treino de ${ROTULO_DIA[dia]}`;
  categoriasSelecionadas = [];
  itensSelecionados = [];
  renderizarGradeCategorias();
  mostrarPassoMontagem(1);
  abrirModal(modalMontarTreino);
}

async function confirmarMontagemTreino() {
  const nome = montarTreinoNomeInput.value.trim();
  const selecionados = itensSelecionados.filter((item) => item.incluido);
  if (!nome || selecionados.length === 0) {
    mostrarToast("Dê um nome ao treino e marque pelo menos um exercício.", "erro");
    return;
  }

  const grupos = gruposAtivos();
  const configResolvida = new Map();
  for (const { chave, rotulo } of grupos) {
    const resolvido = resolverConfigGrupo(chave);
    if (!resolvido.repeticoes) {
      const campo = configPorGrupo[chave]?.tipo === "tempo" ? "o tempo" : "as repetições";
      mostrarToast(`Informe ${campo} de "${rotulo}".`, "erro");
      return;
    }
    configResolvida.set(chave, resolvido);
  }

  const diaIndex = DIAS_SEMANA.findIndex((d) => d.chave === montarTreinoDia);
  const botao = $("[data-acao='confirmar-montar-treino']", modalMontarTreino);
  const textoOriginalBotao = botao.textContent;
  botao.disabled = true;
  botao.textContent = "Salvando...";

  try {
    await api.montarTreino(alunoId, {
      nome,
      ordem: diaIndex,
      dia_semana: montarTreinoDia,
      exercicios: selecionados.map((item) => {
        const { repeticoes, descanso, numeroSeries, carga } = configResolvida.get(item.categoriaChave || "manual");
        // Uma linha de série por série de verdade (ex: "4 séries" = 4 linhas o aluno marca uma a uma).
        const serieRepetida = { repeticoes_alvo: repeticoes, carga_alvo: carga, intervalo_descanso: descanso || null };
        return { nome: item.nome, series: Array.from({ length: numeroSeries }, () => serieRepetida) };
      }),
    });

    mostrarToast(`Treino de ${ROTULO_DIA[montarTreinoDia]} criado com ${selecionados.length} exercício(s)!`, "sucesso");
    fecharModal(modalMontarTreino);
    recarregarTreinos();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginalBotao;
  }
}

gradeCategoriasEl?.addEventListener("click", (evento) => {
  const chip = evento.target.closest("[data-categoria]");
  if (!chip) return;
  const chave = chip.dataset.categoria;
  if (categoriasSelecionadas.includes(chave)) {
    categoriasSelecionadas = categoriasSelecionadas.filter((c) => c !== chave);
  } else {
    categoriasSelecionadas.push(chave);
  }
  renderizarGradeCategorias();
});

$("[data-acao='ir-para-exercicios']")?.addEventListener("click", () => {
  if (categoriasSelecionadas.length === 0) {
    mostrarToast("Escolha pelo menos uma categoria.", "erro");
    return;
  }
  itensSelecionados = montarItensDasCategorias();
  renderizarChecklistExercicios();
  mostrarPassoMontagem(2);
});

$all("[data-acao='voltar-categoria']").forEach((el) => el.addEventListener("click", () => mostrarPassoMontagem(1)));
$all("[data-acao='voltar-exercicios']").forEach((el) => el.addEventListener("click", () => mostrarPassoMontagem(2)));

$("[data-acao='ir-para-config']")?.addEventListener("click", () => {
  if (!itensSelecionados.some((item) => item.incluido)) {
    mostrarToast("Marque pelo menos um exercício.", "erro");
    return;
  }
  renderizarPassoConfig();
  mostrarPassoMontagem(3);
});

listaExerciciosSugeridosEl?.addEventListener("change", (evento) => {
  const checkbox = evento.target.closest("input[type='checkbox']");
  if (!checkbox) return;
  const indice = Number(checkbox.dataset.indice);
  itensSelecionados[indice].incluido = checkbox.checked;
  checkbox.closest(".exercicio-sugerido").classList.toggle("selecionado", checkbox.checked);
});

$("[data-acao='adicionar-outro-exercicio']")?.addEventListener("click", () => {
  const nome = outroExercicioInput.value.trim();
  if (!nome) return;
  itensSelecionados.push({ nome, incluido: true, categoria: null, categoriaChave: null });
  outroExercicioInput.value = "";
  renderizarChecklistExercicios();
});

configGruposEl?.addEventListener("click", (evento) => {
  const chip = evento.target.closest(".chip-opcao");
  if (!chip) return;
  const [chaveGrupo, campo] = chip.dataset.grupo.split("__");
  const valor = chip.dataset.valor;
  const bruto = valor === "outro" ? "outro" : isNaN(Number(valor)) ? valor : Number(valor);
  configPorGrupo[chaveGrupo][campo] = bruto;

  $all(`.chip-opcao[data-grupo="${chip.dataset.grupo}"]`, configGruposEl).forEach((c) => c.classList.toggle("selecionado", c === chip));

  if (campo === "repeticoes" || campo === "descanso" || campo === "tempo") {
    const personalizadoEl = configGruposEl.querySelector(`[data-campo="${campo}-personalizado"][data-grupo-config="${chaveGrupo}"]`);
    if (personalizadoEl) {
      personalizadoEl.hidden = valor !== "outro";
      if (valor === "outro") personalizadoEl.focus();
    }
  }
});

document
  .querySelectorAll("[data-acao='fechar-modal-montar']")
  .forEach((el) => el.addEventListener("click", () => fecharModal(modalMontarTreino)));

$("[data-acao='confirmar-montar-treino']")?.addEventListener("click", confirmarMontagemTreino);

cabecalhoLinkEl?.addEventListener("click", () => {
  if (cabecalhoLinkEl.dataset.link) copiarParaAreaDeTransferencia(cabecalhoLinkEl.dataset.link, cabecalhoLinkEl);
});

gradeSemanaEl?.addEventListener("click", async (evento) => {
  const botao = evento.target.closest("button[data-acao]");
  if (!botao) return;
  const dia = botao.dataset.dia;

  if (botao.dataset.acao === "montar-treino") {
    abrirMontarTreino(dia);
    return;
  }

  if (botao.dataset.acao === "excluir-dia") {
    const confirmou = await confirmarAcao(`Remover o treino de ${ROTULO_DIA[dia]} e todos os seus exercícios/séries?`, {
      titulo: "Remover treino",
      textoConfirmar: "Remover",
    });
    if (!confirmou) return;
    try {
      await api.excluirTreino(Number(botao.dataset.id));
      mostrarToast("Treino removido.", "sucesso");
      recarregarTreinos();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
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
    const intervaloDescanso = alvo.intervalo_descanso.value.trim() || null;
    if (!repeticoesAlvo) return;
    try {
      await api.criarSerie(exercicioId, {
        ordem: 0,
        repeticoes_alvo: repeticoesAlvo,
        carga_alvo: cargaAlvo,
        intervalo_descanso: intervaloDescanso,
      });
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

  if (acao === "editar-treino") return abrirEdicaoItem("treino", id);
  if (acao === "editar-exercicio") return abrirEdicaoItem("exercicio", id);
  if (acao === "editar-serie") return abrirEdicaoItem("serie", id);

  const confirmacoes = {
    "excluir-treino": "Excluir este treino e todos os seus exercícios/séries?",
    "excluir-exercicio": "Excluir este exercício e suas séries?",
    "excluir-serie": "Remover esta série?",
  };
  if (confirmacoes[acao]) {
    const confirmou = await confirmarAcao(confirmacoes[acao], { titulo: "Confirmar exclusão", textoConfirmar: "Excluir" });
    if (!confirmou) return;
  }

  try {
    if (acao === "excluir-treino") await api.excluirTreino(id);
    if (acao === "excluir-exercicio") await api.excluirExercicio(id);
    if (acao === "excluir-serie") await api.excluirSerie(id);
    recarregarTreinos();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
});

// --- Editar aluno (nome/e-mail/WhatsApp/CPF/meta de peso) ---
$("[data-acao='editar-aluno']")?.addEventListener("click", () => {
  if (!alunoAtual) return;
  formEditarAluno.nome.value = alunoAtual.nome;
  formEditarAluno.email.value = alunoAtual.email || "";
  formEditarAluno.telefone.value = alunoAtual.telefone || "";
  formEditarAluno.endereco.value = alunoAtual.endereco || "";
  formEditarAluno.numero.value = alunoAtual.numero || "";
  formEditarAluno.peso_meta_kg.value = alunoAtual.peso_meta_kg ?? "";

  // CPF vem travado (texto fixo) depois de cadastrado — protege de trocar
  // sem querer enquanto edita outra coisa. Dá pra destravar com confirmação.
  const cpfInputEl = formEditarAluno.cpf;
  const blocoFixoEl = $("#editar-aluno-cpf-bloco-fixo");
  if (alunoAtual.cpf) {
    cpfInputEl.hidden = true;
    blocoFixoEl.hidden = false;
    $("#editar-aluno-cpf-fixo").textContent = alunoAtual.cpf;
  } else {
    cpfInputEl.hidden = false;
    cpfInputEl.value = "";
    blocoFixoEl.hidden = true;
  }

  // Só faz sentido definir uma meta depois de ter pelo menos um peso registrado
  // (é a partir dele que a barra de progresso calcula o ponto de partida).
  const temPeso = avaliacoesCache.length > 0;
  formEditarAluno.peso_meta_kg.disabled = !temPeso;
  avisoMetaSemPesoEl.hidden = temPeso;

  abrirModal(modalEditarAluno);
});

document.querySelectorAll("[data-acao='fechar-modal-aluno']").forEach((el) =>
  el.addEventListener("click", () => fecharModal(modalEditarAluno))
);

$("[data-acao='desbloquear-cpf-aluno']")?.addEventListener("click", async () => {
  const confirmou = await confirmarAcao("Tem certeza que quer corrigir o CPF? Só mude se foi cadastrado errado.", {
    titulo: "Corrigir CPF",
    textoConfirmar: "Sim, corrigir",
    perigo: false,
  });
  if (!confirmou) return;
  $("#editar-aluno-cpf-bloco-fixo").hidden = true;
  const cpfInputEl = formEditarAluno.cpf;
  cpfInputEl.hidden = false;
  cpfInputEl.value = alunoAtual.cpf || "";
  cpfInputEl.focus();
});

formEditarAluno?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const botao = $("button[type='submit']", formEditarAluno);
  botao.disabled = true;
  try {
    const dados = {
      nome: formEditarAluno.nome.value.trim(),
      email: formEditarAluno.email.value.trim() || null,
      telefone: formEditarAluno.telefone.value.trim() || null,
      endereco: formEditarAluno.endereco.value.trim() || null,
      numero: formEditarAluno.numero.value.trim() || null,
      peso_meta_kg: formEditarAluno.peso_meta_kg.value ? Number(formEditarAluno.peso_meta_kg.value) : null,
    };
    // Só manda o CPF se o campo estava editável (ainda não tinha sido definido) —
    // uma vez travado, não entra no payload, então o backend nem encosta nele.
    if (!formEditarAluno.cpf.hidden) {
      dados.cpf = formEditarAluno.cpf.value.trim() || null;
    }
    alunoAtual = await api.atualizarAluno(alunoId, dados);
    cabecalhoNomeEl.textContent = alunoAtual.nome;
    atualizarBotoesWhatsapp();
    renderizarAvaliacaoProgresso(); // a meta pode ter mudado

    mostrarToast("Dados do aluno atualizados!", "sucesso");
    fecharModal(modalEditarAluno);
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botao.disabled = false;
  }
});

// --- Editar treino/exercício/série (modal genérico, campos montados por tipo) ---
document.querySelectorAll("[data-acao='fechar-modal-item']").forEach((el) =>
  el.addEventListener("click", () => fecharModal(modalEditarItem))
);

formEditarItem?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const { tipo, id } = formEditarItem.dataset;
  const config = CAMPOS_POR_TIPO[tipo];
  const botao = $("button[type='submit']", formEditarItem);
  botao.disabled = true;
  try {
    await config.salvar(Number(id), config.montarPayload(formEditarItem));
    mostrarToast("Alterações salvas!", "sucesso");
    fecharModal(modalEditarItem);
    recarregarTreinos();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botao.disabled = false;
  }
});

carregarAluno();
recarregarTreinos();
carregarAnalytics();
carregarAvaliacoes();
