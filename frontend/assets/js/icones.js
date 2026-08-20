// Seklyn — biblioteca central de ícones de linha (SVG), substituindo os
// emojis do produto por algo consistente e profissional. Todo ícone usa
// stroke="currentColor" — herda a cor do texto ao redor automaticamente,
// funciona em qualquer tema/cor de conta sem precisar de ajuste.
//
// Uso: import { icone } from "./icones.js"; depois `${icone("halteres")}`.

const CAMINHOS = {
  halteres: '<path d="M6.5 6.5 17.5 17.5"/><path d="M4 4l3 3M20 20l-3-3"/><rect x="2" y="8" width="4" height="8" rx="1"/><rect x="18" y="8" width="4" height="8" rx="1"/><path d="M8 12h8"/>',
  costas: '<path d="M4 4v16h16"/><path d="M8 16l4-8 4 4 4-6"/>',
  pernas: '<path d="M8 3v6l-3 12h3l2-8 2 8h3l-3-12V3"/>',
  ombro: '<circle cx="12" cy="5" r="2"/><path d="M6 21v-6a6 6 0 0 1 12 0v6"/>',
  chama: '<path d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c0-1-1-2-1-3 2 1 3 3 3 5a5 5 0 0 1-10 0c0-4 3-6 5-10z"/>',
  corrida: '<circle cx="16" cy="5" r="2"/><path d="M9 21l2-5 4 2 2 4M6 13l3-3 3 2 4-4"/>',
  editar: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
  impressora: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  grafico: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  enviar: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  whatsapp: '<path d="M21 11.5a8.5 8.5 0 0 1-12.36 7.57L3 20l1.06-5.44A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8.5 10.5c.3 2 2 3.7 4 4"/>',
  balanca: '<path d="M12 3v18"/><path d="M6 8h12"/><path d="M3 8l3-4 3 4-3 5-3-5Z"/><path d="M15 8l3-4 3 4-3 5-3-5Z"/>',
  lixeira: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  lampada: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 2Z"/>',
  troféu: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 5H4a2 2 0 0 0 2 4"/><path d="M17 5h3a2 2 0 0 1-2 4"/>',
  correntes: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  celular: '<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="10" y1="18" x2="14" y2="18"/>',
  monitor: '<rect x="2" y="4" width="20" height="13" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  envelope: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  aviso: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  cadeado: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  cartao: '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  fechar: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  sacola: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  pessoas: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  chevron: '<polyline points="9 6 15 12 9 18"/>',
  video: '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>',
};

/** Devolve o <svg> pronto pro nome do ícone dado. `tamanho` em px (padrão 18). */
export function icone(nome, tamanho = 18) {
  const caminho = CAMINHOS[nome];
  if (!caminho) return "";
  return `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px;">${caminho}</svg>`;
}
