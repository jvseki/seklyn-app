// Seklyn — gestão de treinos/exercícios/séries de um aluno específico.
import { api } from "./api.js";
import { protegerPagina } from "./auth.js";
import {
  $,
  escaparHtml,
  mensagemDeErro,
  mostrarToast,
  copiarParaAreaDeTransferencia,
  linkWhatsApp,
  abrirModal,
  fecharModal,
} from "./utils.js";
import { listaCompletaExercicios } from "./catalogo-exercicios.js";

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

let alunoAtual = null;
let treinosCache = []; // guarda os dados carregados pra preencher os modais de edição sem outra chamada à API

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
      <span>Série ${serie.ordem + 1}: ${escaparHtml(serie.repeticoes_alvo)} reps${serie.carga_alvo ? " · " + escaparHtml(serie.carga_alvo) : ""}</span>
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
    `,
    montarPayload: (form) => ({
      repeticoes_alvo: form.repeticoes_alvo.value.trim(),
      carga_alvo: form.carga_alvo.value.trim() || null,
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

cabecalhoLinkEl?.addEventListener("click", () => {
  if (cabecalhoLinkEl.dataset.link) copiarParaAreaDeTransferencia(cabecalhoLinkEl.dataset.link);
});

gradeSemanaEl?.addEventListener("click", async (evento) => {
  const botao = evento.target.closest("button[data-acao]");
  if (!botao) return;
  const dia = botao.dataset.dia;

  if (botao.dataset.acao === "salvar-dia") {
    const linha = botao.closest(".dia-linha");
    const input = linha.querySelector("[data-campo-nome-dia]");
    const nome = input.value.trim();
    const diaIndex = DIAS_SEMANA.findIndex((d) => d.chave === dia);
    const treinoExistente = treinosCache.find((t) => t.dia_semana === dia);

    if (!nome) {
      // Campo vazio: se já existia um treino nesse dia, apaga (virou dia de descanso).
      if (treinoExistente) {
        if (!confirm(`Remover o treino de ${ROTULO_DIA[dia]}?`)) return;
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
    if (!confirm(`Remover o treino de ${ROTULO_DIA[dia]} e todos os seus exercícios/séries?`)) return;
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

  if (acao === "editar-treino") return abrirEdicaoItem("treino", id);
  if (acao === "editar-exercicio") return abrirEdicaoItem("exercicio", id);
  if (acao === "editar-serie") return abrirEdicaoItem("serie", id);

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
