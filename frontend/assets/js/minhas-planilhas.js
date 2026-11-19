// Seklyn — "Minhas planilhas" do comprador: lista o que comprou, toca os
// vídeos (links assinados, válidos por algumas horas) e baixa os arquivos.
import { lojaApi, tokenComprador, urlCompleta } from "./loja-api.js";
import { $, escaparHtml, mensagemDeErro, mostrarToast } from "./utils.js";

const STATUS = {
  paga: ["Liberada", "pl-status-paga"],
  aguardando: ["Pagamento em processamento", "pl-status-aguardando"],
  reembolsada: ["Reembolsada", "pl-status-outro"],
  expirada: ["Pagamento não concluído", "pl-status-outro"],
};

let compras = [];

const mb = (b) => (!b ? "" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / (1024 * 1024)).toFixed(b > 10 * 1024 * 1024 ? 0 : 1)} MB`);

function mostrar(logado) {
  $("#bloco-login").hidden = logado;
  $("#bloco-area").hidden = !logado;
  $("#sair").hidden = !logado;
}

function capa(p) {
  return p?.capa_url ? `<img src="${escaparHtml(urlCompleta(p.capa_url))}" alt="" />` : `<div class="pl-mini-capa">🏋️</div>`;
}

function renderizarLista() {
  const lista = $("#lista-minhas");
  if (!compras.length) {
    lista.innerHTML = `<div class="pl-vazio"><h3>Nenhuma planilha ainda</h3><p><a href="./#planilhas">Ver planilhas disponíveis</a></p></div>`;
    return;
  }
  lista.innerHTML = compras
    .map((c) => {
      const [texto, classe] = STATUS[c.status] || [c.status, "pl-status-outro"];
      return `
        <button class="pl-minha" type="button" data-produto="${c.produto?.id ?? ""}" data-status="${c.status}">
          ${capa(c.produto)}
          <span>
            <strong>${escaparHtml(c.produto?.titulo || "Planilha")}</strong>
            <span class="pl-status ${classe}">${texto}</span>
          </span>
        </button>`;
    })
    .join("");
}

function tocar(item, botao) {
  document.querySelectorAll(".pl-aula.tocando").forEach((b) => b.classList.remove("tocando"));
  botao?.classList.add("tocando");
  const player = $("#player");
  if (item.tipo === "youtube") {
    player.innerHTML = `<iframe src="${escaparHtml(item.url)}" title="${escaparHtml(item.titulo)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  } else {
    player.innerHTML = `<video controls playsinline controlslist="nodownload" preload="metadata" src="${escaparHtml(urlCompleta(item.url))}"></video>`;
  }
  $("#player-titulo").textContent = item.titulo;
}

async function abrirProduto(produtoId) {
  document.querySelectorAll(".pl-minha").forEach((b) => b.classList.toggle("ativa", b.dataset.produto === String(produtoId)));
  try {
    const dados = await lojaApi.conteudos(produtoId);
    $("#conteudo").hidden = false;
    $("#conteudo-titulo").textContent = dados.produto.titulo;
    const videos = dados.conteudos.filter((c) => c.tipo === "video" || c.tipo === "youtube");
    const arquivos = dados.conteudos.filter((c) => c.tipo === "arquivo");
    const aulas = $("#aulas");
    aulas.innerHTML =
      videos
        .map(
          (c, i) => `<button class="pl-aula" type="button" data-video="${i}"><span class="pl-aula-icone">▶</span>${escaparHtml(c.titulo)}</button>`
        )
        .join("") +
      arquivos
        .map(
          (c) =>
            `<a class="pl-aula" href="${escaparHtml(urlCompleta(c.download_url))}" download><span class="pl-aula-icone">⬇</span>${escaparHtml(c.titulo)}<small>${mb(c.tamanho_bytes)}</small></a>`
        )
        .join("") || `<p class="pl-mini">O conteúdo dessa planilha ainda está sendo preparado.</p>`;
    aulas.querySelectorAll("[data-video]").forEach((b) => b.addEventListener("click", () => tocar(videos[Number(b.dataset.video)], b)));
    $("#player").parentElement.hidden = !videos.length;
    if (videos.length) tocar(videos[0], aulas.querySelector("[data-video='0']"));
    $("#conteudo").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

async function carregar() {
  try {
    const me = await lojaApi.me();
    $("#ola").textContent = `Olá, ${me.nome.split(" ")[0]}!`;
    mostrar(true);
    compras = await lojaApi.compras();
    renderizarLista();
    const pedido = new URLSearchParams(location.search).get("p");
    const alvo = compras.find((c) => c.status === "paga" && String(c.produto?.id) === pedido) || compras.find((c) => c.status === "paga");
    if (alvo) abrirProduto(alvo.produto.id);
    // pagamento ainda processando: atualiza sozinho
    if (compras.some((c) => c.status === "aguardando")) setTimeout(carregar, 6000);
  } catch {
    mostrar(false);
  }
}

$("#lista-minhas").addEventListener("click", (e) => {
  const item = e.target.closest(".pl-minha");
  if (!item) return;
  if (item.dataset.status !== "paga") {
    mostrarToast(item.dataset.status === "aguardando" ? "Assim que o pagamento confirmar, libera aqui." : "Essa planilha não está liberada.", "info");
    return;
  }
  abrirProduto(item.dataset.produto);
});

$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const r = await lojaApi.login($("#l-email").value.trim(), $("#l-senha").value);
    tokenComprador.salvar(r.access_token);
    carregar();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
});

$("#sair").addEventListener("click", () => {
  tokenComprador.limpar();
  location.href = "./";
});

if (tokenComprador.obter()) carregar();
else mostrar(false);
