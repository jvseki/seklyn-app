// Seklyn — formulário de cartão do Mercado Pago (Card Brick) embutido na
// página. O cartão é digitado num campo do próprio Mercado Pago e vira um
// token de uso único: só esse token vai pro nosso backend — o número do
// cartão nunca passa pelo Seklyn. Usado na assinatura do Personal e no
// teste de cobrança do painel admin. Exige o script
// https://sdk.mercadopago.com/js/v2 na página.

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
      onError: (erro) => console.warn("Card Brick:", erro),
    },
  });
  return { desmontar: () => controlador.unmount() };
}
