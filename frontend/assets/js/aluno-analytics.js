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
          (p, indice) => `
            <div class="grafico-barra-coluna" title="${formatarDataCompleta(p.data)}, ${p.percentual}%${p.suspeito ? " - marcações muito próximas" : ""}">
              <div class="grafico-barra ${p.suspeito ? "suspeito" : ""}" style="height:${Math.max(p.percentual, 2)}%;animation-delay:${indice * 15}ms;"></div>
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

/** Junta em uma linha só as séries seguidas do mesmo exercício/horário/treino (ex: 3 séries de Prancha às 22:49 viram "3x Prancha"). */
function agruparExecucoesRepetidas(itens) {
  const grupos = [];
  for (const item of itens) {
    const ultimo = grupos[grupos.length - 1];
    if (
      ultimo &&
      ultimo.hora === item.hora &&
      ultimo.exercicio_nome === item.exercicio_nome &&
      ultimo.treino_nome === item.treino_nome &&
      ultimo.data_treino === item.data_treino
    ) {
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

  // Agrupa pelo dia REAL em que o aluno marcou (data_marcacao) — não pelo dia
  // do treino (data_treino). São coisas diferentes: um treino de segunda
  // marcado só na terça de noite tem que aparecer sob "terça", com um aviso
  // de que era treino de outro dia — não escondido debaixo de "segunda".
  const porDiaMarcacao = new Map();
  execucoes.forEach((e) => {
    if (!porDiaMarcacao.has(e.data_marcacao)) porDiaMarcacao.set(e.data_marcacao, []);
    porDiaMarcacao.get(e.data_marcacao).push(e);
  });

  container.innerHTML = Array.from(porDiaMarcacao.entries())
    .map(([dataMarcacao, itens]) => {
      // Sinal de atenção = tem série aqui marcada num dia diferente do dia do
      // treino a que ela pertence (ex: treino de segunda, só marcado terça de
      // noite) — mais direto de entender do que "várias marcações juntas".
      const temAtraso = itens.some((i) => i.data_treino !== dataMarcacao);
      const grupos = agruparExecucoesRepetidas(itens);
      return `
        <div class="execucao-dia-bloco ${temAtraso ? "suspeito" : ""}">
          <p class="execucao-dia-titulo">
            Marcado em ${formatarDataCompleta(dataMarcacao)}
            ${temAtraso ? `<span class="badge badge-aviso">${icone("aviso", 14)} marcado em um dia diferente do dia do treino</span>` : ""}
          </p>
          <div class="execucao-dia-itens">
            ${grupos
              .map((g) => {
                const atrasado = g.data_treino !== dataMarcacao;
                return `<span class="execucao-item">${escaparHtml(g.hora)} · ${g.quantidade > 1 ? `${g.quantidade}x ` : ""}${escaparHtml(g.exercicio_nome)} <span class="hint-text">(${escaparHtml(g.treino_nome)})</span>${atrasado ? ` <span class="execucao-item-atraso">${icone("aviso", 12)} treino do dia ${formatarDataCompleta(g.data_treino)}</span>` : ""}</span>`;
              })
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");
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
