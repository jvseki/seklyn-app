"""
Rodar (de dentro de backend/):  python tests/integracao_pagamentos_loja.py

Teste de integração da assinatura com cartão embutido (Card Brick +
preapproval com card_token_id), pelas rotas HTTP reais (FastAPI
TestClient), com um Mercado Pago FALSO no lugar da API. SQLite descartável.
"""
import hashlib
from decimal import Decimal
import hmac
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone

DB = os.path.join(tempfile.mkdtemp(), "teste_mp.db").replace("\\", "/")
os.environ.update(
    DATABASE_URL=f"sqlite:///{DB}",
    JWT_SECRET="teste",
    MERCADOPAGO_ACCESS_TOKEN="TEST-token-falso",
    MERCADOPAGO_PUBLIC_KEY="TEST-public-key",
    MERCADOPAGO_WEBHOOK_SECRET="segredo-webhook",
    FRONTEND_URL="http://localhost:5500",
)
BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

from sqlalchemy import JSON, DateTime, TypeDecorator  # noqa: E402

import app.models  # noqa: E402,F401
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.core.security import criar_token_acesso, hash_senha  # noqa: E402
from app.models.assinatura import Assinatura  # noqa: E402
from app.models.personal import Personal  # noqa: E402
from app.models.treino_template import TreinoTemplate  # noqa: E402


class _ComFuso(TypeDecorator):  # SQLite perde o fuso; Postgres não.
    impl = DateTime
    cache_ok = True

    def process_result_value(self, valor, dialeto):
        return valor.replace(tzinfo=timezone.utc) if valor is not None and valor.tzinfo is None else valor


TreinoTemplate.__table__.columns["dados_json"].type = JSON()
Assinatura.__table__.columns["current_period_end"].type = _ComFuso()
Base.metadata.create_all(engine)

# ---------------- Mercado Pago falso ----------------
import app.services.mercadopago_service as mp  # noqa: E402
from app.core.config import get_settings as _gs  # noqa: E402
_cfg = _gs()
_cfg.mercadopago_public_key = _cfg.mercadopago_public_key or "APP_USR-chave-publica-falsa"
_cfg.valor_mensal_padrao = 0

FAKE = {"preapprovals": {}, "pagamentos": {}, "avulsos": {}, "chamadas": [], "proximo": 1, "fora_do_ar": False}


def mp_falso(metodo, caminho, corpo=None):
    FAKE["chamadas"].append((metodo, caminho, corpo))
    if FAKE["fora_do_ar"]:
        raise mp.ErroMercadoPago("timeout")  # sem status HTTP = instabilidade
    if metodo == "POST" and caminho == "/preapproval":
        token = corpo.get("card_token_id")
        if token == "tok_sem_saldo":
            raise mp.ErroMercadoPago('{"message":"cc_rejected_insufficient_amount"}', 400)
        pid = f"pre{FAKE['proximo']}"
        FAKE["proximo"] += 1
        status = "pending" if token == "tok_processando" else "authorized"
        FAKE["preapprovals"][pid] = {
            "id": pid,
            "status": status,
            "external_reference": corpo["external_reference"],
            "next_payment_date": corpo["auto_recurring"].get("start_date") or "2026-12-06T10:00:00.000-03:00",
            "start_date": corpo["auto_recurring"].get("start_date"),
            "auto_recurring": corpo["auto_recurring"],
            "valor": corpo["auto_recurring"]["transaction_amount"],
            "card_token_id": token,
            "payer_email": corpo["payer_email"],
        }
        return dict(FAKE["preapprovals"][pid])
    if caminho.startswith("/preapproval/search"):
        return {"results": [dict(v) for v in FAKE["preapprovals"].values()]}
    if caminho.startswith("/preapproval/"):
        pid = caminho.rsplit("/", 1)[1]
        if metodo == "PUT":
            FAKE["preapprovals"][pid]["status"] = corpo["status"]
        return dict(FAKE["preapprovals"][pid])
    if caminho.startswith("/authorized_payments/search"):
        pid = caminho.split("preapproval_id=", 1)[1]
        return {"results": [
            {"id": k, "transaction_amount": 1.0, "payment": {"id": k, "status": v["payment"]["status"]}}
            for k, v in FAKE["pagamentos"].items() if v["preapproval_id"] == pid
        ]}
    if caminho.startswith("/v1/payments/search"):
        return {"results": []}
    if metodo == "POST" and caminho.startswith("/v1/payments/") and caminho.endswith("/refunds"):
        pay = caminho.split("/")[3]
        if pay in FAKE["avulsos"]:
            FAKE["avulsos"][pay]["status"] = "refunded"
        else:
            FAKE["pagamentos"][pay]["payment"]["status"] = "refunded"
        return {"id": 1, "payment_id": pay}
    if metodo == "POST" and caminho == "/v1/payments":
        pid = f"av{FAKE['proximo']}"
        FAKE["proximo"] += 1
        pagamento = {
            "id": pid,
            "external_reference": corpo["external_reference"],
            "transaction_amount": corpo["transaction_amount"],
            "payment_method_id": corpo["payment_method_id"],
            "corpo": corpo,
        }
        if corpo["payment_method_id"] == "pix":
            pagamento.update(
                status="pending",
                date_of_expiration=corpo["date_of_expiration"],
                point_of_interaction={"transaction_data": {"qr_code": f"00020126-PIX-{pid}", "qr_code_base64": "iVBORw0KGgo=", "ticket_url": "https://mp/pix"}},
            )
        elif corpo["token"] == "tok_deb_recusado":
            pagamento.update(status="rejected", status_detail="cc_rejected_insufficient_amount")
        elif corpo["token"] == "tok_deb_analise":
            pagamento.update(status="in_process")
        else:
            pagamento.update(status="approved")
            if corpo["external_reference"].startswith("seklyn-loja-"):
                pagamento["payment_type_id"] = "debit_card" if corpo["payment_method_id"].startswith("deb") else "credit_card"
                pagamento["fee_details"] = [{"type": "mercadopago_fee", "amount": round(corpo["transaction_amount"] * 0.03, 2)}]
        FAKE["avulsos"][pid] = pagamento
        return dict(pagamento)
    if metodo == "PUT" and caminho.startswith("/v1/payments/"):
        FAKE["avulsos"][caminho.rsplit("/", 1)[1]]["status"] = corpo["status"]
        return dict(FAKE["avulsos"][caminho.rsplit("/", 1)[1]])
    if metodo == "GET" and caminho.startswith("/v1/payments/"):
        pid = caminho.rsplit("/", 1)[1]
        return dict(FAKE["avulsos"].get(pid) or {"id": pid, "status": "approved", "external_reference": "loja-qualquer-123"})
    if caminho.startswith("/authorized_payments/"):
        return FAKE["pagamentos"][caminho.rsplit("/", 1)[1]]
    raise AssertionError(f"chamada inesperada: {metodo} {caminho}")


mp._requisitar = mp_falso
# E-mails: captura (síncrono) em vez de mandar pelo Resend.
from app.services import email_avisos as _email_avisos  # noqa: E402

EMAILS = []
_email_avisos._em_segundo_plano = lambda funcao, *a, **k: funcao(*a, **k)
_email_avisos.enviar_email = lambda destino, assunto, html, texto=None: EMAILS.append((destino, assunto))
# Cenários antigos testam o reembolso com conta comum: simula "reembolso pra todos".
_reembolso_real = mp.reembolso_horas_para
mp.reembolso_horas_para = lambda assinatura: mp.settings.reembolso_horas

# ---------------- dados ----------------
db = SessionLocal()
admin = Personal(nome="Dono", email="dono@seklyn.com.br", senha_hash=hash_senha("x" * 8), is_admin=True)
ana = Personal(nome="Ana Souza", email="ana@teste.com", senha_hash=hash_senha("x" * 8), cpf="529.982.247-25")
db.add_all([admin, ana])
db.commit()
TOKEN_ADMIN = criar_token_acesso(admin.id)
admin_id_teste = admin.id
TOKEN_ANA = criar_token_acesso(ana.id)
ANA_ID = ana.id
db.close()

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

cliente = TestClient(app)
H_ANA = {"Authorization": f"Bearer {TOKEN_ANA}"}
H_ADMIN = {"Authorization": f"Bearer {TOKEN_ADMIN}"}
falhas = []


