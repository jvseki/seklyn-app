// Seklyn — login e cadastro do Personal.
import { api, salvarToken, limparToken, estaAutenticado } from "./api.js";
import { $, mensagemDeErro } from "./utils.js";
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

    botao.disabled = true;
    try {
      const dados = {
        nome: formulario.nome.value.trim(),
        email: formulario.email.value.trim(),
        senha: formulario.senha.value,
        telefone: formulario.telefone.value.trim() || null,
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
