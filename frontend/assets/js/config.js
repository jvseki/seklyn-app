// Seklyn — define a URL base da API de acordo com o ambiente.
// Script clássico (não-módulo), carregado ANTES de api.js, pra já existir
// window.PV_API_BASE_URL quando o módulo api.js for avaliado.
(function () {
  var producao = window.location.hostname === "seklyn.com.br" || window.location.hostname === "www.seklyn.com.br";
  window.PV_API_BASE_URL = producao ? "https://api.seklyn.com.br/api" : "http://localhost:8000/api";
})();
