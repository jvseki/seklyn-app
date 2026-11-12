// Seklyn — login e cadastro do Personal.
import { api, salvarToken, limparToken, estaAutenticado } from "./api.js";
import { $, cpfValido, escaparHtml, formatarDataHora, mensagemDeErro } from "./utils.js";
import { aplicarTemaPersonalizado } from "./tema-personalizado.js";
import { montarMenuConta } from "./conta-menu.js";

/**
 * Usado no topo das páginas protegidas do Personal: redireciona pro login se
 * necessário, aplica o tema visual exclusivo da conta (se houver) e monta o
 * menu de conta (nome + editar dados/senha/sair) na sidebar.
 */
export function protegerPagina() {
  if (!estaAutenticado()) {
    window.location.href = "login.html";
    return;
  }
  api
    .me()
    .then((personal) => {
      aplicarTemaPersonalizado(personal.tema_personalizado);
      montarMenuConta(personal);
      if (personal.is_admin) {
        document.querySelectorAll("[data-admin-only]").forEach((el) => (el.hidden = false));
      }
    })
    .catch(() => {});
  mostrarAvisoVencimento();
}

/**
 * Aviso GRANDE no topo de todas as telas do Personal quando a assinatura
 * paga por Pix/débito (que não renovam sozinhos) está perto de vencer ou já
 * venceu. Some sozinho quando o próximo mês é pago.
 */
async function mostrarAvisoVencimento() {
  const principal = document.querySelector(".conteudo-personal");
  if (!principal || document.querySelector(".aviso-vencimento")) return;
  let a;
  try {
    a = await api.statusAssinatura();
  } catch {
    return;
  }
  const venceu = a.status === "vencida";
  if (!a.alerta_vencimento && !venceu) return;
  const fim = formatarDataHora(a.current_period_end);
  const dias = a.dias_para_vencer;
  const titulo = venceu
    ? `Sua assinatura venceu em ${fim}`
    : dias === 0
      ? "Sua assinatura vence HOJE"
      : `Sua assinatura vence em ${dias} dia${dias === 1 ? "" : "s"} (${fim})`;
  const texto = venceu
    ? "Criar e editar treinos está bloqueado até você pagar. Seus alunos e treinos continuam salvos."
    : "Pix e débito não renovam sozinhos. Pague o próximo mês pra não perder o acesso — pagando antes, você não perde nenhum dia.";
  const naPaginaDeAssinatura = /assinatura\.html$/.test(window.location.pathname);
  const aviso = document.createElement("div");
  aviso.className = `aviso-vencimento${venceu || dias <= 1 ? " urgente" : ""}`;
  aviso.setAttribute("role", "alert");
  aviso.innerHTML = `
    <div class="aviso-vencimento-icone" aria-hidden="true">!</div>
    <div class="aviso-vencimento-texto">
      <strong>${escaparHtml(titulo)}</strong>
      <p>${escaparHtml(texto)}</p>
    </div>
    ${naPaginaDeAssinatura ? "" : '<a class="btn aviso-vencimento-botao" href="assinatura.html">Pagar agora</a>'}
  `;
  principal.prepend(aviso);
  // O aviso genérico do painel ("assinatura não está ativa") ficaria repetido.
  if (venceu) {
    const generico = document.querySelector("#banner-assinatura");
    if (generico) {
      generico.hidden = true;
      generico.dataset.substituido = "1";
      new MutationObserver(() => {
        if (!generico.hidden) generico.hidden = true;
      }).observe(generico, { attributes: true, attributeFilter: ["hidden"] });
    }
  }
}

export function sair() {
  limparToken();
  window.location.href = "login.html";
}

function ligarBotaoSair() {
  const botao = $("[data-acao='sair']");
  if (botao) botao.addEventListener("click", sair);
}

function exibirErroFormulario(formulario, mensagem) {
  const alerta = $(".form-erro", formulario);
  if (alerta) {
    alerta.textContent = mensagem;
    alerta.hidden = false;
  }
}

function iniciarFormularioLogin() {
  const formulario = $("#form-login");
  if (!formulario) return;

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const botao = $("button[type='submit']", formulario);
    const alerta = $(".form-erro", formulario);
    if (alerta) alerta.hidden = true;
    botao.disabled = true;

    try {
      const dados = {
        email: formulario.email.value.trim(),
        senha: formulario.senha.value,
      };
      const resultado = await api.login(dados);
      salvarToken(resultado.access_token);
      window.location.href = "dashboard.html";
    } catch (erro) {
      exibirErroFormulario(formulario, mensagemDeErro(erro));
    } finally {
      botao.disabled = false;
    }
  });
}

function iniciarFormularioCadastro() {
  const formulario = $("#form-cadastro");
  if (!formulario) return;

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const botao = $("button[type='submit']", formulario);
    const alerta = $(".form-erro", formulario);
    if (alerta) alerta.hidden = true;

    if (formulario.senha.value.length < 8) {
      exibirErroFormulario(formulario, "A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (formulario.confirmar_senha.value !== formulario.senha.value) {
      exibirErroFormulario(formulario, "As senhas não coincidem.");
      return;
    }

    if (!cpfValido(formulario.cpf.value)) {
      exibirErroFormulario(formulario, "CPF inválido. Confira os números.");
      formulario.cpf.focus();
      return;
    }

    botao.disabled = true;
    try {
      const dados = {
        nome: formulario.nome.value.trim(),
        email: formulario.email.value.trim(),
        senha: formulario.senha.value,
        telefone: formulario.telefone.value.trim() || null,
        cpf: formulario.cpf.value.trim(),
      };
      const resultado = await api.registrar(dados);
      salvarToken(resultado.access_token);
      window.location.href = "assinatura.html?boas-vindas=1";
    } catch (erro) {
      exibirErroFormulario(formulario, mensagemDeErro(erro));
    } finally {
      botao.disabled = false;
    }
  });
}

iniciarFormularioLogin();
iniciarFormularioCadastro();
ligarBotaoSair();
