// Seklyn — gestão dos links de afiliado ("Dicas do seu Personal").
import { api } from "./api.js";
import { protegerPagina } from "./auth.js";
import { $, escaparHtml, mensagemDeErro, mostrarToast } from "./utils.js";
import { confirmarAcao } from "./confirmar.js";

protegerPagina();

const listaEl = $("#lista-recomendacoes");
const estadoVazioEl = $("#estado-vazio-recomendacoes");
const formEl = $("#form-recomendacao");

function linha(rec) {
  return `
    <div class="card" data-id="${rec.id}" style="display:flex;align-items:center;gap:var(--espaco-4);">
      <div style="flex:1;min-width:0;">
        <strong>${escaparHtml(rec.titulo)}</strong>
        ${rec.categoria ? `<span class="badge badge-neutro" style="margin-left:8px;">${escaparHtml(rec.categoria)}</span>` : ""}
        <div class="hint-text" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escaparHtml(rec.url_afiliado)}</div>
        ${rec.descricao ? `<p class="hint-text" style="margin-top:4px;">${escaparHtml(rec.descricao)}</p>` : ""}
      </div>
      <label class="hint-text" style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        <input type="checkbox" data-acao="alternar-ativo" data-id="${rec.id}" ${rec.ativo ? "checked" : ""} /> Ativa
      </label>
      <button class="btn btn-danger btn-sm" data-acao="excluir" data-id="${rec.id}" type="button">Excluir</button>
    </div>
  `;
}

async function carregar() {
  try {
    const recomendacoes = await api.listarRecomendacoes();
    if (recomendacoes.length === 0) {
      listaEl.innerHTML = "";
      estadoVazioEl.hidden = false;
      return;
    }
    estadoVazioEl.hidden = true;
    listaEl.innerHTML = recomendacoes.map(linha).join("");
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

formEl?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const botao = $("button[type='submit']", formEl);
  botao.disabled = true;
  try {
    const dados = {
      titulo: formEl.titulo.value.trim(),
      url_afiliado: formEl.url_afiliado.value.trim(),
      categoria: formEl.categoria.value.trim() || null,
      descricao: formEl.descricao.value.trim() || null,
      ordem: 0,
    };
    await api.criarRecomendacao(dados);
    mostrarToast("Recomendação cadastrada!", "sucesso");
    formEl.reset();
    carregar();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    botao.disabled = false;
  }
});

listaEl?.addEventListener("change", async (evento) => {
  const checkbox = evento.target.closest("[data-acao='alternar-ativo']");
  if (!checkbox) return;
  try {
    await api.atualizarRecomendacao(Number(checkbox.dataset.id), { ativo: checkbox.checked });
    mostrarToast("Atualizado!", "sucesso");
  } catch (erro) {
    checkbox.checked = !checkbox.checked;
    mostrarToast(mensagemDeErro(erro), "erro");
  }
});

listaEl?.addEventListener("click", async (evento) => {
  const botao = evento.target.closest("[data-acao='excluir']");
  if (!botao) return;
  const confirmou = await confirmarAcao("Excluir esta recomendação?", { titulo: "Excluir recomendação", textoConfirmar: "Excluir" });
  if (!confirmou) return;
  try {
    await api.excluirRecomendacao(Number(botao.dataset.id));
    mostrarToast("Recomendação excluída.", "sucesso");
    carregar();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
});

carregar();