def checar(descricao, condicao, detalhe=""):
    print(f"[{'OK' if condicao else 'FALHOU'}] {descricao}" + (f"  -> {detalhe}" if not condicao and detalhe else ""))
    if not condicao:
        falhas.append(descricao)


def webhook(tipo, recurso_id, segredo="segredo-webhook", request_id="req-123", ts="1730800000"):
    manifesto = f"id:{recurso_id.lower() if recurso_id.isalnum() else recurso_id};request-id:{request_id};ts:{ts};"
    v1 = hmac.new(segredo.encode(), manifesto.encode(), hashlib.sha256).hexdigest()
    return cliente.post(
        f"/api/mercadopago/webhook?data.id={recurso_id}&type={tipo}",
        json={"type": tipo, "data": {"id": recurso_id}},
        headers={"x-signature": f"ts={ts},v1={v1}", "x-request-id": request_id},
    )


def assinar(token):
    return cliente.post("/api/personal/assinatura/cartao", json={"card_token": token}, headers=H_ANA)


def status_ana():
    return cliente.get("/api/personal/assinatura", headers=H_ANA).json()


def agora():
    return datetime.now(timezone.utc)


def editar_ana(**campos):
    sessao = SessionLocal()
    try:
        a = sessao.query(Assinatura).filter(Assinatura.personal_id == ANA_ID).first()
        for k, v in campos.items():
            setattr(a, k, v)
        sessao.commit()
    finally:
        sessao.close()


def ana_no_banco():
    sessao = SessionLocal()
    try:
        a = sessao.query(Assinatura).filter(Assinatura.personal_id == ANA_ID).first()
        sessao.expunge(a)
        return a
    finally:
        sessao.close()


def refunds():
    return [c[1].split("/")[3] for c in FAKE["chamadas"] if c[0] == "POST" and c[1].endswith("/refunds")]


def perto(d1, d2, segundos=120):
    if d1.tzinfo is None:
        d1 = d1.replace(tzinfo=timezone.utc)
    if d2.tzinfo is None:
        d2 = d2.replace(tzinfo=timezone.utc)
    return abs((d1 - d2).total_seconds()) < segundos


def status_no_banco():
    sessao = SessionLocal()
    try:
        return sessao.query(Assinatura).filter(Assinatura.personal_id == ANA_ID).first().status
    finally:
        sessao.close()


# 1) Sem valor combinado não dá pra assinar.
r = assinar("tok_ok_1")
checar("sem valor mensal → 409", r.status_code == 409, r.text)

# 2) Só o admin define o preço.
r = cliente.put(f"/api/admin/personais/{ANA_ID}/valor", json={"valor_mensal": 1}, headers=H_ANA)
checar("Personal comum não define o próprio valor (403)", r.status_code == 403, r.text)
r = cliente.put(f"/api/admin/personais/{ANA_ID}/valor", json={"valor_mensal": -5}, headers=H_ADMIN)
checar("valor negativo rejeitado (422)", r.status_code == 422, r.text)
r = cliente.put(f"/api/admin/personais/{ANA_ID}/valor", json={"valor_mensal": "89.90"}, headers=H_ADMIN)
checar("admin define R$ 89,90", r.status_code == 200 and float(r.json()["valor_mensal"]) == 89.9, r.text)

s = status_ana()
checar("tela recebe a chave pública pro formulário", s["pagamento_disponivel"] and s["mp_public_key"] == "TEST-public-key", s)

# 3) Inativa: escrita bloqueada.
r = cliente.post("/api/personal/alunos", json={"nome": "Aluno X"}, headers=H_ANA)
checar("inativa: criar aluno bloqueado (402)", r.status_code == 402, r.text)

# 4) Token inválido (curto demais) nem chega no MP.
r = cliente.post("/api/personal/assinatura/cartao", json={"card_token": "x"}, headers=H_ANA)
checar("token malformado → 422", r.status_code == 422, r.text)

# 5) Cartão recusado: mensagem clara e nada é ativado.
r = assinar("tok_sem_saldo")
checar("cartão sem saldo → 402", r.status_code == 402, r.text)
checar("...com o motivo em português", "Saldo ou limite insuficiente" in r.json().get("detail", ""), r.text)
checar("...e a conta continua inativa", status_no_banco() == "inativa")

# 6) MP fora do ar: 502 e aviso de que nada foi cobrado.
FAKE["fora_do_ar"] = True
r = assinar("tok_ok_1")
FAKE["fora_do_ar"] = False
checar("MP fora do ar → 502 'nenhuma cobrança'", r.status_code == 502 and "Nenhuma cobrança" in r.json()["detail"], r.text)

# 7) Cartão aprovado: ativa NA HORA (sem esperar webhook).
r = assinar("tok_ok_1")
pre1 = FAKE["preapprovals"].get("pre1", {})
checar("cartão ok → 200 e já ativa", r.status_code == 200 and r.json()["ativa"] and r.json()["automatica"], r.text)
checar("preapproval criado com o token e R$ 89,90", pre1.get("card_token_id") == "tok_ok_1" and pre1.get("valor") == 89.9, pre1)
checar("cobrança no e-mail da conta Seklyn", pre1.get("payer_email") == "ana@teste.com", pre1)
checar("próxima cobrança registrada", (r.json()["current_period_end"] or "").startswith("2026-12-06"), r.text)
r = cliente.post("/api/personal/alunos", json={"nome": "Aluno X"}, headers=H_ANA)
checar("ativa: criar aluno liberado (201)", r.status_code == 201, r.text)

# 8) Já ativa: não deixa assinar de novo.
r = assinar("tok_ok_2")
checar("já ativa → 409", r.status_code == 409, r.text)

# 9) Webhook com assinatura falsa é recusado.
r = webhook("subscription_preapproval", "pre1", segredo="segredo-errado")
checar("webhook com assinatura falsa → 401", r.status_code == 401, r.text)

# 10) Cobrança mensal recusada → past_due → escrita bloqueada.
FAKE["pagamentos"]["pay9"] = {"id": "pay9", "preapproval_id": "pre1", "payment": {"status": "rejected"}}
r = webhook("subscription_authorized_payment", "pay9")
checar("cobrança recusada → past_due", r.status_code == 200 and status_no_banco() == "past_due", r.text)
r = cliente.post("/api/personal/alunos", json={"nome": "Aluno Y"}, headers=H_ANA)
checar("past_due: escrita bloqueada (402)", r.status_code == 402, r.text)

# 11) Assina de novo com outro cartão: cancela a antiga antes (sem cobrança dupla).
r = assinar("tok_ok_2")
checar("re-assinar com outro cartão → ativa", r.status_code == 200 and r.json()["ativa"], r.text)
checar("preapproval antigo (pre1) cancelado no MP", FAKE["preapprovals"]["pre1"]["status"] == "cancelled")

# 12) Notificação atrasada do preapproval antigo não derruba o atual.
webhook("subscription_preapproval", "pre1")
checar("notificação velha (pre1) ignorada", status_no_banco() == "active", status_no_banco())

# 13) Cancelar pelo site.
r = cliente.post("/api/personal/assinatura/cancelar", headers=H_ANA)
checar(
    "cancelar sem cobrança achada → segue ativa até o fim do mês (agendado)",
    r.status_code == 200 and r.json()["ativa"] and r.json()["cancelamento_agendado"],
    r.text,
)
checar("cancelamento enviado ao MP", FAKE["preapprovals"]["pre2"]["status"] == "cancelled")
r = cliente.post("/api/personal/assinatura/cancelar", headers=H_ANA)
checar("cancelar de novo → 409", r.status_code == 409, r.text)
editar_ana(current_period_end=agora() - timedelta(minutes=1))  # o mês pago acabou
checar("mês acabou → vencida", status_ana()["status"] == "vencida" and not status_ana()["ativa"], status_ana())

# 14) Pagamento que fica processando: pendente → MP aprova → a tela ativa sozinha.
r = assinar("tok_processando")
checar("cartão em análise → pendente", r.status_code == 200 and r.json()["status"] == "pendente", r.text)
FAKE["preapprovals"]["pre3"]["status"] = "authorized"
s = status_ana()
checar("sem webhook: tela consulta o MP e ativa", s["ativa"] and s["status"] == "active", s)

# 15) Diversos.
checar("tópico que não nos interessa → 200", webhook("payment", "123").status_code == 200)
checar("sem login → 401", cliente.get("/api/personal/assinatura").status_code == 401)
checar("rota antiga de checkout removida (404/405)", cliente.post("/api/personal/assinatura/checkout", headers=H_ANA).status_code in (404, 405))

