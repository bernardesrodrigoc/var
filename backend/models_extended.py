# Extended Models for ExploTrack
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid

# Filial Model
class FilialBase(BaseModel):
    nome: str
    endereco: Optional[str] = None
    telefone: Optional[str] = None
    ativa: bool = True

class Filial(FilialBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Vale Model (Adiantamento de vendedora)
class ValeBase(BaseModel):
    vendedora_id: str
    valor: float
    data: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    mes: int
    ano: int
    observacoes: Optional[str] = None

class Vale(ValeBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

# Transferência de Dinheiro para Gerência
class TransferenciaBase(BaseModel):
    vendedora_id: str
    valor: float
    data: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    observacoes: Optional[str] = None

class Transferencia(TransferenciaBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

# Fechamento de Caixa
class FechamentoCaixaBase(BaseModel):
    vendedora_id: str
    vendedora_nome: str
    filial_id: str
    data: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    total_dinheiro: float
    total_pix: float
    total_cartao: float
    total_credito: float
    total_geral: float
    num_vendas: int
    observacoes: Optional[str] = None

class FechamentoCaixa(FechamentoCaixaBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
