"""
"Hoje" de verdade pro produto: o servidor roda em UTC, mas os usuários são
todos do Brasil. Usar `date.today()` puro (hora do sistema) faz o dia virar
umas 3h antes do que devia pro aluno — ex: 21h de sexta no Brasil já é
sábado em UTC, o que bagunçaria a semana/"Hoje" mostrados pra ele.
"""
from datetime import date, datetime
from zoneinfo import ZoneInfo

FUSO_BRASIL = ZoneInfo("America/Sao_Paulo")


def hoje() -> date:
    """A data de hoje no horário de Brasília, não no horário (UTC) do servidor."""
    return datetime.now(FUSO_BRASIL).date()
