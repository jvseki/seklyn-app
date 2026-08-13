// Seklyn — alternância de tema claro/escuro, compartilhada por TODAS as páginas
// (não só a área do aluno). A escolha fica salva em localStorage e é aplicada
// antes da renderização por um script inline no <head> de cada página
// (evita o "flash" do tema errado).
const CHAVE_TEMA = "pv_tema";

export function temaAtual() {
  return document.documentElement.dataset.theme === "escuro" ? "escuro" : "claro";
}

const ICONE_SOL =
  '<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM15.657 14.596l-1.06-1.06a.75.75 0 10-1.061 1.06l1.06 1.06a.75.75 0 001.06-1.06zM6.464 5.404l-1.06-1.06a.75.75 0 10-1.06 1.06l1.06 1.06a.75.75 0 101.06-1.06z"/></svg>';
const ICONE_LUA =
  '<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>';

function atualizarBotoes(tema) {
  document.querySelectorAll("[data-acao='alternar-tema']").forEach((botao) => {
    botao.innerHTML = tema === "escuro" ? ICONE_SOL : ICONE_LUA;
    botao.setAttribute("aria-label", tema === "escuro" ? "Ativar modo claro" : "Ativar modo escuro");
  });
}

export function aplicarTema(tema) {
  if (tema === "escuro") {
    document.documentElement.dataset.theme = "escuro";
  } else {
    delete document.documentElement.dataset.theme;
  }
  localStorage.setItem(CHAVE_TEMA, tema);
  atualizarBotoes(tema);
}

function iniciar() {
  atualizarBotoes(temaAtual());
  document.querySelectorAll("[data-acao='alternar-tema']").forEach((botao) => {
    botao.addEventListener("click", () => {
      aplicarTema(temaAtual() === "escuro" ? "claro" : "escuro");
    });
  });
}

iniciar();
