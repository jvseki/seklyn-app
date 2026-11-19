"""
Loja de planilhas de treino — vitrine pública, conta do comprador, compra
(Pix/crédito/débito com divisão do parceiro), conteúdo protegido e o
cadastro de produtos no Admin. Ver services/loja_service.py.
"""
import logging
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    assinar_link_conteudo,
    criar_token_comprador,
    decodificar_token_comprador,
    hash_senha,
    validar_link_conteudo,
    verificar_senha,
)
from app.deps import exigir_admin
from app.models.loja import Comprador, ConteudoProduto, Produto
from app.models.parceiro import Parceiro, VendaParceiro
from app.models.personal import Personal
from app.schemas.loja import (
    CompraCartaoIn,
    CompradorCriar,
    CompradorLogin,
    CompradorOut,
    CompradorTokenOut,
    CompraOut,
    CompraPixOut,
    CompraStatusOut,
    ConteudoAdminOut,
    ConteudoLiberadoOut,
    ItemConteudoPublico,
    LojaConfigOut,
    ProdutoAdminOut,
    ProdutoIn,
    ProdutoLiberadoOut,
    ProdutoPublicoOut,
)
from app.services import loja_service as loja
from app.services import mercadopago_service as mp
from app.services import parceiro_service as parceria

router = APIRouter(tags=["Loja de planilhas"])
logger = logging.getLogger("seklyn.loja")
oauth2_comprador = OAuth2PasswordBearer(tokenUrl="api/loja/conta/login", auto_error=False)
API = "/api/loja"


# ---------- helpers ----------


def _publico(produto: Produto) -> ProdutoPublicoOut:
    videos, arquivos = loja.contar_itens(produto)
    return ProdutoPublicoOut(
        id=produto.id,
        titulo=produto.titulo,
        slug=produto.slug,
        subtitulo=produto.subtitulo,
        descricao=produto.descricao,
        preco=produto.preco,
        capa_url=produto.capa_url,
        nivel=produto.nivel,
        duracao=produto.duracao,
        qtd_videos=videos,
        qtd_arquivos=arquivos,
        itens=[ItemConteudoPublico(tipo=c.tipo, titulo=c.titulo) for c in produto.conteudos],
    )


def _parceiro(db: Session) -> Parceiro | None:
    return db.query(Parceiro).order_by(Parceiro.id).first()


def get_comprador(token: str | None = Depends(oauth2_comprador), db: Session = Depends(get_db)) -> Comprador:
    erro = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Entre na sua conta pra continuar.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    comprador_id = decodificar_token_comprador(token) if token else None
    comprador = db.get(Comprador, comprador_id) if comprador_id else None
    if comprador is None:
        raise erro
    return comprador


def _produto_ativo(db: Session, produto_id: int) -> Produto:
    produto = db.get(Produto, produto_id)
    if produto is None or not produto.ativo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planilha não encontrada.")
    return produto


