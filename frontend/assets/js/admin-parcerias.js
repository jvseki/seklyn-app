// Seklyn — Admin: pedidos de Personais que querem vender planilhas na loja.
import { api } from "./api.js";
import { $, escaparHtml, formatarDataHoraCompleta, mensagemDeErro, mostrarToast } from "./utils.js";

const STATUS = { nova: "Nova", em_contato: "Em contato", aprovada: "Aprovada", recusada: "Recusada" };
const CLASSE = { nova: "badge-aviso", em_contato: "badge-neutro", aprovada: "badge-sucesso", recusada: "badge-perigo" };

const zap = (numero) => {
  let d = String(numero || "").replace(/\D/g, "");
  if (d.length <= 11) d = "55" + d;
  return `https://wa.me/${d}`;
};

async function carregar() {
  const lista = $("#lista-solicitacoes");
  if (!lista) return;
  try {
    const pedidos = await api.solicitacoesParceriaAdmin();
    if (!pedidos.length) {
      lista.innerHTML = `<p class="hint-text">Nenhum pedido ainda.</p>`;
      return;
    }
    lista.innerHTML = pedidos
      .map(
        (p) => `
        <article class="pedido-parceria" data-id="${p.id}">
          <div class="pedido-parceria-topo">
            <div>
              <strong>${escaparHtml(p.personal_nome)}</strong>
              <span class="hint-text">${escaparHtml(p.personal_email)} · ${formatarDataHoraCompleta(p.criado_em)}</span>
            </div>
            <span class="badge ${CLASSE[p.status] || "badge-neutro"}">${STATUS[p.status] || p.status}</span>
          </div>
          <p class="pedido-parceria-info">📱 ${escaparHtml(p.whatsapp)}${p.instagram ? ` · 📸 @${escaparHtml(p.instagram)}` : ""}</p>
          ${p.mensagem ? `<p class="pedido-parceria-msg">“${escaparHtml(p.mensagem)}”</p>` : ""}
          <div class="pedido-parceria-acoes">
            <a class="btn btn-primary btn-sm" href="${zap(p.whatsapp)}" target="_blank" rel="noopener">Chamar no WhatsApp</a>
            <select class="input" data-status="${p.id}" aria-label="Status do pedido">
              ${Object.entries(STATUS).map(([v, t]) => `<option value="${v}" ${v === p.status ? "selected" : ""}>${t}</option>`).join("")}
            </select>
          </div>
        </article>`
      )
      .join("");
  } catch (erro) {
    lista.innerHTML = "";
    mostrarToast(mensagemDeErro(erro), "erro");
  }
}

document.addEventListener("change", async (e) => {
  const sel = e.target.closest("[data-status]");
  if (!sel) return;
  try {
    await api.atualizarSolicitacaoAdmin(Number(sel.dataset.status), { status: sel.value });
    mostrarToast(sel.value === "nova" ? "Status atualizado." : "Status atualizado — o Personal recebeu um e-mail.", "sucesso");
    carregar();
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  }
});

carregar();
