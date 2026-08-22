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
import { adicionarBlobsEm } from "./tema-personalizado.js";
import { renderizarPlayerVideo } from "./video-exercicio.js";

protegerPagina();
adicionarBlobsEm("#painel-hero-aluno");

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
const gradeSemanaEl = $("#grade-semana");
const analyticsEl = $("#analytics-resumo");
const avaliacaoProgressoEl = $("#avaliacao-progresso");
const avaliacaoHistoricoEl = $("#avaliacao-historico");
const fichaImpressaoEl = $("#ficha-impressao");
const modalNovaAvaliacao = $("#modal-nova-avaliacao");
const formNovaAvaliacao = $("#form-nova-avaliacao");
const anamneseEl = $("#anamnese-conteudo");
const modalAnamnese = $("#modal-anamnese");
const formAnamnese = $("#form-anamnese");
const fotosProgressoEl = $("#fotos-progresso-conteudo");
const modalNovaFoto = $("#modal-nova-foto");
const formNovaFoto = $("#form-nova-foto");
const modalSalvarTemplate = $("#modal-salvar-template");
const formSalvarTemplate = $("#form-salvar-template");
const modalUsarTemplate = $("#modal-usar-template");
const listaTemplatesUsarEl = $("#lista-templates-usar");
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
const configIndividualEl = $("#config-individual");
const configModoExplicacaoEl = $("#config-modo-explicacao");
const configModoToggleEl = $("#montar-treino-config-individual");
const listaVideosEl = $("#lista-videos-exercicios");

let alunoAtual = null;
let treinosCache = []; // guarda os dados carregados pra preencher os modais de edição sem outra chamada à API
let avaliacoesCache = []; // histórico de peso do aluno, mais recente primeiro (vem assim da API)
let fotosCache = []; // fotos de progresso, mais recente primeiro (vem assim da API)
let anamneseCache = null; // null = ainda não preenchida (ou não carregada)
let montarTreinoDia = null; // dia da semana sendo montado no modal assistido
let templateDiaAlvo = null; // dia da semana sendo salvo/preenchido via modelo
let templatesCache = null; // null = ainda não carregado (carrega sob demanda ao abrir "Usar modelo")
let categoriasSelecionadas = []; // chaves das categorias escolhidas no passo 1 (pode ser mais de uma)
let itensSelecionados = []; // [{ nome, incluido, categoria, categoriaChave }] — exercícios sugeridos das categorias escolhidas
let configPorGrupo = {}; // chave da categoria (ou "manual") → { series, repeticoes, descanso }
let configPorExercicio = {}; // índice de itensSelecionados → { series, repeticoes, descanso, cargaModo, carga, cargasPorSerie }
let videosPorItem = {}; // índice de itensSelecionados → { video_exercicio_id, video } | undefined (sem vídeo)
let modoConfigIndividual = false; // false = config por grupo/categoria (padrão), true = por exercício

// --- Acordeão da "Organização da semana" (edição direta na grade) ---
let diaExpandidoChave = null; // chave do dia com o corpo aberto (ex: "segunda") — só um por vez
let exercicioExpandidoId = null; // id do exercício aberto dentro do dia expandido — só um por vez

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
// Fotos de progresso ficam servidas pela API (uploads/), igual vídeo — a
// URL que vem do backend é relativa ("/uploads/fotos/...").
const ORIGEM_UPLOADS = API_BASE_URL.replace(/\/api\/?$/, "");

function linhaSerie(serie) {
  return `
    <div class="series-linha" data-serie-id="${serie.id}">
      <span>Série ${serie.ordem + 1}: ${escaparHtml(serie.repeticoes_alvo)} reps${serie.carga_alvo ? " · " + escaparHtml(serie.carga_alvo) : ""}${serie.intervalo_descanso ? " · descanso " + escaparHtml(serie.intervalo_descanso) : ""}</span>
      <button class="btn btn-ghost btn-sm" data-acao="editar-serie" data-id="${serie.id}" type="button">Editar</button>
      <button class="btn btn-ghost btn-sm" data-acao="excluir-serie" data-id="${serie.id}" type="button">Remover</button>
    </div>
  `;
}

/** Corpo do exercício quando o accordion dele tá aberto: vídeo, séries, form de nova série. */
function corpoExercicio(exercicio) {
  const series = exercicio.series.map(linhaSerie).join("") || `<p class="hint-text" style="margin:0 0 var(--espaco-2);">Nenhuma série cadastrada ainda.</p>`;
  const videoAtual = exercicio.video ? renderizarPlayerVideo(exercicio.video, { altura: 200 }) : "";
  const botoesVideo = exercicio.video
    ? `<button class="btn btn-ghost btn-sm" type="button" data-acao="abrir-video-exercicio" data-id="${exercicio.id}">Trocar vídeo</button>
       <button class="btn btn-ghost btn-sm" type="button" data-acao="remover-video-exercicio" data-id="${exercicio.id}">Remover vídeo</button>`
    : `<button class="btn btn-ghost btn-sm" type="button" data-acao="abrir-video-exercicio" data-id="${exercicio.id}">+ Adicionar vídeo</button>`;

  return `
    ${videoAtual}
    <div class="video-exercicio-anexo" style="margin:0 0 var(--espaco-3);">${botoesVideo}</div>
    <div class="video-exercicio-painel" data-painel-video-exercicio="${exercicio.id}" hidden></div>
    ${series}
    <form class="form-row" data-acao="form-nova-serie" data-exercicio-id="${exercicio.id}" style="margin-top:var(--espaco-2);">
      <div class="form-group" style="flex:1;"><input class="input" name="repeticoes_alvo" placeholder="Repetições (ex: 10-12)" maxlength="60" required /></div>
      <div class="form-group" style="flex:1;"><input class="input" name="carga_alvo" placeholder="Carga (opcional)" maxlength="60" /></div>
      <div class="form-group" style="flex:1;"><input class="input" name="intervalo_descanso" placeholder="Descanso (ex: 60s)" maxlength="20" /></div>
      <div class="form-group" style="flex:0;"><button class="btn btn-secondary btn-sm" type="submit">+ Série</button></div>
    </form>
  `;
}

/** Um exercício dentro do dia expandido — cabeçalho sempre visível, corpo em accordion próprio. */
function itemExercicio(exercicio) {
  const aberto = exercicioExpandidoId === exercicio.id;
  return `
    <div class="exercicio-item ${aberto ? "aberto" : ""}" data-exercicio-id="${exercicio.id}">
      <div class="exercicio-cabecalho" data-acao="toggle-exercicio" data-id="${exercicio.id}">
        ${icone("chevron", 16)}
        <span class="exercicio-nome">${escaparHtml(exercicio.nome)}</span>
        ${exercicio.categoria ? `<span class="badge badge-neutro">${escaparHtml(obterCategoria(exercicio.categoria)?.rotulo || exercicio.categoria)}</span>` : ""}
        ${exercicio.video ? `<span class="exercicio-video-marca" title="Tem vídeo anexado">${icone("video", 15)}</span>` : ""}
        <button class="btn btn-ghost btn-sm" data-acao="editar-exercicio" data-id="${exercicio.id}" type="button">Editar</button>
        <button class="btn btn-ghost btn-sm" data-acao="excluir-exercicio" data-id="${exercicio.id}" type="button">Remover</button>
      </div>
      <div class="acordeao-secao ${aberto ? "aberto" : ""}" data-exercicio-corpo="${exercicio.id}">
        <div class="exercicio-corpo">${aberto ? corpoExercicio(exercicio) : ""}</div>
      </div>
    </div>
  `;
}