# 16) Botão de teste do admin: R$ 1,00 separado, consulta e reembolso.
status_ana_antes = status_no_banco()
r = cliente.get("/api/admin/teste-cartao/config", headers=H_ANA)
checar("Personal comum não acessa o teste (403)", r.status_code == 403, r.text)
r = cliente.get("/api/admin/teste-cartao/config", headers=H_ADMIN)
checar("config do teste disponível", r.status_code == 200 and r.json()["disponivel"] and r.json()["valor"] == 1.0, r.text)
r = cliente.post("/api/admin/teste-cartao", json={"card_token": "tok_teste_1", "payer_email": "outro@email.com"}, headers=H_ADMIN)
checar("admin cria cobrança de teste", r.status_code == 200 and r.json()["status"] == "authorized", r.text)
tid = r.json().get("preapproval_id")
pre = FAKE["preapprovals"].get(tid, {})
checar("teste: R$ 1,00 e referência de teste", pre.get("valor") == 1.0 and pre.get("external_reference", "").startswith("seklyn-teste-"), pre)
checar("teste não mexe na assinatura da Ana", status_no_banco() == status_ana_antes, status_no_banco())
r = cliente.post("/api/admin/teste-cartao", json={"card_token": "tok_sem_saldo", "payer_email": "outro@email.com"}, headers=H_ADMIN)
checar("teste com cartão sem saldo → 402", r.status_code == 402, r.text)
FAKE["pagamentos"]["payT"] = {"id": "payT", "preapproval_id": tid, "payment": {"status": "approved"}}
r = cliente.get(f"/api/admin/teste-cartao/{tid}", headers=H_ADMIN)
pags = r.json().get("pagamentos", [])
checar("consulta mostra a cobrança", r.status_code == 200 and pags and pags[0]["status"] == "approved" and pags[0]["valor"] == 1.0, r.text)
r = cliente.post(f"/api/admin/teste-cartao/{tid}/reembolsar", headers=H_ADMIN)
checar("cancelar e reembolsar", r.status_code == 200 and r.json()["reembolsados"] == ["payT"], r.text)
checar("assinatura de teste cancelada no MP", FAKE["preapprovals"][tid]["status"] == "cancelled")
checar("refund chamado no MP", ("POST", "/v1/payments/payT/refunds", {}) in FAKE["chamadas"])
r = cliente.post("/api/admin/teste-cartao/pre2/reembolsar", headers=H_ADMIN)
checar("assinatura real (não teste) não é reembolsável (400)", r.status_code == 400, r.text)
r = cliente.get("/api/admin/teste-cartao/abc%3Fx=1", headers=H_ADMIN)
checar("ID com caracteres estranhos → 422", r.status_code == 422, r.text)
r = cliente.post(f"/api/admin/teste-cartao/{tid}/reembolsar", headers=H_ANA)
checar("Personal comum não reembolsa (403)", r.status_code == 403, r.text)

# 17) Crédito: cancelar dentro de 10h → reembolso e encerra na hora.
s = status_ana()
checar("crédito ativo mostra janela de reembolso", s["ativa"] and s["reembolso_ate"] and s["forma_pagamento"] == "credito", s)
pre_atual = ana_no_banco().mp_preapproval_id
FAKE["pagamentos"]["payC"] = {"id": "payC", "preapproval_id": pre_atual, "payment": {"id": "payC", "status": "approved"}}
r = cliente.post("/api/personal/assinatura/cancelar", headers=H_ANA)
checar("crédito em até 10h → reembolsa e cancela", r.status_code == 200 and r.json()["status"] == "canceled" and not r.json()["ativa"], r.text)
checar("reembolso da cobrança do crédito pedido", "payC" in refunds(), refunds())

# 18) Crédito: cancelar depois de 10h → sem reembolso, ativa até o fim do mês.
r = assinar("tok_ok_3")
checar("assina de novo no crédito", r.status_code == 200 and r.json()["ativa"], r.text)
editar_ana(ultimo_pagamento_em=agora() - timedelta(hours=11))
checar("passou 10h → sem janela de reembolso", status_ana()["reembolso_ate"] is None)
antes = len(refunds())
r = cliente.post("/api/personal/assinatura/cancelar", headers=H_ANA)
j = r.json()
checar("crédito após 10h → continua ativa, cancelamento agendado", r.status_code == 200 and j["ativa"] and j["cancelamento_agendado"] and not j["automatica"], r.text)
checar("crédito após 10h → nenhum reembolso", len(refunds()) == antes)
pre4 = ana_no_banco().mp_preapproval_id
checar("crédito após 10h → assinatura parada no MP", FAKE["preapprovals"][pre4]["status"] == "cancelled")
webhook("subscription_preapproval", pre4)
checar("webhook do preapproval cancelado não derruba o mês pago", status_ana()["ativa"], status_ana())
editar_ana(current_period_end=agora() - timedelta(minutes=1))
checar("fim do mês → vencida", status_ana()["status"] == "vencida")
r = cliente.post("/api/personal/alunos", json={"nome": "Aluno Z"}, headers=H_ANA)
checar("vencida: escrita bloqueada (402)", r.status_code == 402, r.text)

# 19) Pix: gera, reaproveita o mesmo enquanto aberto, pago → +1 mês.
s = status_ana()
checar("vencida pode pagar Pix/débito", s["pode_pagar_avulso"] and s["pode_assinar_credito"], s)
r = cliente.post("/api/personal/assinatura/pix", headers=H_ANA)
pix1 = r.json()
checar("Pix gerado com QR e copia-e-cola", r.status_code == 200 and pix1["qr_code"] and pix1["qr_code_base64"], r.text)
checar("Pix no valor do plano", FAKE["avulsos"][pix1["pagamento_id"]]["transaction_amount"] == 89.9)
r = cliente.post("/api/personal/assinatura/pix", headers=H_ANA)
checar("Pix em aberto é reaproveitado", r.json()["pagamento_id"] == pix1["pagamento_id"], r.text)
checar("Pix aberto → pagamento em andamento", status_ana()["pagamento_em_andamento"])
FAKE["avulsos"][pix1["pagamento_id"]]["status"] = "approved"
s = status_ana()
fim_pix = datetime.fromisoformat(s["current_period_end"])
checar("Pix pago → ativa, forma pix", s["ativa"] and s["forma_pagamento"] == "pix" and not s["pagamento_em_andamento"], s)
checar("Pix pago → vale 1 mês a partir de hoje", 27 <= (fim_pix - agora()).days <= 31, fim_pix)
webhook("payment", pix1["pagamento_id"])
checar("webhook do mesmo Pix não soma 2 meses", datetime.fromisoformat(status_ana()["current_period_end"]) == fim_pix)
checar("Pix com mês longe de vencer: sem alerta", not status_ana()["alerta_vencimento"])
r = cliente.post("/api/personal/assinatura/pix", headers=H_ANA)
checar("Pix antes da hora (mês longe de vencer) → 409", r.status_code == 409, r.text)

# 20) Perto de vencer: alerta grande + pagar adiantado soma a partir do fim do mês.
editar_ana(current_period_end=agora() + timedelta(days=3), ultimo_pagamento_em=agora() - timedelta(days=27))
s = status_ana()
checar("3 dias pra vencer → alerta e Pix liberado", s["alerta_vencimento"] and s["dias_para_vencer"] == 3 and s["pode_pagar_avulso"], s)
fim_antigo = ana_no_banco().current_period_end
r = cliente.post("/api/personal/assinatura/pix", headers=H_ANA)
pix2 = r.json()["pagamento_id"]
FAKE["avulsos"][pix2]["status"] = "approved"
s = status_ana()
novo_fim = datetime.fromisoformat(s["current_period_end"])
checar("pago adiantado → +1 mês a partir do fim do atual", perto(novo_fim, mp._somar_meses(fim_antigo, 1)), (novo_fim, fim_antigo))
checar("pagou → alerta some", not s["alerta_vencimento"], s)

# 21) Pix: reembolso em até 10h volta pro mês que já tinha.
r = cliente.post("/api/personal/assinatura/cancelar", headers=H_ANA)
j = r.json()
checar("Pix em até 10h → reembolsado", pix2 in refunds(), refunds())
checar("reembolso do adiantado → volta pro fim antigo, sem renovar", j["ativa"] and j["cancelamento_agendado"] and perto(datetime.fromisoformat(j["current_period_end"]), fim_antigo), j)

