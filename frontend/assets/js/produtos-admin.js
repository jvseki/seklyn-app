// Seklyn — Admin: planilhas da loja pública (produtos, capa e conteúdos).
// Vídeo/arquivo sobem com barra de progresso (XHR) e ficam em pasta privada
// no servidor: só quem comprou abre, por link assinado.
import { API_BASE_URL, api, obterToken } from "./api.js";
import { confirmarAcao } from "./confirmar.js";
import { $, escaparHtml, mensagemDeErro, mostrarToast } from "./utils.js";

const ORIGEM_API = API_BASE_URL.replace(/\/api\/?$/, "");
const reais = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const mb = (b) => (b ? `${(b / (1024 * 1024)).toFixed(1)} MB` : "");
const ICONES = { video: "🎥", arquivo: "📄", youtube: "▶️" };

let produtos = [];
let editando = null;

/** Envia multipart com progresso (fetch não informa progresso de upload). */
function enviar(caminho, formData, aoProgresso) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${caminho}`);
    xhr.setRequestHeader("Authorization", `Bearer ${obterToken()}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && aoProgresso?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let corpo = null;
      try {
        corpo = JSON.parse(xhr.responseText);
      } catch {
        /* sem corpo */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(corpo);
      else {
        const detalhe = corpo?.detail;
        reject(new Error(xhr.status === 413 ? "Arquivo grande demais." : Array.isArray(detalhe) ? detalhe.map((d) => d.msg).join(", ") : detalhe || "Falha no envio."));
      }
    };
    xhr.onerror = () => reject(new Error("Sem conexão durante o envio."));
    xhr.send(formData);
  });
}

function renderizar() {
  const lista = $("#lista-produtos-admin");
  if (!produtos.length) {
    lista.innerHTML = `<p class="hint-text">Nenhuma planilha ainda. Clique em <b>+ Nova planilha</b>.</p>`;
    return;
  }
  lista.innerHTML = produtos
    .map(
      (p) => `
      <article class="produto-admin" data-id="${p.id}">
        <div class="produto-admin-cabeca">
          <label class="produto-admin-capa" title="Trocar capa">
            ${p.capa_url ? `<img src="${escaparHtml(ORIGEM_API + p.capa_url)}" alt="" />` : `<span>🖼️<small>capa</small></span>`}
            <input type="file" accept="image/jpeg,image/png,image/webp" data-capa="${p.id}" hidden />
          </label>
          <div class="produto-admin-info">
            <strong>${escaparHtml(p.titulo)}</strong>
            <span class="hint-text">${reais(p.preco)} · ${p.vendas_pagas} venda${p.vendas_pagas === 1 ? "" : "s"} · ${p.ativo ? "na vitrine" : "<b>oculta</b>"}</span>
            <a class="hint-text" href="/planilha-de-treino/?p=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">link direto ↗</a>
          </div>
          <div class="produto-admin-acoes">
            <button class="btn btn-ghost btn-sm" type="button" data-editar="${p.id}">Editar</button>
            <button class="btn btn-ghost btn-sm" type="button" data-apagar="${p.id}">Apagar</button>
          </div>
        </div>
        <ul class="produto-admin-conteudos">
          ${
            p.conteudos
              .map(
                (c) => `<li><span>${ICONES[c.tipo] || "•"} ${escaparHtml(c.titulo)} <small class="hint-text">${c.tipo === "youtube" ? "YouTube" : mb(c.tamanho_bytes)}</small></span>
                <button class="btn btn-ghost btn-sm" type="button" data-apagar-conteudo="${c.id}" aria-label="Remover">✕</button></li>`
              )
              .join("") || `<li class="hint-text">Sem conteúdo ainda — adicione os vídeos e a planilha abaixo.</li>`
          }
        </ul>
        <form class="produto-admin-novo" data-conteudo="${p.id}">
          <input class="input" name="titulo" placeholder="Título (ex: Aula 1 — Peito)" maxlength="160" required />
          <select class="input" name="tipo">
            <option value="video">Vídeo (MP4/MOV)</option>
            <option value="arquivo">Arquivo (PDF/Excel)</option>
            <option value="youtube">Link do YouTube</option>
          </select>
          <input class="input" name="arquivo" type="file" accept="video/mp4,video/quicktime,video/webm" />
          <input class="input" name="url_youtube" placeholder="https://youtu.be/..." hidden />
          <button class="btn btn-secondary btn-sm" type="submit">Adicionar</button>
          <div class="produto-admin-progresso" hidden><span></span></div>
        </form>
      </article>`
    )
    .join("");
}