def _preparar_compra(db: Session, comprador: Comprador, produto_id: int) -> tuple[Produto, Parceiro]:
    if not mp.configurado():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Pagamento indisponível no momento.")
    produto = _produto_ativo(db, produto_id)
    if loja.tem_acesso(db, comprador.id, produto.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Você já tem essa planilha — ela está em Minhas planilhas.")
    parceiro = db.get(Parceiro, produto.parceiro_id)
    if parceiro is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Loja indisponível no momento.")
    return produto, parceiro


# ---------- vitrine pública ----------


@router.get(f"{API}/config", response_model=LojaConfigOut)
def config_loja(db: Session = Depends(get_db)) -> LojaConfigOut:
    parceiro = _parceiro(db)
    return LojaConfigOut(
        pagamento_disponivel=mp.configurado() and bool(mp.settings.mercadopago_public_key),
        mp_public_key=mp.settings.mercadopago_public_key or None,
        parceiro_nome=parceiro.nome if parceiro else None,
    )


@router.get(f"{API}/produtos", response_model=list[ProdutoPublicoOut])
def listar_produtos(db: Session = Depends(get_db)) -> list[ProdutoPublicoOut]:
    produtos = db.query(Produto).filter(Produto.ativo.is_(True)).order_by(Produto.ordem, Produto.id).all()
    return [_publico(p) for p in produtos]


@router.get(f"{API}/produtos/{{slug}}", response_model=ProdutoPublicoOut)
def ver_produto(slug: str, db: Session = Depends(get_db)) -> ProdutoPublicoOut:
    produto = db.query(Produto).filter(Produto.slug == slug, Produto.ativo.is_(True)).first()
    if produto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planilha não encontrada.")
    return _publico(produto)


# ---------- conta do comprador ----------


@router.post(f"{API}/conta/registrar", response_model=CompradorTokenOut, status_code=status.HTTP_201_CREATED)
def registrar_comprador(dados: CompradorCriar, db: Session = Depends(get_db)) -> CompradorTokenOut:
    email = dados.email.lower().strip()
    if db.query(Comprador).filter(Comprador.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe uma conta com esse e-mail. Entre com ela.")
    if _personal_por_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esse e-mail já tem conta no Seklyn. Use \"Entrar\" com a mesma senha do Seklyn.",
        )
    comprador = Comprador(
        nome=dados.nome.strip(),
        email=email,
        senha_hash=hash_senha(dados.senha),
        cpf=dados.cpf,
        telefone=(dados.telefone or "").strip() or None,
    )
    db.add(comprador)
    db.commit()
    db.refresh(comprador)
    return CompradorTokenOut(access_token=criar_token_comprador(comprador.id), comprador=CompradorOut.model_validate(comprador))


@router.post(f"{API}/conta/login", response_model=CompradorTokenOut)
def login_comprador(dados: CompradorLogin, db: Session = Depends(get_db)) -> CompradorTokenOut:
    """Login da loja. Aceita também a conta Seklyn (Personal): na primeira vez
    cria a conta de comprador ligada a ela; a senha é sempre a do Personal."""
    email = dados.email.lower().strip()
    erro = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha incorretos.")
    comprador = db.query(Comprador).filter(Comprador.email == email).first()
    if comprador is not None:
        personal = db.get(Personal, comprador.personal_id) if comprador.personal_id else None
        hash_certo = personal.senha_hash if personal else comprador.senha_hash
        if not verificar_senha(dados.senha, hash_certo):
            raise erro
    else:
        personal = _personal_por_email(db, email)
        if personal is None or not verificar_senha(dados.senha, personal.senha_hash):
            raise erro
        comprador = Comprador(
            nome=personal.nome,
            email=email,
            senha_hash=personal.senha_hash,
            cpf=personal.cpf,
            telefone=personal.telefone,
            personal_id=personal.id,
        )
        db.add(comprador)
        db.commit()
        db.refresh(comprador)
    return CompradorTokenOut(access_token=criar_token_comprador(comprador.id), comprador=CompradorOut.model_validate(comprador))


def _personal_por_email(db: Session, email: str) -> Personal | None:
    return db.query(Personal).filter(func.lower(Personal.email) == email.lower()).first()


@router.get(f"{API}/conta/me", response_model=CompradorOut)
def me_comprador(comprador: Comprador = Depends(get_comprador)) -> CompradorOut:
    return CompradorOut.model_validate(comprador)


@router.get(f"{API}/conta/compras", response_model=list[CompraOut])
def minhas_compras(comprador: Comprador = Depends(get_comprador), db: Session = Depends(get_db)) -> list[CompraOut]:
    vendas = (
        db.query(VendaParceiro)
        .filter(VendaParceiro.comprador_id == comprador.id)
        .order_by(VendaParceiro.id.desc())
        .all()
    )
    saida = []
    for venda in vendas:
        if venda.status == "aguardando" and mp.configurado():
            try:
                parceria.sincronizar(db, venda)
            except mp.ErroMercadoPago:
                logger.warning("Não deu pra consultar a venda %s agora", venda.id)
        produto = db.get(Produto, venda.produto_id) if venda.produto_id else None
        saida.append(
            CompraOut(
                venda_id=venda.id,
                produto=_publico(produto) if produto else None,
                status=venda.status,
                forma_pagamento=venda.forma_pagamento,
                valor=venda.valor,
                criado_em=venda.criado_em,
                paga_em=venda.paga_em,
            )
        )
    return saida


@router.post(f"{API}/conta/comprar/{{produto_id}}/pix", response_model=CompraPixOut)
def comprar_pix(produto_id: int, comprador: Comprador = Depends(get_comprador), db: Session = Depends(get_db)) -> CompraPixOut:
    produto, parceiro = _preparar_compra(db, comprador, produto_id)
    try:
        venda, pix = parceria.criar_venda_pix(
            db,
            parceiro,
            produto.titulo,
            produto.preco,
            comprador.email,
            pagador=loja.pagador_do_comprador(comprador),
            comprador_id=comprador.id,
            produto_id=produto.id,
        )
    except mp.ErroMercadoPago as erro:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não deu pra gerar o Pix agora. Tente de novo em instantes.") from erro
    return CompraPixOut(
        venda_id=venda.id,
        qr_code=pix["qr_code"],
        qr_code_base64=pix["qr_code_base64"],
        expira_em=pix["expira_em"],
        valor=venda.valor,
    )


@router.post(f"{API}/conta/comprar/{{produto_id}}/cartao", response_model=CompraStatusOut)
def comprar_cartao(
    produto_id: int,
    dados: CompraCartaoIn,
    comprador: Comprador = Depends(get_comprador),
    db: Session = Depends(get_db),
) -> CompraStatusOut:
    produto, parceiro = _preparar_compra(db, comprador, produto_id)
    try:
        venda = parceria.criar_venda_cartao(
            db,
            parceiro,
            produto.titulo,
            produto.preco,
            comprador.email,
            dados.card_token,
            dados.payment_method_id,
            dados.issuer_id,
            dados.documento_tipo,
            dados.documento_numero,
            pagador_base=loja.pagador_do_comprador(comprador),
            comprador_id=comprador.id,
            produto_id=produto.id,
        )
    except mp.CartaoRecusado as recusa:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=recusa.mensagem) from recusa
    except mp.ErroMercadoPago as erro:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Não deu pra falar com o Mercado Pago agora. Nenhuma cobrança foi feita."
        ) from erro
    return CompraStatusOut(venda_id=venda.id, status=venda.status, produto_id=venda.produto_id)


