// Seklyn — API da loja de planilhas (comprador). O login do comprador fica
// numa chave SEPARADA do login do Personal: as duas contas nunca se misturam.
import { API_BASE_URL } from "./api.js";

const CHAVE = "seklyn_comprador_token";
/** Origem do backend (https://api.seklyn.com.br) — pra capas e links de vídeo. */
export const ORIGEM_API = API_BASE_URL.replace(/\/api\/?$/, "");

export const tokenComprador = {
  obter() {
    try {
      return localStorage.getItem(CHAVE);
    } catch {
      return null;
    }
  },
  salvar(token) {
    try {
      localStorage.setItem(CHAVE, token);
    } catch {
      /* modo privado: segue logado só nesta aba */
    }
  },
  limpar() {
    try {
      localStorage.removeItem(CHAVE);
    } catch {
      /* nada */
    }
  },
};

async function chamar(caminho, opcoes = {}) {
  const headers = { "Content-Type": "application/json", ...(opcoes.headers || {}) };
  const token = tokenComprador.obter();
  if (token) headers.Authorization = `Bearer ${token}`;
  let resposta;
  try {
    resposta = await fetch(`${API_BASE_URL}${caminho}`, { cache: "no-store", ...opcoes, headers });
  } catch {
    throw new Error("Sem conexão com o servidor. Confira sua internet e tente de novo.");
  }
  if (resposta.status === 204) return null;
  let corpo = null;
  try {
    corpo = await resposta.json();
  } catch {
    corpo = null;
  }
  if (!resposta.ok) {
    if (resposta.status === 401) tokenComprador.limpar();
    const detalhe = corpo?.detail;
    const erro = new Error(
      Array.isArray(detalhe) ? [...new Set(detalhe.map((d) => d.msg))].join(", ") : detalhe || "Algo deu errado. Tente de novo."
    );
    erro.status = resposta.status;
    throw erro;
  }
  return corpo;
}

const json = (corpo) => ({ method: "POST", body: JSON.stringify(corpo) });

export const lojaApi = {
  config: () => chamar("/loja/config"),
  produtos: () => chamar("/loja/produtos"),
  produto: (slug) => chamar(`/loja/produtos/${encodeURIComponent(slug)}`),
  registrar: (dados) => chamar("/loja/conta/registrar", json(dados)),
  login: (email, senha) => chamar("/loja/conta/login", json({ email, senha })),
  me: () => chamar("/loja/conta/me"),
  compras: () => chamar("/loja/conta/compras"),
  comprarPix: (produtoId) => chamar(`/loja/conta/comprar/${produtoId}/pix`, { method: "POST" }),
  comprarCartao: (produtoId, dados) => chamar(`/loja/conta/comprar/${produtoId}/cartao`, json(dados)),
  statusCompra: (vendaId) => chamar(`/loja/conta/vendas/${vendaId}`),
  conteudos: (produtoId) => chamar(`/loja/conta/produtos/${produtoId}/conteudos`),
};

export const urlCompleta = (caminho) => (!caminho ? "" : /^https?:/.test(caminho) ? caminho : `${ORIGEM_API}${caminho}`);
