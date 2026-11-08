"""
Trilha ORIGINAL do vídeo de explicação da parceria (src/ExplicacaoParceria.tsx),
sintetizada aqui mesmo (sem direitos de terceiros): mesma base do Reel
(120 BPM, Lá menor) com efeitos nos cortes de cena, nos cartões que entram,
no "✓ repasse feito" e no fechamento. Os tempos espelham CENAS no .tsx.
Uso:  python scripts/gerar_trilha_parceria.py
Saída: public/parceria/trilha.wav
"""
import os
import wave

import numpy as np

SR = 44100
DURACAO = 55.0
BPM = 120
BATIDA = 60 / BPM
N = int(SR * DURACAO)
rng = np.random.default_rng(7)

# ---------------- linha do tempo (segundos) ----------------
CORTES = [4.0, 14.0, 25.0, 33.0, 40.0, 50.0]
TOQUES = [40.83, 42.33, 43.83, 45.33]  # passos do "próximo passo"
POPS = [4.67, 6.33, 25.67, 26.5, 27.33]  # cartões e opções entrando
NOTIFICACAO = 34.0                       # "hoje": repasse
VITORIA = 10.7                           # "repasse feito ✓"
IMPACTOS = [0.05, 50.0]                  # abertura e fechamento
INICIO_BATIDA = 4.0


def t_de(segundos, n):
    return np.arange(n) / SR


def env_exp(n, decaimento):
    return np.exp(-np.arange(n) / (SR * decaimento))


def colocar(buffer, inicio_s, som, ganho=1.0):
    i = int(inicio_s * SR)
    if i >= len(buffer):
        return
    fim = min(len(buffer), i + len(som))
    buffer[i:fim] += som[: fim - i] * ganho


def nota_hz(semitons_de_a4):
    return 440.0 * 2 ** (semitons_de_a4 / 12)


# ---------------- instrumentos ----------------
def kick():
    n = int(SR * 0.45)
    t = t_de(0, n)
    freq = 45 + 110 * np.exp(-t * 28)
    fase = 2 * np.pi * np.cumsum(freq) / SR
    return np.sin(fase) * env_exp(n, 0.16) * 1.1


def hat(aberto=False):
    n = int(SR * (0.18 if aberto else 0.05))
    ruido = rng.standard_normal(n)
    ruido = np.diff(ruido, prepend=0)  # agudo
    return ruido * env_exp(n, 0.06 if aberto else 0.012) * 0.22


def clap():
    n = int(SR * 0.25)
    ruido = rng.standard_normal(n)
    envelope = env_exp(n, 0.07)
    for atraso in (0.0, 0.011, 0.022):  # três estalos juntos = clap
        k = int(atraso * SR)
        envelope[k:] += env_exp(n - k, 0.012) * 0.6
    return np.convolve(ruido * envelope, np.ones(6) / 6, mode="same") * 0.32


def baixo(freq, duracao):
    n = int(SR * duracao)
    t = t_de(0, n)
    onda = np.sign(np.sin(2 * np.pi * freq * t)) * 0.35 + np.sin(2 * np.pi * freq * t) * 0.65
    onda = np.convolve(onda, np.ones(18) / 18, mode="same")  # filtro passa-baixa simples
    ataque = np.minimum(1, t / 0.008)
    return onda * ataque * env_exp(n, 0.35) * 0.42


def pad(freqs, duracao):
    n = int(SR * duracao)
    t = t_de(0, n)
    onda = np.zeros(n)
    for f in freqs:
        for desafino in (-0.11, 0.0, 0.13):  # "supersaw" suave
            onda += np.sin(2 * np.pi * f * (1 + desafino / 100) * t + rng.uniform(0, 6))
    onda /= len(freqs) * 3
    fade = np.minimum(1, t / 0.25) * np.minimum(1, (duracao - t) / 0.35)
    return onda * fade * 0.16


def whoosh(duracao=0.55):
    n = int(SR * duracao)
    t = t_de(0, n)
    ruido = rng.standard_normal(n)
    janela = 40 - 34 * (t / duracao)  # filtro abrindo = "subindo"
    filtrado = np.array([0.0] * n)
    acumulado = 0.0
    for i in range(n):  # passa-baixa de 1 polo com corte variável
        alfa = 1 / max(1.0, janela[i])
        acumulado += alfa * (ruido[i] - acumulado)
        filtrado[i] = acumulado
    envelope = np.sin(np.pi * t / duracao) ** 2
    return filtrado * envelope * 1.6


def clique():
    n = int(SR * 0.06)
    t = t_de(0, n)
    return (np.sin(2 * np.pi * 1900 * t) * 0.6 + rng.standard_normal(n) * 0.25) * env_exp(n, 0.008) * 0.55


def pop(freq=880):
    n = int(SR * 0.22)
    t = t_de(0, n)
    f = freq * (1 + 0.6 * np.exp(-t * 40))
    fase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(fase) * env_exp(n, 0.07) * 0.5


def sino(freq, duracao=1.2, ganho=0.35):
    n = int(SR * duracao)
    t = t_de(0, n)
    onda = np.sin(2 * np.pi * freq * t) + 0.4 * np.sin(2 * np.pi * freq * 2.01 * t) + 0.15 * np.sin(2 * np.pi * freq * 3.02 * t)
    return onda * env_exp(n, duracao / 3.5) * ganho * np.minimum(1, t / 0.004)