# 22) Débito: recusado, incompleto, aprovado.
r = cliente.post("/api/personal/assinatura/cartao", json={"card_token": "tok_deb_recusado", "tipo": "debito", "payment_method_id": "debvisa"}, headers=H_ANA)
checar("débito sem saldo → 402 com motivo", r.status_code == 402 and "limite" in r.text.lower(), r.text)
r = cliente.post("/api/personal/assinatura/cartao", json={"card_token": "tok_deb_ok_1", "tipo": "debito"}, headers=H_ANA)
checar("débito sem payment_method_id → 422", r.status_code == 422, r.text)
r = cliente.post(
    "/api/personal/assinatura/cartao",
    json={"card_token": "tok_deb_ok_1", "tipo": "debito", "payment_method_id": "debvisa", "issuer_id": "25", "documento_tipo": "CPF", "documento_numero": "12345678909"},
    headers=H_ANA,
)
j = r.json()
checar("débito aprovado → ativa, forma débito, renovação religada", r.status_code == 200 and j["ativa"] and j["forma_pagamento"] == "debito" and not j["cancelamento_agendado"], r.text)
deb = [p for p in FAKE["avulsos"].values() if p["payment_method_id"] == "debvisa" and p["status"] == "approved"][-1]
checar("débito: 1x, CPF e banco enviados", deb["corpo"]["installments"] == 1 and deb["corpo"]["payer"]["identification"]["number"] == "12345678909" and deb["corpo"]["issuer_id"] == 25, deb["corpo"])

# 23) Débito depois de 10h: cancelar só para a renovação.
editar_ana(ultimo_pagamento_em=agora() - timedelta(hours=10, minutes=1))
antes = len(refunds())
r = cliente.post("/api/personal/assinatura/cancelar", headers=H_ANA)
checar("débito após 10h → sem reembolso, ativa até o fim", r.json()["ativa"] and r.json()["cancelamento_agendado"] and len(refunds()) == antes, r.text)

# 24) Débito em análise: fica pendente e ativa quando aprovar.
editar_ana(current_period_end=agora() - timedelta(minutes=1), cancelamento_agendado=False)
r = cliente.post("/api/personal/assinatura/cartao", json={"card_token": "tok_deb_analise", "tipo": "debito", "payment_method_id": "debmaster"}, headers=H_ANA)
checar("débito em análise → ainda não ativa, em andamento", r.status_code == 200 and not r.json()["ativa"] and r.json()["pagamento_em_andamento"], r.text)
FAKE["avulsos"][ana_no_banco().pagamento_pendente_id]["status"] = "approved"
checar("débito aprovado depois → ativa sozinha", status_ana()["ativa"])

# 25) Crédito com mês já pago: 1ª cobrança automática só no fim dele.
editar_ana(ultimo_pagamento_em=agora() - timedelta(days=2))
r = assinar("tok_ok_4")
j = r.json()
pre5 = ana_no_banco().mp_preapproval_id
checar("trocar pra crédito com mês pago → começa no fim do mês", r.status_code == 200 and j["ativa"] and j["forma_pagamento"] == "credito" and FAKE["preapprovals"][pre5]["start_date"], (r.text, FAKE["preapprovals"][pre5]))
checar("trocar pra crédito com mês pago → sem janela de reembolso (nada cobrado agora)", j["reembolso_ate"] is None, j)

# 26) Diversos.
checar("webhook de pagamento que não é do Seklyn → 200", webhook("payment", "pay9").status_code == 200)
r = cliente.post(f"/api/admin/personais/{ANA_ID}/ativar", headers=H_ADMIN)
checar("ativação pelo admin → não vence sozinha", ana_no_banco().forma_pagamento is None and status_ana()["dias_para_vencer"] is None, status_ana())

# 27) Loja do parceiro (teste): venda por Pix, divisão meio a meio, repasse.
from app.services import parceiro_service as loja_srv  # noqa: E402

r = cliente.get("/api/admin/loja", headers=H_ANA)
checar("loja: Personal comum não acessa (403)", r.status_code == 403, r.text)
r = cliente.get("/api/admin/loja", headers=H_ADMIN)
checar("loja: painel vazio sem parceiro", r.status_code == 200 and r.json()["parceiro"] is None, r.text)
r = cliente.post("/api/admin/loja/vendas", json={"produto": "Camiseta", "valor": "1.00", "email_pagador": "cliente@teste.com"}, headers=H_ADMIN)
checar("loja: vender sem parceiro → 409", r.status_code == 409, r.text)
r = cliente.put("/api/admin/loja/parceiro", json={"nome": "Douglas Personal", "chave_pix_tipo": "cpf", "chave_pix": "123"}, headers=H_ADMIN)
checar("loja: chave Pix que não confere → 422", r.status_code == 422, r.text)
r = cliente.put(
    "/api/admin/loja/parceiro",
    json={"nome": "Douglas Personal", "chave_pix_tipo": "celular", "chave_pix": "(18) 99999-8888", "cidade": "Andradina", "percentual_parceiro": 50},
    headers=H_ADMIN,
)
checar("loja: parceiro salvo, celular normalizado", r.status_code == 200 and r.json()["chave_pix"] == "+5518999998888", r.text)
checar("loja: padrão novo = taxa dividida entre os dois", r.json()["taxa_paga_por"] == "dividida", r.text)
r = cliente.put(
    "/api/admin/loja/parceiro",
    json={"nome": "Douglas Personal", "chave_pix_tipo": "celular", "chave_pix": "(18) 99999-8888", "cidade": "Andradina", "percentual_parceiro": 50, "taxa_paga_por": "parceiro"},
    headers=H_ADMIN,
)
r = cliente.post("/api/admin/loja/vendas", json={"produto": "Camiseta Seklyn", "valor": "100.00", "email_pagador": "cliente@teste.com"}, headers=H_ADMIN)
j = r.json()
checar("loja: venda gera Pix", r.status_code == 200 and j["pix_qr_code"] and j["venda"]["status"] == "aguardando", r.text)
vid = j["venda"]["id"]
pag = FAKE["avulsos"][ana_pag := str(next(k for k, v in FAKE["avulsos"].items() if v["external_reference"] == f"seklyn-loja-{vid}"))]
checar("loja: referência da venda no Mercado Pago", pag["external_reference"] == f"seklyn-loja-{vid}" and pag["transaction_amount"] == 100.0)
r = cliente.get(f"/api/admin/loja/vendas/{vid}/repasse", headers=H_ADMIN)
checar("loja: repasse antes de pagar → 409", r.status_code == 409, r.text)
pag["status"] = "approved"
pag["fee_details"] = [{"type": "mercadopago_fee", "amount": 0.99}]
r = cliente.get("/api/admin/loja", headers=H_ADMIN)
p = r.json()
v = p["vendas"][0]
checar(
    "loja: paga → você 50% do valor cheio, taxa sai do parceiro",
    v["status"] == "paga" and float(v["taxa_mp"]) == 0.99 and float(v["parte_parceiro"]) == 49.01 and float(v["parte_dono"]) == 50.00,
    v,
)
checar("loja: totais (a repassar)", float(p["total_vendido"]) == 100 and float(p["a_repassar"]) == 49.01 and float(p["liquido_dono"]) == 50.0, p)
webhook("payment", ana_pag)
checar("loja: webhook da mesma venda não muda nada", float(cliente.get(f"/api/admin/loja/vendas/{vid}", headers=H_ADMIN).json()["parte_parceiro"]) == 49.01)
r = cliente.get(f"/api/admin/loja/vendas/{vid}/repasse", headers=H_ADMIN)
rep = r.json()
codigo = rep["pix_copia_e_cola"]
checar("loja: Pix de repasse com chave e valor do Douglas", r.status_code == 200 and "+5518999998888" in codigo and "540549.01" in codigo and "DOUGLAS PERSONAL" in codigo, codigo)
checar("loja: CRC do Pix de repasse confere", loja_srv._crc16(codigo[:-4]) == codigo[-4:], codigo)
r = cliente.post(f"/api/admin/loja/vendas/{vid}/repassado", headers=H_ADMIN)
p = cliente.get("/api/admin/loja", headers=H_ADMIN).json()
checar("loja: marcado como repassado", r.json()["repasse_status"] == "feito" and float(p["ja_repassado"]) == 49.01 and float(p["a_repassar"]) == 0, p)
r = cliente.post(f"/api/admin/loja/vendas/{vid}/reembolsar", headers=H_ADMIN)
checar("loja: reembolso da venda de teste", r.status_code == 200 and r.json()["status"] == "reembolsada" and ana_pag in refunds(), r.text)
checar("loja: assinatura da Ana não foi afetada pela venda", ana_no_banco().forma_pagamento is None)

