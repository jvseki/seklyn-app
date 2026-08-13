from pydantic import BaseModel, EmailStr


class AdminEmailIn(BaseModel):
    email: EmailStr


class AdminAssinaturaOut(BaseModel):
    email: EmailStr
    status: str
