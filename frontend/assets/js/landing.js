// Seklyn — landing page: se o Personal já tem sessão salva, troca
// "Entrar"/"Criar conta grátis" por "Olá, Nome" + "Ir para o painel",
// em vez de sempre parecer deslogado só por estar na home.
import { api, estaAutenticado } from "./api.js";
import { $ } from "./utils.js";

async function refletirLoginNaNav() {
  if (!estaAutenticado()) return; // já mostra o estado padrão (não logado)

  try {
    const personal = await api.me();
    const naoLogado = $("#landing-nao-logado");
    const logado = $("#landing-logado");
    const nomeEl = $("#landing-nome-personal");
    if (!naoLogado || !logado || !nomeEl) return;

    nomeEl.textContent = `Olá, ${personal.nome.split(" ")[0]}!`;
    naoLogado.hidden = true;
    logado.hidden = false;
  } catch {
    // token expirado/inválido — mantém o estado padrão (não logado)
  }
}

refletirLoginNaNav();