# 28) Loja no cartão (R$ 1,00): você 0,50, parceiro 0,47 (taxa de 0,03 sai dele).
venda_cartao = {"produto": "Teste cartão", "valor": "1.00", "email_pagador": "cliente@teste.com", "card_token": "tok_loja_1", "payment_method_id": "master"}
r = cliente.post("/api/admin/loja/vendas/cartao", json=venda_cartao, headers=H_ANA)
checar("loja cartão: Personal comum não vende (403)", r.status_code == 403, r.text)
r = cliente.post("/api/admin/loja/vendas/cartao", json=venda_cartao, headers=H_ADMIN)
j = r.json()
checar(
    "loja cartão: R$ 1 → você 0,50, parceiro 0,47",
    r.status_code == 200 and j["status"] == "paga" and float(j["parte_dono"]) == 0.50 and float(j["parte_parceiro"]) == 0.47 and j["forma_pagamento"] == "credito",
    r.text,
)
r = cliente.post("/api/admin/loja/vendas/cartao", json={**venda_cartao, "payment_method_id": "debmaster", "card_token": "tok_loja_2"}, headers=H_ADMIN)
checar("loja cartão: débito reconhecido", r.status_code == 200 and r.json()["forma_pagamento"] == "debito", r.text)
r = cliente.post("/api/admin/loja/vendas/cartao", json={**venda_cartao, "card_token": "tok_deb_recusado"}, headers=H_ADMIN)
checar("loja cartão: recusado → 402 com motivo", r.status_code == 402 and "limite" in r.text.lower(), r.text)
r = cliente.post("/api/admin/loja/vendas/cartao", json={**venda_cartao, "card_token": "tok_deb_analise"}, headers=H_ADMIN)
checar("loja cartão: em análise → aguardando", r.status_code == 200 and r.json()["status"] == "aguardando", r.text)
p = cliente.get("/api/admin/loja", headers=H_ADMIN).json()
checar("loja: painel manda a chave pública pro formulário de cartão", p["mp_public_key"], p.get("mp_public_key"))

# 29) Opção "taxa dividida" (a anterior) continua disponível.
r = cliente.put(
    "/api/admin/loja/parceiro",
    json={"nome": "Douglas Personal", "chave_pix_tipo": "celular", "chave_pix": "18999998888", "percentual_parceiro": 50, "taxa_paga_por": "dividida"},
    headers=H_ADMIN,
)
checar("loja: muda pra taxa dividida", r.status_code == 200 and r.json()["taxa_paga_por"] == "dividida", r.text)
r = cliente.post("/api/admin/loja/vendas/cartao", json={**venda_cartao, "valor": "100.00", "card_token": "tok_loja_3"}, headers=H_ADMIN)
j = r.json()
checar("loja: taxa dividida → 48,50 / 48,50 (taxa 3,00)", float(j["parte_parceiro"]) == 48.50 and float(j["parte_dono"]) == 48.50 and j["taxa_paga_por"] == "dividida", r.text)
checar("loja: venda antiga mantém a regra dela", cliente.get(f"/api/admin/loja/vendas/{vid}", headers=H_ADMIN).json()["taxa_paga_por"] == "parceiro")

# 30) Verificar chave Pix (QR de R$ 0,01) e repasse de tudo de uma vez.
r = cliente.get("/api/admin/loja/parceiro/teste-chave", headers=H_ADMIN)
cod = r.json().get("pix_copia_e_cola", "")
checar("chave: Pix de teste de R$ 0,01 pra chave do parceiro", r.status_code == 200 and "54040.01" in cod and "+5518999998888" in cod and loja_srv._crc16(cod[:-4]) == cod[-4:], r.text)
checar("chave: começa não verificada", cliente.get("/api/admin/loja", headers=H_ADMIN).json()["parceiro"]["chave_verificada_em"] is None)
r = cliente.post("/api/admin/loja/parceiro/chave-verificada", headers=H_ADMIN)
checar("chave: marcada como verificada", r.status_code == 200 and r.json()["chave_verificada_em"], r.text)
base_parceiro = {"nome": "Douglas Personal", "chave_pix_tipo": "celular", "chave_pix": "18999998888", "percentual_parceiro": 50, "taxa_paga_por": "parceiro"}
r = cliente.put("/api/admin/loja/parceiro", json=base_parceiro, headers=H_ADMIN)
checar("chave: salvar sem mudar a chave mantém verificada", r.json()["chave_verificada_em"], r.text)
r = cliente.put("/api/admin/loja/parceiro", json={**base_parceiro, "chave_pix": "18911112222"}, headers=H_ADMIN)
checar("chave: trocar a chave zera a verificação", r.json()["chave_verificada_em"] is None, r.text)
r = cliente.get("/api/admin/loja/parceiro/teste-chave", headers=H_ANA)
checar("chave: Personal comum não acessa (403)", r.status_code == 403, r.text)

p = cliente.get("/api/admin/loja", headers=H_ADMIN).json()
pendentes = [v for v in p["vendas"] if v["status"] == "paga" and v["repasse_status"] == "pendente"]
soma = round(sum(float(v["parte_parceiro"]) for v in pendentes), 2)
r = cliente.get("/api/admin/loja/repasse-pendente", headers=H_ADMIN)
j = r.json()
checar("repasse total: soma de todas as vendas pendentes", r.status_code == 200 and float(j["valor"]) == soma and sorted(j["vendas"]) == sorted(v["id"] for v in pendentes), (j, soma))
checar("repasse total: Pix com o valor somado e CRC certo", f"{soma:.2f}" in j["pix_copia_e_cola"] and loja_srv._crc16(j["pix_copia_e_cola"][:-4]) == j["pix_copia_e_cola"][-4:])
r = cliente.post("/api/admin/loja/repasse-pendente/confirmar", json={"vendas": j["vendas"]}, headers=H_ADMIN)
p = cliente.get("/api/admin/loja", headers=H_ADMIN).json()
checar("repasse total: tudo marcado como feito", len(r.json()) == len(pendentes) and float(p["a_repassar"]) == 0, p)
r = cliente.get("/api/admin/loja/repasse-pendente", headers=H_ADMIN)
checar("repasse total: nada pendente → 409", r.status_code == 409, r.text)

# 31) Teste do admin no débito e no Pix (R$ 1,00) com reembolso / cancelamento.
deb = {"card_token": "tok_teste_deb", "payer_email": "outro@email.com", "payment_method_id": "debmaster", "issuer_id": "24"}
r = cliente.post("/api/admin/teste-pagamento/debito", json=deb, headers=H_ANA)
checar("teste débito: Personal comum não acessa (403)", r.status_code == 403, r.text)
r = cliente.post("/api/admin/teste-pagamento/debito", json=deb, headers=H_ADMIN)
j = r.json()
checar("teste débito: R$ 1,00 aprovado", r.status_code == 200 and j["status"] == "approved" and j["valor"] == 1.0, r.text)
pid_deb = j["pagamento_id"]
checar("teste débito: marcado como teste", FAKE["avulsos"][pid_deb]["external_reference"].startswith("seklyn-teste-"))
r = cliente.post(f"/api/admin/teste-pagamento/{pid_deb}/reembolsar", headers=H_ADMIN)
checar("teste débito: reembolsado", r.status_code == 200 and r.json()["status"] == "refunded" and pid_deb in refunds(), r.text)
r = cliente.post("/api/admin/teste-pagamento/debito", json={**deb, "card_token": "tok_deb_recusado"}, headers=H_ADMIN)
checar("teste débito: recusado → 402", r.status_code == 402, r.text)
r = cliente.post("/api/admin/teste-pagamento/pix", json={"payer_email": "outro@email.com"}, headers=H_ADMIN)
j = r.json()
checar("teste Pix: QR de R$ 1,00", r.status_code == 200 and j["tipo"] == "pix" and j["status"] == "pending" and j["pix_qr_code"], r.text)
pid_pix = j["pagamento_id"]
r = cliente.get(f"/api/admin/teste-pagamento/{pid_pix}", headers=H_ADMIN)
checar("teste Pix: consulta devolve o QR (pra recarregar a página)", r.json()["pix_qr_code_base64"], r.text)
r = cliente.post(f"/api/admin/teste-pagamento/{pid_pix}/reembolsar", headers=H_ADMIN)
checar("teste Pix não pago: cancela o QR", r.json()["status"] == "cancelled" and pid_pix not in refunds(), r.text)
r = cliente.post(f"/api/admin/teste-pagamento/{ana_pag}/reembolsar", headers=H_ADMIN)
checar("teste: pagamento de venda real não é reembolsável por aqui (400)", r.status_code == 400, r.text)

