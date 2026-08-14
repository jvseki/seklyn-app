from pydantic import BaseModel, EmailStr


class AdminEmailIn(BaseModel):
    email: EmailStr


class AdminAtivarIn(BaseModel):
    email: EmailStr
    # Quantos alunos esse Personal pode cadastrar (combinado individualmente
    # fora do site). Se omitido, mantém o limite que já estava definido.
    limite_alunos: int | None = None


class AdminAssinaturaOut(BaseModel):
    email: EmailStr
    status: str
    limite_alunos: int | None = None
