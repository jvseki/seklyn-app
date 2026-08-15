// Seklyn — ícones ilustrados das categorias de treino (montador de treino).
// Corpo em contorno fino (linework) + mancha de músculo destacada em roxo,
// em vez de um ícone de linha genérico por categoria.
//
// A silhueta (classe "base") usa stroke/fill="currentColor" — herda a cor
// do texto ao redor, então se adapta sozinha ao tema claro/escuro. O
// destaque usa var(--cor-primaria) — a cor da marca, que já muda sozinha
// por conta de Personal (rosa, verde, azul etc.).
//
// Uso: import { iconeTreino } from "./icones-treino.js"; `${iconeTreino("peito")}`

const SVGS = {

  peito: `<svg viewBox="0 0 64 64">
    <g class="base" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13.5 20 C9 25 6.5 31 7 38 C7.3 42 8 46.5 9 50.5"/>
      <path d="M50.5 20 C55 25 57.5 31 57 38 C56.7 42 56 46.5 55 50.5"/>
      <path d="M17 18 C17 14 20 11 24 11 L28 11 M47 18 C47 14 44 11 40 11 L36 11"/>
      <path d="M28 11 C28 8.5 29.8 7 32 7 C34.2 7 36 8.5 36 11"/>
      <path d="M17 21 L17 48 C17 53.5 21.5 58 27 58 L37 58 C42.5 58 47 53.5 47 48 L47 21"/>
    </g>
    <path fill="var(--cor-primaria)" d="M17 27 C17 20.5 22.5 16.5 28.5 18.5 C31 19.3 32 22.5 32 25.5 C32 22.5 33 19.3 35.5 18.5 C41.5 16.5 47 20.5 47 27 C47 33.5 41.5 39 34.5 40 C33 40.2 32.5 39 32 37.5 C31.5 39 31 40.2 29.5 40 C22.5 39 17 33.5 17 27 Z"/>
  </svg>`,

  costas: `<svg viewBox="0 0 64 64">
    <g class="base" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13.5 20 C9 25 6.5 31 7 38 C7.3 42 8 46.5 9 50.5"/>
      <path d="M50.5 20 C55 25 57.5 31 57 38 C56.7 42 56 46.5 55 50.5"/>
      <path d="M17 18 C17 14 20 11 24 11 L28 11 L32 17 L36 11 L40 11 C44 11 47 14 47 18"/>
      <path d="M17 21 L17 48 C17 53.5 21.5 58 27 58 L37 58 C42.5 58 47 53.5 47 48 L47 21"/>
    </g>
    <path class="base" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.5" d="M32 22 L32 48"/>
    <g fill="var(--cor-primaria)">
      <path d="M23.5 24 C18.5 29 17 36.5 20 43 C21.5 46.5 25.5 46.5 26.5 43 C28 37.5 27 29.5 23.5 24 Z"/>
      <path d="M40.5 24 C45.5 29 47 36.5 44 43 C42.5 46.5 38.5 46.5 37.5 43 C36 37.5 37 29.5 40.5 24 Z"/>
    </g>
  </svg>`,

  pernas: `<svg viewBox="0 0 64 64">
    <g fill="var(--cor-primaria)">
      <path d="M18 14 C17 20 17 27 20 32 C22 35 26 34 26 29 C26 22 24 15 18 14 Z"/>
      <path d="M46 14 C47 20 47 27 44 32 C42 35 38 34 38 29 C38 22 40 15 46 14 Z"/>
    </g>
    <path class="base" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
      d="M16 8 L48 8 M16 8 C15 20 15 32 17 44 C18 50 19 54 20 58 M48 8 C49 20 49 32 47 44 C46 50 45 54 44 58 M27 10 C26 18 25 26 24 34 M37 10 C38 18 39 26 40 34"/>
  </svg>`,

  ombro: `<svg viewBox="0 0 64 64">
    <g fill="var(--cor-primaria)">
      <path d="M14 40 C10 34 10 26 16 22 C20 19 24 22 22 28 C20 34 16 38 14 40 Z"/>
      <path d="M50 40 C54 34 54 26 48 22 C44 19 40 22 42 28 C44 34 48 38 50 40 Z"/>
    </g>
    <circle class="base" fill="none" stroke="currentColor" stroke-width="2.4" cx="32" cy="10" r="6"/>
    <path class="base" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
      d="M14 40 C14 28 20 18 32 18 C44 18 50 28 50 40 M14 40 L12 54 M50 40 L52 54"/>
  </svg>`,

  biceps: `<svg viewBox="0 0 64 64">
    <g fill="var(--cor-primaria)">
      <path d="M17 20 C15 26 17 32 22 34 C27 36 30 31 28 26 C26 21 20 18 17 20 Z"/>
    </g>
    <circle class="base" fill="none" stroke="currentColor" stroke-width="2.4" cx="14" cy="14" r="5.5"/>
    <path class="base" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
      d="M14 19 C14 26 19 33 26 38 C31 33 37 26 41 19"/>
    <path class="base" fill="currentColor"
      d="M41 19 C44 15 49 14 52 17 C54 19 53 23 49 23 C45 24 42 22 41 19 Z"/>
  </svg>`,

  triceps: `<svg viewBox="0 0 64 64">
    <g fill="var(--cor-primaria)">
      <path d="M12 18 C8 24 8 32 13 37 C16 39 19.5 36 18.5 31 C17.5 25 15 19 12 18 Z"/>
    </g>
    <circle class="base" fill="none" stroke="currentColor" stroke-width="2.4" cx="19" cy="12" r="5.5"/>
    <path class="base" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
      d="M19 17.5 C18 26 17 33 16 38 C22 42 27 46 31 50"/>
    <path class="base" fill="currentColor"
      d="M31 50 C35 49 39 51 39.5 54.5 C40 57.5 36.5 59.5 33.5 58 C30.5 56.5 29 52 31 50 Z"/>
  </svg>`,

  abdomen: `<svg viewBox="0 0 64 64">
    <path class="base" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
      d="M22 10 C17 10 15 15 15 21 L15 45 C15 53 20 58 27 58 L37 58 C44 58 49 53 49 45 L49 21 C49 15 47 10 42 10 M15 21 C12 20 9 18 8 15 M49 21 C52 20 55 18 56 15"/>
    <g fill="var(--cor-primaria)">
      <rect x="21" y="20" width="9" height="9" rx="3"/>
      <rect x="34" y="20" width="9" height="9" rx="3"/>
      <rect x="21" y="31" width="9" height="9" rx="3"/>
      <rect x="34" y="31" width="9" height="9" rx="3"/>
      <rect x="21" y="42" width="9" height="9" rx="3"/>
      <rect x="34" y="42" width="9" height="9" rx="3"/>
    </g>
  </svg>`,

  cardio: `<svg viewBox="0 0 64 64">
    <g class="base" fill="currentColor">
      <circle cx="42" cy="10" r="6.5"/>
      <rect x="26" y="18" width="13" height="24" rx="6.5" transform="rotate(20 32 30)"/>
      <rect x="26" y="30" width="12" height="22" rx="6" transform="rotate(-25 32 41)"/>
      <rect x="12" y="34" width="12" height="24" rx="6" transform="rotate(35 18 46)"/>
      <rect x="30" y="14" width="10" height="18" rx="5" transform="rotate(-40 35 23)"/>
      <rect x="16" y="16" width="10" height="18" rx="5" transform="rotate(55 21 25)"/>
    </g>
    <g stroke="var(--cor-primaria)" stroke-width="3" fill="none" stroke-linecap="round">
      <path d="M2 52 Q9 47 16 52"/>
      <path d="M0 45 Q9 39 18 45"/>
      <path d="M2 38 Q9 33 16 38"/>
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
