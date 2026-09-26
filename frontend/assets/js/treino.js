// Seklyn — área do Aluno: lista de treinos, execução (checklist) e
// a aba não-invasiva "Dicas do seu Personal". Tudo em uma única página,
// acessada via link único (?t=<hash_token>), sem login.
import { api, API_BASE_URL } from "./api.js";
import { $, $all, escaparHtml, mensagemDeErro, mostrarToast, abrirModal, fecharModal } from "./utils.js";
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
  secaoProgresso: $("#secao-progresso"),
  progressoCarregando: $("#progresso-carregando"),
  progressoConteudo: $("#progresso-conteudo"),
  progressoMetas: $("#progresso-metas"),
  progressoMedidas: $("#progresso-medidas"),
  progressoFotos: $("#progresso-fotos"),
  listaTreinos: $("#lista-treinos-aluno"),
  tabBar: $("#tab-bar"),
  tabTreinos: $("#tab-treinos"),
  tabProgresso: $("#tab-progresso"),
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
  modalRecado: $("#modal-recado"),
  formRecado: $("#form-recado"),
};

let painelCache = null;
let recomendacoesCarregadas = false;
let progressoCarregado = false;

// --- Navegação entre seções (lista / execução / progresso / dicas) ---
function mostrarSecao(nome) {
  els.secaoLista.hidden = nome !== "lista";
  els.secaoExecucao.hidden = nome !== "execucao";
  els.secaoDicas.hidden = nome !== "dicas";
  els.secaoProgresso.hidden = nome !== "progresso";
  els.tabBar.hidden = nome === "execucao";

  els.tabTreinos.classList.toggle("ativa", nome === "lista");
  els.tabProgresso.classList.toggle("ativa", nome === "progresso");
  els.tabDicas.classList.toggle("ativa", nome === "dicas");

  if (nome === "dicas" && !recomendacoesCarregadas) {
    carregarRecomendacoes();
  }
  if (nome === "progresso" && !progressoCarregado) {
    carregarProgresso();
  }
}

els.tabTreinos?.addEventListener("click", () => mostrarSecao("lista"));
els.tabProgresso?.addEventListener("click", () => mostrarSecao("progresso"));
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

/** Anel de progresso (SVG) — pathLength=100 deixa o dasharray igual ao %. */
function anelProgresso(percentual, concluido) {
  const p = Math.max(0, Math.min(100, Number(percentual) || 0));
  return `
    <div class="anel-progresso ${concluido ? "completo" : ""} ${p === 0 ? "vazio" : ""}" aria-hidden="true">
      <svg viewBox="0 0 44 44">
        <circle class="anel-fundo" cx="22" cy="22" r="18" pathLength="100" />
        <circle class="anel-valor" cx="22" cy="22" r="18" pathLength="100" style="stroke-dasharray:${p} 100;" />
      </svg>
      <span>${concluido ? icone("check", 16) : `${Math.round(p)}<small>%</small>`}</span>
    </div>
  `;
}

function cardDia(dia) {
  const rotulo = ROTULO_DIA[dia.dia_semana] || dia.dia_semana;
  const dataCurta = formatarDataCurta(dia.data);

  // Descanso vira uma linha compacta: antes cada dia de folga ocupava um
  // card do tamanho de um treino, e o aluno tinha que rolar à toa.
  if (!dia.treino_id) {
    return `
      <div class="dia-card dia-card-descanso reveal ${dia.hoje ? "hoje" : ""}">
        <span class="dia-card-dia">${rotulo} <small>${dataCurta}</small></span>
        <span class="dia-card-descanso-rotulo">${dia.hoje ? "Hoje · " : ""}Descanso</span>
      </div>
    `;
  }

  const acao = dia.concluido ? "Concluído" : dia.series_concluidas > 0 ? "Continuar" : dia.hoje ? "Começar treino" : "Ver treino";
  return `
    <button class="dia-card dia-card-treino reveal ${dia.hoje ? "hoje" : ""} ${dia.concluido ? "concluido" : ""}" type="button"
      data-treino-id="${dia.treino_id}" data-data="${dia.data}">
      ${anelProgresso(dia.progresso_percentual, dia.concluido)}
      <span class="dia-card-info">
        <span class="dia-card-dia">${dia.hoje ? `<span class="dia-card-hoje">Hoje</span>` : ""}${rotulo} <small>${dataCurta}</small></span>
        <strong class="dia-card-nome">${escaparHtml(dia.treino_nome)}</strong>
        <span class="dia-card-meta">${dia.series_concluidas} de ${dia.total_series} séries</span>
      </span>
      <span class="dia-card-acao">${acao}<span aria-hidden="true">›</span></span>
    </button>
  `;
}

