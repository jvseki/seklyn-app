// Seklyn — sistema genérico de "revelar ao rolar": qualquer elemento com a
// classe .reveal ganha um fade+slide suave assim que entra na tela. Usa
// IntersectionObserver (nativo, leve, sem libs) — funciona igual em
// desktop/mobile e em qualquer página que importar este módulo.
//
// Cartões dentro do mesmo container ganham atraso escalonado automático
// (efeito cascata), calculado pela ordem em que aparecem no DOM.

const SELETOR = ".reveal:not(.revelado)";
const ATRASO_ENTRE_ITENS_MS = 70;
const ATRASO_MAXIMO_MS = 420;

function prefereMenosMovimento() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let observador = null;

function garantirObservador() {
  if (observador) return observador;
  observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        entrada.target.classList.add("revelado");
        observador.unobserve(entrada.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  return observador;
}

/**
 * Aplica o observer em todo elemento .reveal ainda não observado — chame de
 * novo depois de renderizar uma lista nova (ex: cards de aluno recarregados).
 */
export function observarRevelacoes(raiz = document) {
  const itens = raiz.querySelectorAll(SELETOR);
  if (itens.length === 0) return;

  if (prefereMenosMovimento()) {
    itens.forEach((el) => el.classList.add("revelado"));
    return;
  }

  const obs = garantirObservador();

  // Agrupa por "container pai" pra escalonar o atraso dentro de cada grade,
  // sem os atrasos se acumularem entre seções diferentes da página.
  const porPai = new Map();
  itens.forEach((el) => {
    const pai = el.parentElement;
    if (!porPai.has(pai)) porPai.set(pai, []);
    porPai.get(pai).push(el);
  });

  porPai.forEach((filhos) => {
    filhos.forEach((el, indice) => {
      const atraso = Math.min(indice * ATRASO_ENTRE_ITENS_MS, ATRASO_MAXIMO_MS);
      el.style.transitionDelay = `${atraso}ms`;
      obs.observe(el);
    });
  });
}

observarRevelacoes();