@router.get(f"{API}/conta/vendas/{{venda_id}}", response_model=CompraStatusOut)
def status_compra(venda_id: int, comprador: Comprador = Depends(get_comprador), db: Session = Depends(get_db)) -> CompraStatusOut:
    venda = db.get(VendaParceiro, venda_id)
    if venda is None or venda.comprador_id != comprador.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compra não encontrada.")
    if venda.status == "aguardando" and mp.configurado():
        try:
            parceria.sincronizar(db, venda)
        except mp.ErroMercadoPago:
            logger.warning("Não deu pra consultar a venda %s agora", venda.id)
    return CompraStatusOut(venda_id=venda.id, status=venda.status, produto_id=venda.produto_id)


@router.get(f"{API}/conta/produtos/{{produto_id}}/conteudos", response_model=ProdutoLiberadoOut)
def conteudos_liberados(
    produto_id: int, comprador: Comprador = Depends(get_comprador), db: Session = Depends(get_db)
) -> ProdutoLiberadoOut:
    produto = db.get(Produto, produto_id)
    if produto is None or not loja.tem_acesso(db, comprador.id, produto_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Essa planilha ainda não foi liberada pra você.")
    itens = []
    for c in produto.conteudos:
        if c.tipo == "youtube":
            vid = loja.id_youtube(c.url_youtube or "")
            itens.append(ConteudoLiberadoOut(id=c.id, tipo=c.tipo, titulo=c.titulo, url=f"https://www.youtube-nocookie.com/embed/{vid}" if vid else None))
            continue
        link = f"{API}/arquivo/{c.id}?t={assinar_link_conteudo(c.id, comprador.id)}"
        itens.append(
            ConteudoLiberadoOut(
                id=c.id,
                tipo=c.tipo,
                titulo=c.titulo,
                url=link if c.tipo == "video" else None,
                download_url=f"{link}&baixar=1",
                nome_original=c.nome_original,
                tamanho_bytes=c.tamanho_bytes,
            )
        )
    return ProdutoLiberadoOut(produto=_publico(produto), conteudos=itens)


@router.get(f"{API}/arquivo/{{conteudo_id}}")
def baixar_conteudo(conteudo_id: int, t: str, request: Request, baixar: int = 0, db: Session = Depends(get_db)) -> Response:
    """Arquivo pago: só com link assinado (gerado pra quem comprou). Aceita Range."""
    conteudo = db.get(ConteudoProduto, conteudo_id)
    if conteudo is None or not conteudo.caminho or not validar_link_conteudo(conteudo_id, t):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Link expirado — abra a planilha de novo pelo site.")
    comprador_id = int(t.split(".")[0])
    if not loja.tem_acesso(db, comprador_id, conteudo.produto_id):  # reembolsou depois? perde o acesso
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não disponível.")
    if not os.path.exists(conteudo.caminho):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo não encontrado.")
    tamanho = os.path.getsize(conteudo.caminho)
    extensao = conteudo.caminho.rsplit(".", 1)[-1].lower()
    tipo_mime = {v: k for k, v in {**loja.TIPOS_VIDEO, **loja.TIPOS_ARQUIVO}.items()}.get(extensao, "application/octet-stream")
    nome = (conteudo.nome_original or f"{conteudo.titulo}.{extensao}").replace('"', "")
    cabecalhos = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
        "Content-Disposition": f'{"attachment" if baixar else "inline"}; filename="{nome}"',
    }
    intervalo = loja.intervalo_do_range(request.headers.get("range"), tamanho)
    if intervalo is None:
        cabecalhos["Content-Length"] = str(tamanho)
        return StreamingResponse(loja.ler_pedaco(conteudo.caminho, 0, tamanho - 1), media_type=tipo_mime, headers=cabecalhos)
    inicio, fim = intervalo
    cabecalhos["Content-Range"] = f"bytes {inicio}-{fim}/{tamanho}"
    cabecalhos["Content-Length"] = str(fim - inicio + 1)
    return StreamingResponse(
        loja.ler_pedaco(conteudo.caminho, inicio, fim), status_code=206, media_type=tipo_mime, headers=cabecalhos
    )


