// Seklyn — "Novidades": telas explicando uma função nova, que aparecem UMA vez
// por conta (o servidor guarda a última novidade vista em personal.novidade_vista).
// Novidade 1: vender planilhas de treino na loja do Seklyn → pedido de parceria.
import { api } from "./api.js";
import { $, escaparHtml, mensagemDeErro, mostrarToast } from "./utils.js";

const NOVIDADE_ATUAL = 1;

const TELAS = [
  {
    arte: `<div class="nv-arte nv-arte-loja"><span>🏋️</span><b>Planilha Hipertrofia</b><i>R$ 97,00</i></div>`,
    selo: "Novidade",
    titulo: "Venda suas planilhas de treino no Seklyn",
    texto: "Agora o Seklyn tem uma loja de planilhas: seus treinos viram um produto que qualquer pessoa compra pelo celular, com vídeo de cada exercício.",
  },
  {
    arte: `<div class="nv-arte nv-arte-passos"><span>1 · Escolhe</span><span>2 · Paga</span><span>3 · Treina</span></div>`,
    selo: "Pro seu aluno",
    titulo: "Compra em 1 minuto",
    texto: "O aluno escolhe a planilha, cria a conta e paga no Pix, crédito ou débito. Na hora já assiste os vídeos e baixa a planilha em “Minhas planilhas”.",
  },
  {
    arte: `<div class="nv-arte nv-arte-divisao"><div><b>Você</b><i>sua parte</i></div><div><b>Seklyn</b><i>plataforma</i></div></div>`,
    selo: "Pra você",
    titulo: "Cada venda, uma parte é sua",
    texto: "O pagamento é processado pelo Mercado Pago e o valor de cada venda é dividido entre você e o Seklyn — a porcentagem a gente combina com você.",
  },
  {
    arte: `<div class="nv-arte nv-arte-video"><span>▶</span><i>Grava os vídeos · a gente monta a página</i></div>`,
    selo: "Como começar",
    titulo: "Quer vender as suas?",
    texto: "Mande seu contato: a gente te chama no WhatsApp pra combinar as planilhas, o preço e a divisão. Você grava os vídeos, a gente cuida da loja.",
    formulario: true,
  },
];

let indice = 0;
let jaMarcou = false;

function marcarVista() {
  if (jaMarcou) return;
  jaMarcou = true;
  api.marcarNovidadeVista(NOVIDADE_ATUAL).catch(() => {});
}

function fechar() {
  marcarVista();
  document.querySelector(".nv-fundo")?.remove();
  document.body.style.overflow = "";
}

function formularioHtml() {
  return `
    <form class="nv-form" id="nv-form" novalidate>
      <label class="label" for="nv-whats">WhatsApp (com DDD)</label>
      <input class="input" id="nv-whats" type="tel" inputmode="tel" placeholder="(18) 99999-9999" maxlength="30" required />
      <label class="label" for="nv-insta">Instagram (opcional)</label>
      <input class="input" id="nv-insta" placeholder="@seuperfil" maxlength="80" />
      <label class="label" for="nv-msg">O que você quer vender? (opcional)</label>
      <textarea class="input" id="nv-msg" rows="2" maxlength="2000" placeholder="Ex: planilha de hipertrofia pra iniciantes, treino em casa…"></textarea>
      <button class="btn btn-primary btn-block" type="submit">Quero vender minhas planilhas</button>
    </form>`;
}

