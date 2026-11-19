"""
Aviso por e-mail de assinatura paga com Pix/débito perto de vencer
(3 dias antes, 1 dia antes e no dia). Roda uma vez por dia (cron no servidor):
    docker compose exec -T backend python scripts/avisar_vencimentos.py
"""
import sys

sys.path.insert(0, ".")

from app.core.database import SessionLocal  # noqa: E402
from app.models.assinatura import Assinatura  # noqa: E402
from app.services import email_avisos  # noqa: E402
from app.services import mercadopago_service as mp  # noqa: E402

DIAS_DE_AVISO = (3, 1, 0)

db = SessionLocal()
enviados = 0
for a in db.query(Assinatura).filter(Assinatura.forma_pagamento.in_(("pix", "debito")), Assinatura.cancelamento_agendado.is_(False)).all():
    dias = mp.dias_para_vencer(a)
    if a.ativa and dias in DIAS_DE_AVISO and a.personal is not None:
        email_avisos.vencimento_proximo(a.personal.email, a.personal.nome, dias, a.fim_do_periodo)
        enviados += 1
email_avisos.aguardar_envios()
db.close()
print(f"avisos de vencimento enviados: {enviados}")
