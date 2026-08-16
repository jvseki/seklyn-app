// Seklyn — cliente da API (fetch wrapper + armazenamento do JWT).
//
// Em produção, troque API_BASE_URL pela URL pública do backend
// (ex: https://api.seklyn.com.br/api).

export const API_BASE_URL = window.PV_API_BASE_URL || "http://localhost:8000/api";

const CHAVE_TOKEN = "pv_token";

export function obterToken() {
  return localStorage.getItem(CHAVE_TOKEN);
}

export function salvarToken(token) {
  localStorage.setItem(CHAVE_TOKEN, token);
}

export function limparToken() {
  localStorage.removeItem(CHAVE_TOKEN);
}

export function estaAutenticado() {
  return Boolean(obterToken());
}

async function apiFetch(caminho, opcoes = {}) {
  const token = obterToken();
  const headers = { "Content-Type": "application/json", ...(opcoes.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  let resposta;
  try {
    resposta = await fetch(`${API_BASE_URL}${caminho}`, { cache: "no-store", ...opcoes, headers });
  } catch {
    throw new Error("Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.");
  }

  if (resposta.status === 204) return null;

  let corpo = null;
  try {
    corpo = await resposta.json();
  } catch {
    corpo = null;
  }

  if (!resposta.ok) {
    if (resposta.status === 401) limparToken();
    const detalhe = corpo?.detail;
    const mensagem = Array.isArray(detalhe)
      ? [...new Set(detalhe.map((d) => d.msg))].join(", ") // dedupe: mesmo erro em várias séries não vira parede de texto repetida
      : detalhe || "Ocorreu um erro. Tente novamente.";
    const erro = new Error(mensagem);
    erro.status = resposta.status;
    erro.corpo = corpo;
    throw erro;
  }

  return corpo;
}

export const api = {
  // --- Autenticação do Personal ---
  registrar: (dados) => apiFetch("/auth/personal/registrar", { method: "POST", body: JSON.stringify(dados) }),
  login: (dados) => apiFetch("/auth/personal/login", { method: "POST", body: JSON.stringify(dados) }),
  me: () => apiFetch("/auth/personal/me"),
  confirmarEmail: (token) => apiFetch("/auth/personal/confirmar-email", { method: "POST", body: JSON.stringify({ token }) }),
  reenviarConfirmacao: () => apiFetch("/auth/personal/reenviar-confirmacao", { method: "POST" }),
  atualizarMeusDados: (dados) => apiFetch("/auth/personal/me", { method: "PUT", body: JSON.stringify(dados) }),
  trocarSenha: (dados) => apiFetch("/auth/personal/trocar-senha", { method: "POST", body: JSON.stringify(dados) }),

  // --- Alunos ---
  listarAlunos: () => apiFetch("/personal/alunos"),
  criarAluno: (dados) => apiFetch("/personal/alunos", { method: "POST", body: JSON.stringify(dados) }),
  obterAluno: (id) => apiFetch(`/personal/alunos/${id}`),
  atualizarAluno: (id, dados) => apiFetch(`/personal/alunos/${id}`, { method: "PUT", body: JSON.stringify(dados) }),
  excluirAluno: (id) => apiFetch(`/personal/alunos/${id}`, { method: "DELETE" }),
  regenerarLinkAluno: (id) => apiFetch(`/personal/alunos/${id}/regenerar-link`, { method: "POST" }),
  analyticsAluno: (id, periodoDias = 30) =>
    apiFetch(`/personal/alunos/${id}/analytics?periodo_dias=${periodoDias}`),
  analyticsDetalhadoAluno: (id, periodoDias = 30) =>
    apiFetch(`/personal/alunos/${id}/analytics-detalhado?periodo_dias=${periodoDias}`),

  // --- Avaliações físicas (peso ao longo do tempo) ---
  listarAvaliacoes: (alunoId) => apiFetch(`/personal/alunos/${alunoId}/avaliacoes`),
  criarAvaliacao: (alunoId, dados) =>
    apiFetch(`/personal/alunos/${alunoId}/avaliacoes`, { method: "POST", body: JSON.stringify(dados) }),
  excluirAvaliacao: (id) => apiFetch(`/personal/avaliacoes/${id}`, { method: "DELETE" }),

  // --- Treinos ---
  listarTreinos: (alunoId) => apiFetch(`/personal/alunos/${alunoId}/treinos`),
  criarTreino: (alunoId, dados) =>
    apiFetch(`/personal/alunos/${alunoId}/treinos`, { method: "POST", body: JSON.stringify(dados) }),
  atualizarTreino: (id, dados) => apiFetch(`/personal/treinos/${id}`, { method: "PUT", body: JSON.stringify(dados) }),
  excluirTreino: (id) => apiFetch(`/personal/treinos/${id}`, { method: "DELETE" }),
  montarTreino: (alunoId, dados) =>
    apiFetch(`/personal/alunos/${alunoId}/treinos/montar`, { method: "POST", body: JSON.stringify(dados) }),

  // --- Exercícios ---
  criarExercicio: (treinoId, dados) =>
    apiFetch(`/personal/treinos/${treinoId}/exercicios`, { method: "POST", body: JSON.stringify(dados) }),
  atualizarExercicio: (id, dados) =>
    apiFetch(`/personal/exercicios/${id}`, { method: "PUT", body: JSON.stringify(dados) }),
  excluirExercicio: (id) => apiFetch(`/personal/exercicios/${id}`, { method: "DELETE" }),

  // --- Séries ---
  criarSerie: (exercicioId, dados) =>
    apiFetch(`/personal/exercicios/${exercicioId}/series`, { method: "POST", body: JSON.stringify(dados) }),
  atualizarSerie: (id, dados) => apiFetch(`/personal/series/${id}`, { method: "PUT", body: JSON.stringify(dados) }),
  excluirSerie: (id) => apiFetch(`/personal/series/${id}`, { method: "DELETE" }),

  // --- Recomendações (visão do Personal) ---
  listarRecomendacoes: () => apiFetch("/personal/recomendacoes"),
  criarRecomendacao: (dados) => apiFetch("/personal/recomendacoes", { method: "POST", body: JSON.stringify(dados) }),
  atualizarRecomendacao: (id, dados) =>
    apiFetch(`/personal/recomendacoes/${id}`, { method: "PUT", body: JSON.stringify(dados) }),
  excluirRecomendacao: (id) => apiFetch(`/personal/recomendacoes/${id}`, { method: "DELETE" }),

  // --- Assinatura / Stripe ---
  statusAssinatura: () => apiFetch("/personal/assinatura"),
  criarCheckoutSession: () => apiFetch("/stripe/criar-checkout-session", { method: "POST" }),

  // --- Painel de administração (só pra conta super admin) ---
  listarPersonaisAdmin: () => apiFetch("/admin/personais"),
  ativarPersonalAdmin: (id) => apiFetch(`/admin/personais/${id}/ativar`, { method: "POST" }),
  desativarPersonalAdmin: (id) => apiFetch(`/admin/personais/${id}/desativar`, { method: "POST" }),
  definirLimitePersonalAdmin: (id, limite_alunos) =>
    apiFetch(`/admin/personais/${id}/limite`, { method: "PUT", body: JSON.stringify({ limite_alunos }) }),

  // --- Área pública do Aluno (via hash_token, sem login) ---
  painelAluno: (token) => apiFetch(`/aluno/${token}`),
  detalheTreinoAluno: (token, treinoId, data) =>
    apiFetch(`/aluno/${token}/treinos/${treinoId}${data ? `?data=${data}` : ""}`),
  executarSerie: (token, serieId, data) =>
    apiFetch(`/aluno/${token}/series/${serieId}/executar`, {
      method: "POST",
      body: JSON.stringify({ data: data || null }),
    }),
  recomendacoesAluno: (token) => apiFetch(`/aluno/${token}/recomendacoes`),
};
