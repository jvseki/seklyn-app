// Seklyn — gestão de treinos/exercícios/séries de um aluno específico.
import { api } from "./api.js";
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

const cabecalhoNomeEl = $("#aluno-nome");
const cabecalhoLinkEl = $("#aluno-link");
const whatsappEl = $("#aluno-whatsapp");
const listaTreinosEl = $("#lista-treinos-editor");
const gradeSemanaEl = $("#grade-semana");
const analyticsEl = $("#analytics-resumo");
const modalEditarAluno = $("#modal-editar-aluno");
const formEditarAluno = $("#form-editar-aluno");
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
const chipsSeriesEl = $("#chips-series");
const chipsRepeticoesEl = $("#chips-repeticoes");
const chipsDescansoEl = $("#chips-descanso");
const repeticoesPersonalizadoEl = $("#config-repeticoes-personalizado");
const descansoPersonalizadoEl = $("#config-descanso-personalizado");
const configCargaEl = $("#config-carga");

let alunoAtual = null;
let treinosCache = []; // guarda os dados carregados pra preencher os modais de edição sem outra chamada à API
let montarTreinoDia = null; // dia da semana sendo montado no modal assistido
let categoriasSelecionadas = []; // chaves das categorias escolhidas no passo 1 (pode ser mais de uma)
let itensSelecionados = []; // [{ nome, incluido, categoria }] — exercícios sugeridos das categorias escolhidas
let configAtual = { series: 3, repeticoes: "10-12", descanso: "60s" };

const OPCOES_SERIES = [2, 3, 4, 5, 6];
const OPCOES_REPETICOES = ["6-8", "8-10", "10-12", "12-15", "15-20"];
const OPCOES_DESCANSO = ["30s", "45s", "60s", "90s", "2min"];

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
        <div class="form-group" style="flex:1;"><input class="input" name="repeticoes_alvo" placeholder="Repetições (ex: 10-12)" required /></div>
        <div class="form-group" style="flex:1;"><input class="input" name="carga_alvo" placeholder="Carga (opcional)" /></div>
        <div class="form-group" style="flex:1;"><input class="input" name="intervalo_descanso" placeholder="Descanso (ex: 60s)" /></div>
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
      <input
        class="input"
        type="text"
        placeholder="Dia de descanso (deixe em branco)"
        value="${temTreino ? escaparHtml(treinoDoDia.nome) : ""}"
        data-campo-nome-dia="${dia.chave}"
      />
      <div class="dia-acoes">
        <button class="btn btn-ghost btn-sm" data-acao="montar-treino" data-dia="${dia.chave}" type="button" title="Montar com sugestões de exercícios">🏋️ Montar</button>
        <button class="btn btn-secondary btn-sm" data-acao="salvar-dia" data-dia="${dia.chave}" type="button">Salvar</button>
        ${temTreino ? `<button class="btn btn-ghost btn-sm" data-acao="excluir-dia" data-dia="${dia.chave}" data-id="${treinoDoDia.id}" type="button">🗑️</button>` : ""}
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
          <input class="input" id="editar-item-repeticoes" name="repeticoes_alvo" value="${escaparHtml(item.repeticoes_alvo)}" required />
        </div>
        <div class="form-group">
          <label class="label" for="editar-item-carga">Carga (opcional)</label>
          <input class="input" id="editar-item-carga" name="carga_alvo" value="${escaparHtml(item.carga_alvo || "")}" />
        </div>
      </div>
      <div class="form-group">
        <label class="label" for="editar-item-intervalo">Descanso (opcional)</label>
        <input class="input" id="editar-item-intervalo" name="intervalo_descanso" placeholder="ex: 60s" value="${escaparHtml(item.intervalo_descanso || "")}" />
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

    const whatsapp = linkWhatsApp(alunoAtual.telefone);
    if (whatsapp) {
      whatsappEl.href = whatsapp;
      whatsappEl.hidden = false;
    }
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
        <span class="emoji">${cat.emoji}</span>
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
      itens.push({ nome: ex.nome, incluido: ex.recomendado, categoria: categoria.rotulo });
    }
  }
  return itens;
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
  const primeiraCategoria = obterCategoria(categoriasSelecionadas[0]);
  const padrao = primeiraCategoria?.padrao || { repeticoes_alvo: "10-12", intervalo_descanso: "60s" };
  configAtual = { series: 3, repeticoes: padrao.repeticoes_alvo, descanso: padrao.intervalo_descanso || "60s" };

  const rotulos = categoriasSelecionadas.map((c) => obterCategoria(c)?.rotulo).filter(Boolean);
  montarTreinoNomeInput.value = `Treino - ${rotulos.join(" e ")}`;

  renderizarChipsConfig(chipsSeriesEl, OPCOES_SERIES, configAtual.series, "series", false);
  renderizarChipsConfig(chipsRepeticoesEl, OPCOES_REPETICOES, configAtual.repeticoes, "repeticoes");
  renderizarChipsConfig(chipsDescansoEl, OPCOES_DESCANSO, configAtual.descanso, "descanso");
  repeticoesPersonalizadoEl.hidden = true;
  descansoPersonalizadoEl.hidden = true;
  configCargaEl.value = "";
}

