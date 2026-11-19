// Seklyn — página pública das planilhas (seklyn.com.br/planilha-de-treino).
// Vitrine → criar conta / entrar → Pix, crédito ou débito → liberado em
// "Minhas planilhas". O cartão é digitado no formulário do Mercado Pago
// (cartao-mp.js): o número nunca passa pelo Seklyn.
import { pode3D } from "./3d/motor.js";
import { montarFormularioCartao } from "./cartao-mp.js";
import { lojaApi, tokenComprador, urlCompleta } from "./loja-api.js";
import { observarRevelacoes } from "./revelar-ao-rolar.js";
import { ativarSpotlight } from "./spotlight.js";
import { $, $all, cpfValido, escaparHtml, mensagemDeErro, mostrarToast } from "./utils.js";

const reais = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

let config = null;
let produtos = [];
let comprador = null;
let produtoAtual = null;
let formulario = null;
let consulta = null;

// ---------- hero 3D (o mesmo halter da página inicial) ----------

async function iniciarHero() {
  const palco = $("#hero-palco");
  if (!palco || !pode3D()) return;
  try {
    const { montarHeroHalter } = await import("./3d/cena-halter.js");
    await montarHeroHalter($("#hero-canvas"), {
      aoMoverPonteiro(x, y) {
        palco.style.setProperty("--px", x.toFixed(3));
        palco.style.setProperty("--py", y.toFixed(3));
      },
    });
    palco.classList.add("com-3d");
  } catch (erro) {
    console.warn("3D indisponível:", erro);
  }
}