# 32) Cadastro com CPF (obrigatório e validado).
base_cad = {"nome": "Bruno Lima", "email": "bruno@teste.com", "senha": "senha12345"}
r = cliente.post("/api/auth/personal/registrar", json=base_cad)
checar("cadastro sem CPF → 422", r.status_code == 422, r.text)
r = cliente.post("/api/auth/personal/registrar", json={**base_cad, "cpf": "111.111.111-11"})
checar("cadastro com CPF inválido → 422", r.status_code == 422, r.text)
r = cliente.post("/api/auth/personal/registrar", json={**base_cad, "cpf": "52998224725"})
checar("cadastro com CPF válido → salvo formatado", r.status_code == 201 and r.json()["personal"]["cpf"] == "529.982.247-25", r.text)
H_BRUNO = {"Authorization": f"Bearer {r.json()['access_token']}"}

# 33) Preço padrão (R$ 1,00) pra quem não tem valor combinado.
_cfg.valor_mensal_padrao = Decimal("1.00")
s = cliente.get("/api/personal/assinatura", headers=H_BRUNO).json()
checar("sem valor combinado → R$ 1,00 padrão e pode pagar", float(s["valor_mensal"]) == 1.0 and s["pode_pagar_avulso"] and s["pode_assinar_credito"], s)

# 34) Pix com nome, e-mail e CPF da conta como pagador.
r = cliente.post("/api/personal/assinatura/pix", headers=H_BRUNO)
j = r.json()
corpo_pix = FAKE["avulsos"][j["pagamento_id"]]["corpo"]
checar("Pix de R$ 1,00", r.status_code == 200 and corpo_pix["transaction_amount"] == 1.0, r.text)
checar(
    "Pix leva nome, e-mail e CPF do cadastro",
    corpo_pix["payer"] == {"email": "bruno@teste.com", "first_name": "Bruno", "last_name": "Lima", "identification": {"type": "CPF", "number": "52998224725"}},
    corpo_pix["payer"],
)
sessao = SessionLocal()
sem_cpf = Personal(nome="Carla", email="carla@teste.com", senha_hash=hash_senha("x" * 8))
sessao.add(sem_cpf)
sessao.commit()
H_CARLA = {"Authorization": f"Bearer {criar_token_acesso(sem_cpf.id)}"}
sessao.close()
r = cliente.post("/api/personal/assinatura/pix", headers=H_CARLA)
checar("conta antiga sem CPF: Pix pede o CPF (422)", r.status_code == 422, r.text)
r = cliente.post("/api/personal/assinatura/pix", json={"cpf": "123"}, headers=H_CARLA)
checar("conta antiga: CPF inválido no Pix → 422", r.status_code == 422, r.text)
r = cliente.post("/api/personal/assinatura/pix", json={"cpf": "529.982.247-25"}, headers=H_CARLA)
checar("conta antiga: manda o CPF no Pix → gera e salva", r.status_code == 200 and cliente.get("/api/auth/personal/me", headers=H_CARLA).json().get("cpf") == "529.982.247-25", r.text)

# 35) Teste do crédito AUTOMÁTICO: cobra de novo em 2 dias e termina sozinho.
r = cliente.post("/api/admin/teste-cartao", json={"card_token": "tok_auto_1", "payer_email": "outro@email.com", "intervalo_dias": 2}, headers=H_ADMIN)
pid_auto = r.json().get("preapproval_id")
rec = FAKE["preapprovals"].get(pid_auto, {}).get("auto_recurring", {})
checar("teste automático: a cada 2 dias, R$ 1,00", r.status_code == 200 and rec.get("frequency") == 2 and rec.get("frequency_type") == "days" and rec.get("transaction_amount") == 1.0, rec)
fim_auto = datetime.fromisoformat(rec.get("end_date", "2000-01-01T00:00:00+00:00"))
checar("teste automático: termina depois da 2ª cobrança (antes da 3ª)", timedelta(days=2) < fim_auto - agora() < timedelta(days=4), fim_auto)
checar("teste automático: marcado como teste auto", FAKE["preapprovals"][pid_auto]["external_reference"].startswith("seklyn-teste-auto-"))
FAKE["pagamentos"]["payA1"] = {"id": "payA1", "preapproval_id": pid_auto, "payment": {"id": "payA1", "status": "approved"}}
FAKE["pagamentos"]["payA2"] = {"id": "payA2", "preapproval_id": pid_auto, "payment": {"id": "payA2", "status": "approved"}}
r = cliente.post("/api/admin/teste-cartao", json={"card_token": "tok_auto_x", "payer_email": "outro@email.com", "intervalo_dias": 30}, headers=H_ADMIN)
checar("teste automático: intervalo maior que 7 dias → 422", r.status_code == 422, r.text)
import runpy  # noqa: E402

status_clientes_antes = {k: v["status"] for k, v in FAKE["preapprovals"].items() if not v["external_reference"].startswith("seklyn-teste-auto-")}
runpy.run_path(os.path.join(BACKEND, "scripts", "encerrar_testes_automaticos.py"))
checar("encerramento agendado: cancela o teste automático", FAKE["preapprovals"][pid_auto]["status"] == "cancelled")
checar("encerramento agendado: reembolsa as 2 cobranças", "payA1" in refunds() and "payA2" in refunds(), refunds())
checar(
    "encerramento agendado: não toca em nenhuma outra assinatura",
    all(FAKE["preapprovals"][k]["status"] == st for k, st in status_clientes_antes.items()),
)

# 36) Reembolso ao cancelar: só pra conta admin (o dono).
mp.reembolso_horas_para = _reembolso_real
sessao = SessionLocal()
a_ana = sessao.query(Assinatura).filter(Assinatura.personal_id == ANA_ID).first()
a_admin = mp.obter_ou_criar_assinatura(sessao, sessao.get(Personal, admin_id_teste))
checar("reembolso: conta comum não tem (0h)", mp.reembolso_horas_para(a_ana) == 0)
checar("reembolso: conta admin tem 10h", mp.reembolso_horas_para(a_admin) == 10)
sessao.close()
editar_ana(status="active", forma_pagamento="pix", cancelamento_agendado=False, ultimo_pagamento_em=agora(), ultimo_pagamento_id="avX", current_period_end=agora() + timedelta(days=30))
s = status_ana()
checar("cliente que acabou de pagar: sem botão de reembolso", s["reembolso_ate"] is None and s["reembolso_horas"] == 0, s)
antes = len(refunds())
r = cliente.post("/api/personal/assinatura/cancelar", headers=H_ANA)
checar("cliente cancela: nada reembolsado, fica ativa até o fim do mês", r.json()["ativa"] and r.json()["cancelamento_agendado"] and len(refunds()) == antes, r.text)

# 37) Loja de planilhas: produtos no admin, comprador, compra, conteúdo protegido.
import os as _os  # noqa: E402

from app.models.loja import ConteudoProduto as _Conteudo  # noqa: E402

