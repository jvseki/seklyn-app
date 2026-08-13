from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    """Base para schemas de saída que leem direto de objetos SQLAlchemy."""

    model_config = ConfigDict(from_attributes=True)