# ---------- admin: produtos e conteúdos ----------

ADMIN = "/api/admin/loja/produtos"


def _admin_out(db: Session, produto: Produto) -> ProdutoAdminOut:
    saida = ProdutoAdminOut.model_validate(produto)
    saida.vendas_pagas = (
        db.query(VendaParceiro).filter(VendaParceiro.produto_id == produto.id, VendaParceiro.status == "paga").count()
    )
    return saida


def _produto_admin(db: Session, produto_id: int) -> Produto:
    produto = db.get(Produto, produto_id)
    if produto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado.")
    return produto


@router.get(ADMIN, response_model=list[ProdutoAdminOut], dependencies=[Depends(exigir_admin)])
def admin_listar(db: Session = Depends(get_db)) -> list[ProdutoAdminOut]:
    return [_admin_out(db, p) for p in db.query(Produto).order_by(Produto.ordem, Produto.id).all()]


@router.post(ADMIN, response_model=ProdutoAdminOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(exigir_admin)])
def admin_criar(dados: ProdutoIn, db: Session = Depends(get_db)) -> ProdutoAdminOut:
    parceiro = _parceiro(db)
    if parceiro is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cadastre o parceiro primeiro (Loja (teste) → Parceiro).")
    produto = Produto(parceiro_id=parceiro.id, slug=loja.gerar_slug(db, dados.titulo), **dados.model_dump())
    db.add(produto)
    db.commit()
    db.refresh(produto)
    return _admin_out(db, produto)


@router.put(f"{ADMIN}/{{produto_id}}", response_model=ProdutoAdminOut, dependencies=[Depends(exigir_admin)])
def admin_editar(produto_id: int, dados: ProdutoIn, db: Session = Depends(get_db)) -> ProdutoAdminOut:
    produto = _produto_admin(db, produto_id)
    if dados.titulo != produto.titulo:
        produto.slug = loja.gerar_slug(db, dados.titulo, ignorar_id=produto.id)
    for campo, valor in dados.model_dump().items():
        setattr(produto, campo, valor)
    db.commit()
    db.refresh(produto)
    return _admin_out(db, produto)


