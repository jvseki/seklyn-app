# Seklyn

SaaS B2B2C para Personal Trainers acompanharem a execução dos treinos dos seus alunos, série por série — com acesso do aluno via link único (sem senha) e uma aba não-invasiva de recomendações de produtos (afiliados).

- **Backend:** Python + FastAPI + PostgreSQL (SQLAlchemy + Alembic)
- **Frontend:** HTML + CSS + JavaScript puro (sem framework), consumindo a API via `fetch()`
- **Pagamentos:** Stripe (assinatura mensal — preço negociado individualmente por Personal, sem valor fixo público)
- **Idioma:** PT-BR

## Estrutura do projeto

```
seklyn/
├── backend/            # API FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── core/        # config, database, security (JWT, hash, hash_token do aluno)
│   │   ├── models/      # SQLAlchemy (personais, alunos, treinos, exercicios, series, execucoes, assinaturas, recomendacoes_produtos)
│   │   ├── schemas/     # Pydantic
│   │   ├── api/routes/  # auth, personal, aluno, recomendacoes, stripe_webhook
│   │   ├── services/    # progresso.py (regra hierárquica), stripe_service.py
│   │   └── deps.py
│   ├── alembic/         # migrations
│   └── requirements.txt
├── frontend/            # site estático (sem build step)
│   ├── index.html         # landing page
│   ├── personal/          # login, cadastro, dashboard, aluno-detalhe, recomendacoes, assinatura
│   ├── aluno/treino.html  # área do aluno (mobile-first, acesso via ?t=<hash_token>)
│   └── assets/css|js
└── docker-compose.yml    # só sobe o Postgres local
```

## Como rodar localmente
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows (PowerShell: .venv\Scripts\Activate.ps1)
pip install -r requirements.txt
docker-compose up -d
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows (PowerShell: .venv\Scripts\Activate.ps1)
pip install -r requirements.txt

copy .env.example .env          # edite os valores se necessário (Stripe, JWT_SECRET, etc.)
alembic upgrade head            # cria as tabelas
uvicorn app.main:app --reload   # sobe em http://localhost:8000
```

Documentação interativa da API: **http://localhost:8000/docs**

### 3. Frontend

Não tem build step — é só servir a pasta `frontend/` com qualquer servidor estático:

```bash
cd frontend
python -m http.server 5500
```

Acesse **http://localhost:5500**. Se o backend não estiver em `http://localhost:8000/api`, ajuste `API_BASE_URL` em [assets/js/api.js](frontend/assets/js/api.js).

> A porta do frontend precisa bater com `FRONTEND_URL` no `.env` do backend (usado no CORS e nos links gerados para o Stripe/aluno).

### 4. Testando o fluxo completo

1. Cadastre-se em `personal/cadastro.html` (cria a conta, mas sem assinatura ativa)
2. Configure suas chaves de teste do Stripe no `.env` do backend e assine em `personal/assinatura.html`
3. Cadastre um aluno no dashboard → copie o link gerado
4. Monte um treino com exercícios e séries em `aluno-detalhe.html`
5. Abra o link do aluno (`aluno/treino.html?t=...`) e marque as séries — o treino só fica "concluído" quando todas as séries de todos os exercícios forem marcadas
6. Cadastre uma recomendação em `personal/recomendacoes.html` e confirme que ela aparece na aba "Dicas" da visão do aluno

## Fora do escopo desta primeira versão

- Exportação de PDF da ficha de treino
- Dashboard de analytics com gráficos (a API de aderência já existe em `/api/personal/alunos/{id}/analytics`)
- Deploy em produção (Dockerfile de produção, Nginx, HTTPS) e publicação em seklyn.com.br
- Recuperação de senha / verificação de e-mail

## Licença

Projeto privado — todos os direitos reservados.