r = cliente.get("/api/loja/produtos")
checar("loja pública: começa vazia", r.status_code == 200 and r.json() == [], r.text)
prod_in = {"titulo": "Planilha Hipertrofia 8 Semanas", "subtitulo": "Do zero ao shape", "descricao": "Treino ABC", "preco": "1.00", "nivel": "Iniciante", "duracao": "8 semanas"}
r = cliente.post("/api/admin/loja/produtos", json=prod_in, headers=H_ANA)
checar("produto: Personal comum não cadastra (403)", r.status_code == 403, r.text)
r = cliente.post("/api/admin/loja/produtos", json=prod_in, headers=H_ADMIN)
prod = r.json()
checar("produto: admin cadastra, slug sem acento", r.status_code == 201 and prod["slug"] == "planilha-hipertrofia-8-semanas", r.text)
PID = prod["id"]
video_bytes = b"\x00\x00\x00\x18ftypmp42" + bytes(range(256)) * 40
r = cliente.post(f"/api/admin/loja/produtos/{PID}/conteudos", data={"titulo": "Aula 1 — Peito", "tipo": "video"}, files={"arquivo": ("aula1.mp4", video_bytes, "video/mp4")}, headers=H_ADMIN)
checar("conteúdo: vídeo enviado", r.status_code == 200 and r.json()["tamanho_bytes"] == len(video_bytes), r.text)
VID = r.json()["id"]
r = cliente.post(f"/api/admin/loja/produtos/{PID}/conteudos", data={"titulo": "Planilha em PDF", "tipo": "arquivo"}, files={"arquivo": ("planilha.pdf", b"%PDF-1.4 teste", "application/pdf")}, headers=H_ADMIN)
checar("conteúdo: PDF enviado", r.status_code == 200, r.text)
ARQ = r.json()["id"]
r = cliente.post(f"/api/admin/loja/produtos/{PID}/conteudos", data={"titulo": "Aquecimento", "tipo": "youtube", "url_youtube": "https://youtu.be/dQw4w9WgXcQ"}, headers=H_ADMIN)
checar("conteúdo: link do YouTube", r.status_code == 200, r.text)
r = cliente.post(f"/api/admin/loja/produtos/{PID}/conteudos", data={"titulo": "x", "tipo": "arquivo"}, files={"arquivo": ("x.exe", b"MZ", "application/x-msdownload")}, headers=H_ADMIN)
checar("conteúdo: formato perigoso recusado (422)", r.status_code == 422, r.text)
caminho_video = SessionLocal().get(_Conteudo, VID).caminho
checar("conteúdo: vídeo guardado na pasta PRIVADA", caminho_video.replace("\\", "/").startswith("uploads/privado/produtos/"), caminho_video)
r = cliente.get("/" + caminho_video.replace("\\", "/"))
checar("pasta privada NÃO é acessível direto (404)", r.status_code == 404, r.status_code)
r = cliente.get("/api/loja/produtos")
pub = r.json()[0]
checar("vitrine: mostra só títulos (sem link do conteúdo)", pub["qtd_videos"] == 2 and pub["qtd_arquivos"] == 1 and "caminho" not in str(pub) and "uploads" not in str(pub["itens"]), pub)

# comprador
base_c = {"nome": "Lucas Aluno", "email": "Lucas@Teste.com", "senha": "senha12345", "cpf": "52998224725"}
r = cliente.post("/api/loja/conta/registrar", json={**base_c, "cpf": "123"})
checar("comprador: CPF inválido → 422", r.status_code == 422, r.text)
r = cliente.post("/api/loja/conta/registrar", json=base_c)
checar("comprador: cadastro", r.status_code == 201 and r.json()["comprador"]["email"] == "lucas@teste.com", r.text)
r = cliente.post("/api/loja/conta/registrar", json=base_c)
checar("comprador: e-mail repetido → 409", r.status_code == 409, r.text)
r = cliente.post("/api/loja/conta/login", json={"email": "lucas@teste.com", "senha": "errada123"})
checar("comprador: senha errada → 401", r.status_code == 401, r.text)
r = cliente.post("/api/loja/conta/login", json={"email": "LUCAS@teste.com", "senha": "senha12345"})
TOK_C = r.json()["access_token"]
H_C = {"Authorization": f"Bearer {TOK_C}"}
checar("comprador: login", r.status_code == 200, r.text)
checar("token de comprador NÃO entra como Personal (401)", cliente.get("/api/auth/personal/me", headers=H_C).status_code == 401)
checar("token de Personal NÃO entra como comprador (401)", cliente.get("/api/loja/conta/me", headers=H_ANA).status_code == 401)
r = cliente.get(f"/api/loja/conta/produtos/{PID}/conteudos", headers=H_C)
checar("antes de pagar: conteúdo bloqueado (403)", r.status_code == 403, r.text)

# compra no Pix
r = cliente.post(f"/api/loja/conta/comprar/{PID}/pix", headers=H_C)
j = r.json()
checar("compra Pix: QR gerado", r.status_code == 200 and j["qr_code"] and float(j["valor"]) == 1.0, r.text)
venda_lucas = j["venda_id"]
pag_lucas = [k for k, v in FAKE["avulsos"].items() if v["external_reference"] == f"seklyn-loja-{venda_lucas}"][0]
checar(
    "compra Pix: pagador com nome e CPF do aluno",
    FAKE["avulsos"][pag_lucas]["corpo"]["payer"] == {"email": "lucas@teste.com", "first_name": "Lucas", "last_name": "Aluno", "identification": {"type": "CPF", "number": "52998224725"}},
    FAKE["avulsos"][pag_lucas]["corpo"]["payer"],
)
FAKE["avulsos"][pag_lucas]["status"] = "approved"
FAKE["avulsos"][pag_lucas]["fee_details"] = [{"type": "mercadopago_fee", "amount": 0.01}]
r = cliente.get(f"/api/loja/conta/vendas/{venda_lucas}", headers=H_C)
checar("compra Pix: paga", r.json()["status"] == "paga", r.text)
r = cliente.get("/api/loja/conta/compras", headers=H_C)
checar("Minhas planilhas: aparece paga", r.json()[0]["status"] == "paga" and r.json()[0]["produto"]["id"] == PID, r.text)
r = cliente.get(f"/api/loja/conta/produtos/{PID}/conteudos", headers=H_C)
lib = r.json()
checar("depois de pagar: 3 conteúdos liberados", r.status_code == 200 and len(lib["conteudos"]) == 3, r.text)
cv = [c for c in lib["conteudos"] if c["id"] == VID][0]
r = cliente.get(cv["url"])
checar("vídeo pelo link assinado: inteiro", r.status_code == 200 and r.content == video_bytes and r.headers["accept-ranges"] == "bytes", r.status_code)
r = cliente.get(cv["url"], headers={"Range": "bytes=10-19"})
checar("vídeo com Range (iPhone/pular): 206 com o pedaço certo", r.status_code == 206 and r.content == video_bytes[10:20] and r.headers["content-range"] == f"bytes 10-19/{len(video_bytes)}", r.headers.get("content-range"))
ca = [c for c in lib["conteudos"] if c["id"] == ARQ][0]
r = cliente.get(ca["download_url"])
checar("download do PDF", r.status_code == 200 and r.content == b"%PDF-1.4 teste" and "attachment" in r.headers["content-disposition"], r.headers.get("content-disposition"))
adulterado = cv["url"][:-3] + ("aaa" if not cv["url"].endswith("aaa") else "bbb")
checar("link adulterado → 403", cliente.get(adulterado).status_code == 403)
outro = cv["url"].replace(f"/arquivo/{VID}?", f"/arquivo/{ARQ}?")
checar("link de um arquivo não abre outro → 403", cliente.get(outro).status_code == 403)
r = cliente.post(f"/api/loja/conta/comprar/{PID}/pix", headers=H_C)
checar("comprar de novo o que já tem → 409", r.status_code == 409, r.text)
p = cliente.get("/api/admin/loja", headers=H_ADMIN).json()
v = [x for x in p["vendas"] if x["id"] == venda_lucas][0]
checar("venda aparece no painel da loja com a divisão", v["status"] == "paga" and v["parte_parceiro"] is not None, v)

# compra no cartão por outro aluno
r = cliente.post("/api/loja/conta/registrar", json={"nome": "Maria", "email": "maria@teste.com", "senha": "senha12345", "cpf": "529.982.247-25"})
H_M = {"Authorization": f"Bearer {r.json()['access_token']}"}
r = cliente.post(f"/api/loja/conta/comprar/{PID}/cartao", json={"card_token": "tok_loja_maria", "payment_method_id": "master"}, headers=H_M)
checar("compra cartão aprovada → paga", r.status_code == 200 and r.json()["status"] == "paga", r.text)
checar("cartão: conteúdo liberado", cliente.get(f"/api/loja/conta/produtos/{PID}/conteudos", headers=H_M).status_code == 200)
r = cliente.post(f"/api/loja/conta/comprar/{PID}/cartao", json={"card_token": "tok_deb_recusado", "payment_method_id": "master"}, headers=H_ANA)
checar("Personal não compra com token dele (401)", r.status_code == 401, r.text)