@router.delete(f"{ADMIN}/{{produto_id}}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(exigir_admin)])
def admin_apagar(produto_id: int, db: Session = Depends(get_db)) -> Response:
    produto = _produto_admin(db, produto_id)
    if db.query(VendaParceiro).filter(VendaParceiro.produto_id == produto.id, VendaParceiro.status == "paga").count():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Essa planilha já foi vendida — desative em vez de apagar (quem comprou continua com acesso).",
        )
    for c in produto.conteudos:
        loja.apagar_conteudo(c)
    loja.apagar_arquivo(produto.capa_url.lstrip("/") if produto.capa_url else None)
    db.delete(produto)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(f"{ADMIN}/{{produto_id}}/capa", response_model=ProdutoAdminOut, dependencies=[Depends(exigir_admin)])
async def admin_capa(produto_id: int, arquivo: UploadFile = File(...), db: Session = Depends(get_db)) -> ProdutoAdminOut:
    produto = _produto_admin(db, produto_id)
    extensao = loja.TIPOS_CAPA.get(arquivo.content_type or "")
    if not extensao:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Envie uma imagem JPG, PNG ou WEBP.")
    caminho, _ = await loja.salvar_upload(arquivo, loja.PASTA_CAPAS, extensao, loja.LIMITE_CAPA)
    loja.apagar_arquivo(produto.capa_url.lstrip("/") if produto.capa_url else None)
    produto.capa_url = "/" + caminho.replace(os.sep, "/")
    db.commit()
    db.refresh(produto)
    return _admin_out(db, produto)


@router.post(f"{ADMIN}/{{produto_id}}/conteudos", response_model=ConteudoAdminOut, dependencies=[Depends(exigir_admin)])
async def admin_adicionar_conteudo(
    produto_id: int,
    titulo: str = Form(..., min_length=1, max_length=160),
    tipo: str = Form(...),
    url_youtube: str | None = Form(None),
    arquivo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
) -> ConteudoAdminOut:
    produto = _produto_admin(db, produto_id)
    conteudo = ConteudoProduto(produto_id=produto.id, tipo=tipo, titulo=titulo.strip(), ordem=len(produto.conteudos))
    if tipo == "youtube":
        if not loja.id_youtube(url_youtube or ""):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Link do YouTube inválido.")
        conteudo.url_youtube = url_youtube.strip()
    elif tipo in ("video", "arquivo"):
        if arquivo is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Escolha o arquivo.")
        tipos = loja.TIPOS_VIDEO if tipo == "video" else loja.TIPOS_ARQUIVO
        extensao = tipos.get(arquivo.content_type or "")
        if not extensao:
            permitido = "MP4, MOV ou WEBM" if tipo == "video" else "PDF, Excel, CSV ou ZIP"
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Formato não aceito — envie {permitido}.")
        limite = loja.LIMITE_VIDEO if tipo == "video" else loja.LIMITE_ARQUIVO
        caminho, tamanho = await loja.salvar_upload(arquivo, os.path.join(loja.PASTA_PRIVADA, str(produto.id)), extensao, limite)
        conteudo.caminho = caminho
        conteudo.tamanho_bytes = tamanho
        conteudo.nome_original = (arquivo.filename or "")[:200] or None
    else:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Tipo inválido.")
    db.add(conteudo)
    db.commit()
    db.refresh(conteudo)
    return ConteudoAdminOut.model_validate(conteudo)


@router.delete(f"{ADMIN}/conteudos/{{conteudo_id}}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(exigir_admin)])
def admin_apagar_conteudo(conteudo_id: int, db: Session = Depends(get_db)) -> Response:
    conteudo = db.get(ConteudoProduto, conteudo_id)
    if conteudo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conteúdo não encontrado.")
    loja.apagar_conteudo(conteudo)
    db.delete(conteudo)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
