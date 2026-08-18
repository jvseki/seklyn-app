// Seklyn — assistente virtual (mentor de uso do site), só no painel do
// Personal. Widget flutuante que injeta o próprio HTML — só precisa
// incluir este script na página, sem duplicar markup em cada tela.
import { api } from "./api.js";
import { icone } from "./icones.js";

const MASCOTE_SRC = "../assets/img/mascote.png";

let historico = [];
let carregando = false;

function montarWidget() {
  if (document.querySelector("#assistente-widget")) return;

  const container = document.createElement("div");
  container.id = "assistente-widget";
  container.innerHTML = `
    <button class="assistente-botao" type="button" aria-label="Abrir o Kyn, assistente virtual do Seklyn">
      <img src="${MASCOTE_SRC}" alt="" class="assistente-mascote" />
    </button>
    <div class="assistente-painel" hidden>
      <div class="assistente-cabecalho">
        <img src="${MASCOTE_SRC}" alt="" class="assistente-mascote assistente-mascote-cabecalho" />
        <strong>Kyn — mentor Seklyn</strong>
        <button class="btn btn-ghost btn-icon" type="button" data-acao="fechar-assistente" aria-label="Fechar" style="margin-left:auto;">${icone("fechar", 16)}</button>
      </div>
      <div class="assistente-mensagens" id="assistente-mensagens">
        <div class="assistente-msg assistente-msg-bot">Oi! Sou o Kyn, o mentor do Seklyn. Posso te ajudar a entender como usar o site — cadastrar aluno, montar treino, ver aderência, assinatura, etc. O que você quer saber?</div>
      </div>
      <form class="assistente-form" id="assistente-form">
        <input class="input" type="text" placeholder="Digite sua dúvida..." maxlength="500" required />
        <button class="btn btn-primary btn-icon" type="submit" aria-label="Enviar">${icone("enviar", 16)}</button>
      </form>
    </div>
  `;
  document.body.appendChild(container);

  const botao = container.querySelector(".assistente-botao");
  const painel = container.querySelector(".assistente-painel");
  const fechar = container.querySelector("[data-acao='fechar-assistente']");
  const form = container.querySelector("#assistente-form");
  const input = form.querySelector("input");
  const mensagensEl = container.querySelector("#assistente-mensagens");

  botao.addEventListener("click", () => {
    painel.hidden = !painel.hidden;
    if (!painel.hidden) input.focus();
  });
  fechar.addEventListener("click", () => {
    painel.hidden = true;
  });

  function adicionarMensagem(role, texto) {
    const div = document.createElement("div");
    div.className = `assistente-msg assistente-msg-${role === "user" ? "user" : "bot"}`;
    div.textContent = texto;
    mensagensEl.appendChild(div);
    mensagensEl.scrollTop = mensagensEl.scrollHeight;
    return div;
  }

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const texto = input.value.trim();
    if (!texto || carregando) return;
    input.value = "";
    adicionarMensagem("user", texto);
    historico.push({ role: "user", texto });

    carregando = true;
    const bolhaResposta = adicionarMensagem("model", "…");
    try {
      const { resposta } = await api.perguntarAssistente(texto, historico);
      bolhaResposta.textContent = resposta;
      historico.push({ role: "model", texto: resposta });
    } catch {
      bolhaResposta.textContent = "Não consegui responder agora. Tente de novo em instantes.";
    } finally {
      carregando = false;
      mensagensEl.scrollTop = mensagensEl.scrollHeight;
    }
  });
}

montarWidget();