let jaRolouAteHoje = false;

function renderizarSemana(semana) {
  els.listaTreinos.innerHTML = semana.map(cardDia).join("");
  observarRevelacoes(els.listaTreinos);

  // Na primeira abertura, se o treino de hoje ficou abaixo da dobra (ex:
  // sábado num celular pequeno), rola suave até ele — é o que o aluno veio
  // fazer. Só uma vez: voltar de um treino não pode ficar pulando a tela.
  if (jaRolouAteHoje) return;
  jaRolouAteHoje = true;
  const cardHoje = els.listaTreinos.querySelector(".dia-card-treino.hoje");
  if (!cardHoje) return;
  const { bottom } = cardHoje.getBoundingClientRect();
  const alturaTabBar = els.tabBar?.offsetHeight || 0;
  if (bottom > window.innerHeight - alturaTabBar) {
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => cardHoje.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "center" }), 350);
  }
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
      <button class="checklist-checkbox" type="button" data-acao="alternar-serie" data-serie-id="${serie.id}" aria-pressed="${serie.concluida_hoje ? "true" : "false"}" aria-label="Marcar série como concluída">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12.5L10 17L19 8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="checklist-info">
        <div class="checklist-titulo">Série ${serie.ordem + 1}</div>
        <div class="checklist-meta">${escaparHtml(serie.repeticoes_alvo)} repetições${serie.carga_alvo ? " · " + escaparHtml(serie.carga_alvo) : ""}${serie.intervalo_descanso ? " · descanso " + escaparHtml(serie.intervalo_descanso) : ""}</div>
        ${serie.comentario_hoje ? `<div class="serie-comentario" data-comentario-de="${serie.id}">"${escaparHtml(serie.comentario_hoje)}"</div>` : ""}
      </div>
      <button class="botao-recado${serie.comentario_hoje ? " tem-recado" : ""}" data-acao="comentar-serie" data-serie-id="${serie.id}" type="button" aria-label="Deixar um recado nesta série para o Personal" title="Deixar um recado pro seu Personal">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      </button>
    </div>
  `;
}

function blocoExercicio(exercicio) {
  return `
    <div class="bloco-exercicio ${exercicio.concluido_hoje ? "completo" : ""}" data-exercicio-id="${exercicio.id}">
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
    if (!detalhe.concluido_hoje) preCarregarCelebracao();
    els.execucaoExercicios.dataset.treinoId = treinoId;
    els.execucaoExercicios.dataset.data = data || "";
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
    mostrarSecao("lista");
  }
}

// --- Recado do aluno numa série ("doeu o joelho aqui") ---
// Independente de ter marcado a série como feita: dá pra avisar justamente
// quando pulou o exercício por causa de dor.
let serieDoRecado = null;

els.execucaoExercicios?.addEventListener("click", (evento) => {
  const botao = evento.target.closest("[data-acao='comentar-serie']");
  if (!botao) return;
  serieDoRecado = Number(botao.dataset.serieId);
  const existente = els.execucaoExercicios.querySelector(`[data-comentario-de="${serieDoRecado}"]`);
  // Tira as aspas que o render coloca em volta pra reabrir o texto puro.
  els.formRecado.texto.value = existente ? existente.textContent.replace(/^"|"$/g, "") : "";
  abrirModal(els.modalRecado);
  els.formRecado.texto.focus();
});

$all("[data-acao='fechar-modal-recado']").forEach((el) =>
  el.addEventListener("click", () => fecharModal(els.modalRecado))
);

