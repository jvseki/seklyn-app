"""
Traduz os erros de validação do Pydantic (em inglês por padrão) pra
PT-BR antes de devolver pro frontend. Usa o campo `type` do erro (estável,
não depende de idioma) em vez do `msg` original.
"""
from typing import Any, Callable

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def _msg_tamanho_maximo(ctx: dict) -> str:
    return f"Deve ter no máximo {ctx.get('max_length')} caracteres."


def _msg_tamanho_minimo(ctx: dict) -> str:
    return f"Deve ter no mínimo {ctx.get('min_length')} caracteres."


TRADUCOES_ERRO: dict[str, Callable[[dict], str]] = {
    "string_too_long": _msg_tamanho_maximo,
    "string_too_short": _msg_tamanho_minimo,
    "missing": lambda ctx: "Esse campo é obrigatório.",
    "value_error": lambda ctx: "Valor inválido.",
    "greater_than": lambda ctx: f"Deve ser maior que {ctx.get('gt')}.",
    "greater_than_equal": lambda ctx: f"Deve ser maior ou igual a {ctx.get('ge')}.",
    "less_than": lambda ctx: f"Deve ser menor que {ctx.get('lt')}.",
    "less_than_equal": lambda ctx: f"Deve ser menor ou igual a {ctx.get('le')}.",
    "int_parsing": lambda ctx: "Deve ser um número inteiro.",
    "int_type": lambda ctx: "Deve ser um número inteiro.",
    "float_parsing": lambda ctx: "Deve ser um número.",
    "bool_parsing": lambda ctx: "Valor inválido (esperado verdadeiro/falso).",
    "string_type": lambda ctx: "Deve ser um texto.",
    "literal_error": lambda ctx: "Valor não permitido.",
    "enum": lambda ctx: "Valor não permitido.",
    "date_parsing": lambda ctx: "Data inválida.",
    "date_from_datetime_parsing": lambda ctx: "Data inválida.",
    "json_invalid": lambda ctx: "Dados inválidos.",
}


def _traduzir_um_erro(erro: dict[str, Any]) -> str:
    tipo = erro.get("type", "")
    traducao = TRADUCOES_ERRO.get(tipo)
    if traducao:
        return traducao(erro.get("ctx") or {})
    # "email" e variantes do email-validator caem aqui como value_error também,
    # mas por segurança cobre qualquer tipo não mapeado com uma mensagem genérica.
    return "Valor inválido."


async def tratar_erro_validacao(request: Request, exc: RequestValidationError) -> JSONResponse:
    detalhes = [
        {"loc": erro.get("loc"), "msg": _traduzir_um_erro(erro), "type": erro.get("type")} for erro in exc.errors()
    ]
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"detail": detalhes})
