"""
Regra de negócio central do produto: a conclusão hierárquica
Série -> Exercício -> Treino.

Um Exercício só está "concluído" no dia se TODAS as suas Séries têm
execução registrada; um Treino só está "treinado" se TODOS os seus
Exercícios estiverem concluídos. Nada disso é armazenado como flag
redundante — é sempre calculado a partir da tabela `execucoes`.
"""
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.tempo import FUSO_BRASIL
from app.core.tempo import hoje as hoje_brasil
from app.models.aluno import Aluno
from app.models.execucao import Execucao
from app.models.serie import Serie
from app.models.treino import Treino
from app.schemas.analytics import (
    AderenciaOut,
    AnalyticsDetalhadoOut,
    ExecucaoDetalheOut,
    ExercicioPuladoOut,
    PontoDesempenhoOut,
)
from app.schemas.exercicio import ExercicioComProgressoOut
from app.schemas.serie import SerieComExecucaoOut
from app.schemas.treino import TreinoDetalheOut, TreinoResumoOut


DIAS_SEMANA_CHAVES = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"]


def datas_semana_atual(hoje: date | None = None) -> list[date]:
    """
    As 7 datas (segunda a domingo) da semana que contém `hoje`. É essa janela
    que o aluno vê e pode marcar — dá pra adiantar ou repor um dia esquecido,
    mas só dentro da semana atual; na semana seguinte a janela já é outra.
    """
    hoje = hoje or hoje_brasil()
    segunda = hoje - timedelta(days=hoje.weekday())  # weekday(): segunda=0 ... domingo=6
    return [segunda + timedelta(days=i) for i in range(7)]


def _series_concluidas_ids(db: Session, serie_ids: list[int], dia: date) -> set[int]:
    if not serie_ids:
        return set()
    linhas = (
        db.query(Execucao.serie_id)
        .filter(
            Execucao.serie_id.in_(serie_ids),
            Execucao.data_execucao == dia,
            Execucao.concluida.is_(True),
        )
        .all()
    )
    return {serie_id for (serie_id,) in linhas}


def montar_treino_resumo(db: Session, treino: Treino, dia: date | None = None) -> TreinoResumoOut:
    """Card resumido (para a lista de treinos do aluno)."""
    dia = dia or hoje_brasil()
    serie_ids = [s.id for ex in treino.exercicios for s in ex.series]
    concluidas_ids = _series_concluidas_ids(db, serie_ids, dia)
    total = len(serie_ids)
    concluidas = len(concluidas_ids)
    percentual = round((concluidas / total) * 100, 1) if total else 0.0

    return TreinoResumoOut(
        id=treino.id,
        nome=treino.nome,
        ordem=treino.ordem,
        dia_semana=treino.dia_semana,
        total_series=total,
        series_concluidas_hoje=concluidas,
        progresso_percentual=percentual,
        concluido_hoje=total > 0 and concluidas == total,
    )


def montar_treino_detalhe(db: Session, treino: Treino, dia: date | None = None) -> TreinoDetalheOut:
    """Detalhe completo do treino, com cada exercício/série marcados com o status do dia."""
    dia = dia or hoje_brasil()
    serie_ids = [s.id for ex in treino.exercicios for s in ex.series]
    concluidas_ids = _series_concluidas_ids(db, serie_ids, dia)

    exercicios_out = []
    for ex in treino.exercicios:
        series_out = [
            SerieComExecucaoOut(
                id=s.id,
                exercicio_id=s.exercicio_id,
                ordem=s.ordem,
                repeticoes_alvo=s.repeticoes_alvo,
                carga_alvo=s.carga_alvo,
                intervalo_descanso=s.intervalo_descanso,
                concluida_hoje=s.id in concluidas_ids,
            )
            for s in ex.series
        ]
        concluido_ex = len(ex.series) > 0 and all(s.id in concluidas_ids for s in ex.series)
        exercicios_out.append(
            ExercicioComProgressoOut(
                id=ex.id,
                nome=ex.nome,
                observacoes=ex.observacoes,
                series=series_out,
                concluido_hoje=concluido_ex,
                video=ex.video,
            )
        )

    total = len(serie_ids)
    concluidas = len(concluidas_ids)
    percentual = round((concluidas / total) * 100, 1) if total else 0.0

    return TreinoDetalheOut(
        id=treino.id,
        nome=treino.nome,
        dia_semana=treino.dia_semana,
        exercicios=exercicios_out,
        progresso_percentual=percentual,
        concluido_hoje=total > 0 and concluidas == total,
    )


