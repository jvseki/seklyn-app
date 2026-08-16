// Seklyn — ícones das categorias de treino (montador de treino).
//
// Imagens fornecidas pelo usuário (frontend/assets/img/treino/*.png), uma
// por categoria — não são desenhadas em código. `iconeCategoriaTreino`
// só monta a tag <img> apontando pro arquivo certo.
//
// Uso: import { iconeCategoriaTreino } from "./icones-treino.js";
//      `${iconeCategoriaTreino("peito")}`

const CATEGORIAS_VALIDAS = ["peito", "costas", "pernas", "ombro", "biceps", "triceps", "abdomen", "cardio"];

/** Devolve a <img> da categoria de treino (peito, costas, pernas, ombro,
 * biceps, triceps, abdomen, cardio), centralizada e sem distorcer. */
export function iconeCategoriaTreino(chave) {
  if (!CATEGORIAS_VALIDAS.includes(chave)) return "";
  return `<img src="../assets/img/treino/${chave}.png" alt="" style="height:60px;width:60px;object-fit:contain;display:block;margin:0 auto;" />`;
}