/** Corpo do dia expandido: nome do treino editável inline + lista de exercícios em accordion. */
function corpoDiaExpandido(treino) {
  const exerciciosHtml =
    treino.exercicios.map(itemExercicio).join("") ||
    `<p class="hint-text" style="padding:var(--espaco-3);margin:0;">Esse treino ainda não tem exercícios.</p>`;
  return `
    <input class="treino-nome-input" type="text" value="${escaparHtml(treino.nome)}" data-treino-nome-id="${treino.id}" aria-label="Nome do treino" />
    <div class="exercicios-acordeao">${exerciciosHtml}</div>
  `;
}

function linhaDiaSemana(dia, treinoDoDia) {
  const temTreino = Boolean(treinoDoDia);
  const expandido = temTreino && diaExpandidoChave === dia.chave;
  return `
    <div class="dia-item ${temTreino ? "tem-treino" : ""}" data-dia-item="${dia.chave}">
      <div class="dia-linha" data-dia="${dia.chave}">
        <span class="dia-nome">${dia.rotulo}</span>
        <span class="dia-treino-nome ${temTreino ? "" : "dia-treino-vazio"}">${
          temTreino ? escaparHtml(treinoDoDia.nome) : "Dia de descanso"
        }</span>
        <div class="dia-acoes">
          ${
            temTreino
              ? `<button class="btn btn-ghost btn-sm" data-acao="editar-dia" data-dia="${dia.chave}" type="button">${icone("editar", 14)} Editar</button>
                 <button class="btn btn-ghost btn-sm" data-acao="montar-treino" data-dia="${dia.chave}" type="button" title="Refazer este dia com o montador">${ICONE_HALTERES} Refazer</button>
                 <button class="btn btn-ghost btn-sm btn-icon" data-acao="salvar-template" data-dia="${dia.chave}" type="button" title="Salvar este treino como modelo">${icone("salvar", 14)}</button>
                 <button class="btn btn-ghost btn-sm" data-acao="excluir-dia" data-dia="${dia.chave}" data-id="${treinoDoDia.id}" type="button" title="Remover treino deste dia">${ICONE_LIXEIRA}</button>`
              : `<button class="btn btn-primary btn-sm" data-acao="montar-treino" data-dia="${dia.chave}" type="button">${ICONE_HALTERES} Montar treino</button>
                 <button class="btn btn-ghost btn-sm" data-acao="usar-template" data-dia="${dia.chave}" type="button">${icone("copiar", 14)} Usar modelo</button>`
          }
        </div>
      </div>
      ${
        temTreino
          ? `<div class="acordeao-secao ${expandido ? "aberto" : ""}" data-dia-corpo="${dia.chave}">
              <div class="dia-corpo">${expandido ? corpoDiaExpandido(treinoDoDia) : ""}</div>
            </div>`
          : ""
      }
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
    // se o dia/exercício que tava aberto não existe mais (foi excluído em
    // outra aba, por ex.), fecha em vez de tentar renderizar algo que sumiu.
    if (diaExpandidoChave && !treinosCache.some((t) => t.dia_semana === diaExpandidoChave)) {
      diaExpandidoChave = null;
      exercicioExpandidoId = null;
    }
    renderizarGradeSemana();
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
  // "treino" saiu daqui — o nome agora é editado direto na linha do dia
  // (input inline em .treino-nome-input), sem precisar desse modal.
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
    montarPayload: (form) => ({
      nome: form.nome.value.trim(),
      observacoes: form.observacoes.value.trim() || null,
    }),
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
  const metaAlcancada = diferenca === 0;
  const faltaTexto = metaAlcancada
    ? `${icone("troféu", 15)} Meta alcançada!`
    : `Faltam ${diferenca}kg para a meta de ${progresso.meta}kg.`;

  avaliacaoProgressoEl.innerHTML = `
    <p><strong>${progresso.atual}kg</strong> atualmente <span class="hint-text">(começou com ${progresso.inicial}kg)</span></p>
    <div class="barra-progresso"><div class="barra-progresso-preenchida${metaAlcancada ? " meta-alcancada" : ""}" style="width:${progresso.percentual}%;"></div></div>
    <p class="${metaAlcancada ? "" : "hint-text"}" style="margin-top:var(--espaco-2);${metaAlcancada ? "color:var(--cor-sucesso);font-weight:700;" : ""}">${faltaTexto}</p>
  `;
}

const ROTULO_MEDIDA = { cintura_cm: "Cintura", quadril_cm: "Quadril", braco_cm: "Braço", coxa_cm: "Coxa", peito_cm: "Peito" };

/** "Cintura 80cm · Braço 35cm" — só as medidas que essa avaliação tem. */
function formatarMedidas(a) {
  return Object.entries(ROTULO_MEDIDA)
    .filter(([campo]) => a[campo] != null)
    .map(([campo, rotulo]) => `${rotulo} ${a[campo]}cm`)
    .join(" · ");
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
          .map((a) => {
            const medidas = formatarMedidas(a);
            return `
              <div class="series-linha" data-avaliacao-id="${a.id}" style="align-items:flex-start;">
                <span>
                  ${formatarData(a.data)} — <strong>${a.peso_kg}kg</strong>${a.observacoes ? " · " + escaparHtml(a.observacoes) : ""}
                  ${medidas ? `<br><span class="hint-text">${medidas}</span>` : ""}
                </span>
                <button class="btn btn-ghost btn-sm" data-acao="excluir-avaliacao" data-id="${a.id}" type="button">${ICONE_LIXEIRA}</button>
              </div>
            `;
          })
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
    const medida = (campo) => (formNovaAvaliacao[campo].value.trim() ? Number(formNovaAvaliacao[campo].value) : null);
    await api.criarAvaliacao(alunoId, {
      data: formNovaAvaliacao.data.value || null,
      peso_kg: Number(formNovaAvaliacao.peso_kg.value),
      cintura_cm: medida("cintura_cm"),
      quadril_cm: medida("quadril_cm"),
      braco_cm: medida("braco_cm"),
      coxa_cm: medida("coxa_cm"),
      peito_cm: medida("peito_cm"),
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

// --- Anamnese (ficha de avaliação inicial — um registro por aluno) ---

const ROTULO_NIVEL_EXPERIENCIA = { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado" };

function renderizarAnamnese() {
  const a = anamneseCache;
  const temAlgo = a && (a.nivel_experiencia || a.objetivo || a.lesoes_e_limitacoes || a.condicoes_saude || a.observacoes);
  if (!temAlgo) {
    anamneseEl.innerHTML = `<p class="hint-text">Nenhuma anamnese preenchida ainda.</p>`;
    return;
  }
  const linha = (rotulo, valor) =>
    valor ? `<p style="margin:0 0 var(--espaco-2);"><strong>${rotulo}:</strong> ${escaparHtml(valor)}</p>` : "";
  anamneseEl.innerHTML = `
    ${linha("Nível", ROTULO_NIVEL_EXPERIENCIA[a.nivel_experiencia] || null)}
    ${linha("Objetivo", a.objetivo)}
    ${linha("Lesões e limitações", a.lesoes_e_limitacoes)}
    ${linha("Condições de saúde", a.condicoes_saude)}
    ${linha("Observações", a.observacoes)}
  `;
}

async function carregarAnamnese() {
  try {
    anamneseCache = await api.obterAnamnese(alunoId);
    renderizarAnamnese();
  } catch {
    anamneseEl.innerHTML = `<p class="hint-text">Não foi possível carregar a anamnese agora.</p>`;
  }
}

$("[data-acao='abrir-anamnese']")?.addEventListener("click", () => {
  formAnamnese.reset();
  const a = anamneseCache;
  if (a) {
    formAnamnese.nivel_experiencia.value = a.nivel_experiencia || "";
    formAnamnese.objetivo.value = a.objetivo || "";
    formAnamnese.lesoes_e_limitacoes.value = a.lesoes_e_limitacoes || "";
    formAnamnese.condicoes_saude.value = a.condicoes_saude || "";
    formAnamnese.observacoes.value = a.observacoes || "";
  }
  abrirModal(modalAnamnese);
});

document
  .querySelectorAll("[data-acao='fechar-modal-anamnese']")
  .forEach((el) => el.addEventListener("click", () => fecharModal(modalAnamnese)));

formAnamnese?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const botao = $("button[type='submit']", formAnamnese);
  botao.disabled = true;
  try {
    anamneseCache = await api.salvarAnamnese(alunoId, {
      nivel_experiencia: formAnamnese.nivel_experiencia.value || null,
      objetivo: formAnamnese.objetivo.value.trim() || null,
      lesoes_e_limitacoes: formAnamnese.lesoes_e_limitacoes.value.trim() || null,
      condicoes_saude: formAnamnese.condicoes_saude.value.trim() || null,
      observacoes: formAnamnese.observacoes.value.trim() || null,
    });
    mostrarToast("Anamnese salva!", "sucesso");
    fecharModal(modalAnamnese);
    renderizarAnamnese();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botao.disabled = false;
  }
});

// --- Fotos de progresso (antes/depois) ---

function urlFotoCompleta(foto) {
  return foto.url.startsWith("http") ? foto.url : `${ORIGEM_UPLOADS}${foto.url}`;
}

function renderizarFotosProgresso() {
  if (fotosCache.length === 0) {
    fotosProgressoEl.innerHTML = `<p class="hint-text">Nenhuma foto enviada ainda.</p>`;
    return;
  }

  const ordenadasCronologicas = [...fotosCache].sort((a, b) => a.data.localeCompare(b.data));
  const primeira = ordenadasCronologicas[0];
  const ultima = ordenadasCronologicas[ordenadasCronologicas.length - 1];

  fotosProgressoEl.innerHTML = `
    ${
      fotosCache.length >= 2
        ? `
          <div class="fotos-comparacao">
            <div class="fotos-comparacao-item">
              <img src="${urlFotoCompleta(primeira)}" alt="Foto de ${formatarData(primeira.data)}" loading="lazy" />
              <span class="hint-text">Antes · ${formatarData(primeira.data)}</span>
            </div>
            <div class="fotos-comparacao-item">
              <img src="${urlFotoCompleta(ultima)}" alt="Foto de ${formatarData(ultima.data)}" loading="lazy" />
              <span class="hint-text">Depois · ${formatarData(ultima.data)}</span>
            </div>
          </div>
        `
        : ""
    }
    <div class="fotos-galeria">
      ${fotosCache
        .map(
          (f) => `
            <div class="fotos-galeria-item">
              <img src="${urlFotoCompleta(f)}" alt="Foto de ${formatarData(f.data)}" loading="lazy" data-acao="abrir-foto-ampliada" data-id="${f.id}" />
              <div class="fotos-galeria-legenda">
                <span>${formatarData(f.data)}</span>
                <button class="btn btn-ghost btn-sm" data-acao="excluir-foto" data-id="${f.id}" type="button">${ICONE_LIXEIRA}</button>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

let fotosRequisicaoId = 0; // evita que uma resposta antiga (fora de ordem) sobrescreva uma mais nova

async function carregarFotos() {
  const idDestaRequisicao = ++fotosRequisicaoId;
  try {
    const dados = await api.listarFotos(alunoId);
    if (idDestaRequisicao !== fotosRequisicaoId) return;
    fotosCache = dados;
    renderizarFotosProgresso();
  } catch (erro) {
    if (idDestaRequisicao !== fotosRequisicaoId) return;
    fotosProgressoEl.innerHTML = `<p class="hint-text">Não foi possível carregar as fotos agora.</p>`;
  }
}

$("[data-acao='abrir-nova-foto']")?.addEventListener("click", () => {
  formNovaFoto.reset();
  formNovaFoto.data.value = new Date().toISOString().slice(0, 10);
  abrirModal(modalNovaFoto);
});

document
  .querySelectorAll("[data-acao='fechar-modal-foto']")
  .forEach((el) => el.addEventListener("click", () => fecharModal(modalNovaFoto)));

formNovaFoto?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const arquivo = formNovaFoto.arquivo.files[0];
  if (!arquivo) return;
  const botao = $("button[type='submit']", formNovaFoto);
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = "Enviando...";
  try {
    await api.enviarFoto(alunoId, {
      arquivo,
      data: formNovaFoto.data.value || null,
      observacoes: formNovaFoto.observacoes.value.trim() || null,
    });
    mostrarToast("Foto enviada!", "sucesso");
    fecharModal(modalNovaFoto);
    carregarFotos();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
});

fotosProgressoEl?.addEventListener("click", async (evento) => {
  const botaoExcluir = evento.target.closest("[data-acao='excluir-foto']");
  if (botaoExcluir) {
    const confirmou = await confirmarAcao("Remover essa foto de progresso?", {
      titulo: "Remover foto",
      textoConfirmar: "Remover",
    });
    if (!confirmou) return;
    try {
      await api.excluirFoto(Number(botaoExcluir.dataset.id));
      mostrarToast("Foto removida.", "sucesso");
      carregarFotos();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
    return;
  }

  const imgAmpliar = evento.target.closest("[data-acao='abrir-foto-ampliada']");
  if (imgAmpliar) {
    const foto = fotosCache.find((f) => f.id === Number(imgAmpliar.dataset.id));
    if (foto) window.open(urlFotoCompleta(foto), "_blank", "noopener");
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
            <label class="label">Dica de execução (opcional)</label>
            <input class="input" data-campo="observacoes" data-grupo-config="${chave}" placeholder="Ex: desça devagar, cuidado com a lombar" maxlength="500" />
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
    return { repeticoes: tempo, descanso: null, numeroSeries: 1, observacoes: null };
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
  const observacoes = configGruposEl.querySelector(`[data-campo="observacoes"][data-grupo-config="${chave}"]`)?.value.trim() || null;
  return { repeticoes, descanso, numeroSeries, observacoes };
}

// --- Vídeo demonstrativo por exercício (upload ou link do YouTube, reusado por nome) ---

function renderizarListaVideos() {
  const selecionados = itensSelecionados.map((item, indice) => ({ ...item, indice })).filter((item) => item.incluido);
  listaVideosEl.innerHTML = selecionados
    .map(({ nome, indice }) => {
      const anexado = videosPorItem[indice]?.video_exercicio_id;
      return `
        <div>
          <div class="video-exercicio-anexo" data-video-item="${indice}">
            <span style="flex:1;font-size:0.88rem;">${escaparHtml(nome)}</span>
            ${
              anexado
                ? `<span class="video-exercicio-badge">${icone("check", 14)} Vídeo anexado</span>
                   <button class="btn btn-ghost btn-sm" type="button" data-acao="remover-video" data-indice="${indice}">Remover</button>`
                : `<button class="btn btn-ghost btn-sm" type="button" data-acao="abrir-video" data-indice="${indice}">+ Vídeo</button>`
            }
          </div>
          <div class="video-exercicio-painel" data-painel-video="${indice}" hidden></div>
        </div>
      `;
    })
    .join("");
}

async function abrirPainelVideo(indice) {
  const painel = listaVideosEl.querySelector(`[data-painel-video="${indice}"]`);
  if (!painel) return;
  const item = itensSelecionados[indice];
  painel.hidden = false;
  painel.innerHTML = `<p class="hint-text" style="margin:0;">Procurando vídeo salvo pra "${escaparHtml(item.nome)}"...</p>`;

  let salvo = null;
  try {
    salvo = await api.buscarVideoExercicio(item.nome);
  } catch {
    salvo = null;
  }

  painel.innerHTML = `
    ${
      salvo
        ? `<div>
            <p class="hint-text" style="margin:0 0 var(--espaco-2);">Já existe um vídeo salvo pra "${escaparHtml(item.nome)}" (de outro treino). Quer reusar em vez de subir de novo?</p>
            <button class="btn btn-secondary btn-sm" type="button" data-acao="reusar-video" data-indice="${indice}" data-video-id="${salvo.id}">Usar esse vídeo</button>
          </div>`
        : ""
    }
    <div class="video-exercicio-abas">
      <button class="video-exercicio-aba ativa" type="button" data-aba="youtube" data-indice="${indice}">Link do YouTube</button>
      <button class="video-exercicio-aba" type="button" data-aba="upload" data-indice="${indice}">Enviar arquivo MP4</button>
    </div>
    <div data-conteudo-aba="youtube" data-indice="${indice}">
      <div class="form-row">
        <div class="form-group" style="flex:1;margin-bottom:0;">
          <input class="input" type="url" placeholder="https://youtube.com/watch?v=... (pode ser não listado)" data-campo-youtube="${indice}" />
        </div>
        <div class="form-group" style="flex:0;margin-bottom:0;">
          <button class="btn btn-primary btn-sm" type="button" data-acao="salvar-video-youtube" data-indice="${indice}">Salvar</button>
        </div>
      </div>
    </div>
    <div data-conteudo-aba="upload" data-indice="${indice}" hidden>
      <div class="form-group">
        <input class="input" type="file" accept="video/mp4,video/quicktime,video/webm" data-campo-upload="${indice}" />
        <span class="hint-text">Até 30MB.</span>
      </div>
      <div class="form-group">
        <label class="label" style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-weight:400;">
          <input type="checkbox" data-campo-direitos-video="${indice}" style="margin-top:3px;" />
          <span class="hint-text">Confirmo que tenho os direitos de uso desse vídeo (gravei eu mesmo ou tenho autorização) — a responsabilidade pelo conteúdo enviado é minha.</span>
        </label>
      </div>
      <button class="btn btn-primary btn-sm" type="button" data-acao="salvar-video-upload" data-indice="${indice}">Enviar e salvar</button>
    </div>
    <button class="btn btn-ghost btn-sm" type="button" data-acao="fechar-video" data-indice="${indice}">Cancelar</button>
  `;
}

listaVideosEl?.addEventListener("click", async (evento) => {
  const abrir = evento.target.closest("[data-acao='abrir-video']");
  if (abrir) return abrirPainelVideo(Number(abrir.dataset.indice));

  const fechar = evento.target.closest("[data-acao='fechar-video']");
  if (fechar) {
    listaVideosEl.querySelector(`[data-painel-video="${fechar.dataset.indice}"]`).hidden = true;
    return;
  }

  const remover = evento.target.closest("[data-acao='remover-video']");
  if (remover) {
    delete videosPorItem[Number(remover.dataset.indice)];
    renderizarListaVideos();
    return;
  }

  const aba = evento.target.closest("[data-aba]");
  if (aba) {
    const painel = aba.closest(".video-exercicio-painel");
    $all("[data-aba]", painel).forEach((b) => b.classList.toggle("ativa", b === aba));
    $all("[data-conteudo-aba]", painel).forEach((c) => (c.hidden = c.dataset.conteudoAba !== aba.dataset.aba));
    return;
  }

  const reusar = evento.target.closest("[data-acao='reusar-video']");
  if (reusar) {
    const indice = Number(reusar.dataset.indice);
    videosPorItem[indice] = { video_exercicio_id: Number(reusar.dataset.videoId) };
    renderizarListaVideos();
    mostrarToast("Vídeo reusado.", "sucesso");
    return;
  }

  const salvarYoutube = evento.target.closest("[data-acao='salvar-video-youtube']");
  if (salvarYoutube) {
    const indice = Number(salvarYoutube.dataset.indice);
    const input = listaVideosEl.querySelector(`[data-campo-youtube="${indice}"]`);
    const url = input.value.trim();
    if (!url) {
      mostrarToast("Cole o link do vídeo.", "erro");
      return;
    }
    salvarYoutube.disabled = true;
    try {
      const video = await api.salvarVideoExercicioYoutube(itensSelecionados[indice].nome, url);
      videosPorItem[indice] = { video_exercicio_id: video.id };
      renderizarListaVideos();
      mostrarToast("Vídeo salvo!", "sucesso");
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    } finally {
      salvarYoutube.disabled = false;
    }
    return;
  }

  const salvarUpload = evento.target.closest("[data-acao='salvar-video-upload']");
  if (salvarUpload) {
    const indice = Number(salvarUpload.dataset.indice);
    const input = listaVideosEl.querySelector(`[data-campo-upload="${indice}"]`);
    const arquivo = input.files[0];
    if (!arquivo) {
      mostrarToast("Escolha um arquivo de vídeo.", "erro");
      return;
    }
    if (arquivo.size > 30 * 1024 * 1024) {
      mostrarToast("Vídeo muito grande — o limite é 30MB.", "erro");
      return;
    }
    const confirmaDireitos = listaVideosEl.querySelector(`[data-campo-direitos-video="${indice}"]`);
    if (!confirmaDireitos?.checked) {
      mostrarToast("Confirme que você tem os direitos de uso desse vídeo antes de enviar.", "erro");
      return;
    }
    salvarUpload.disabled = true;
    const textoOriginal = salvarUpload.textContent;
    salvarUpload.textContent = "Enviando...";
    try {
      const video = await api.salvarVideoExercicioUpload(itensSelecionados[indice].nome, arquivo);
      videosPorItem[indice] = { video_exercicio_id: video.id };
      renderizarListaVideos();
      mostrarToast("Vídeo salvo!", "sucesso");
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    } finally {
      salvarUpload.disabled = false;
      salvarUpload.textContent = textoOriginal;
    }
  }
});

// --- Configuração individual por exercício (em vez de por grupo/categoria) ---

function renderizarPassoConfigIndividual() {
  const selecionados = itensSelecionados.map((item, indice) => ({ ...item, indice })).filter((item) => item.incluido);
  configPorExercicio = {};

  configIndividualEl.innerHTML = selecionados
    .map(({ nome, categoriaChave, indice }) => {
      const categoria = categoriaChave ? obterCategoria(categoriaChave) : null;
      const tipoConfig = categoria?.tipoConfig || "series";

      if (tipoConfig === "tempo") {
        return `
          <div class="config-grupo">
            <p class="config-grupo-titulo">${escaparHtml(nome)}</p>
            <div class="form-group">
              <span class="label">Tempo</span>
              <div class="grade-chips" data-chips="tempo" data-exercicio-config="${indice}"></div>
              <input class="input" data-campo="tempo-personalizado" data-exercicio-config="${indice}" placeholder="Ex: 25 min" maxlength="60" hidden style="margin-top:var(--espaco-2);" />
            </div>
          </div>
        `;
      }

      return `
        <div class="config-grupo">
          <p class="config-grupo-titulo">${escaparHtml(nome)}</p>
          <div class="form-group">
            <span class="label">Quantas séries</span>
            <div class="grade-chips" data-chips="series" data-exercicio-config="${indice}"></div>
          </div>
          <div class="form-group">
            <span class="label">Repetições por série</span>
            <div class="grade-chips" data-chips="repeticoes" data-exercicio-config="${indice}"></div>
            <input class="input" data-campo="repeticoes-personalizado" data-exercicio-config="${indice}" placeholder="Ex: 10-12" maxlength="60" hidden style="margin-top:var(--espaco-2);" />
          </div>
          <div class="form-group">
            <span class="label">Descanso entre séries</span>
            <div class="grade-chips" data-chips="descanso" data-exercicio-config="${indice}"></div>
            <input class="input" data-campo="descanso-personalizado" data-exercicio-config="${indice}" placeholder="Ex: 60s" maxlength="20" hidden style="margin-top:var(--espaco-2);" />
          </div>
          <div class="form-group">
            <label class="label" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" data-campo="carga-progressiva" data-exercicio-config="${indice}" />
              Carga progressiva (uma carga diferente por série)
            </label>
          </div>
          <div class="form-group" data-carga-unica="${indice}">
            <label class="label">Carga (opcional)</label>
            <input class="input" data-campo="carga" data-exercicio-config="${indice}" placeholder="Deixe em branco se variar por aluno" maxlength="60" />
          </div>
          <div data-carga-progressiva="${indice}" hidden></div>
        </div>
      `;
    })
    .join("");

  selecionados.forEach(({ categoriaChave, indice }) => {
    const categoria = categoriaChave ? obterCategoria(categoriaChave) : null;
    const tipoConfig = categoria?.tipoConfig || "series";
    const padrao = categoria?.padrao || { repeticoes_alvo: "10-12", intervalo_descanso: "60s" };

    if (tipoConfig === "tempo") {
      configPorExercicio[indice] = { tipo: "tempo", tempo: padrao.repeticoes_alvo };
      renderizarChipsConfig(
        configIndividualEl.querySelector(`[data-chips="tempo"][data-exercicio-config="${indice}"]`),
        OPCOES_TEMPO,
        configPorExercicio[indice].tempo,
        `ex${indice}__tempo`
      );
      return;
    }

    configPorExercicio[indice] = {
      tipo: "series",
      series: 3,
      repeticoes: padrao.repeticoes_alvo,
      descanso: padrao.intervalo_descanso || "60s",
      cargaModo: "unica",
      cargasPorSerie: [],
    };

    renderizarChipsConfig(
      configIndividualEl.querySelector(`[data-chips="series"][data-exercicio-config="${indice}"]`),
      OPCOES_SERIES,
      configPorExercicio[indice].series,
      `ex${indice}__series`,
      false
    );
    renderizarChipsConfig(
      configIndividualEl.querySelector(`[data-chips="repeticoes"][data-exercicio-config="${indice}"]`),
      OPCOES_REPETICOES,
      configPorExercicio[indice].repeticoes,
      `ex${indice}__repeticoes`
    );
    renderizarChipsConfig(
      configIndividualEl.querySelector(`[data-chips="descanso"][data-exercicio-config="${indice}"]`),
      OPCOES_DESCANSO,
      configPorExercicio[indice].descanso,
      `ex${indice}__descanso`
    );
  });
}

function regenerarCargasProgressivas(indice) {
  const numeroSeries = Number(configPorExercicio[indice].series) || 3;
  const bloco = configIndividualEl.querySelector(`[data-carga-progressiva="${indice}"]`);
  if (!bloco) return;
  bloco.innerHTML = Array.from(
    { length: numeroSeries },
    (_, i) => `
      <div class="form-group" style="margin-bottom:var(--espaco-2);">
        <label class="label">Carga na série ${i + 1}</label>
        <input class="input" data-campo="carga-serie" data-exercicio-config="${indice}" data-serie-numero="${i}" placeholder="Ex: 10kg" maxlength="60" value="${escaparHtml(configPorExercicio[indice].cargasPorSerie[i] || "")}" />
      </div>
    `
  ).join("");
  configPorExercicio[indice].cargasPorSerie = Array.from(
    { length: numeroSeries },
    (_, i) => configPorExercicio[indice].cargasPorSerie[i] || ""
  );
}

configIndividualEl?.addEventListener("click", (evento) => {
  const chip = evento.target.closest(".chip-opcao");
  if (!chip) return;
  const [chaveExercicio, campo] = chip.dataset.grupo.split("__");
  const indice = Number(chaveExercicio.replace("ex", ""));
  const valor = chip.dataset.valor;
  const bruto = valor === "outro" ? "outro" : isNaN(Number(valor)) ? valor : Number(valor);
  configPorExercicio[indice][campo] = bruto;

  $all(`.chip-opcao[data-grupo="${chip.dataset.grupo}"]`, configIndividualEl).forEach((c) => c.classList.toggle("selecionado", c === chip));

  if (campo === "repeticoes" || campo === "descanso" || campo === "tempo") {
    const personalizadoEl = configIndividualEl.querySelector(`[data-campo="${campo}-personalizado"][data-exercicio-config="${indice}"]`);
    if (personalizadoEl) {
      personalizadoEl.hidden = valor !== "outro";
      if (valor === "outro") personalizadoEl.focus();
    }
  }

  if (campo === "series" && configPorExercicio[indice].cargaModo === "progressiva") {
    regenerarCargasProgressivas(indice);
  }
});

configIndividualEl?.addEventListener("change", (evento) => {
  const toggleProgressiva = evento.target.closest("[data-campo='carga-progressiva']");
  if (toggleProgressiva) {
    const indice = Number(toggleProgressiva.dataset.exercicioConfig);
    const ligado = toggleProgressiva.checked;
    configPorExercicio[indice].cargaModo = ligado ? "progressiva" : "unica";
    configIndividualEl.querySelector(`[data-carga-unica="${indice}"]`).hidden = ligado;
    configIndividualEl.querySelector(`[data-carga-progressiva="${indice}"]`).hidden = !ligado;
    if (ligado) regenerarCargasProgressivas(indice);
    return;
  }

  const cargaSerieInput = evento.target.closest("[data-campo='carga-serie']");
  if (cargaSerieInput) {
    const indice = Number(cargaSerieInput.dataset.exercicioConfig);
    const numeroSerie = Number(cargaSerieInput.dataset.serieNumero);
    configPorExercicio[indice].cargasPorSerie[numeroSerie] = cargaSerieInput.value.trim();
  }
});

/** Lê a config de um exercício (modo individual) no momento de salvar. */
function resolverConfigExercicio(indice) {
  const cfg = configPorExercicio[indice];

  if (cfg.tipo === "tempo") {
    const tempo =
      cfg.tempo === "outro"
        ? (configIndividualEl.querySelector(`[data-campo="tempo-personalizado"][data-exercicio-config="${indice}"]`)?.value.trim() || "")
        : String(cfg.tempo);
    return { repeticoes: tempo, descanso: null, cargas: [null] };
  }

  const repeticoes =
    cfg.repeticoes === "outro"
      ? (configIndividualEl.querySelector(`[data-campo="repeticoes-personalizado"][data-exercicio-config="${indice}"]`)?.value.trim() || "")
      : String(cfg.repeticoes);
  const descanso =
    cfg.descanso === "outro"
      ? (configIndividualEl.querySelector(`[data-campo="descanso-personalizado"][data-exercicio-config="${indice}"]`)?.value.trim() || "")
      : String(cfg.descanso);
  const numeroSeries = Number(cfg.series) || 3;

  let cargas;
  if (cfg.cargaModo === "progressiva") {
    cargas = Array.from({ length: numeroSeries }, (_, i) => cfg.cargasPorSerie[i] || null);
  } else {
    const cargaUnica = configIndividualEl.querySelector(`[data-campo="carga"][data-exercicio-config="${indice}"]`)?.value.trim() || null;
    cargas = Array.from({ length: numeroSeries }, () => cargaUnica);
  }

  return { repeticoes, descanso, cargas };
}

function aplicarModoConfig() {
  configGruposEl.hidden = modoConfigIndividual;
  configIndividualEl.hidden = !modoConfigIndividual;
  configModoExplicacaoEl.textContent = modoConfigIndividual
    ? "Cada exercício tem sua própria configuração — dá pra fazer 3 séries num e 4 no outro, por exemplo."
    : "Cada categoria tem sua própria configuração — dá pra deixar peito diferente de perna, por exemplo.";
  if (modoConfigIndividual) {
    renderizarPassoConfigIndividual();
  } else {
    renderizarPassoConfig();
  }
}

configModoToggleEl?.addEventListener("change", () => {
  modoConfigIndividual = configModoToggleEl.checked;
  aplicarModoConfig();
});

function abrirMontarTreino(dia) {
  montarTreinoDia = dia;
  const jaTemTreino = treinosCache.some((t) => t.dia_semana === dia);
  montarTreinoTitulo.textContent = jaTemTreino
    ? `Refazer treino de ${ROTULO_DIA[dia]}`
    : `Montar treino de ${ROTULO_DIA[dia]}`;
  categoriasSelecionadas = [];
  itensSelecionados = [];
  videosPorItem = {};
  configPorExercicio = {};
  modoConfigIndividual = false;
  if (configModoToggleEl) configModoToggleEl.checked = false;
  renderizarGradeCategorias();
  mostrarPassoMontagem(1);
  abrirModal(modalMontarTreino);
}

// --- Templates de treino (modelos reutilizáveis entre alunos) ---

function abrirSalvarTemplate(dia) {
  templateDiaAlvo = dia;
  formSalvarTemplate.reset();
  const treino = treinosCache.find((t) => t.dia_semana === dia);
  if (treino) formSalvarTemplate.nome.value = treino.nome;
  abrirModal(modalSalvarTemplate);
}

document
  .querySelectorAll("[data-acao='fechar-modal-salvar-template']")
  .forEach((el) => el.addEventListener("click", () => fecharModal(modalSalvarTemplate)));

formSalvarTemplate?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const treino = treinosCache.find((t) => t.dia_semana === templateDiaAlvo);
  if (!treino) return;
  const botao = $("button[type='submit']", formSalvarTemplate);
  botao.disabled = true;
  try {
    const exercicios = treino.exercicios.map((ex) => ({
      nome: ex.nome,
      categoria: ex.categoria || null,
      observacoes: ex.observacoes || null,
      series: ex.series.map((s) => ({
        repeticoes_alvo: s.repeticoes_alvo,
        carga_alvo: s.carga_alvo || null,
        intervalo_descanso: s.intervalo_descanso || null,
      })),
    }));
    await api.criarTemplate({ nome: formSalvarTemplate.nome.value.trim(), exercicios });
    mostrarToast("Modelo salvo!", "sucesso");
    fecharModal(modalSalvarTemplate);
    templatesCache = null; // força recarregar na próxima vez que "Usar modelo" abrir
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botao.disabled = false;
  }
});

async function carregarTemplatesSeNecessario() {
  if (templatesCache) return templatesCache;
  templatesCache = await api.listarTemplates();
  return templatesCache;
}

function itemTemplateUsar(template) {
  const qtd = template.dados_json?.exercicios?.length || 0;
  return `
    <div class="series-linha" data-template-id="${template.id}">
      <span><strong>${escaparHtml(template.nome)}</strong> <span class="hint-text">${qtd} exercício${qtd !== 1 ? "s" : ""}</span></span>
      <div style="display:flex;gap:var(--espaco-2);">
        <button class="btn btn-primary btn-sm" data-acao="aplicar-template" data-id="${template.id}" type="button">Aplicar</button>
        <button class="btn btn-ghost btn-sm" data-acao="excluir-template" data-id="${template.id}" type="button">${ICONE_LIXEIRA}</button>
      </div>
    </div>
  `;
}

async function abrirUsarTemplate(dia) {
  templateDiaAlvo = dia;
  listaTemplatesUsarEl.innerHTML = `<p class="hint-text">Carregando…</p>`;
  abrirModal(modalUsarTemplate);
  try {
    const templates = await carregarTemplatesSeNecessario();
    if (templates.length === 0) {
      listaTemplatesUsarEl.innerHTML = `<p class="hint-text">Nenhum modelo salvo ainda. Monte um treino e clique no ícone de salvar na grade da semana pra criar o primeiro.</p>`;
      return;
    }
    listaTemplatesUsarEl.innerHTML = templates.map(itemTemplateUsar).join("");
  } catch {
    listaTemplatesUsarEl.innerHTML = `<p class="hint-text">Não foi possível carregar os modelos agora.</p>`;
  }
}

document
  .querySelectorAll("[data-acao='fechar-modal-usar-template']")
  .forEach((el) => el.addEventListener("click", () => fecharModal(modalUsarTemplate)));

listaTemplatesUsarEl?.addEventListener("click", async (evento) => {
  const aplicarBtn = evento.target.closest("[data-acao='aplicar-template']");
  if (aplicarBtn) {
    const id = Number(aplicarBtn.dataset.id);
    aplicarBtn.disabled = true;
    aplicarBtn.textContent = "Aplicando…";
    try {
      await api.aplicarTemplate(alunoId, id, { dia_semana: templateDiaAlvo });
      mostrarToast(`Modelo aplicado em ${ROTULO_DIA[templateDiaAlvo]}!`, "sucesso");
      fecharModal(modalUsarTemplate);
      recarregarTreinos();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
      aplicarBtn.disabled = false;
      aplicarBtn.textContent = "Aplicar";
    }
    return;
  }

  const excluirBtn = evento.target.closest("[data-acao='excluir-template']");
  if (excluirBtn) {
    const confirmou = await confirmarAcao("Excluir esse modelo? Não afeta os treinos já aplicados a partir dele.", {
      titulo: "Excluir modelo",
      textoConfirmar: "Excluir",
    });
    if (!confirmou) return;
    try {
      await api.excluirTemplate(Number(excluirBtn.dataset.id));
      mostrarToast("Modelo excluído.", "sucesso");
      templatesCache = null;
      abrirUsarTemplate(templateDiaAlvo);
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
  }
});

function montarPayloadExerciciosPorGrupo(selecionados) {
  const grupos = gruposAtivos();
  const configResolvida = new Map();
  for (const { chave, rotulo } of grupos) {
    const resolvido = resolverConfigGrupo(chave);
    if (!resolvido.repeticoes) {
      const campo = configPorGrupo[chave]?.tipo === "tempo" ? "o tempo" : "as repetições";
      mostrarToast(`Informe ${campo} de "${rotulo}".`, "erro");
      return null;
    }
    configResolvida.set(chave, resolvido);
  }

  return selecionados.map((item) => {
    const indiceOriginal = itensSelecionados.indexOf(item);
    const { repeticoes, descanso, numeroSeries, observacoes } = configResolvida.get(item.categoriaChave || "manual");
    // Uma linha de série por série de verdade (ex: "4 séries" = 4 linhas o aluno marca uma a uma).
    const serieRepetida = { repeticoes_alvo: repeticoes, carga_alvo: null, intervalo_descanso: descanso || null };
    return {
      nome: item.nome,
      video_exercicio_id: videosPorItem[indiceOriginal]?.video_exercicio_id || null,
      observacoes,
      categoria: item.categoriaChave || null,
      series: Array.from({ length: numeroSeries }, () => serieRepetida),
    };
  });
}

function montarPayloadExerciciosIndividual() {
  const comIndice = itensSelecionados.map((item, indice) => ({ ...item, indice })).filter((item) => item.incluido);
  const payload = [];
  for (const { nome, categoriaChave, indice } of comIndice) {
    const resolvido = resolverConfigExercicio(indice);
    if (!resolvido.repeticoes) {
      const campo = configPorExercicio[indice]?.tipo === "tempo" ? "o tempo" : "as repetições";
      mostrarToast(`Informe ${campo} de "${nome}".`, "erro");
      return null;
    }
    payload.push({
      nome,
      video_exercicio_id: videosPorItem[indice]?.video_exercicio_id || null,
      categoria: categoriaChave || null,
      series: resolvido.cargas.map((carga) => ({
        repeticoes_alvo: resolvido.repeticoes,
        carga_alvo: carga,
        intervalo_descanso: resolvido.descanso || null,
      })),
    });
  }
  return payload;
}

async function confirmarMontagemTreino() {
  const nome = montarTreinoNomeInput.value.trim();
  const selecionados = itensSelecionados.filter((item) => item.incluido);
  if (!nome || selecionados.length === 0) {
    mostrarToast("Dê um nome ao treino e marque pelo menos um exercício.", "erro");
    return;
  }

  const exercicios = modoConfigIndividual
    ? montarPayloadExerciciosIndividual()
    : montarPayloadExerciciosPorGrupo(selecionados);
  if (!exercicios) return; // mensagem de erro já mostrada por montarPayloadExercicios*

  const diaIndex = DIAS_SEMANA.findIndex((d) => d.chave === montarTreinoDia);
  const botao = $("[data-acao='confirmar-montar-treino']", modalMontarTreino);
  const textoOriginalBotao = botao.textContent;
  botao.disabled = true;
  botao.textContent = "Salvando...";

  try {
    await api.montarTreino(alunoId, { nome, ordem: diaIndex, dia_semana: montarTreinoDia, exercicios });

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
  videosPorItem = {}; // a lista de exercícios mudou — índices antigos não valem mais
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
  modoConfigIndividual = false;
  if (configModoToggleEl) configModoToggleEl.checked = false;
  renderizarListaVideos();
  aplicarModoConfig();
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

// --- Vídeo de um exercício já existente (fora do wizard) — mesma lógica de
// upload/YouTube/reuso, só que salva na hora via atualizarExercicio, em vez
// de guardar em memória até confirmar o treino inteiro. ---

async function abrirPainelVideoExercicio(exercicioId) {
  const painel = gradeSemanaEl.querySelector(`[data-painel-video-exercicio="${exercicioId}"]`);
  if (!painel) return;
  const exercicio = encontrarNoCache("exercicio", exercicioId);
  if (!exercicio) return;

  painel.hidden = false;
  painel.innerHTML = `<p class="hint-text" style="margin:0;">Procurando vídeo salvo pra "${escaparHtml(exercicio.nome)}"...</p>`;

  let salvo = null;
  try {
    salvo = await api.buscarVideoExercicio(exercicio.nome);
  } catch {
    salvo = null;
  }

  painel.innerHTML = `
    ${
      salvo && salvo.id !== exercicio.video?.id
        ? `<div>
            <p class="hint-text" style="margin:0 0 var(--espaco-2);">Já existe um vídeo salvo pra "${escaparHtml(exercicio.nome)}" (de outro treino). Quer reusar?</p>
            <button class="btn btn-secondary btn-sm" type="button" data-acao="reusar-video-exercicio" data-id="${exercicioId}" data-video-id="${salvo.id}">Usar esse vídeo</button>
          </div>`
        : ""
    }
    <div class="video-exercicio-abas">
      <button class="video-exercicio-aba ativa" type="button" data-aba-exercicio="youtube" data-id="${exercicioId}">Link do YouTube</button>
      <button class="video-exercicio-aba" type="button" data-aba-exercicio="upload" data-id="${exercicioId}">Enviar arquivo MP4</button>
    </div>
    <div data-conteudo-aba-exercicio="youtube" data-id="${exercicioId}">
      <div class="form-row">
        <div class="form-group" style="flex:1;margin-bottom:0;">
          <input class="input" type="url" placeholder="https://youtube.com/watch?v=... (pode ser não listado)" data-campo-youtube-exercicio="${exercicioId}" />
        </div>
        <div class="form-group" style="flex:0;margin-bottom:0;">
          <button class="btn btn-primary btn-sm" type="button" data-acao="salvar-video-youtube-exercicio" data-id="${exercicioId}">Salvar</button>
        </div>
      </div>
    </div>
    <div data-conteudo-aba-exercicio="upload" data-id="${exercicioId}" hidden>
      <div class="form-group">
        <input class="input" type="file" accept="video/mp4,video/quicktime,video/webm" data-campo-upload-exercicio="${exercicioId}" />
        <span class="hint-text">Até 30MB.</span>
      </div>
      <div class="form-group">
        <label class="label" style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-weight:400;">
          <input type="checkbox" data-campo-direitos-exercicio="${exercicioId}" style="margin-top:3px;" />
          <span class="hint-text">Confirmo que tenho os direitos de uso desse vídeo (gravei eu mesmo ou tenho autorização) — a responsabilidade pelo conteúdo enviado é minha.</span>
        </label>
      </div>
      <button class="btn btn-primary btn-sm" type="button" data-acao="salvar-video-upload-exercicio" data-id="${exercicioId}">Enviar e salvar</button>
    </div>
    <button class="btn btn-ghost btn-sm" type="button" data-acao="fechar-video-exercicio" data-id="${exercicioId}">Cancelar</button>
  `;
}

gradeSemanaEl?.addEventListener("click", async (evento) => {
  // Ações dentro do exercício expandido — checadas antes das mais genéricas
  // (editar-dia, toggle-exercicio) porque um clique nesses botões também
  // "bate" no cabeçalho do exercício por baixo, e closest() pega o mais
  // específico primeiro de qualquer forma, mas deixamos explícito aqui.
  const editarExercicio = evento.target.closest("[data-acao='editar-exercicio']");
  if (editarExercicio) return abrirEdicaoItem("exercicio", Number(editarExercicio.dataset.id));

  const editarSerie = evento.target.closest("[data-acao='editar-serie']");
  if (editarSerie) return abrirEdicaoItem("serie", Number(editarSerie.dataset.id));

  const excluirExercicio = evento.target.closest("[data-acao='excluir-exercicio']");
  if (excluirExercicio) {
    const confirmou = await confirmarAcao("Excluir este exercício e suas séries?", { titulo: "Confirmar exclusão", textoConfirmar: "Excluir" });
    if (!confirmou) return;
    try {
      await api.excluirExercicio(Number(excluirExercicio.dataset.id));
      mostrarToast("Exercício removido.", "sucesso");
      recarregarTreinos();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
    return;
  }

  const excluirSerie = evento.target.closest("[data-acao='excluir-serie']");
  if (excluirSerie) {
    const confirmou = await confirmarAcao("Remover esta série?", { titulo: "Confirmar exclusão", textoConfirmar: "Excluir" });
    if (!confirmou) return;
    try {
      await api.excluirSerie(Number(excluirSerie.dataset.id));
      mostrarToast("Série removida.", "sucesso");
      recarregarTreinos();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
    return;
  }

  // --- vídeo do exercício ---
  const abrirVideo = evento.target.closest("[data-acao='abrir-video-exercicio']");
  if (abrirVideo) return abrirPainelVideoExercicio(Number(abrirVideo.dataset.id));

  const fecharVideo = evento.target.closest("[data-acao='fechar-video-exercicio']");
  if (fecharVideo) {
    gradeSemanaEl.querySelector(`[data-painel-video-exercicio="${fecharVideo.dataset.id}"]`).hidden = true;
    return;
  }

  const removerVideo = evento.target.closest("[data-acao='remover-video-exercicio']");
  if (removerVideo) {
    try {
      await api.atualizarExercicio(Number(removerVideo.dataset.id), { video_exercicio_id: null });
      mostrarToast("Vídeo removido do exercício.", "sucesso");
      recarregarTreinos();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
    return;
  }

  const abaExercicio = evento.target.closest("[data-aba-exercicio]");
  if (abaExercicio) {
    const painel = abaExercicio.closest(".video-exercicio-painel");
    $all("[data-aba-exercicio]", painel).forEach((b) => b.classList.toggle("ativa", b === abaExercicio));
    $all("[data-conteudo-aba-exercicio]", painel).forEach(
      (c) => (c.hidden = c.dataset.conteudoAbaExercicio !== abaExercicio.dataset.abaExercicio)
    );
    return;
  }

  const reusarVideo = evento.target.closest("[data-acao='reusar-video-exercicio']");
  if (reusarVideo) {
    const id = Number(reusarVideo.dataset.id);
    try {
      await api.atualizarExercicio(id, { video_exercicio_id: Number(reusarVideo.dataset.videoId) });
      mostrarToast("Vídeo anexado!", "sucesso");
      recarregarTreinos();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
    return;
  }

  const salvarYoutube = evento.target.closest("[data-acao='salvar-video-youtube-exercicio']");
  if (salvarYoutube) {
    const id = Number(salvarYoutube.dataset.id);
    const input = gradeSemanaEl.querySelector(`[data-campo-youtube-exercicio="${id}"]`);
    const url = input.value.trim();
    if (!url) {
      mostrarToast("Cole o link do vídeo.", "erro");
      return;
    }
    const exercicio = encontrarNoCache("exercicio", id);
    salvarYoutube.disabled = true;
    try {
      const video = await api.salvarVideoExercicioYoutube(exercicio.nome, url);
      await api.atualizarExercicio(id, { video_exercicio_id: video.id });
      mostrarToast("Vídeo salvo!", "sucesso");
      recarregarTreinos();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    } finally {
      salvarYoutube.disabled = false;
    }
    return;
  }

  const salvarUpload = evento.target.closest("[data-acao='salvar-video-upload-exercicio']");
  if (salvarUpload) {
    const id = Number(salvarUpload.dataset.id);
    const inputArquivo = gradeSemanaEl.querySelector(`[data-campo-upload-exercicio="${id}"]`);
    const arquivo = inputArquivo.files[0];
    if (!arquivo) {
      mostrarToast("Escolha um arquivo de vídeo.", "erro");
      return;
    }
    if (arquivo.size > 30 * 1024 * 1024) {
      mostrarToast("Vídeo muito grande — o limite é 30MB.", "erro");
      return;
    }
    const confirmaDireitos = gradeSemanaEl.querySelector(`[data-campo-direitos-exercicio="${id}"]`);
    if (!confirmaDireitos?.checked) {
      mostrarToast("Confirme que você tem os direitos de uso desse vídeo antes de enviar.", "erro");
      return;
    }
    const exercicio = encontrarNoCache("exercicio", id);
    salvarUpload.disabled = true;
    const textoOriginal = salvarUpload.textContent;
    salvarUpload.textContent = "Enviando...";
    try {
      const video = await api.salvarVideoExercicioUpload(exercicio.nome, arquivo);
      await api.atualizarExercicio(id, { video_exercicio_id: video.id });
      mostrarToast("Vídeo salvo!", "sucesso");
      recarregarTreinos();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    } finally {
      salvarUpload.disabled = false;
      salvarUpload.textContent = textoOriginal;
    }
    return;
  }

  // --- accordions (dia / exercício) ---
  const toggleExercicio = evento.target.closest("[data-acao='toggle-exercicio']");
  if (toggleExercicio) {
    const id = Number(toggleExercicio.dataset.id);
    exercicioExpandidoId = exercicioExpandidoId === id ? null : id;
    renderizarGradeSemana();
    return;
  }

  const editarDia = evento.target.closest("[data-acao='editar-dia']");
  if (editarDia) {
    const dia = editarDia.dataset.dia;
    diaExpandidoChave = diaExpandidoChave === dia ? null : dia;
    exercicioExpandidoId = null; // troca de dia sempre começa com os exercícios recolhidos
    renderizarGradeSemana();
    return;
  }

  const montarTreinoBtn = evento.target.closest("[data-acao='montar-treino']");
  if (montarTreinoBtn) {
    abrirMontarTreino(montarTreinoBtn.dataset.dia);
    return;
  }

  const salvarTemplateBtn = evento.target.closest("[data-acao='salvar-template']");
  if (salvarTemplateBtn) {
    abrirSalvarTemplate(salvarTemplateBtn.dataset.dia);
    return;
  }

  const usarTemplateBtn = evento.target.closest("[data-acao='usar-template']");
  if (usarTemplateBtn) {
    abrirUsarTemplate(usarTemplateBtn.dataset.dia);
    return;
  }

  const excluirDia = evento.target.closest("[data-acao='excluir-dia']");
  if (excluirDia) {
    const dia = excluirDia.dataset.dia;
    const confirmou = await confirmarAcao(`Remover o treino de ${ROTULO_DIA[dia]} e todos os seus exercícios/séries?`, {
      titulo: "Remover treino",
      textoConfirmar: "Remover",
    });
    if (!confirmou) return;
    try {
      await api.excluirTreino(Number(excluirDia.dataset.id));
      mostrarToast("Treino removido.", "sucesso");
      if (diaExpandidoChave === dia) diaExpandidoChave = null;
      recarregarTreinos();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
  }
});

gradeSemanaEl?.addEventListener("submit", async (evento) => {
  if (evento.target.dataset.acao !== "form-nova-serie") return;
  evento.preventDefault();
  const alvo = evento.target;
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
});

// Nome do treino editável direto na linha — salva ao sair do campo ou apertar Enter.
// "blur" não borbulha por padrão, por isso o listener vai na fase de captura.
gradeSemanaEl?.addEventListener(
  "blur",
  async (evento) => {
    const input = evento.target.closest?.(".treino-nome-input");
    if (!input) return;
    const treinoId = Number(input.dataset.treinoNomeId);
    const treino = encontrarNoCache("treino", treinoId);
    const nome = input.value.trim();
    if (!treino) return;
    if (!nome || nome === treino.nome) {
      input.value = treino.nome; // não deixa salvar vazio nem faz chamada à toa
      return;
    }
    try {
      await api.atualizarTreino(treinoId, { nome });
      treino.nome = nome;
      mostrarToast("Nome do treino atualizado.", "sucesso");
      renderizarGradeSemana();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
      input.value = treino.nome;
    }
  },
  true
);

gradeSemanaEl?.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter" && evento.target.closest(".treino-nome-input")) {
    evento.preventDefault();
    evento.target.blur();
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
carregarFotos();
carregarAnamnese();
