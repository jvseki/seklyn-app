// Seklyn — menu de conta do Personal: nome + dropdown (editar dados,
// trocar senha, sair) injetado no rodapé da sidebar de todas as páginas
// internas. Chamado por protegerPagina() em auth.js depois de buscar /me,
// pra não precisar duplicar HTML/JS em cada uma das telas.
import { api, limparToken } from "./api.js";
import { $, escaparHtml, mensagemDeErro, mostrarToast, abrirModal, fecharModal } from "./utils.js";
import { confirmarAcao } from "./confirmar.js";
import { icone } from "./icones.js";

let personalAtual = null;

function sair() {
  limparToken();
  window.location.href = "login.html";
}

function iniciais(nome) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function garantirModais() {
  if ($("#modal-editar-conta")) return;

  const modalEditar = document.createElement("div");
  modalEditar.className = "modal-fundo";
  modalEditar.id = "modal-editar-conta";
  modalEditar.hidden = true;
  modalEditar.innerHTML = `
    <div class="modal">
      <div class="modal-cabecalho">
        <h3>Editar meus dados</h3>
        <button class="btn btn-ghost btn-icon" data-acao="fechar-editar-conta">${icone("fechar", 16)}</button>
      </div>
      <form id="form-editar-conta">
        <div class="form-group">
          <label class="label" for="editar-conta-nome">Nome</label>
          <input class="input" id="editar-conta-nome" name="nome" required />
        </div>
        <div class="form-group">
          <label class="label" for="editar-conta-telefone">Telefone/WhatsApp (opcional)</label>
          <input class="input" id="editar-conta-telefone" name="telefone" type="tel" placeholder="(18) 99999-0000" />
        </div>
        <div class="form-group">
          <label class="label" for="editar-conta-cpf">CPF (opcional)</label>
          <input class="input" id="editar-conta-cpf" name="cpf" placeholder="000.000.000-00" />
          <div id="editar-conta-cpf-bloco-fixo" hidden style="display:flex;gap:var(--espaco-2);align-items:center;">
            <p class="input" id="editar-conta-cpf-fixo" style="flex:1;background:var(--cor-superficie);color:var(--cor-texto-muted);margin:0;"></p>
            <button type="button" class="btn btn-ghost btn-sm" data-acao="desbloquear-cpf-conta">${icone("editar", 14)} Corrigir</button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:2;">
            <label class="label" for="editar-conta-endereco">Endereço (opcional)</label>
            <input class="input" id="editar-conta-endereco" name="endereco" placeholder="Rua, bairro..." />
          </div>
          <div class="form-group" style="flex:1;">
            <label class="label" for="editar-conta-numero">Número</label>
            <input class="input" id="editar-conta-numero" name="numero" placeholder="Ex: 123" />
          </div>
        </div>
        <div class="modal-acoes">
          <button type="button" class="btn btn-ghost" data-acao="fechar-editar-conta">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modalEditar);

  const modalSenha = document.createElement("div");
  modalSenha.className = "modal-fundo";
  modalSenha.id = "modal-trocar-senha";
  modalSenha.hidden = true;
  modalSenha.innerHTML = `
    <div class="modal">
      <div class="modal-cabecalho">
        <h3>Alterar senha</h3>
        <button class="btn btn-ghost btn-icon" data-acao="fechar-trocar-senha">${icone("fechar", 16)}</button>
      </div>
      <form id="form-trocar-senha">
        <div class="form-group">
          <label class="label" for="senha-atual">Senha atual</label>
          <input class="input" id="senha-atual" name="senha_atual" type="password" required />
        </div>
        <div class="form-group">
          <label class="label" for="senha-nova">Nova senha (mínimo 8 caracteres)</label>
          <input class="input" id="senha-nova" name="senha_nova" type="password" minlength="8" required />
        </div>
        <div class="form-group">
          <label class="label" for="senha-nova-confirmar">Confirmar nova senha</label>
          <input class="input" id="senha-nova-confirmar" name="senha_nova_confirmar" type="password" minlength="8" required />
        </div>
        <div class="modal-acoes">
          <button type="button" class="btn btn-ghost" data-acao="fechar-trocar-senha">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar nova senha</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modalSenha);

  document
    .querySelectorAll("[data-acao='fechar-editar-conta']")
    .forEach((el) => el.addEventListener("click", () => fecharModal(modalEditar)));
  document
    .querySelectorAll("[data-acao='fechar-trocar-senha']")
    .forEach((el) => el.addEventListener("click", () => fecharModal(modalSenha)));

  $("[data-acao='desbloquear-cpf-conta']").addEventListener("click", async () => {
    const confirmou = await confirmarAcao("Tem certeza que quer corrigir o CPF? Só mude se foi cadastrado errado.", {
      titulo: "Corrigir CPF",
      textoConfirmar: "Sim, corrigir",
      perigo: false,
    });
    if (!confirmou) return;
    $("#editar-conta-cpf-bloco-fixo").hidden = true;
    const cpfInputEl = $("#editar-conta-cpf");
    cpfInputEl.hidden = false;
    cpfInputEl.value = personalAtual?.cpf || "";
    cpfInputEl.focus();
  });

  $("#form-editar-conta").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const form = evento.target;
    const botao = $("button[type='submit']", form);
    botao.disabled = true;
    try {
      const dados = {
        nome: form.nome.value.trim(),
        telefone: form.telefone.value.trim() || null,
        endereco: form.endereco.value.trim() || null,
        numero: form.numero.value.trim() || null,
      };
      if (!$("#editar-conta-cpf").hidden) {
        dados.cpf = form.cpf.value.trim() || null;
      }
      const personal = await api.atualizarMeusDados(dados);
      personalAtual = personal;
      atualizarNomeExibido(personal.nome);
      mostrarToast("Dados atualizados!", "sucesso");
      fecharModal(modalEditar);
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    } finally {
      botao.disabled = false;
    }
  });

  $("#form-trocar-senha").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const form = evento.target;
    if (form.senha_nova.value !== form.senha_nova_confirmar.value) {
      mostrarToast("As senhas novas não coincidem.", "erro");
      return;
    }
    const botao = $("button[type='submit']", form);
    botao.disabled = true;
    try {
      await api.trocarSenha({ senha_atual: form.senha_atual.value, senha_nova: form.senha_nova.value });
      mostrarToast("Senha alterada!", "sucesso");
      form.reset();
      fecharModal(modalSenha);
    } catch (erro) {
      mostrarToast(mensagemDeErro(erro), "erro");
    } finally {
      botao.disabled = false;
    }
  });
}

