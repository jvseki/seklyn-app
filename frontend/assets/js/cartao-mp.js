// Seklyn — formulário de cartão do Mercado Pago (Card Brick) embutido na
// página. O cartão é digitado num campo do próprio Mercado Pago e vira um
// token de uso único: só esse token vai pro nosso backend — o número do
// cartão nunca passa pelo Seklyn. Usado na assinatura do Personal e no
// teste de cobrança do painel admin. Exige o script
// https://sdk.mercadopago.com/js/v2 na página.

import { mostrarToast } from "./utils.js";

/** Erro do formulário do Mercado Pago em português claro (antes só ia pro console). */
function avisarErroDoFormulario(erro) {
  console.warn("Card Brick:", erro);
  const texto = String(erro?.message || erro?.cause || "");
  if (/bin|payment_method|not.?(found|supported|accepted)|card.?type/i.test(texto)) {
    mostrarToast("Esse cartão não foi aceito nessa opção. Cartões que são crédito e débito no mesmo número (como o do Nubank) o Mercado Pago reconhece só como crédito. Use Crédito, ou Pix (sai na hora da conta, como o débito).", "erro");
  } else if (erro?.type === "critical" || erro?.type === "non_critical") {
    mostrarToast(`O formulário do Mercado Pago recusou: ${texto || "erro desconhecido"}. Tente outro cartão ou Pix.`, "erro");
  }
}

/**
 * Monta o formulário dentro de `containerId`. `aoEnviar(token)` deve
 * devolver uma Promise: se ela falhar, o formulário volta pro estado de
 * edição pra pessoa tentar de novo. Retorna `{ desmontar }`.
 */
export async function montarFormularioCartao({ containerId, publicKey, valor, email, textoBotao, aoEnviar, tiposExcluidos }) {
  if (typeof window.MercadoPago === "undefined") {
    throw new Error("Não deu pra carregar o formulário do Mercado Pago. Verifique sua internet e recarregue a página.");
  }
  const corMarca = getComputedStyle(document.documentElement).getPropertyValue("--cor-primaria").trim() || "#7c3aed";
  const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
  const controlador = await mp.bricks().create("cardPayment", containerId, {
    initialization: {
      amount: Number(valor),
      payer: email ? { email } : undefined,
    },
    customization: {
      // Cobrança mensal: sempre à vista. tiposExcluidos: ["debit_card"] = só
      // crédito; ["credit_card", "prepaid_card"] = só débito.
      paymentMethods: { maxInstallments: 1, ...(tiposExcluidos ? { types: { excluded: tiposExcluidos } } : {}) },
      visual: {
        style: { theme: "default", customVariables: { baseColor: corMarca } },
        texts: textoBotao ? { formSubmit: textoBotao } : undefined,
      },
    },
    callbacks: {
      onReady: () => {},
      // dadosCartao: token, payment_method_id, issuer_id, payer.identification…
      onSubmit: (dadosCartao) => aoEnviar(dadosCartao.token, dadosCartao),
      onError: avisarErroDoFormulario,
    },
  });
  return { desmontar: () => controlador.unmount() };
}