function renderizar() {
  const t = TELAS[indice];
  const caixa = document.querySelector(".nv-caixa");
  caixa.innerHTML = `
    <button class="nv-fechar" type="button" aria-label="Fechar">×</button>
    ${t.arte}
    <span class="nv-selo">${escaparHtml(t.selo)}</span>
    <h2 id="nv-titulo">${escaparHtml(t.titulo)}</h2>
    <p>${escaparHtml(t.texto)}</p>
    ${t.formulario ? formularioHtml() : ""}
    <div class="nv-rodape">
      <div class="nv-pontos">${TELAS.map((_, i) => `<span class="${i === indice ? "ativo" : ""}"></span>`).join("")}</div>
      <div class="nv-botoes">
        ${indice > 0 ? `<button class="btn btn-ghost btn-sm" type="button" data-nv="voltar">Voltar</button>` : `<button class="btn btn-ghost btn-sm" type="button" data-nv="depois">Agora não</button>`}
        ${indice < TELAS.length - 1 ? `<button class="btn btn-primary btn-sm" type="button" data-nv="proximo">Próximo</button>` : `<button class="btn btn-ghost btn-sm" type="button" data-nv="depois">Fechar</button>`}
      </div>
    </div>`;
  caixa.querySelector(".nv-fechar").addEventListener("click", fechar);
  caixa.querySelectorAll("[data-nv]").forEach((b) =>
    b.addEventListener("click", () => {
      const acao = b.dataset.nv;
      if (acao === "proximo") indice = Math.min(indice + 1, TELAS.length - 1);
      if (acao === "voltar") indice = Math.max(indice - 1, 0);
      if (acao === "depois") return fechar();
      renderizar();
    })
  );
  caixa.querySelector("#nv-form")?.addEventListener("submit", enviarPedido);
}

async function enviarPedido(evento) {
  evento.preventDefault();
  const whatsapp = $("#nv-whats").value.trim();
  if (whatsapp.replace(/\D/g, "").length < 10) return mostrarToast("Coloque o WhatsApp com DDD.", "erro");
  const botao = evento.submitter;
  if (botao) botao.disabled = true;
  try {
    await api.solicitarParceria({ whatsapp, instagram: $("#nv-insta").value.trim() || null, mensagem: $("#nv-msg").value.trim() || null });
    fechar();
    mostrarToast("Pedido enviado! Logo te chamamos no WhatsApp.", "sucesso");
    montarCartaoParceria();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
    if (erro.status === 409) fechar();
  } finally {
    if (botao) botao.disabled = false;
  }
}

/** Abre as telas (também usado pelo cartão do painel). */
export function abrirNovidades(irParaFormulario = false) {
  document.querySelector(".nv-fundo")?.remove();
  indice = irParaFormulario ? TELAS.length - 1 : 0;
  const fundo = document.createElement("div");
  fundo.className = "nv-fundo";
  fundo.innerHTML = `<div class="nv-caixa" role="dialog" aria-modal="true" aria-labelledby="nv-titulo"></div>`;
  fundo.addEventListener("click", (e) => e.target === fundo && fechar());
  document.body.appendChild(fundo);
  document.body.style.overflow = "hidden";
  renderizar();
}

/** Cartão fixo no painel: chama pra vender ou mostra o status do pedido. */
export async function montarCartaoParceria() {
  const alvo = document.querySelector("#cartao-parceria");
  if (!alvo) return;
  let pedido = null;
  try {
    pedido = await api.minhaSolicitacaoParceria();
  } catch {
    /* sem pedido */
  }
  const STATUS = {
    nova: "Pedido enviado — logo te chamamos no WhatsApp.",
    em_contato: "Estamos conversando com você pelo WhatsApp.",
    aprovada: "Parceria aprovada! Bora cadastrar suas planilhas.",
    recusada: "Por enquanto não seguimos com a parceria.",
  };
  alvo.hidden = false;
  alvo.innerHTML = `
    <div class="cartao-parceria-icone" aria-hidden="true">💸</div>
    <div class="cartao-parceria-texto">
      <strong>Ganhe dinheiro vendendo suas planilhas</strong>
      <span>${pedido ? escaparHtml(STATUS[pedido.status] || "") : "Seus treinos viram produto na loja do Seklyn — cada venda, uma parte é sua."}</span>
    </div>
    ${pedido ? `<a class="btn btn-ghost btn-sm" href="/planilha-de-treino/" target="_blank" rel="noopener">Ver a loja</a>` : `<button class="btn btn-primary btn-sm" type="button" id="cartao-parceria-botao">Quero vender</button>`}`;
  alvo.querySelector("#cartao-parceria-botao")?.addEventListener("click", () => abrirNovidades(false));
}

/** Chamado em toda página do Personal: mostra as telas uma vez por conta. */
export function mostrarNovidades(personal) {
  montarCartaoParceria();
  if (!personal || (personal.novidade_vista || 0) >= NOVIDADE_ATUAL) return;
  setTimeout(() => abrirNovidades(false), 900);
}