function abrirMontarTreino(dia) {
  montarTreinoDia = dia;
  montarTreinoTitulo.textContent = `Montar treino de ${ROTULO_DIA[dia]}`;
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

  const repeticoes =
    configAtual.repeticoes === "outro" ? repeticoesPersonalizadoEl.value.trim() : String(configAtual.repeticoes);
  const descanso = configAtual.descanso === "outro" ? descansoPersonalizadoEl.value.trim() : String(configAtual.descanso);
  const numeroSeries = Number(configAtual.series) || 3;
  const carga = configCargaEl.value.trim() || null;

  if (!repeticoes) {
    mostrarToast("Informe as repetições.", "erro");
    return;
  }

  const diaIndex = DIAS_SEMANA.findIndex((d) => d.chave === montarTreinoDia);
  const botao = $("[data-acao='confirmar-montar-treino']", modalMontarTreino);
  const textoOriginalBotao = botao.textContent;
  botao.disabled = true;
  botao.textContent = "Salvando...";

  try {
    // Uma linha de série por série de verdade (ex: "4 séries" = 4 linhas o aluno marca uma a uma).
    const serieRepetida = { repeticoes_alvo: repeticoes, carga_alvo: carga, intervalo_descanso: descanso || null };
    await api.montarTreino(alunoId, {
      nome,
      ordem: diaIndex,
      dia_semana: montarTreinoDia,
      exercicios: selecionados.map((item) => ({
        nome: item.nome,
        series: Array.from({ length: numeroSeries }, () => serieRepetida),
      })),
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
  itensSelecionados.push({ nome, incluido: true, categoria: null });
  outroExercicioInput.value = "";
  renderizarChecklistExercicios();
});

passoConfigEl?.addEventListener("click", (evento) => {
  const chip = evento.target.closest(".chip-opcao");
  if (!chip) return;
  const grupo = chip.dataset.grupo;
  const valor = chip.dataset.valor;
  const bruto = valor === "outro" ? "outro" : isNaN(Number(valor)) ? valor : Number(valor);
  configAtual[grupo] = bruto;

  $all(`.chip-opcao[data-grupo="${grupo}"]`, passoConfigEl).forEach((c) => c.classList.toggle("selecionado", c === chip));

  if (grupo === "repeticoes") {
    repeticoesPersonalizadoEl.hidden = valor !== "outro";
    if (valor === "outro") repeticoesPersonalizadoEl.focus();
  }
  if (grupo === "descanso") {
    descansoPersonalizadoEl.hidden = valor !== "outro";
    if (valor === "outro") descansoPersonalizadoEl.focus();
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

  if (botao.dataset.acao === "salvar-dia") {
    const linha = botao.closest(".dia-linha");
    const input = linha.querySelector("[data-campo-nome-dia]");
    const nome = input.value.trim();
    const diaIndex = DIAS_SEMANA.findIndex((d) => d.chave === dia);
    const treinoExistente = treinosCache.find((t) => t.dia_semana === dia);

    if (!nome) {
      // Campo vazio: se já existia um treino nesse dia, apaga (virou dia de descanso).
      if (treinoExistente) {
        const confirmou = await confirmarAcao(`Remover o treino de ${ROTULO_DIA[dia]}?`, { titulo: "Remover treino", textoConfirmar: "Remover" });
        if (!confirmou) return;
        try {
          await api.excluirTreino(treinoExistente.id);
          mostrarToast("Treino removido.", "sucesso");
          recarregarTreinos();
        } catch (erro) {
          mostrarToast(mensagemDeErro(erro), "erro");
        }
      }
      return;
    }

    try {
      if (treinoExistente) {
        await api.atualizarTreino(treinoExistente.id, { nome });
      } else {
        await api.criarTreino(alunoId, { nome, ordem: diaIndex, dia_semana: dia });
      }
      mostrarToast(`Treino de ${ROTULO_DIA[dia]} salvo!`, "sucesso");
      recarregarTreinos();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
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

// --- Editar aluno (nome/e-mail/WhatsApp) ---
$("[data-acao='editar-aluno']")?.addEventListener("click", () => {
  if (!alunoAtual) return;
  formEditarAluno.nome.value = alunoAtual.nome;
  formEditarAluno.email.value = alunoAtual.email || "";
  formEditarAluno.telefone.value = alunoAtual.telefone || "";
  abrirModal(modalEditarAluno);
});

document.querySelectorAll("[data-acao='fechar-modal-aluno']").forEach((el) =>
  el.addEventListener("click", () => fecharModal(modalEditarAluno))
);

formEditarAluno?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const botao = $("button[type='submit']", formEditarAluno);
  botao.disabled = true;
  try {
    const dados = {
      nome: formEditarAluno.nome.value.trim(),
      email: formEditarAluno.email.value.trim() || null,
      telefone: formEditarAluno.telefone.value.trim() || null,
    };
    alunoAtual = await api.atualizarAluno(alunoId, dados);
    cabecalhoNomeEl.textContent = alunoAtual.nome;

    const whatsapp = linkWhatsApp(alunoAtual.telefone);
    whatsappEl.hidden = !whatsapp;
    if (whatsapp) whatsappEl.href = whatsapp;

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