function atualizarNomeExibido(nome) {
  const nomeEl = $("#conta-menu-nome");
  const avatarEl = $("#conta-menu-avatar");
  if (nomeEl) nomeEl.textContent = nome.split(" ")[0];
  if (avatarEl) avatarEl.textContent = iniciais(nome);
}

export function montarMenuConta(personal) {
  personalAtual = personal;
  const rodape = $(".sidebar-rodape");
  if (!rodape || $(".conta-menu", rodape)) return; // já montado (ou página sem sidebar)

  // O botão "Sair" avulso fica redundante — a opção some pra dentro do dropdown.
  const botaoSairAntigo = $("[data-acao='sair']", rodape);
  if (botaoSairAntigo) botaoSairAntigo.remove();

  const contaMenu = document.createElement("div");
  contaMenu.className = "conta-menu";
  contaMenu.innerHTML = `
    <button class="conta-menu-gatilho" type="button" data-acao="abrir-menu-conta">
      <span class="avatar avatar-pequeno" id="conta-menu-avatar">${escaparHtml(iniciais(personal.nome))}</span>
      <span class="conta-menu-nome" id="conta-menu-nome">${escaparHtml(personal.nome.split(" ")[0])}</span>
      <span class="conta-menu-seta">▾</span>
    </button>
    <div class="conta-menu-dropdown" id="conta-menu-dropdown" hidden>
      <button type="button" data-acao="abrir-editar-conta">${icone("editar", 16)} Editar meus dados</button>
      <button type="button" data-acao="abrir-trocar-senha">${icone("cadeado", 16)} Alterar senha</button>
      <a href="assinatura.html">${icone("cartao", 16)} Assinatura</a>
      <hr />
      <button type="button" data-acao="sair-menu-conta">${icone("sair", 16)} Sair</button>
    </div>
  `;
  rodape.insertBefore(contaMenu, rodape.firstChild);

  garantirModais();

  const dropdown = $("#conta-menu-dropdown", contaMenu);
  $("[data-acao='abrir-menu-conta']", contaMenu).addEventListener("click", (evento) => {
    evento.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
  });
  document.addEventListener("click", () => {
    dropdown.hidden = true;
  });
  dropdown.addEventListener("click", (evento) => evento.stopPropagation());

  $("[data-acao='abrir-editar-conta']", contaMenu).addEventListener("click", () => {
    dropdown.hidden = true;
    const form = $("#form-editar-conta");
    form.nome.value = personalAtual.nome;
    form.telefone.value = personalAtual.telefone || "";
    form.endereco.value = personalAtual.endereco || "";
    form.numero.value = personalAtual.numero || "";

    const cpfInputEl = $("#editar-conta-cpf");
    const blocoFixoEl = $("#editar-conta-cpf-bloco-fixo");
    if (personalAtual.cpf) {
      cpfInputEl.hidden = true;
      blocoFixoEl.hidden = false;
      $("#editar-conta-cpf-fixo").textContent = personalAtual.cpf;
    } else {
      cpfInputEl.hidden = false;
      cpfInputEl.value = "";
      blocoFixoEl.hidden = true;
    }

    abrirModal($("#modal-editar-conta"));
  });

  $("[data-acao='abrir-trocar-senha']", contaMenu).addEventListener("click", () => {
    dropdown.hidden = true;
    $("#form-trocar-senha").reset();
    abrirModal($("#modal-trocar-senha"));
  });

  $("[data-acao='sair-menu-conta']", contaMenu).addEventListener("click", sair);
}
