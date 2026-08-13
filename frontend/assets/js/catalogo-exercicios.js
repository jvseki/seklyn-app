// Seklyn — catálogo de exercícios comuns de academia, usado como sugestão
// (autocomplete) na hora do Personal montar a ficha de treino. O Personal
// continua podendo digitar qualquer nome que não esteja na lista.
export const CATALOGO_EXERCICIOS = {
  Peito: [
    "Supino reto",
    "Supino inclinado",
    "Supino declinado",
    "Supino com halteres",
    "Crucifixo reto",
    "Crucifixo inclinado",
    "Crossover",
    "Peck deck (voador)",
    "Flexão de braço",
  ],
  Costas: [
    "Puxada frente (pulley)",
    "Puxada atrás",
    "Remada baixa (cavalinho)",
    "Remada curvada",
    "Remada unilateral (serrote)",
    "Remada cavalo",
    "Levantamento terra",
    "Barra fixa",
    "Pull-down",
  ],
  Pernas: [
    "Agachamento livre",
    "Agachamento smith",
    "Leg press 45°",
    "Cadeira extensora",
    "Cadeira flexora",
    "Mesa flexora",
    "Stiff",
    "Afundo (passada)",
    "Cadeira adutora",
    "Cadeira abdutora",
    "Panturrilha em pé",
    "Panturrilha sentado",
    "Hack machine",
  ],
  Ombro: [
    "Desenvolvimento militar",
    "Desenvolvimento com halteres",
    "Elevação lateral",
    "Elevação frontal",
    "Remada alta",
    "Crucifixo invertido",
    "Encolhimento de ombros",
  ],
  Bíceps: [
    "Rosca direta",
    "Rosca alternada",
    "Rosca martelo",
    "Rosca scott",
    "Rosca concentrada",
    "Rosca 21",
  ],
  Tríceps: [
    "Tríceps pulley (corda)",
    "Tríceps pulley (barra)",
    "Tríceps testa",
    "Tríceps francês",
    "Mergulho (paralelas)",
    "Tríceps coice",
  ],
  Abdômen: [
    "Abdominal supra",
    "Abdominal infra",
    "Prancha",
    "Elevação de pernas",
    "Abdominal oblíquo",
    "Abdominal na polia",
  ],
  Cardio: ["Esteira", "Bicicleta ergométrica", "Elíptico", "Escada (stairmaster)", "Pular corda", "HIIT"],
};

/** Lista simples com todos os exercícios, pra popular um <datalist>. */
export function listaCompletaExercicios() {
  return Object.values(CATALOGO_EXERCICIOS).flat();
}
