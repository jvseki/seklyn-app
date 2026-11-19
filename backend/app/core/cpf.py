"""CPF: validação dos dígitos verificadores e formatação 000.000.000-00."""
import re


def so_digitos(cpf: str) -> str:
    return re.sub(r"\D", "", cpf or "")


def cpf_valido(cpf: str) -> bool:
    d = so_digitos(cpf)
    if len(d) != 11 or d == d[0] * 11:
        return False
    for tamanho in (9, 10):
        soma = sum(int(d[i]) * (tamanho + 1 - i) for i in range(tamanho))
        digito = (soma * 10) % 11 % 10
        if digito != int(d[tamanho]):
            return False
    return True


def formatar_cpf(cpf: str) -> str:
    d = so_digitos(cpf)
    return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"
