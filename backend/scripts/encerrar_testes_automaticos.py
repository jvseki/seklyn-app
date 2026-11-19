"""
Encerra os TESTES do crédito automático (criados no Admin com "cobrar de novo
em N dias"): cancela a assinatura de teste e reembolsa todas as cobranças.
Só mexe em assinaturas com a marca seklyn-teste-auto- — nunca em cliente.

Agendado no servidor (crontab do root) pra rodar uma vez, dentro do container:
    docker compose exec -T backend python scripts/encerrar_testes_automaticos.py
"""
import logging
import sys

sys.path.insert(0, ".")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

from app.services import mercadopago_service as mp  # noqa: E402

ids = mp.ids_testes_automaticos()
print(f"testes do automático encontrados: {len(ids)}")
for preapproval_id in ids:
    try:
        r = mp.cancelar_e_reembolsar_teste(preapproval_id)
        print(f"{preapproval_id}: cancelado, reembolsados={r['reembolsados']}, aguardando={r['aguardando']}")
    except (ValueError, mp.ErroMercadoPago) as erro:
        print(f"{preapproval_id}: ERRO {str(erro)[:200]}")