def calcular_streak(db: Session, aluno: Aluno) -> int:
    """
    Sequência de dias consecutivos (de hoje pra trás) em que o aluno
    completou o treino do dia. Dia de descanso (sem treino cadastrado
    pra aquele dia da semana) é pulado, não quebra a sequência. Hoje só
    quebra a sequência se já tiver algum treino cadastrado e ele decidir
    não fazer — enquanto o dia não "vira", um hoje incompleto não conta
    contra nem a favor.
    """
    treino_por_dia_semana = {t.dia_semana: t for t in aluno.treinos if t.dia_semana and t.ativo}
    if not treino_por_dia_semana:
        return 0

    hoje = hoje_brasil()
    streak = 0
    dia = hoje
    primeiro_dia = True
    limite = hoje - timedelta(days=400)  # trava de segurança contra loop infinito

    while dia > limite:
        treino = treino_por_dia_semana.get(DIAS_SEMANA_CHAVES[dia.weekday()])
        if treino:
            if montar_treino_resumo(db, treino, dia=dia).concluido_hoje:
                streak += 1
            elif not primeiro_dia:
                break
            # se for hoje e ainda não concluído: nem soma nem quebra, só segue pro dia anterior
        dia -= timedelta(days=1)
        primeiro_dia = False

    return streak


def alternar_execucao_serie(db: Session, serie: Serie, aluno_id: int, dia: date | None = None) -> bool:
    """
    Alterna o estado 'concluída hoje' de uma série: cria o log de execução
    se ainda não existir, remove se já existir. Retorna o novo estado
    (True = passou a estar concluída).
    """
    dia = dia or hoje_brasil()
    execucao = (
        db.query(Execucao)
        .filter(Execucao.serie_id == serie.id, Execucao.data_execucao == dia)
        .first()
    )
    if execucao:
        db.delete(execucao)
        db.commit()
        return False

    nova = Execucao(serie_id=serie.id, aluno_id=aluno_id, data_execucao=dia, concluida=True)
    db.add(nova)
    db.commit()
    return True


def calcular_aderencia(db: Session, aluno: Aluno, periodo_dias: int = 30) -> AderenciaOut:
    """
    Analytics de aderência: entre os dias em que o aluno treinou pelo menos
    uma série, identifica quais exercícios costumam ficar incompletos
    ("pulados").
    """
    hoje = hoje_brasil()
    inicio = hoje - timedelta(days=periodo_dias - 1)

    execucoes = (
        db.query(Execucao)
        .join(Serie, Execucao.serie_id == Serie.id)
        .filter(
            Execucao.aluno_id == aluno.id,
            Execucao.data_execucao >= inicio,
            Execucao.concluida.is_(True),
        )
        .all()
    )

    dias_com_treino = {e.data_execucao for e in execucoes}
    total_dias_ativos = len(dias_com_treino)

    series_por_exercicio: dict[int, list[int]] = defaultdict(list)
    exercicios_info: dict[int, tuple[str, str]] = {}
    for treino in aluno.treinos:
        for ex in treino.exercicios:
            exercicios_info[ex.id] = (ex.nome, treino.nome)
            for s in ex.series:
                series_por_exercicio[ex.id].append(s.id)

    serie_para_exercicio = {
        s_id: ex_id for ex_id, s_ids in series_por_exercicio.items() for s_id in s_ids
    }

    concluidas_por_exercicio_dia: dict[tuple[int, date], set[int]] = defaultdict(set)
    for e in execucoes:
        ex_id = serie_para_exercicio.get(e.serie_id)
        if ex_id is not None:
            concluidas_por_exercicio_dia[(ex_id, e.data_execucao)].add(e.serie_id)

    exercicios_pulados: list[ExercicioPuladoOut] = []
    for ex_id, (nome_ex, nome_treino) in exercicios_info.items():
        total_series_ex = len(series_por_exercicio[ex_id])
        if total_series_ex == 0 or total_dias_ativos == 0:
            continue
        vezes_concluido = sum(
            1
            for dia in dias_com_treino
            if len(concluidas_por_exercicio_dia.get((ex_id, dia), set())) == total_series_ex
        )
        percentual = round((vezes_concluido / total_dias_ativos) * 100, 1)
        exercicios_pulados.append(
            ExercicioPuladoOut(
                exercicio_id=ex_id,
                exercicio_nome=nome_ex,
                treino_nome=nome_treino,
                vezes_planejado=total_dias_ativos,
                vezes_concluido=vezes_concluido,
                percentual_aderencia=percentual,
            )
        )

    exercicios_pulados.sort(key=lambda e: e.percentual_aderencia)

    percentual_geral = (
        round(sum(e.percentual_aderencia for e in exercicios_pulados) / len(exercicios_pulados), 1)
        if exercicios_pulados
        else 0.0
    )

    return AderenciaOut(
        aluno_id=aluno.id,
        periodo_dias=periodo_dias,
        percentual_geral_aderencia=percentual_geral,
        dias_com_algum_treino=total_dias_ativos,
        exercicios_mais_pulados=exercicios_pulados[:10],
    )