els.formRecado?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (serieDoRecado == null) return;
  const botao = $("button[type='submit']", els.formRecado);
  botao.disabled = true;
  const data = els.execucaoExercicios.dataset.data || undefined;
  try {
    const salvo = await api.comentarSerieAluno(token, serieDoRecado, els.formRecado.texto.value, data);
    const item = els.execucaoExercicios.querySelector(`.checklist-item[data-serie-id="${serieDoRecado}"]`);
    const infoEl = item?.querySelector(".checklist-info");
    const existente = item?.querySelector(`[data-comentario-de="${serieDoRecado}"]`);
    const botaoRecado = item?.querySelector("[data-acao='comentar-serie']");

    if (salvo) {
      if (existente) {
        existente.textContent = `"${salvo.texto}"`;
      } else if (infoEl) {
        const div = document.createElement("div");
        div.className = "serie-comentario";
        div.dataset.comentarioDe = String(serieDoRecado);
        div.textContent = `"${salvo.texto}"`;
        infoEl.appendChild(div);
      }
      botaoRecado?.classList.add("tem-recado");
      mostrarToast("Recado enviado pro seu Personal!", "sucesso");
    } else {
      existente?.remove();
      botaoRecado?.classList.remove("tem-recado");
      mostrarToast("Recado apagado.", "sucesso");
    }
    fecharModal(els.modalRecado);
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botao.disabled = false;
  }
});

/** Ícone do exercício (halter → check) calculado pelo próprio DOM: antes
 * cada toque baixava o treino inteiro de novo só pra atualizar isso. */
function atualizarIconeExercicio(blocoEl) {
  if (!blocoEl) return;
  const itens = [...blocoEl.querySelectorAll(".checklist-item")];
  const completo = itens.length > 0 && itens.every((el) => el.classList.contains("concluida"));
  blocoEl.classList.toggle("completo", completo);
  const iconeEl = blocoEl.querySelector(".bloco-exercicio-titulo span");
  if (!iconeEl) return;
  iconeEl.className = completo ? "icone-concluido" : "";
  iconeEl.innerHTML = completo ? icone("check", 18) : iconeHalter(18);
}

/** "Pop" do check + faíscas na cor da marca + vibraçãozinha (Android). */
function comemorarSerie(botao) {
  navigator.vibrate?.(14);
  botao.classList.remove("pop");
  void botao.offsetWidth; // reinicia a animação se tocar de novo rápido
  botao.classList.add("pop");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const faiscas = document.createElement("span");
  faiscas.className = "faiscas";
  faiscas.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 10; i++) {
    const faisca = document.createElement("i");
    faisca.style.setProperty("--a", `${i * 36 + Math.random() * 18}deg`);
    faisca.style.setProperty("--d", `${26 + Math.random() * 16}px`);
    faiscas.appendChild(faisca);
  }
  botao.appendChild(faiscas);
  setTimeout(() => faiscas.remove(), 700);
}

async function celebrarConclusao() {
  try {
    const { celebrarTreinoConcluido } = await import("./3d/celebracao.js");
    celebrarTreinoConcluido({
      titulo: "Treino concluído!",
      subtitulo: `${els.execucaoTitulo.textContent} — mandou bem demais.`,
    });
  } catch {
    mostrarToast("Treino concluído! Parabéns.", "sucesso"); // sem rede pro módulo: o recado chega mesmo assim
  }
}

/** Ao abrir um treino ainda não concluído, baixa o Three.js em segundo
 * plano (quando o navegador estiver ocioso) — assim a celebração 3D abre
 * na hora ao terminar, mesmo no 4G da academia. ~330KB compactado, uma vez
 * por aparelho: depois fica no cache do navegador (URL com versão fixa). */
let threePreCarregado = false;
function preCarregarCelebracao() {
  if (threePreCarregado) return;
  threePreCarregado = true;
  const carregar = () =>
    import("./3d/motor.js")
      .then((motor) => motor.pode3D() && Promise.all([motor.carregarThree(), import("./3d/celebracao.js")]))
      .catch(() => {});
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 400)))(carregar);
}

// Séries com requisição em andamento — um toque duplo não dispara duas
// alternâncias (o endpoint é um toggle, a segunda desfaria a primeira).
const seriesEmAndamento = new Set();