// barra fixa do celular some quando a lista de planilhas está na tela
function ligarBarraCelular() {
  const barra = $("#barra-celular");
  const alvo = $("#planilhas");
  if (!barra || !alvo || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(([e]) => barra.classList.toggle("escondida", e.isIntersecting), { threshold: 0.15 }).observe(alvo);
}

// ---------- vitrine ----------

function capaHtml(p, classe = "") {
  return p.capa_url
    ? `<img src="${escaparHtml(urlCompleta(p.capa_url))}" alt="" loading="lazy" ${classe ? `class="${classe}"` : ""} />`
    : `<div class="pl-mini-capa ${classe}">🏋️</div>`;
}

function renderizarProdutos() {
  const lista = $("#lista-produtos");
  if (!produtos.length) {
    lista.innerHTML = `
      <div class="pl-vazio reveal">
        <div style="font-size:2.4rem">🎬</div>
        <h3>Em breve</h3>
        <p>As planilhas estão sendo gravadas. Volte logo — ou acompanhe pelo Instagram.</p>
      </div>`;
    observarRevelacoes(lista);
    return;
  }
  lista.innerHTML = produtos
    .map((p) => {
      const selos = [p.nivel, p.duracao, p.qtd_videos ? `${p.qtd_videos} vídeo${p.qtd_videos > 1 ? "s" : ""}` : null]
        .filter(Boolean)
        .map((s) => `<span>${escaparHtml(s)}</span>`)
        .join("");
      const itens = p.itens
        .slice(0, 4)
        .map((i) => `<li>${escaparHtml(i.titulo)}</li>`)
        .join("");
      const mais = p.itens.length > 4 ? `<li>e mais ${p.itens.length - 4}…</li>` : "";
      return `
        <article class="pl-produto spotlight-card reveal">
          <div class="pl-produto-capa">
            ${p.capa_url ? `<img src="${escaparHtml(urlCompleta(p.capa_url))}" alt="${escaparHtml(p.titulo)}" loading="lazy" />` : `<div class="pl-produto-capa-vazia">🏋️</div>`}
            <div class="pl-produto-selos">${selos}</div>
          </div>
          <div class="pl-produto-corpo">
            <h3>${escaparHtml(p.titulo)}</h3>
            ${p.subtitulo ? `<p class="pl-produto-sub">${escaparHtml(p.subtitulo)}</p>` : ""}
            ${itens ? `<ul class="pl-produto-itens">${itens}${mais}</ul>` : ""}
            <div class="pl-produto-rodape">
              <div class="pl-preco">${reais(p.preco)}<small>pagamento único</small></div>
              <button class="pl-btn pl-btn-brilho" type="button" data-comprar="${p.id}">Quero essa</button>
            </div>
          </div>
        </article>`;
    })
    .join("");
  observarRevelacoes(lista);
  ativarSpotlight(".spotlight-card", lista);
}

function atualizarTopo() {
  const link = $("#topo-conta");
  link.textContent = comprador ? `Minhas planilhas` : "Entrar";
  link.title = comprador ? comprador.nome : "";
}

// ---------- fluxo de compra ----------

function mostrarPasso(nome) {
  $all(".pl-passo-compra").forEach((p) => (p.hidden = p.dataset.passo !== nome));
}

function abrirCompra(produto) {
  produtoAtual = produto;
  $("#compra-produto").innerHTML = `
    ${capaHtml(produto)}
    <div><strong id="compra-titulo">${escaparHtml(produto.titulo)}</strong><span>${reais(produto.preco)}</span></div>`;
  $("#modal-compra").hidden = false;
  document.body.style.overflow = "hidden";
  if (comprador) irParaPagamento();
  else mostrarPasso("conta");
}

function fecharCompra() {
  clearInterval(consulta);
  formulario?.desmontar();
  formulario = null;
  $("#modal-compra").hidden = true;
  document.body.style.overflow = "";
}

function irParaPagamento() {
  $("#compra-ola").textContent = `Comprando como ${comprador.nome} (${comprador.email})`;
  $("#compra-pagar").textContent = `Pagar ${reais(produtoAtual.preco)}`;
  mostrarPasso("pagamento");
}

function sucesso() {
  clearInterval(consulta);
  formulario?.desmontar();
  formulario = null;
  $("#sucesso-abrir").href = `minhas.html?p=${produtoAtual.id}`;
  mostrarPasso("sucesso");
}

/** Pix/cartão em análise: consulta até confirmar. */
function acompanhar(vendaId) {
  clearInterval(consulta);
  let vezes = 0;
  consulta = setInterval(async () => {
    if (++vezes > 300) return clearInterval(consulta);
    try {
      const s = await lojaApi.statusCompra(vendaId);
      if (s.status === "paga") sucesso();
      else if (s.status !== "aguardando") {
        clearInterval(consulta);
        mostrarToast("O pagamento não foi concluído. Tente de novo.", "erro");
        irParaPagamento();
      }
    } catch {
      /* tenta de novo */
    }
  }, 4000);
}

function tratarErroCompra(erro) {
  if (erro.status === 409) {
    mostrarToast("Você já tem essa planilha!", "sucesso");
    window.location.href = `minhas.html?p=${produtoAtual.id}`;
    return;
  }
  if (erro.status === 401) {
    comprador = null;
    atualizarTopo();
    mostrarPasso("conta");
  }
  mostrarToast(mensagemDeErro(erro), "erro");
}

async function pagarPix() {
  const botao = $("#compra-pagar");
  botao.disabled = true;
  try {
    const pix = await lojaApi.comprarPix(produtoAtual.id);
    $("#pix-qr").src = `data:image/png;base64,${pix.qr_code_base64}`;
    $("#pix-codigo").value = pix.qr_code;
    mostrarPasso("pix");
    acompanhar(pix.venda_id);
  } catch (erro) {
    tratarErroCompra(erro);
  } finally {
    botao.disabled = false;
  }
}

async function pagarCartao(tipo) {
  if (!config?.mp_public_key) {
    mostrarToast("Pagamento com cartão indisponível agora. Use o Pix.", "erro");
    return;
  }
  mostrarPasso("cartao");
  $("#pl-brick").innerHTML = "";
  try {
    formulario = await montarFormularioCartao({
      containerId: "pl-brick",
      publicKey: config.mp_public_key,
      valor: produtoAtual.preco,
      email: comprador.email,
      textoBotao: `Pagar ${reais(produtoAtual.preco)}`,
      tiposExcluidos: tipo === "debito" ? ["credit_card", "prepaid_card"] : ["debit_card", "prepaid_card"],
      aoEnviar: (token, dados) =>
        lojaApi
          .comprarCartao(produtoAtual.id, {
            card_token: token,
            payment_method_id: dados?.payment_method_id,
            issuer_id: dados?.issuer_id != null ? String(dados.issuer_id) : null,
            documento_tipo: dados?.payer?.identification?.type || null,
            documento_numero: dados?.payer?.identification?.number || null,
          })
          .then((r) => {
            if (r.status === "paga") sucesso();
            else {
              mostrarToast("Pagamento em análise pelo banco — já já libera.", "info");
              acompanhar(r.venda_id);
            }
          })
          .catch((erro) => {
            tratarErroCompra(erro);
            throw erro;
          }),
    });
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
    irParaPagamento();
  }
}

function ligarCompra() {
  document.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-comprar]");
    if (!botao) return;
    const produto = produtos.find((p) => p.id === Number(botao.dataset.comprar));
    if (produto) abrirCompra(produto);
  });
  $("#compra-fechar").addEventListener("click", fecharCompra);
  $("#modal-compra").addEventListener("click", (e) => e.target.id === "modal-compra" && fecharCompra());
  document.addEventListener("keydown", (e) => e.key === "Escape" && !$("#modal-compra").hidden && fecharCompra());

  $all(".pl-aba").forEach((aba) =>
    aba.addEventListener("click", () => {
      $all(".pl-aba").forEach((a) => a.classList.toggle("ativa", a === aba));
      $("#form-criar").hidden = aba.dataset.aba !== "criar";
      $("#form-entrar").hidden = aba.dataset.aba !== "entrar";
    })
  );

  $("#form-criar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const dados = {
      nome: $("#c-nome").value.trim(),
      email: $("#c-email").value.trim(),
      cpf: $("#c-cpf").value.trim(),
      telefone: $("#c-tel").value.trim() || null,
      senha: $("#c-senha").value,
    };
    if (dados.nome.length < 2) return mostrarToast("Digite seu nome.", "erro");
    if (!$("#c-email").checkValidity() || !dados.email) return mostrarToast("Digite um e-mail válido.", "erro");
    if (!cpfValido(dados.cpf)) return mostrarToast("CPF inválido. Confira os números.", "erro");
    if (dados.senha.length < 8) return mostrarToast("A senha precisa ter pelo menos 8 caracteres.", "erro");
    const botao = e.submitter;
    if (botao) botao.disabled = true;
    try {
      const r = await lojaApi.registrar(dados);
      tokenComprador.salvar(r.access_token);
      comprador = r.comprador;
      atualizarTopo();
      irParaPagamento();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    } finally {
      if (botao) botao.disabled = false;
    }
  });

  $("#form-entrar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = e.submitter;
    if (botao) botao.disabled = true;
    try {
      const r = await lojaApi.login($("#e-email").value.trim(), $("#e-senha").value);
      tokenComprador.salvar(r.access_token);
      comprador = r.comprador;
      atualizarTopo();
      irParaPagamento();
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    } finally {
      if (botao) botao.disabled = false;
    }
  });

  $all(".pl-modal .metodo input").forEach((input) =>
    input.addEventListener("change", () =>
      $all(".pl-modal .metodo").forEach((m) => m.classList.toggle("selecionado", m.querySelector("input").checked))
    )
  );
  $("#compra-pagar").addEventListener("click", () => {
    const forma = document.querySelector("input[name='pl-forma']:checked")?.value || "pix";
    if (forma === "pix") pagarPix();
    else pagarCartao(forma);
  });
  $("#cartao-voltar").addEventListener("click", () => {
    formulario?.desmontar();
    formulario = null;
    irParaPagamento();
  });
  $("#compra-sair").addEventListener("click", () => {
    tokenComprador.limpar();
    comprador = null;
    atualizarTopo();
    mostrarPasso("conta");
  });
  $("#pix-copiar").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("#pix-codigo").value);
    } catch {
      $("#pix-codigo").select();
      document.execCommand("copy");
    }
    mostrarToast("Código Pix copiado! Cole no app do banco.", "sucesso");
  });
}

// ---------- início ----------

async function iniciar() {
  iniciarHero();
  ligarBarraCelular();
  ligarCompra();
  if (tokenComprador.obter()) {
    comprador = await lojaApi.me().catch(() => null);
  }
  atualizarTopo();
  try {
    [config, produtos] = await Promise.all([lojaApi.config(), lojaApi.produtos()]);
    if (config.parceiro_nome) $("#hero-parceiro").textContent = config.parceiro_nome;
  } catch (erro) {
    produtos = [];
    console.warn("Loja indisponível:", erro);
  }
  renderizarProdutos();
  // link direto pra uma planilha: ?p=<slug>
  const slug = new URLSearchParams(location.search).get("p");
  const alvo = slug && produtos.find((p) => p.slug === slug);
  if (alvo) abrirCompra(alvo);
}

iniciar();