def calcular_analytics_detalhado(db: Session, aluno: Aluno, periodo_dias: int = 30) -> AnalyticsDetalhadoOut:
    """
    Painel "Ver mais": um ponto por dia (% do treino daquele dia da semana
    concluído naquela data) pra montar o gráfico, e a lista de marcações
    recentes com hora real — pra dar transparência de verdade ao personal,
    em vez de só confiar no check ficar verde.

    "Suspeito" = 3+ séries marcadas numa janela de até 5 minutos no mesmo
    dia — não prova nada sozinho, mas é um sinal pra olhar com atenção.
    """
    hoje = hoje_brasil()
    inicio = hoje - timedelta(days=periodo_dias - 1)

    # Quantas séries o treino de cada dia da semana tem, pra servir de "meta do dia".
    total_series_por_dia_semana: dict[str, int] = {}
    for treino in aluno.treinos:
        if not treino.dia_semana:
            continue
        total_series_por_dia_semana[treino.dia_semana] = sum(len(ex.series) for ex in treino.exercicios)

    execucoes = (
        db.query(Execucao)
        .join(Serie, Execucao.serie_id == Serie.id)
        .filter(
            Execucao.aluno_id == aluno.id,
            Execucao.data_execucao >= inicio,
            Execucao.concluida.is_(True),
        )
        .all()
    )

    concluidas_por_dia: dict[date, int] = defaultdict(int)
    horarios_por_dia: dict[date, list] = defaultdict(list)
    for e in execucoes:
        concluidas_por_dia[e.data_execucao] += 1
        horarios_por_dia[e.data_execucao].append(e.criado_em)

    def dia_e_suspeito(horarios: list) -> bool:
        if len(horarios) < 3:
            return False
        ordenados = sorted(horarios)
        janela = ordenados[-1] - ordenados[0]
        return len(horarios) >= 3 and janela.total_seconds() <= 5 * 60

    desempenho: list[PontoDesempenhoOut] = []
    d = inicio
    while d <= hoje:
        chave_dia = DIAS_SEMANA_CHAVES[d.weekday()]
        total_esperado = total_series_por_dia_semana.get(chave_dia, 0)
        concluidas = concluidas_por_dia.get(d, 0)
        percentual = min(round((concluidas / total_esperado) * 100, 1), 100.0) if total_esperado else 0.0
        desempenho.append(
            PontoDesempenhoOut(data=d, percentual=percentual, suspeito=dia_e_suspeito(horarios_por_dia.get(d, [])))
        )
        d += timedelta(days=1)

    execucoes_ordenadas = sorted(execucoes, key=lambda e: e.criado_em, reverse=True)[:150]
    execucoes_recentes = [
        ExecucaoDetalheOut(
            data_marcacao=e.criado_em.astimezone(FUSO_BRASIL).date(),
            hora=e.criado_em.astimezone(FUSO_BRASIL).strftime("%H:%M"),
            data_treino=e.data_execucao,
            treino_nome=e.serie.exercicio.treino.nome,
            exercicio_nome=e.serie.exercicio.nome,
        )
        for e in execucoes_ordenadas
    ]

    return AnalyticsDetalhadoOut(
        aluno_id=aluno.id,
        periodo_dias=periodo_dias,
        desempenho=desempenho,
        execucoes_recentes=execucoes_recentes,
    )
