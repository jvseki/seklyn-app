// Seklyn — catálogo de exercícios comuns de academia, por categoria, com
// séries/repetições/descanso padrão sugeridos. Usado tanto no autocomplete
// livre (datalist) quanto no montador assistido de treino por categoria —
// o Personal sempre pode ajustar ou digitar algo que não está na lista.

export const CATEGORIAS_TREINO = [
  {
    chave: "peito",
    rotulo: "Peito",
    emoji: "🏋️",
    padrao: { repeticoes_alvo: "10-12", carga_alvo: "", intervalo_descanso: "60s" },
    exercicios: [
      { nome: "Supino reto", recomendado: true },
      { nome: "Supino inclinado", recomendado: true },
      { nome: "Crucifixo reto", recomendado: true },
      { nome: "Supino declinado", recomendado: false },
      { nome: "Supino com halteres", recomendado: false },
      { nome: "Crucifixo inclinado", recomendado: false },
      { nome: "Crossover", recomendado: false },
      { nome: "Peck deck (voador)", recomendado: false },
      { nome: "Flexão de braço", recomendado: false },
    ],
  },
  {
    chave: "costas",
    rotulo: "Costas",
    emoji: "🔙",
    padrao: { repeticoes_alvo: "10-12", carga_alvo: "", intervalo_descanso: "60s" },
    exercicios: [
      { nome: "Puxada frente (pulley)", recomendado: true },
      { nome: "Remada baixa (cavalinho)", recomendado: true },
      { nome: "Remada curvada", recomendado: true },
      { nome: "Puxada atrás", recomendado: false },
      { nome: "Remada unilateral (serrote)", recomendado: false },
      { nome: "Remada cavalo", recomendado: false },
      { nome: "Levantamento terra", recomendado: false },
      { nome: "Barra fixa", recomendado: false },
      { nome: "Pull-down", recomendado: false },
    ],
  },
  {
    chave: "pernas",
    rotulo: "Pernas",
    emoji: "🦵",
    padrao: { repeticoes_alvo: "10-12", carga_alvo: "", intervalo_descanso: "90s" },
    exercicios: [
      { nome: "Agachamento livre", recomendado: true },
      { nome: "Leg press 45°", recomendado: true },
      { nome: "Cadeira extensora", recomendado: true },
      { nome: "Cadeira flexora", recomendado: true },
      { nome: "Agachamento smith", recomendado: false },
      { nome: "Mesa flexora", recomendado: false },
      { nome: "Stiff", recomendado: false },
      { nome: "Afundo (passada)", recomendado: false },
      { nome: "Cadeira adutora", recomendado: false },
      { nome: "Cadeira abdutora", recomendado: false },
      { nome: "Panturrilha em pé", recomendado: false },
      { nome: "Panturrilha sentado", recomendado: false },
      { nome: "Hack machine", recomendado: false },
    ],
  },
  {
    chave: "ombro",
    rotulo: "Ombro",
    emoji: "🙆",
    padrao: { repeticoes_alvo: "12-15", carga_alvo: "", intervalo_descanso: "60s" },
    exercicios: [
      { nome: "Desenvolvimento militar", recomendado: true },
      { nome: "Elevação lateral", recomendado: true },
      { nome: "Elevação frontal", recomendado: false },
      { nome: "Desenvolvimento com halteres", recomendado: false },
      { nome: "Remada alta", recomendado: false },
      { nome: "Crucifixo invertido", recomendado: false },
      { nome: "Encolhimento de ombros", recomendado: false },
    ],
  },
  {
    chave: "biceps",
    rotulo: "Bíceps",
    emoji: "💪",
    padrao: { repeticoes_alvo: "12-15", carga_alvo: "", intervalo_descanso: "45s" },
    exercicios: [
      { nome: "Rosca direta", recomendado: true },
      { nome: "Rosca alternada", recomendado: true },
      { nome: "Rosca martelo", recomendado: false },
      { nome: "Rosca scott", recomendado: false },
      { nome: "Rosca concentrada", recomendado: false },
      { nome: "Rosca 21", recomendado: false },
    ],
  },
  {
    chave: "triceps",
    rotulo: "Tríceps",
    emoji: "💪",
    padrao: { repeticoes_alvo: "12-15", carga_alvo: "", intervalo_descanso: "45s" },
    exercicios: [
      { nome: "Tríceps pulley (corda)", recomendado: true },
      { nome: "Tríceps testa", recomendado: true },
      { nome: "Tríceps pulley (barra)", recomendado: false },
      { nome: "Tríceps francês", recomendado: false },
      { nome: "Mergulho (paralelas)", recomendado: false },
      { nome: "Tríceps coice", recomendado: false },
    ],
  },
  {
    chave: "abdomen",
    rotulo: "Abdômen",
    emoji: "🔥",
    padrao: { repeticoes_alvo: "15-20", carga_alvo: "", intervalo_descanso: "30s" },
    exercicios: [
      { nome: "Abdominal supra", recomendado: true },
      { nome: "Prancha", recomendado: true },
      { nome: "Abdominal infra", recomendado: false },
      { nome: "Elevação de pernas", recomendado: false },
      { nome: "Abdominal oblíquo", recomendado: false },
      { nome: "Abdominal na polia", recomendado: false },
    ],
  },
  {
    chave: "cardio",
    rotulo: "Cardio",
    emoji: "🏃",
    padrao: { repeticoes_alvo: "20 min", carga_alvo: "", intervalo_descanso: "" },
    exercicios: [
      { nome: "Esteira", recomendado: true },
      { nome: "Bicicleta ergométrica", recomendado: false },
      { nome: "Elíptico", recomendado: false },
      { nome: "Escada (stairmaster)", recomendado: false },
      { nome: "Pular corda", recomendado: false },
      { nome: "HIIT", recomendado: false },
    ],
  },
];

/** Lista simples com todos os exercícios, pra popular um <datalist>. */
export function listaCompletaExercicios() {
  return CATEGORIAS_TREINO.flatMap((cat) => cat.exercicios.map((ex) => ex.nome));
}

export function obterCategoria(chave) {
  return CATEGORIAS_TREINO.find((cat) => cat.chave === chave) || null;
}