# reembolso tira o acesso
r = cliente.post(f"/api/admin/loja/vendas/{venda_lucas}/reembolsar", headers=H_ADMIN)
checar("admin reembolsa a compra do Lucas", r.status_code == 200 and r.json()["status"] == "reembolsada", r.text)
checar("depois do reembolso: link antigo do vídeo para de funcionar (403)", cliente.get(cv["url"]).status_code == 403)
checar("depois do reembolso: conteúdos bloqueados (403)", cliente.get(f"/api/loja/conta/produtos/{PID}/conteudos", headers=H_C).status_code == 403)
r = cliente.delete(f"/api/admin/loja/produtos/{PID}", headers=H_ADMIN)
checar("não apaga produto já vendido (409)", r.status_code == 409, r.text)
r = cliente.put(f"/api/admin/loja/produtos/{PID}", json={**prod_in, "ativo": False}, headers=H_ADMIN)
checar("desativar some da vitrine", r.status_code == 200 and cliente.get("/api/loja/produtos").json() == [], r.text)
checar("desativado: quem comprou continua com acesso", cliente.get(f"/api/loja/conta/produtos/{PID}/conteudos", headers=H_M).status_code == 200)

# limpeza dos arquivos de teste
for c in SessionLocal().query(_Conteudo).all():
    if c.caminho and _os.path.exists(c.caminho):
        _os.remove(c.caminho)

# 38) Conta Seklyn (Personal) entra na loja com o mesmo login.
r = cliente.post("/api/loja/conta/registrar", json={"nome": "Ana", "email": "ANA@teste.com", "senha": "outrasenha1", "cpf": "52998224725"})
checar("loja: e-mail de conta Seklyn não cria conta separada (409)", r.status_code == 409 and "Entrar" in r.text, r.text)
r = cliente.post("/api/loja/conta/login", json={"email": "ana@teste.com", "senha": "senha-errada"})
checar("loja: conta Seklyn com senha errada → 401", r.status_code == 401, r.text)
r = cliente.post("/api/loja/conta/login", json={"email": "Ana@Teste.com", "senha": "x" * 8})
j = r.json()
checar("loja: entra com o login do Seklyn (mesma senha)", r.status_code == 200 and j["comprador"]["nome"] == "Ana Souza" and j["comprador"]["cpf"] == "529.982.247-25", r.text)
H_ANA_LOJA = {"Authorization": f"Bearer {j['access_token']}"}
checar("loja: conta ligada vê Minhas planilhas", cliente.get("/api/loja/conta/compras", headers=H_ANA_LOJA).status_code == 200)
r = cliente.post("/api/loja/conta/login", json={"email": "ana@teste.com", "senha": "x" * 8})
checar("loja: segunda entrada usa a mesma conta", r.json()["comprador"]["id"] == j["comprador"]["id"], r.text)
r = cliente.post("/api/auth/personal/trocar-senha", json={"senha_atual": "x" * 8, "senha_nova": "novaSenha123"}, headers=H_ANA)
checar("Ana troca a senha do Seklyn", r.status_code in (200, 204), r.text)
checar("loja: senha antiga do Seklyn deixa de valer", cliente.post("/api/loja/conta/login", json={"email": "ana@teste.com", "senha": "x" * 8}).status_code == 401)
checar("loja: senha nova do Seklyn vale na loja", cliente.post("/api/loja/conta/login", json={"email": "ana@teste.com", "senha": "novaSenha123"}).status_code == 200)

# 39) E-mails com a marca disparados nos momentos certos.
assuntos = [a for _, a in EMAILS]
checar("e-mail: compra confirmada pro aluno", any(d == "maria@teste.com" and "liberada" in a for d, a in EMAILS), assuntos[-10:])
checar("e-mail: nova venda pros admins", any(d == "dono@seklyn.com.br" and a.startswith("Nova venda") for d, a in EMAILS), assuntos[-10:])
checar("e-mail: pagamento da assinatura (Pix) pro Personal", any(d == "ana@teste.com" and "Pagamento confirmado" in a for d, a in EMAILS), assuntos[:20])
checar("e-mail: cancelamento da assinatura", any(d == "ana@teste.com" and "cancelada" in a for d, a in EMAILS), assuntos[:30])

# 40) Novidades (uma vez por conta) e pedido de parceria.
me = cliente.get("/api/auth/personal/me", headers=H_ANA).json()
checar("novidades: conta começa sem ter visto", me.get("novidade_vista") == 0, me)
r = cliente.post("/api/personal/novidades/vista", json={"versao": 1}, headers=H_ANA)
checar("novidades: marca como vista", r.status_code == 204 and cliente.get("/api/auth/personal/me", headers=H_ANA).json()["novidade_vista"] == 1, r.text)
cliente.post("/api/personal/novidades/vista", json={"versao": 0}, headers=H_ANA)
checar("novidades: não volta pra trás", cliente.get("/api/auth/personal/me", headers=H_ANA).json()["novidade_vista"] == 1)
checar("parceria: sem pedido ainda", cliente.get("/api/personal/parceria/solicitacao", headers=H_ANA).json() is None)
r = cliente.post("/api/personal/parceria/solicitacao", json={"whatsapp": "123"}, headers=H_ANA)
checar("parceria: WhatsApp curto → 422", r.status_code == 422, r.text)
antes = len(EMAILS)
r = cliente.post("/api/personal/parceria/solicitacao", json={"whatsapp": "(18) 99999-8888", "instagram": "@anapersonal", "mensagem": "Planilha de hipertrofia"}, headers=H_ANA)
checar("parceria: pedido enviado", r.status_code == 201 and r.json()["status"] == "nova", r.text)
novos_emails = EMAILS[antes:]
checar("parceria: e-mail pro admin e confirmação pro Personal", any(d == "dono@seklyn.com.br" for d, _ in novos_emails) and any(d == "ana@teste.com" for d, _ in novos_emails), novos_emails)
checar("parceria: instagram salvo sem @", cliente.get("/api/personal/parceria/solicitacao", headers=H_ANA).json()["instagram"] == "anapersonal")
r = cliente.post("/api/personal/parceria/solicitacao", json={"whatsapp": "(18) 99999-8888"}, headers=H_ANA)
checar("parceria: pedido repetido → 409", r.status_code == 409, r.text)
checar("parceria: Personal comum não vê a lista (403)", cliente.get("/api/admin/parceria/solicitacoes", headers=H_ANA).status_code == 403)
lista = cliente.get("/api/admin/parceria/solicitacoes", headers=H_ADMIN).json()
checar("parceria: admin vê o pedido com nome e e-mail", lista and lista[0]["personal_email"] == "ana@teste.com", lista)
antes = len(EMAILS)
r = cliente.put(f"/api/admin/parceria/solicitacoes/{lista[0]['id']}", json={"status": "aprovada"}, headers=H_ADMIN)
checar("parceria: admin aprova → Personal recebe e-mail", r.status_code == 200 and any(d == "ana@teste.com" and "aprovada" in a for d, a in EMAILS[antes:]), EMAILS[antes:])
r = cliente.put(f"/api/admin/parceria/solicitacoes/{lista[0]['id']}", json={"status": "qualquer"}, headers=H_ADMIN)
checar("parceria: status inválido → 422", r.status_code == 422, r.text)

# 41) Aviso de vencimento (cron diário): só 3, 1 e 0 dias antes, Pix/débito.
editar_ana(status="active", forma_pagamento="pix", cancelamento_agendado=False, current_period_end=agora() + timedelta(days=2, hours=12))
antes = len(EMAILS)
runpy.run_path(os.path.join(BACKEND, "scripts", "avisar_vencimentos.py"))
checar("vencimento: faltando 3 dias → e-mail", any(d == "ana@teste.com" and "vence em 3 dias" in a for d, a in EMAILS[antes:]), EMAILS[antes:])
editar_ana(current_period_end=agora() + timedelta(days=10))
antes = len(EMAILS)
runpy.run_path(os.path.join(BACKEND, "scripts", "avisar_vencimentos.py"))
checar("vencimento: faltando 10 dias → nada", not any(d == "ana@teste.com" for d, _ in EMAILS[antes:]), EMAILS[antes:])

# arquivo que o teste do automático anota em uploads/
if os.path.exists("uploads/testes_automaticos.txt"):
    os.remove("uploads/testes_automaticos.txt")

print()
print(f"RESULTADO: {'todas as verificações passaram' if not falhas else f'{len(falhas)} falharam: {falhas}'}")
sys.exit(1 if falhas else 0)
