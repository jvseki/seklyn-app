// Seklyn — confirmação de e-mail do Personal (link recebido por e-mail).
import { api } from "./api.js";
import { $ } from "./utils.js";

const parametros = new URLSearchParams(window.location.search);
const token = parametros.get("token");

const els = {
  carregando: $("#estado-carregando"),
  sucesso: $("#estado-sucesso"),
  erro: $("#estado-erro"),
};

async function confirmar() {
  if (!token) {
    els.carregando.hidden = true;
    els.erro.hidden = false;
    return;
  }
  try {
    await api.confirmarEmail(token);
    els.carregando.hidden = true;
    els.sucesso.hidden = false;
  } catch {
    els.carregando.hidden = true;
    els.erro.hidden = false;
  }
}

confirmar();
