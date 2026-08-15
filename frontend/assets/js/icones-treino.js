// Seklyn — ícones ilustrados das categorias de treino (montador de treino).
// Silhueta do grupo muscular + região trabalhada destacada em cor, igual ao
// conceito usado em referências visuais de apps de treino: em vez de um
// ícone de linha genérico, cada categoria tem uma forma própria.
//
// A silhueta (classe "base") usa fill="currentColor" — herda a cor do texto
// ao redor, então se adapta sozinha ao tema claro/escuro e à cor de conta de
// cada Personal. O destaque (o "músculo" propriamente dito) usa cor fixa,
// pensada pra ficar legível nos dois temas.
//
// Uso: import { iconeTreino } from "./icones-treino.js"; `${iconeTreino("peito")}`

const SVGS = {

  peito: `<svg viewBox="0 0 64 64">
    <g class="base" fill="currentColor">
      <rect x="4" y="22" width="11" height="27" rx="5.5"/>
      <rect x="49" y="22" width="11" height="27" rx="5.5"/>
      <circle cx="15" cy="21" r="8"/>
      <circle cx="49" cy="21" r="8"/>
      <rect x="14" y="16" width="36" height="38" rx="16"/>
      <rect x="27" y="4" width="10" height="15" rx="5"/>
    </g>
    <g fill="#f43f5e">
      <ellipse cx="23.5" cy="29" rx="11" ry="9.5" transform="rotate(-16 23.5 29)"/>
      <ellipse cx="40.5" cy="29" rx="11" ry="9.5" transform="rotate(16 40.5 29)"/>
    </g>
  </svg>`,

  costas: `<svg viewBox="0 0 64 64">
    <g class="base" fill="currentColor">
      <rect x="4" y="22" width="11" height="27" rx="5.5"/>
      <rect x="49" y="22" width="11" height="27" rx="5.5"/>
      <circle cx="15" cy="21" r="8"/>
      <circle cx="49" cy="21" r="8"/>
      <rect x="14" y="16" width="36" height="38" rx="16"/>
      <rect x="27" y="4" width="10" height="15" rx="5"/>
    </g>
    <g fill="#3b82f6">
      <path d="M20 20 L32 48 L20 48 Z"/>
      <path d="M44 20 L32 48 L44 48 Z"/>
    </g>
    <rect x="30.7" y="19" width="2.6" height="29" rx="1.3" fill="#1d4ed8"/>
  </svg>`,

  pernas: `<svg viewBox="0 0 64 64">
    <g class="base" fill="currentColor">
      <rect x="16" y="4" width="32" height="14" rx="7"/>
      <rect x="14" y="14" width="15" height="46" rx="7.5"/>
      <rect x="35" y="14" width="15" height="46" rx="7.5"/>
    </g>
    <g fill="#f43f5e">
      <rect x="15" y="16" width="13" height="24" rx="6.5"/>
      <rect x="36" y="16" width="13" height="24" rx="6.5"/>
    </g>
  </svg>`,

  ombro: `<svg viewBox="0 0 64 64">
    <g class="base" fill="currentColor">
      <circle cx="32" cy="8" r="7"/>
      <rect x="28" y="13" width="8" height="9" rx="3"/>
      <rect x="17" y="20" width="30" height="34" rx="14"/>
    </g>
    <g fill="#f97316">
      <circle cx="15" cy="27" r="9.5"/>
      <circle cx="49" cy="27" r="9.5"/>
    </g>
  </svg>`,

  biceps: `<svg viewBox="0 0 64 64">
    <path class="base" d="M16 16 L28 40 L46 16" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <g fill="#22c55e">
      <ellipse cx="21" cy="25" rx="11" ry="9.5" transform="rotate(-25 21 25)"/>
    </g>
    <circle class="base" fill="currentColor" cx="46" cy="16" r="8.5"/>
  </svg>`,

  triceps: `<svg viewBox="0 0 64 64">
    <path class="base" d="M20 12 L18 38 L34 54" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <g fill="#8b5cf6">
      <ellipse cx="11" cy="26" rx="7.5" ry="14"/>
    </g>
    <circle class="base" fill="currentColor" cx="34" cy="54" r="8"/>
  </svg>`,

  abdomen: `<svg viewBox="0 0 64 64">
    <g class="base" fill="currentColor">
      <rect x="22" y="4" width="20" height="12" rx="6"/>
      <rect x="16" y="12" width="32" height="46" rx="15"/>
    </g>
    <g fill="#f59e0b">
      <rect x="21" y="18" width="9" height="9" rx="3"/>
      <rect x="34" y="18" width="9" height="9" rx="3"/>
      <rect x="21" y="29" width="9" height="9" rx="3"/>
      <rect x="34" y="29" width="9" height="9" rx="3"/>
      <rect x="21" y="40" width="9" height="9" rx="3"/>
      <rect x="34" y="40" width="9" height="9" rx="3"/>
    </g>
  </svg>`,

  cardio: `<svg viewBox="0 0 64 64">
    <g fill="#06b6d4">
      <circle cx="42" cy="10" r="6.5"/>
      <rect x="26" y="18" width="13" height="24" rx="6.5" transform="rotate(20 32 30)"/>
      <rect x="26" y="30" width="12" height="22" rx="6" transform="rotate(-25 32 41)"/>
      <rect x="12" y="34" width="12" height="24" rx="6" transform="rotate(35 18 46)"/>
      <rect x="30" y="14" width="10" height="18" rx="5" transform="rotate(-40 35 23)"/>
      <rect x="16" y="16" width="10" height="18" rx="5" transform="rotate(55 21 25)"/>
    </g>
    <g class="base" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.35">
      <path d="M4 50 Q10 46 16 50"/>
      <path d="M2 44 Q10 39 18 44"/>
    </g>
  </svg>`,

};

/** Devolve o SVG ilustrado da categoria de treino (peito, costas, pernas,
 * ombro, biceps, triceps, abdomen, cardio). `tamanho` em px (padrão 28). */
export function iconeTreino(nome, tamanho = 28) {
  const svg = SVGS[nome];
  if (!svg) return "";
  return svg.replace(
    "<svg viewBox=\"0 0 64 64\">",
    `<svg viewBox="0 0 64 64" width="${tamanho}" height="${tamanho}" aria-hidden="true" style="vertical-align:-6px;">`
  );
}
