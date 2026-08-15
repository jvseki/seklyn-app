// Seklyn — painel "Ver mais": gráfico de desempenho dia a dia + lista de
// marcações com hora real, pra dar transparência de verdade ao personal
// (em vez de só confiar no check verde).
import { api } from "./api.js";
import { protegerPagina } from "./auth.js";
import { $, escaparHtml, mensagemDeErro, mostrarToast } from "./utils.js";
import { icone } from "./icones.js";

protegerPagina();

const parametros = new URLSearchParams(window.location.search);
const alunoId = Number(parametros.get("id"));

if (!alunoId) {
  window.location.href = "dashboard.html";
}

$("#link-voltar-aluno").href = `aluno-detalhe.html?id=${alunoId}`;

function formatarDataCurta(isoData) {
  const [, mes, dia] = isoData.split("-");
  return `${dia}/${mes}`;
}

function formatarDataCompleta(isoData) {
  const [ano, mes, dia] = isoData.split("-");
  return `${dia}/${mes}/${ano}`;
}

function renderizarGrafico(pontos) {
  const container = $("#grafico-desempenho");
  container.innerHTML = `
    <div class="grafico-barras">
      ${pontos
        .map(
          (p) => `
            <div class="grafico-barra-coluna" title="${formatarDataCompleta(p.data)}, ${p.percentual}%${p.suspeito ? " - marcações muito próximas" : ""}">
              <div class="grafico-barra ${p.suspeito ? "suspeito" : ""}" style="height:${Math.max(p.percentual, 2)}%;"></div>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="grafico-legenda">
      <span>${formatarDataCurta(pontos[0].data)}</span>
      <span>${formatarDataCurta(pontos[pontos.length - 1].data)}</span>
    </div>
  `;
}

/** Junta em uma linha só as séries seguidas do mesmo exercício/horário (ex: 3 séries de Prancha às 22:49 viram "3x Prancha"). */
function agruparExecucoesRepetidas(itens) {
  const grupos = [];
  for (const item of itens) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.hora === item.hora && ultimo.exercicio_nome === item.exercicio_nome && ultimo.treino_nome === item.treino_nome) {
      ultimo.quantidade += 1;
    } else {
      grupos.push({ ...item, quantidade: 1 });
    }
  }
  return grupos;
}

function renderizarExecucoes(execucoes) {
  const container = $("#lista-execucoes-recentes");
  if (execucoes.length === 0) {
    container.innerHTML = `<p class="hint-text">Nenhuma série marcada ainda nos últimos 30 dias.</p>`;
    return;
  }

  // Agrupa por dia pra destacar visualmente quando muita coisa foi marcada junto.
  const porDia = new Map();
  execucoes.forEach((e) => {
    if (!porDia.has(e.data)) porDia.set(e.data, []);
    porDia.get(e.data).push(e);
  });

  container.innerHTML = Array.from(porDia.entries())
    .map(([data, itens]) => {
      const horarios = itens.map((i) => i.hora).sort();
      const suspeito = itens.length >= 3 && horariosMuitoProximos(horarios);
      const grupos = agruparExecucoesRepetidas(itens);
      return `
        <div class="execucao-dia-bloco ${suspeito ? "suspeito" : ""}">
          <p class="execucao-dia-titulo">
            ${formatarDataCompleta(data)}
            ${suspeito ? `<span class="badge badge-aviso">${icone("aviso", 14)} marcações muito próximas</span>` : ""}
          </p>
          <div class="execucao-dia-itens">
            ${grupos
              .map(
                (g) =>
                  `<span class="execucao-item">${escaparHtml(g.hora)} · ${g.quantidade > 1 ? `${g.quantidade}x ` : ""}${escaparHtml(g.exercicio_nome)} <span class="hint-text">(${escaparHtml(g.treino_nome)})</span></span>`
              )
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

function horariosMuitoProximos(horariosOrdenados) {
  const [h1] = horariosOrdenados;
  const [hUltimo] = horariosOrdenados.slice(-1);
  const min = (h) => {
    const [hh, mm] = h.split(":").map(Number);
    return hh * 60 + mm;
  };
  return min(hUltimo) - min(h1) <= 5;
}

async function iniciar() {
  try {
    const aluno = await api.obterAluno(alunoId);
    $("#analytics-nome-aluno").textContent = `Desempenho de ${aluno.nome}`;

    const dados = await api.analyticsDetalhadoAluno(alunoId, 30);
    renderizarGrafico(dados.desempenho);
    renderizarExecucoes(dados.execucoes_recentes);
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

iniciar();