def impacto():
    n = int(SR * 1.4)
    t = t_de(0, n)
    grave = np.sin(2 * np.pi * (38 + 60 * np.exp(-t * 10)) * t) * env_exp(n, 0.5)
    ruido = np.convolve(rng.standard_normal(n), np.ones(30) / 30, mode="same") * env_exp(n, 0.25) * 2.5
    return (grave + ruido) * 0.75


def riser(duracao):
    n = int(SR * duracao)
    t = t_de(0, n)
    freq = 200 + 1400 * (t / duracao) ** 2
    fase = 2 * np.pi * np.cumsum(freq) / SR
    return np.sin(fase) * (t / duracao) ** 2 * 0.12 + rng.standard_normal(n) * (t / duracao) ** 3 * 0.05


# ---------------- arranjo ----------------
musica = np.zeros(N)
efeitos = np.zeros(N)

# Lá menor: Am – F – C – G (1 compasso = 4 batidas = 2s cada)
PROGRESSAO = [
    (nota_hz(-36), [nota_hz(-12), nota_hz(-9), nota_hz(-5)]),   # Am (A2 | A3 C4 E4)
    (nota_hz(-40), [nota_hz(-16), nota_hz(-12), nota_hz(-9)]),  # F
    (nota_hz(-33), [nota_hz(-21), nota_hz(-17), nota_hz(-14)]), # C
    (nota_hz(-38), [nota_hz(-14), nota_hz(-10), nota_hz(-7)]),  # G
]

# Gancho (0–3s): só pad grave + riser, criando tensão até a logo.
colocar(musica, 0.0, pad(PROGRESSAO[0][1], 4.0) * 1.2)
colocar(musica, 2.2, riser(1.8))

fim_batida = 50.0
batida = 0
tempo = INICIO_BATIDA
while tempo < fim_batida:
    compasso = int((tempo - INICIO_BATIDA) // (BATIDA * 4)) % 4
    pos = batida % 4
    colocar(musica, tempo, kick())
    if pos in (1, 3):
        colocar(musica, tempo, clap())
    colocar(musica, tempo + BATIDA / 2, hat(aberto=pos == 3))
    colocar(musica, tempo, hat(), 0.6)
    raiz, acorde = PROGRESSAO[compasso]
    colocar(musica, tempo + BATIDA / 2, baixo(raiz, BATIDA * 0.45))
    if pos == 0:
        colocar(musica, tempo, pad(acorde, BATIDA * 4))
    tempo += BATIDA
    batida += 1

# Fechamento: acorde de Lá menor aberto segurando até o fim (sem isso o
# último segundo ficava mudo depois que a batida parava).
colocar(musica, 50.0, pad([nota_hz(-24), nota_hz(-12), nota_hz(-9), nota_hz(-5), nota_hz(0)], 5.0) * 2.2)
colocar(musica, 50.0, baixo(nota_hz(-36), 4.5) * 0.9)

# "Respiro" no troféu: a batida abaixa e o acorde de vitória brilha.
for som_inicio in CORTES:
    colocar(efeitos, som_inicio - 0.32, whoosh(), 0.55)
for t in TOQUES:
    colocar(efeitos, t, clique())
for i, t in enumerate(POPS):
    colocar(efeitos, t, pop(880 * 2 ** (i * 4 / 12)))  # cada série um tom acima
colocar(efeitos, NOTIFICACAO, sino(nota_hz(7), 0.5, 0.3))
colocar(efeitos, NOTIFICACAO + 0.14, sino(nota_hz(12), 0.7, 0.3))
for i, semitom in enumerate([0, 4, 7, 12, 16]):  # arpejo de Lá maior subindo
    colocar(efeitos, VITORIA + i * 0.09, sino(nota_hz(semitom + 3), 1.6, 0.26))
for t in IMPACTOS:
    colocar(efeitos, t, impacto(), 0.9)

# Mixagem: ducking leve da música sob os efeitos principais + fade final.
tempo_amostras = np.arange(N) / SR
duck = np.ones(N)
for t in [VITORIA, 50.0]:
    duck -= 0.45 * np.exp(-((tempo_amostras - t - 0.3) ** 2) / (2 * 0.35 ** 2))
mix = musica * duck * 0.8 + efeitos
fade = np.clip((DURACAO - tempo_amostras) / 1.5, 0, 1)
mix *= fade
mix = np.tanh(mix * 1.15)  # limitador suave
mix /= np.max(np.abs(mix)) * 1.05

# Estéreo: um pequeno atraso no canal direito dá largura.
atraso = int(SR * 0.012)
esquerda = mix
direita = np.concatenate([np.zeros(atraso), mix[:-atraso]]) * 0.92 + mix * 0.08
estereo = np.stack([esquerda, direita], axis=1)

os.makedirs(os.path.join(os.path.dirname(__file__), "..", "public", "parceria"), exist_ok=True)
saida = os.path.join(os.path.dirname(__file__), "..", "public", "parceria", "trilha.wav")
with wave.open(saida, "wb") as arquivo:
    arquivo.setnchannels(2)
    arquivo.setsampwidth(2)
    arquivo.setframerate(SR)
    arquivo.writeframes((estereo * 32767).astype(np.int16).tobytes())
print("trilha gerada:", os.path.abspath(saida), f"({DURACAO}s)")