async function carregar() {
  try {
    produtos = await api.produtosAdmin();
    renderizar();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

function abrirFormulario(produto = null) {
  editando = produto;
  $("#produto-form-titulo").textContent = produto ? "Editar planilha" : "Nova planilha";
  $("#pf-titulo").value = produto?.titulo || "";
  $("#pf-subtitulo").value = produto?.subtitulo || "";
  $("#pf-descricao").value = produto?.descricao || "";
  $("#pf-preco").value = produto ? Number(produto.preco).toFixed(2) : "1.00";
  $("#pf-nivel").value = produto?.nivel || "";
  $("#pf-duracao").value = produto?.duracao || "";
  $("#pf-ordem").value = produto?.ordem ?? 0;
  $("#pf-ativo").checked = produto ? produto.ativo : true;
  $("#produto-form").hidden = false;
  $("#pf-titulo").focus();
}

$("#produto-novo").addEventListener("click", () => abrirFormulario());
$("#pf-cancelar").addEventListener("click", () => ($("#produto-form").hidden = true));

$("#produto-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dados = {
    titulo: $("#pf-titulo").value.trim(),
    subtitulo: $("#pf-subtitulo").value.trim() || null,
    descricao: $("#pf-descricao").value.trim() || null,
    preco: Number($("#pf-preco").value).toFixed(2),
    nivel: $("#pf-nivel").value.trim() || null,
    duracao: $("#pf-duracao").value.trim() || null,
    ordem: Number($("#pf-ordem").value || 0),
    ativo: $("#pf-ativo").checked,
  };
  try {
    if (editando) await api.editarProdutoAdmin(editando.id, dados);
    else await api.criarProdutoAdmin(dados);
    $("#produto-form").hidden = true;
    mostrarToast("Planilha salva.", "sucesso");
    carregar();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
});

const lista = $("#lista-produtos-admin");

lista.addEventListener("click", async (e) => {
  const editar = e.target.closest("[data-editar]");
  const apagar = e.target.closest("[data-apagar]");
  const apagarConteudo = e.target.closest("[data-apagar-conteudo]");
  if (editar) abrirFormulario(produtos.find((p) => p.id === Number(editar.dataset.editar)));
  if (apagar) {
    const ok = await confirmarAcao("Apaga a planilha e todos os vídeos/arquivos dela.", { titulo: "Apagar planilha?", textoConfirmar: "Apagar" });
    if (!ok) return;
    try {
      await api.apagarProdutoAdmin(Number(apagar.dataset.apagar));
      mostrarToast("Planilha apagada.", "sucesso");
      carregar();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
  }
  if (apagarConteudo) {
    const ok = await confirmarAcao("Remove esse conteúdo da planilha (quem comprou deixa de ver).", { titulo: "Remover conteúdo?", textoConfirmar: "Remover" });
    if (!ok) return;
    try {
      await api.apagarConteudoAdmin(Number(apagarConteudo.dataset.apagarConteudo));
      carregar();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    }
  }
});

lista.addEventListener("change", async (e) => {
  const tipo = e.target.closest("select[name='tipo']");
  if (tipo) {
    const form = tipo.form;
    const arquivo = form.querySelector("[name='arquivo']");
    form.querySelector("[name='url_youtube']").hidden = tipo.value !== "youtube";
    arquivo.hidden = tipo.value === "youtube";
    arquivo.accept = tipo.value === "video" ? "video/mp4,video/quicktime,video/webm" : ".pdf,.xlsx,.xls,.csv,.zip";
  }
  const capa = e.target.closest("[data-capa]");
  if (capa?.files?.[0]) {
    const fd = new FormData();
    fd.append("arquivo", capa.files[0]);
    try {
      await enviar(`/admin/loja/produtos/${capa.dataset.capa}/capa`, fd);
      mostrarToast("Capa atualizada.", "sucesso");
      carregar();
    } catch (erro) {
      mostrarToast(erro.message, "erro");
    }
  }
});

lista.addEventListener("submit", async (e) => {
  const form = e.target.closest("[data-conteudo]");
  if (!form) return;
  e.preventDefault();
  const tipo = form.tipo.value;
  const fd = new FormData();
  fd.append("titulo", form.titulo.value.trim());
  fd.append("tipo", tipo);
  if (tipo === "youtube") fd.append("url_youtube", form.url_youtube.value.trim());
  else if (form.arquivo.files[0]) fd.append("arquivo", form.arquivo.files[0]);
  else return mostrarToast("Escolha o arquivo.", "erro");
  const barra = form.querySelector(".produto-admin-progresso");
  const botao = form.querySelector("button[type='submit']");
  botao.disabled = true;
  barra.hidden = tipo === "youtube";
  try {
    await enviar(`/admin/loja/produtos/${form.dataset.conteudo}/conteudos`, fd, (pct) => {
      barra.firstElementChild.style.width = `${pct}%`;
      botao.textContent = `Enviando ${pct}%`;
    });
    mostrarToast("Conteúdo adicionado.", "sucesso");
    carregar();
  } catch (erro) {
    mostrarToast(erro.message, "erro");
    botao.disabled = false;
    botao.textContent = "Adicionar";
    barra.hidden = true;
  }
});

carregar();