els.execucaoExercicios?.addEventListener("click", async (evento) => {
  const botao = evento.target.closest("[data-acao='alternar-serie']");
  if (!botao) return;
  const serieId = Number(botao.dataset.serieId);
  if (seriesEmAndamento.has(serieId)) return;
  seriesEmAndamento.add(serieId);

  const item = botao.closest(".checklist-item");
  const bloco = botao.closest(".bloco-exercicio");
  const data = els.execucaoExercicios.dataset.data || undefined;

  // Otimista: marca na hora (no 4G da academia esperar o servidor dava um
  // atraso perceptível); a resposta confirma, e se der erro desfaz.
  const vaiConcluir = !item.classList.contains("concluida");
  item.classList.toggle("concluida", vaiConcluir);
  botao.setAttribute("aria-pressed", String(vaiConcluir));
  if (vaiConcluir) comemorarSerie(botao);
  atualizarIconeExercicio(bloco);

  try {
    const resultado = await api.executarSerie(token, serieId, data);
    item.classList.toggle("concluida", resultado.concluida_hoje);
    botao.setAttribute("aria-pressed", String(resultado.concluida_hoje));
    atualizarIconeExercicio(bloco);

    els.execucaoProgressoBarra.style.width = `${resultado.treino_progresso_percentual}%`;
    els.execucaoProgressoBarra.classList.toggle("completo", resultado.treino_concluido_hoje);
    els.execucaoProgressoTexto.textContent = `${resultado.treino_progresso_percentual}% concluído`;

    const jaMostrandoFaixa = !els.execucaoFaixaConcluido.hidden;
    els.execucaoFaixaConcluido.hidden = !resultado.treino_concluido_hoje;
    if (resultado.treino_concluido_hoje && !jaMostrandoFaixa) {
      celebrarConclusao();
    }
  } catch (erro) {
    item.classList.toggle("concluida", !vaiConcluir);
    botao.setAttribute("aria-pressed", String(!vaiConcluir));
    atualizarIconeExercicio(bloco);
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    seriesEmAndamento.delete(serieId);
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

// --- Aba "Progresso": só leitura. Quem registra peso, medidas e fotos é o
// Personal — aqui o aluno só acompanha a própria evolução. ---

const ROTULO_METRICA = {
  peso_kg: "Peso",
  cintura_cm: "Cintura",
  quadril_cm: "Quadril",
  braco_cm: "Braço",
  coxa_cm: "Coxa",
  peito_cm: "Peito",
};
const unidadeMetrica = (metrica) => (metrica === "peso_kg" ? "kg" : "cm");
const ORIGEM_UPLOADS = API_BASE_URL.replace(/\/api\/?$/, "");

function formatarDataCompleta(isoData) {
  const [ano, mes, dia] = isoData.split("-");
  return `${dia}/${mes}/${ano}`;
}

function cartaoMetaAluno(meta) {
  const rotulo = ROTULO_METRICA[meta.metrica] || meta.metrica;
  const un = unidadeMetrica(meta.metrica);
  const emagrecer = meta.valor_alvo <= meta.valor_inicial;

  const marcos = meta.marcos
    .map((valor) => {
      const batido =
        meta.valor_atual != null && (emagrecer ? meta.valor_atual <= valor : meta.valor_atual >= valor);
      const posicao = Math.abs(((valor - meta.valor_inicial) / (meta.valor_alvo - meta.valor_inicial)) * 100);
      return `<span class="meta-marco${batido ? " batido" : ""}" style="left:${posicao}%;" title="${valor}${un}"></span>`;
    })
    .join("");

  const falta =
    meta.valor_atual == null
      ? "Aguardando a primeira medida."
      : meta.concluida
        ? "Meta batida! Parabéns."
        : `Faltam ${Math.round(Math.abs(meta.valor_atual - meta.valor_alvo) * 10) / 10}${un}`;

  return `
    <div class="meta-cartao${meta.concluida ? " concluida" : ""}">
      <div class="meta-cabecalho">
        <div style="min-width:0;">
          <strong>${rotulo}: ${meta.valor_inicial}${un} → ${meta.valor_alvo}${un}</strong>
          ${meta.concluida ? `<span class="badge badge-sucesso">concluída</span>` : ""}
        </div>
      </div>
      <div class="barra-progresso meta-barra">
        <div class="barra-progresso-preenchida${meta.concluida ? " meta-alcancada" : ""}" style="width:${meta.percentual}%;"></div>
        ${marcos}
      </div>
      <div class="meta-rodape">
        <span class="${meta.concluida ? "meta-sucesso" : ""}">
          ${meta.concluida ? icone("troféu", 14) + " " : ""}${falta}
        </span>
        ${meta.valor_atual != null && !meta.concluida ? `<span class="hint-text">está em ${meta.valor_atual}${un}</span>` : ""}
      </div>
    </div>
  `;
}

/** Compara a medida mais recente com a anterior — "-2kg desde a última". */
function variacaoMedida(avaliacoes, campo) {
  const comValor = avaliacoes.filter((a) => a[campo] != null);
  if (comValor.length < 2) return "";
  const diferenca = Math.round((comValor[0][campo] - comValor[1][campo]) * 10) / 10;
  if (diferenca === 0) return "";
  const un = unidadeMetrica(campo);
  return `<span class="hint-text">(${diferenca > 0 ? "+" : ""}${diferenca}${un} desde a anterior)</span>`;
}

function renderizarProgresso(dados) {
  // Metas (ativas primeiro)
  const metas = [...dados.metas].sort((a, b) => Number(a.concluida) - Number(b.concluida));
  els.progressoMetas.innerHTML = metas.length
    ? `<h2 style="margin-bottom:var(--espaco-3);">Suas metas</h2>
       <div class="metas-lista">${metas.map(cartaoMetaAluno).join("")}</div>`
    : `<h2 style="margin-bottom:var(--espaco-3);">Suas metas</h2>
       <p class="hint-text">Seu Personal ainda não definiu nenhuma meta pra você.</p>`;

  // Peso e medidas
  const avaliacoes = dados.avaliacoes; // já vem da mais recente pra mais antiga
  if (avaliacoes.length === 0) {
    els.progressoMedidas.innerHTML = `
      <h2 style="margin-bottom:var(--espaco-3);">Peso e medidas</h2>
      <p class="hint-text">Nenhuma medida registrada ainda. Seu Personal registra isso nas avaliações.</p>`;
  } else {
    const ultima = avaliacoes[0];
    const campos = Object.keys(ROTULO_METRICA).filter((c) => ultima[c] != null);
    els.progressoMedidas.innerHTML = `
      <h2 style="margin-bottom:var(--espaco-3);">Peso e medidas</h2>
      <p class="hint-text" style="margin-bottom:var(--espaco-3);">Última avaliação: ${formatarDataCompleta(ultima.data)}</p>
      <div class="medidas-grade">
        ${campos
          .map(
            (campo) => `
              <div class="medida-item">
                <div class="medida-rotulo">${ROTULO_METRICA[campo]}</div>
                <div class="medida-valor">${ultima[campo]}${unidadeMetrica(campo)}</div>
                ${variacaoMedida(avaliacoes, campo)}
              </div>
            `
          )
          .join("")}
      </div>
      ${
        avaliacoes.length > 1
          ? `<details style="margin-top:var(--espaco-4);">
               <summary class="hint-text" style="cursor:pointer;font-weight:700;">Ver histórico (${avaliacoes.length})</summary>
               <div style="display:flex;flex-direction:column;gap:var(--espaco-2);margin-top:var(--espaco-3);">
                 ${avaliacoes
                   .map(
                     (a) => `
                       <div class="historico-linha">
                         <span>${formatarDataCompleta(a.data)}</span>
                         <strong>${a.peso_kg != null ? a.peso_kg + "kg" : "—"}</strong>
                       </div>`
                   )
                   .join("")}
               </div>
             </details>`
          : ""
      }
    `;
  }

  // Fotos de progresso
  els.progressoFotos.innerHTML = dados.fotos.length
    ? `<h2 style="margin-bottom:var(--espaco-3);">Suas fotos</h2>
       <div class="fotos-grade-aluno">
         ${dados.fotos
           .map(
             (f) => `
               <figure class="foto-progresso-item">
                 <img src="${ORIGEM_UPLOADS}${escaparHtml(f.url)}" alt="Foto de ${formatarDataCompleta(f.data)}" loading="lazy" />
                 <figcaption class="hint-text">${formatarDataCompleta(f.data)}</figcaption>
               </figure>`
           )
           .join("")}
       </div>`
    : "";
}

async function carregarProgresso() {
  try {
    const dados = await api.progressoAluno(token);
    progressoCarregado = true;
    renderizarProgresso(dados);
    els.progressoCarregando.hidden = true;
    els.progressoConteudo.hidden = false;
  } catch (erro) {
    els.progressoCarregando.hidden = true;
    els.progressoConteudo.hidden = false;
    els.progressoMetas.innerHTML = `<p class="hint-text">Não foi possível carregar seu progresso agora.</p>`;
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
