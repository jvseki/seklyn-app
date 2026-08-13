// Seklyn — aplica o tema visual exclusivo de um Personal (ex: "rosa"),
// tanto no painel dele quanto na área dos alunos (via personal_tema vindo
// da API), mantendo a identidade visual consistente ponta a ponta.
export function aplicarTemaPersonalizado(temaPersonalizado) {
  if (!temaPersonalizado) {
    delete document.documentElement.dataset.temaPersonalizado;
    return;
  }

  document.documentElement.dataset.temaPersonalizado = temaPersonalizado;
  adicionarBlobsDecorativos();
}

function adicionarBlobsDecorativos() {
  const alvo = document.querySelector(".sidebar") || document.querySelector(".app-aluno");
  if (!alvo || alvo.querySelector(".blobs-fundo")) return;

  const container = document.createElement("div");
  container.className = "blobs-fundo";
  container.innerHTML = `
    <div class="blob blob-1" style="top:-70px;left:-70px;width:220px;height:220px;"></div>
    <div class="blob blob-2" style="bottom:-90px;right:-70px;width:240px;height:240px;animation-delay:-7s;"></div>
    <div class="blob blob-3" style="top:40%;left:60%;width:160px;height:160px;animation-delay:-14s;"></div>
  `;
  alvo.insertBefore(container, alvo.firstChild);
}
