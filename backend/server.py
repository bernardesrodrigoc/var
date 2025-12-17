from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from seed_data import seed_database
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="ExploTrack API", version="2.0.0")
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

# Auth Models
class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class TokenData(BaseModel):
    username: Optional[str] = None

class UserBase(BaseModel):
    username: str
    full_name: str
    role: str  # "admin", "gerente", "vendedora"
    active: bool = True

class UserCreate(UserBase):
    password: str
    meta_mensal: float = 0.0  # Meta de vendas mensal
    filial_id: Optional[str] = None  # Filial onde trabalha
    filiais_acesso: List[str] = []  # Para gerentes: filiais que pode acessar

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    meta_mensal: float = 0.0
    filial_id: Optional[str] = None
    filiais_acesso: List[str] = []

class UserInDB(User):
    hashed_password: str

# Product Models
class ProductBase(BaseModel):
    codigo: str  # Product code / barcode
    descricao: str
    quantidade: int
    preco_custo: float
    preco_venda: float
    categoria: Optional[str] = "Geral"
    filial_id: str  # Produto pertence a uma filial

class ProductCreate(ProductBase):
    pass

class Product(ProductBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Customer Models
class CustomerBase(BaseModel):
    nome: str
    telefone: Optional[str] = None
    cpf: Optional[str] = None
    endereco: Optional[str] = None
    limite_credito: float = 0.0
    saldo_devedor: float = 0.0  # Dívida de compras a prazo
    credito_loja: float = 0.0  # Crédito de trocas
    data_ultimo_credito: Optional[datetime] = None
    filial_id: Optional[str] = None  # Cliente pode ser associado a uma filial

class CustomerCreate(CustomerBase):
    pass

class Customer(CustomerBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Sale Item Model
class SaleItem(BaseModel):
    product_id: str
    codigo: str
    descricao: str
    quantidade: int
    preco_venda: float
    preco_custo: float
    subtotal: float

# Payment Split Model
class PaymentSplit(BaseModel):
    modalidade: str
    valor: float
    parcelas: int = 1

# Sale Models
class SaleBase(BaseModel):
    items: List[SaleItem]
    total: float
    modalidade_pagamento: str  # "Dinheiro", "Cartao", "Pix", "Credito", "Misto"
    pagamentos: List[PaymentSplit] = []  # Para pagamento misto
    parcelas: int = 1
    desconto: float = 0.0
    vendedor: str
    vendedor_id: Optional[str] = None  # ID do vendedor responsável
    customer_id: Optional[str] = None
    observacoes: Optional[str] = None
    online: bool = False
    encomenda: bool = False
    is_troca: bool = False  # Se é uma troca
    filial_id: str  # Venda pertence a uma filial

class SaleCreate(SaleBase):
    data: Optional[datetime] = None
    pass

class Sale(SaleBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # VOLTAMOS COM OS DEFAULTS PARA NÃO QUEBRAR LEITURA DE DADOS ANTIGOS
    data: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    hora: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%H:%M:%S"))
    
    estornada: bool = False
    estornada_em: Optional[str] = None
    estornada_por: Optional[str] = None
    

# Payment Plan Models
class PaymentPlanBase(BaseModel):
    customer_id: str
    sale_id: str
    valor_total: float
    valor_pago: float = 0.0
    parcelas_total: int
    parcelas_pagas: int = 0
    taxa_juros: float = 0.0
    status: str = "ativo"  # "ativo", "pago", "atrasado"

class PaymentPlanCreate(PaymentPlanBase):
    pass

class PaymentPlan(PaymentPlanBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    vencimentos: List[datetime] = []

# Goal Models
class GoalBase(BaseModel):
    vendedor: str
    mes: int
    ano: int
    meta_vendas: float
    meta_pecas: int

class GoalCreate(GoalBase):
    pass

class Goal(GoalBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendas_realizadas: float = 0.0
    pecas_vendidas: int = 0
    percentual_atingido: float = 0.0

# Store Credit Models
class StoreCreditBase(BaseModel):
    customer_id: str
    valor: float
    origem: str  # "troca", "devolucao", "bonus"
    observacoes: Optional[str] = None

class StoreCreditCreate(StoreCreditBase):
    pass

class StoreCredit(StoreCreditBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    usado: bool = False
    venda_origem_id: Optional[str] = None

# ==================== AUTH HELPERS ====================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

async def get_user(username: str):
    user = await db.users.find_one({"username": username}, {"_id": 0})
    if user:
        return UserInDB(**user)
    return None

async def authenticate_user(username: str, password: str):
    user = await get_user(username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = await get_user(username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.active:
        raise HTTPException(status_code=400, detail="Usuário inativo")
    return current_user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=User)
async def register(user: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"username": user.username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Nome de usuário já existe")
    
    # Create user
    hashed_password = get_password_hash(user.password)
    user_dict = user.model_dump()
    del user_dict["password"]
    user_obj = UserInDB(**user_dict, hashed_password=hashed_password)
    
    doc = user_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    return User(**user_dict, id=user_obj.id, created_at=user_obj.created_at)

@api_router.post("/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return Token(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "filial_id": user.filial_id,
            "filiais_acesso": user.filiais_acesso
        }
    )

@api_router.get("/auth/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

@api_router.get("/users", response_model=List[User])
async def get_all_users(current_user: User = Depends(get_current_active_user)):
    # Admin vê todos os usuários
    if current_user.role == "admin":
        users = await db.users.find({}, {"_id": 0, "hashed_password": 0}).to_list(100)
    # Gerentes e vendedoras veem apenas usuários da mesma filial
    elif current_user.role in ["gerente", "vendedora"]:
        users = await db.users.find(
            {"filial_id": current_user.filial_id}, 
            {"_id": 0, "hashed_password": 0}
        ).to_list(100)
    else:
        raise HTTPException(status_code=403, detail="Sem permissão para listar usuários")
    
    for u in users:
        if isinstance(u.get('created_at'), str):
            u['created_at'] = datetime.fromisoformat(u['created_at'])
    return users

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, user_data: UserCreate, current_user: User = Depends(get_current_active_user)):
    # Only admin can update users
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem alterar usuários")
    
    update_dict = user_data.model_dump(exclude={'password'})
    if user_data.password:
        update_dict['hashed_password'] = get_password_hash(user_data.password)
    
    await db.users.update_one({"id": user_id}, {"$set": update_dict})
    return {"message": "Usuário atualizado com sucesso"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_active_user)):
    # Only admin can delete users
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem excluir usuários")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return {"message": "Usuário excluído com sucesso"}

# ==================== PRODUCT ROUTES ====================

@api_router.post("/products", response_model=Product)
async def create_product(product: ProductCreate, current_user: User = Depends(get_current_active_user)):
    # Only admin and gerente can create products
    if current_user.role not in ["admin", "gerente"]:
        raise HTTPException(status_code=403, detail="Apenas administradores e gerentes podem cadastrar produtos")
    
    # Check if codigo exists IN THE SAME FILIAL (not globally)
    existing = await db.products.find_one({
        "codigo": product.codigo,
        "filial_id": product.filial_id
    }, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Código de produto já existe nesta filial")
    
    product_obj = Product(**product.model_dump())
    doc = product_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.products.insert_one(doc)
    return product_obj

@api_router.get("/products", response_model=List[Product])
async def get_products(
    filial_id: Optional[str] = None, 
    skip: int = 0, 
    limit: int = 100, 
    current_user: User = Depends(get_current_active_user)
):
    query = {}
    if filial_id:
        query["filial_id"] = filial_id
    
    # Add pagination
    products = await db.products.find(query, {"_id": 0}).skip(skip).limit(min(limit, 500)).to_list(limit)
    for p in products:
        if isinstance(p.get('created_at'), str):
            p['created_at'] = datetime.fromisoformat(p['created_at'])
        if isinstance(p.get('updated_at'), str):
            p['updated_at'] = datetime.fromisoformat(p['updated_at'])
    return products

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str, current_user: User = Depends(get_current_active_user)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    if isinstance(product.get('created_at'), str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    if isinstance(product.get('updated_at'), str):
        product['updated_at'] = datetime.fromisoformat(product['updated_at'])
    return Product(**product)

@api_router.get("/products/barcode/{codigo}", response_model=Product)
async def get_product_by_barcode(codigo: str, filial_id: Optional[str] = None, current_user: User = Depends(get_current_active_user)):
    # Search for product by barcode in specific filial
    query = {"codigo": codigo}
    if filial_id:
        query["filial_id"] = filial_id
    
    product = await db.products.find_one(query, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado nesta filial")
    if isinstance(product.get('created_at'), str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    if isinstance(product.get('updated_at'), str):
        product['updated_at'] = datetime.fromisoformat(product['updated_at'])
    return Product(**product)

@api_router.get("/products/search/{query}", response_model=List[Product])
async def search_products(query: str, filial_id: Optional[str] = None, current_user: User = Depends(get_current_active_user)):
    # Search by codigo or descricao (case insensitive)
    search_query = {
        "$or": [
            {"codigo": {"$regex": query, "$options": "i"}},
            {"descricao": {"$regex": query, "$options": "i"}}
        ]
    }
    
    if filial_id:
        search_query["filial_id"] = filial_id
    
    products = await db.products.find(search_query, {"_id": 0}).limit(10).to_list(10)
    
    for p in products:
        if isinstance(p.get('created_at'), str):
            p['created_at'] = datetime.fromisoformat(p['created_at'])
        if isinstance(p.get('updated_at'), str):
            p['updated_at'] = datetime.fromisoformat(p['updated_at'])
    return products

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, product: ProductCreate, current_user: User = Depends(get_current_active_user)):
    # Only admin and gerente can edit products
    if current_user.role not in ["admin", "gerente"]:
        raise HTTPException(status_code=403, detail="Apenas administradores e gerentes podem editar produtos")
    
    existing = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    
    # Check if new codigo already exists in the same filial (excluding current product)
    if product.codigo != existing.get('codigo'):
        duplicate = await db.products.find_one({
            "codigo": product.codigo,
            "filial_id": product.filial_id,
            "id": {"$ne": product_id}
        }, {"_id": 0})
        if duplicate:
            raise HTTPException(status_code=400, detail="Código de produto já existe nesta filial")
    
    update_data = product.model_dump()
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.products.update_one({"id": product_id}, {"$set": update_data})
    
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated.get('updated_at'), str):
        updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
    return Product(**updated)

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: User = Depends(get_current_active_user)):
    # Only admin and gerente can delete products
    if current_user.role not in ["admin", "gerente"]:
        raise HTTPException(status_code=403, detail="Apenas administradores e gerentes podem excluir produtos")
    
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return {"message": "Produto excluído com sucesso"}

# ==================== CUSTOMER ROUTES ====================

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerCreate, current_user: User = Depends(get_current_active_user)):
    # 1. Validação de CPF Duplicado
    if customer.cpf:
        # Limpa pontuação do CPF para comparar apenas números (opcional, mas recomendado)
        cpf_limpo = customer.cpf.replace(".", "").replace("-", "").strip()
        
        # Busca se já existe algum cliente com esse CPF (mesmo em outras filiais, pois a pessoa é única)
        # Se quiser limitar por filial, adicione "filial_id": customer.filial_id na busca
        existing = await db.customers.find_one({"cpf": customer.cpf}, {"_id": 0})
        
        if existing:
            raise HTTPException(
                status_code=400, 
                detail=f"Já existe um cliente cadastrado com este CPF: {existing.get('nome')}"
            )

    customer_obj = Customer(**customer.model_dump())
    doc = customer_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.customers.insert_one(doc)
    return customer_obj

@api_router.get("/customers", response_model=List[Customer])
async def get_customers(
    filial_id: Optional[str] = None, 
    skip: int = 0, 
    limit: int = 100, 
    current_user: User = Depends(get_current_active_user)
):
    query = {}
    if filial_id:
        query["filial_id"] = filial_id
    
    # Add pagination
    customers = await db.customers.find(query, {"_id": 0}).skip(skip).limit(min(limit, 500)).to_list(limit)
    for c in customers:
        if isinstance(c.get('created_at'), str):
            c['created_at'] = datetime.fromisoformat(c['created_at'])
    return customers

@api_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str, current_user: User = Depends(get_current_active_user)):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    if isinstance(customer.get('created_at'), str):
        customer['created_at'] = datetime.fromisoformat(customer['created_at'])
    return Customer(**customer)

@api_router.get("/customers/{customer_id}/sales")
async def get_customer_sales(customer_id: str, current_user: User = Depends(get_current_active_user)):
    sales = await db.sales.find({"customer_id": customer_id}, {"_id": 0}).to_list(1000)
    for s in sales:
        if isinstance(s.get('data'), str):
            s['data'] = datetime.fromisoformat(s['data'])
    return sales

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer: CustomerCreate, current_user: User = Depends(get_current_active_user)):
    existing = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    update_data = customer.model_dump()
    await db.customers.update_one({"id": customer_id}, {"$set": update_data})
    
    updated = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return Customer(**updated)

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: User = Depends(get_current_active_user)):
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return {"message": "Cliente excluído com sucesso"}


@api_router.get("/customers/{customer_id}/compras-fiado")
async def get_compras_fiado(customer_id: str, current_user: User = Depends(get_current_active_user)):
    """
    Retorna o histórico detalhado de compras feitas no 'Fiado' (Crédito)
    para conferência dos itens pelo cliente.
    """
    # Busca vendas:
    # 1. Deste cliente
    # 2. Modalidade "Credito" (Fiado)
    # 3. Que NÃO foram estornadas
    vendas = await db.sales.find(
        {
            "customer_id": customer_id, 
            "modalidade_pagamento": "Credito",
            "estornada": {"$ne": True}
        }, 
        {"_id": 0}
    ).sort("data", -1).to_list(200) # Limite das últimas 200 compras
    
    # Formata datas para o padrão correto
    for v in vendas:
        if isinstance(v.get('data'), str):
            v['data'] = datetime.fromisoformat(v['data'])
            
    return vendas


# ==================== PAGAMENTO SALDO DEVEDOR ====================

class PagamentoSaldoBase(BaseModel):
    customer_id: str
    customer_nome: str
    valor: float
    forma_pagamento: str  # Dinheiro, Pix, Cartao, etc
    vendedora_id: str
    vendedora_nome: str
    observacoes: Optional[str] = None

class PagamentoSaldo(PagamentoSaldoBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    filial_id: str

@api_router.post("/customers/{customer_id}/pagar-saldo")
async def pagar_saldo_devedor(
    customer_id: str, 
    pagamento: PagamentoSaldoBase, 
    current_user: User = Depends(get_current_active_user)
):
    """
    Registra um pagamento parcial ou total do saldo devedor de um cliente
    Qualquer vendedora ou admin pode receber pagamentos
    """
    # Buscar cliente
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    # Validar valor
    if pagamento.valor <= 0:
        raise HTTPException(status_code=400, detail="Valor deve ser maior que zero")
    
    if pagamento.valor > customer.get('saldo_devedor', 0):
        raise HTTPException(status_code=400, detail="Valor maior que o saldo devedor")
    
    # Criar registro de pagamento
    pagamento_obj = PagamentoSaldo(
        **pagamento.model_dump(),
        filial_id=customer.get('filial_id', '')
    )
    doc = pagamento_obj.model_dump()
    doc['data'] = doc['data'].isoformat()
    
    await db.pagamentos_saldo.insert_one(doc)
    
    # Atualizar saldo devedor do cliente
    novo_saldo = customer.get('saldo_devedor', 0) - pagamento.valor
    await db.customers.update_one(
        {"id": customer_id},
        {"$set": {"saldo_devedor": max(0, novo_saldo)}}
    )
    
    return {
        "message": "Pagamento registrado com sucesso",
        "saldo_anterior": customer.get('saldo_devedor', 0),
        "valor_pago": pagamento.valor,
        "novo_saldo": max(0, novo_saldo)
    }

@api_router.get("/customers/{customer_id}/historico-pagamentos")
async def get_historico_pagamentos(
    customer_id: str, 
    current_user: User = Depends(get_current_active_user)
):
    """
    Retorna histórico de pagamentos de saldo devedor de um cliente
    """
    pagamentos = await db.pagamentos_saldo.find(
        {"customer_id": customer_id}, 
        {"_id": 0}
    ).sort("data", -1).to_list(100)
    
    # Converter datas
    for p in pagamentos:
        if isinstance(p.get('data'), str):
            p['data'] = datetime.fromisoformat(p['data'])
    
    return pagamentos


# ==================== SALES ROUTES ====================

@api_router.post("/sales", response_model=Sale)
async def create_sale(sale: SaleCreate, current_user: User = Depends(get_current_active_user)):
    # If it's a troca (exchange), ADD quantity back to stock instead of subtracting
    if sale.is_troca:
        for item in sale.items:
            product = await db.products.find_one({"id": item.product_id}, {"_id": 0})
            if not product:
                raise HTTPException(status_code=404, detail=f"Produto {item.codigo} não encontrado")
            
            # ADD quantity back (troca = produto voltando)
            new_quantity = product['quantidade'] + item.quantidade
            
            await db.products.update_one(
                {"id": item.product_id},
                {"$set": {"quantidade": new_quantity, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
    else:
        # Normal sale: SUBTRACT quantity from stock
        for item in sale.items:
            product = await db.products.find_one({"id": item.product_id}, {"_id": 0})
            if not product:
                raise HTTPException(status_code=404, detail=f"Produto {item.codigo} não encontrado")
            
            new_quantity = product['quantidade'] - item.quantidade
            if new_quantity < 0:
                raise HTTPException(status_code=400, detail=f"Estoque insuficiente para {item.descricao}")
            
            await db.products.update_one(
                {"id": item.product_id},
                {"$set": {"quantidade": new_quantity, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
    
    # Create sale
    sale_data = sale.model_dump()
    
    # Fuso Horário de São Paulo
    try:
        br_timezone = ZoneInfo("America/Sao_Paulo")
    except:
        br_timezone = timezone(timedelta(hours=-3)) # Fallback se ZoneInfo falhar

    agora = datetime.now(br_timezone)

    # Lógica de Data:
    # Se NÃO tem data (venda normal), usa AGORA.
    if not sale_data.get('data'):
        sale_data['data'] = agora
    # Se TEM data (retroativa enviada pelo front), mantemos ela.

    # Garante que a 'hora' seja gravada
    data_registro = sale_data['data']
    if isinstance(data_registro, str):
        data_registro = datetime.fromisoformat(data_registro.replace('Z', '+00:00'))

    # Se a data do registro for "hoje", usa a hora atual. Se for passado, usa 12:00.
    if data_registro.date() == agora.date():
        sale_data['hora'] = agora.strftime("%H:%M:%S")
    else:
        # Se for retroativo e não tiver hora, define 12:00:00
        if not sale_data.get('hora'):
            sale_data['hora'] = "12:00:00"

    sale_obj = Sale(**sale_data)
    doc = sale_obj.model_dump()
    doc['data'] = doc['data'].isoformat()
    # ----------------------------------
    
    await db.sales.insert_one(doc)
    
    # Update customer credit/debt if applicable
    if sale.customer_id:
        customer = await db.customers.find_one({"id": sale.customer_id}, {"_id": 0})
        if customer:
            # If buying on credit, add to debt
            if sale.modalidade_pagamento == "Credito" and not sale.is_troca:
                new_saldo = customer.get('saldo_devedor', 0) + sale.total
                await db.customers.update_one(
                    {"id": sale.customer_id},
                    {"$set": {"saldo_devedor": new_saldo}}
                )
    
    return sale_obj

@api_router.delete("/sales/{sale_id}/estornar")
async def estornar_venda(sale_id: str, current_user: User = Depends(get_current_active_user)):
    # Apenas admin e gerente podem estornar vendas
    if current_user.role not in ["admin", "gerente"]:
        raise HTTPException(status_code=403, detail="Apenas administradores e gerentes podem estornar vendas")
    
    # Buscar venda
    sale = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Venda não encontrada")
    
    # Verificar se venda já foi estornada
    if sale.get('estornada', False):
        raise HTTPException(status_code=400, detail="Esta venda já foi estornada")
    
    # 1. Devolver produtos ao estoque
    produtos_devolvidos = []
    for item in sale['items']:
        product = await db.products.find_one({"id": item['product_id']}, {"_id": 0})
        if product:
            new_quantity = product['quantidade'] + item['quantidade']
            await db.products.update_one(
                {"id": item['product_id']},
                {"$set": {"quantidade": new_quantity, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            produtos_devolvidos.append({
                "produto": product['descricao'],
                "quantidade": item['quantidade']
            })
    
    # 2. Reverter crédito/débito do cliente se aplicável
    cliente_atualizado = False
    if sale.get('customer_id'):
        customer = await db.customers.find_one({"id": sale['customer_id']}, {"_id": 0})
        if customer:
            # Caso 1: Venda foi no Fiado (Credito) -> Abate a dívida
            if sale['modalidade_pagamento'] == "Credito":
                new_saldo = max(0, customer.get('saldo_devedor', 0) - sale['total'])
                await db.customers.update_one(
                    {"id": sale['customer_id']},
                    {"$set": {"saldo_devedor": new_saldo}}
                )
                cliente_atualizado = True
            
            # Caso 2: Cliente usou Crédito da Loja para pagar -> Devolve o crédito
            elif sale.get('credito_usado', 0) > 0:
                new_credito = customer.get('credito_loja', 0) + sale['credito_usado']
                
                await db.customers.update_one(
                    {"id": sale['customer_id']},
                    {
                        "$set": {
                            "credito_loja": new_credito,
                            # ATUALIZAÇÃO IMPORTANTE:
                            # Se devolveu crédito, atualiza a data para contar o prazo de validade a partir de hoje
                            "data_ultimo_credito": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                cliente_atualizado = True
    
    # 3. Marcar venda como estornada (mantém no histórico mas marcada)
    await db.sales.update_one(
        {"id": sale_id},
        {"$set": {
            "estornada": True,
            "estornada_em": datetime.now(timezone.utc).isoformat(),
            "estornada_por": current_user.username,
            "motivo_estorno": "Cancelamento de venda"
        }}
    )
    
    # 4. Registrar log de auditoria do estorno
    estorno_log = {
        "id": str(uuid.uuid4()),
        "sale_id": sale_id,
        "vendedor": sale.get('vendedor', 'Desconhecido'),
        "vendedor_id": sale.get('vendedor_id'),
        "valor_total": sale['total'],
        "filial_id": sale.get('filial_id'),
        "estornada_por": current_user.username,
        "estornada_em": datetime.now(timezone.utc).isoformat(),
        "produtos_devolvidos": produtos_devolvidos,
        "cliente_id": sale.get('customer_id'),
        "cliente_atualizado": cliente_atualizado
    }
    await db.estornos_log.insert_one(estorno_log)
    
    return {
        "message": "Venda estornada com sucesso",
        "produtos_devolvidos": len(sale['items']),
        "valor_estornado": sale['total'],
        "vendedor": sale.get('vendedor', 'Desconhecido'),
        "cliente_atualizado": cliente_atualizado,
        "detalhes": produtos_devolvidos
    }
# --- SUBSTITUIR A FUNÇÃO get_sales INTEIRA POR ESTA ---
@api_router.get("/sales", response_model=List[Sale])
async def get_sales(
    filial_id: Optional[str] = None, 
    data_inicio: Optional[str] = None, 
    data_fim: Optional[str] = None,    
    skip: int = 0, 
    limit: int = 100, 
    current_user: User = Depends(get_current_active_user)
):
    query = {}
    if filial_id:
        query["filial_id"] = filial_id
    
    # Lógica de Filtro de Data (Faltava isso!)
    if data_inicio:
        date_query = {"$gte": data_inicio}
        if data_fim:
            date_query["$lte"] = data_fim
        query["data"] = date_query
        
        # Se tem filtro de data, aumentamos o limite para garantir que venha tudo
        if limit == 100:
            limit = 50000 

    # Busca no banco
    sales = await db.sales.find(query, {"_id": 0}).sort("data", -1).skip(skip).limit(limit).to_list(limit)
    
    for s in sales:
        if isinstance(s.get('data'), str):
            s['data'] = datetime.fromisoformat(s['data'])
    return sales
# ------------------------------------------------------
@api_router.get("/sales/{sale_id}", response_model=Sale)
async def get_sale(sale_id: str, current_user: User = Depends(get_current_active_user)):
    sale = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Venda não encontrada")
    if isinstance(sale.get('data'), str):
        sale['data'] = datetime.fromisoformat(sale['data'])
    return Sale(**sale)

# ==================== PAYMENT PLAN ROUTES ====================

@api_router.post("/payment-plans", response_model=PaymentPlan)
async def create_payment_plan(plan: PaymentPlanCreate, current_user: User = Depends(get_current_active_user)):
    # Generate vencimentos
    vencimentos = []
    for i in range(plan.parcelas_total):
        vencimento = datetime.now(timezone.utc) + timedelta(days=30 * (i + 1))
        vencimentos.append(vencimento)
    
    plan_obj = PaymentPlan(**plan.model_dump(), vencimentos=vencimentos)
    doc = plan_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['vencimentos'] = [v.isoformat() for v in doc['vencimentos']]
    
    await db.payment_plans.insert_one(doc)
    return plan_obj

@api_router.get("/payment-plans", response_model=List[PaymentPlan])
async def get_payment_plans(current_user: User = Depends(get_current_active_user)):
    plans = await db.payment_plans.find({}, {"_id": 0}).to_list(1000)
    for p in plans:
        if isinstance(p.get('created_at'), str):
            p['created_at'] = datetime.fromisoformat(p['created_at'])
        if 'vencimentos' in p:
            p['vencimentos'] = [datetime.fromisoformat(v) if isinstance(v, str) else v for v in p['vencimentos']]
    return plans

# ==================== GOAL ROUTES ====================

@api_router.post("/goals", response_model=Goal)
async def create_goal(goal: GoalCreate, current_user: User = Depends(get_current_active_user)):
    goal_obj = Goal(**goal.model_dump())
    doc = goal_obj.model_dump()
    
    await db.goals.insert_one(doc)
    return goal_obj

@api_router.get("/goals", response_model=List[Goal])
async def get_goals(current_user: User = Depends(get_current_active_user)):
    goals = await db.goals.find({}, {"_id": 0}).to_list(1000)
    return goals

@api_router.get("/goals/{vendedor}/{mes}/{ano}", response_model=Goal)
async def get_goal_by_period(vendedor: str, mes: int, ano: int, current_user: User = Depends(get_current_active_user)):
    goal = await db.goals.find_one({"vendedor": vendedor, "mes": mes, "ano": ano}, {"_id": 0})
    if not goal:
        # Create default goal
        default_goal = Goal(vendedor=vendedor, mes=mes, ano=ano, meta_vendas=0, meta_pecas=0)
        doc = default_goal.model_dump()
        await db.goals.insert_one(doc)
        return default_goal
    return Goal(**goal)

@api_router.put("/goals/{vendedor}/{mes}/{ano}")
async def update_goal(vendedor: str, mes: int, ano: int, goal_data: GoalCreate, current_user: User = Depends(get_current_active_user)):
    # Only admin can update goals
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem alterar metas")
    
    await db.goals.update_one(
        {"vendedor": vendedor, "mes": mes, "ano": ano},
        {"$set": goal_data.model_dump()},
        upsert=True
    )
    return {"message": "Meta atualizada com sucesso"}

# ==================== STORE CREDIT ROUTES ====================

@api_router.post("/store-credits", response_model=StoreCredit)
async def create_store_credit(credit: StoreCreditCreate, current_user: User = Depends(get_current_active_user)):
    credit_obj = StoreCredit(**credit.model_dump())
    doc = credit_obj.model_dump()
    doc['data'] = doc['data'].isoformat()
    
    await db.store_credits.insert_one(doc)
    
    # Update customer's credit balance
    customer = await db.customers.find_one({"id": credit.customer_id}, {"_id": 0})
    if customer:
        new_credit = customer.get('credito_loja', 0) + credit.valor
        await db.customers.update_one(
            {"id": credit.customer_id},
            {"$set": {"credito_loja": new_credit,
              # ADICIONE ISTO: Atualiza a data do crédito para HOJE
             "data_ultimo_credito": datetime.now(timezone.utc).isoformat()}}
        )
    
    return credit_obj

@api_router.get("/store-credits/customer/{customer_id}", response_model=List[StoreCredit])
async def get_customer_credits(customer_id: str, current_user: User = Depends(get_current_active_user)):
    credits = await db.store_credits.find({"customer_id": customer_id}, {"_id": 0}).to_list(100)
    for c in credits:
        if isinstance(c.get('data'), str):
            c['data'] = datetime.fromisoformat(c['data'])
    return credits

@api_router.get("/store-credits", response_model=List[StoreCredit])
async def get_all_credits(current_user: User = Depends(get_current_active_user)):
    credits = await db.store_credits.find({}, {"_id": 0}).to_list(1000)
    for c in credits:
        if isinstance(c.get('data'), str):
            c['data'] = datetime.fromisoformat(c['data'])
    return credits

@api_router.post("/customers/{customer_id}/expirar-credito")
async def expirar_credito(customer_id: str, current_user: User = Depends(get_current_active_user)):
    if current_user.role not in ["admin", "gerente"]:
        raise HTTPException(status_code=403, detail="Apenas gerentes podem expirar créditos")
        
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
        
    valor_removido = customer.get('credito_loja', 0)
    
    if valor_removido == 0:
        return {"message": "Cliente não possui créditos para expirar"}

    # Zera o crédito
    await db.customers.update_one(
        {"id": customer_id},
        {"$set": {"credito_loja": 0.0}}
    )
    
    # Registra no log de créditos como uma saída (negativo) para auditoria
    log_expiracao = {
        "id": str(uuid.uuid4()),
        "customer_id": customer_id,
        "valor": -valor_removido, # Negativo pois saiu
        "origem": "expiracao_prazo",
        "observacoes": f"Crédito expirado manualmente por {current_user.full_name}",
        "data": datetime.now(timezone.utc).isoformat(),
        "usado": True
    }
    await db.store_credits.insert_one(log_expiracao)
    
    return {"message": "Créditos expirados com sucesso", "valor_removido": valor_removido}

# ==================== REPORTS ROUTES ====================

@api_router.get("/reports/dashboard")
async def get_dashboard_stats(filial_id: Optional[str] = None, current_user: User = Depends(get_current_active_user)):
    # Vendedoras cannot access general dashboard
    if current_user.role == "vendedora":
        raise HTTPException(status_code=403, detail="Vendedoras não têm acesso ao dashboard geral")
    
    # Build query filter
    query = {}
    if filial_id:
        query["filial_id"] = filial_id
    
    # Total products
    total_products = await db.products.count_documents(query)
    
    # Total sales today (excluindo estornadas)
    today = datetime.now(timezone.utc).date()
    

    sales_query = {**query, "data": {"$gte": today.isoformat()}, "estornada": {"$ne": True}, "is_troca": {"$ne": True}}

    
    sales_today = await db.sales.count_documents(sales_query)
    
    # Revenue today (excluindo estornadas)
    sales_pipeline = [
        {"$match": sales_query},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]
    revenue_result = await db.sales.aggregate(sales_pipeline).to_list(1)
    revenue_today = revenue_result[0]['total'] if revenue_result else 0
    
    # Total customers
    total_customers = await db.customers.count_documents(query)
    
    # Low stock products (< 5)
    low_stock = await db.products.count_documents({**query, "quantidade": {"$lt": 5}})
    
    return {
        "total_products": total_products,
        "sales_today": sales_today,
        "revenue_today": revenue_today,
        "total_customers": total_customers,
        "low_stock_products": low_stock
    }

@api_router.get("/reports/sales-by-vendor")
async def get_sales_by_vendor(
    data_inicio: Optional[str] = None, 
    data_fim: Optional[str] = None, 
    filial_id: Optional[str] = None, 
    current_user: User = Depends(get_current_active_user)
):
    # Vendedoras cannot access this report
    if current_user.role == "vendedora":
        raise HTTPException(status_code=403, detail="Vendedoras não têm acesso a relatórios gerais")
    
    match_stage = {"estornada": {"$ne": True}, "is_troca": {"$ne": True}}  # Excluir vendas estornadas
    if filial_id:
        match_stage["filial_id"] = filial_id
    
    if data_inicio and data_fim:
        # Filter by date range
        match_stage["data"] = {"$gte": data_inicio, "$lte": data_fim}
    
    pipeline = [
        {"$match": match_stage},
        {"$group": {
            "_id": "$vendedor",
            "total_vendas": {"$sum": "$total"},
            "num_vendas": {"$sum": 1},
            "total_pecas": {"$sum": {"$sum": "$items.quantidade"}}
        }},
        {"$sort": {"total_vendas": -1}}
    ]
    
    results = await db.sales.aggregate(pipeline).to_list(100)
    return results

@api_router.get("/reports/inventory-value")
async def get_inventory_value(filial_id: Optional[str] = None, current_user: User = Depends(get_current_active_user)):
    match_stage = {}
    if filial_id:
        match_stage["filial_id"] = filial_id
    
    pipeline = [
        {"$match": match_stage} if match_stage else {"$match": {}},
        {"$group": {
            "_id": None,
            "total_custo": {"$sum": {"$multiply": ["$quantidade", "$preco_custo"]}},
            "total_venda": {"$sum": {"$multiply": ["$quantidade", "$preco_venda"]}}
        }}
    ]
    
    result = await db.products.aggregate(pipeline).to_list(1)
    if result:
        return {
            "valor_custo": result[0]['total_custo'],
            "valor_venda": result[0]['total_venda'],
            "lucro_potencial": result[0]['total_venda'] - result[0]['total_custo']
        }
    return {"valor_custo": 0, "valor_venda": 0, "lucro_potencial": 0}

@api_router.get("/reports/my-performance")
async def get_my_performance(current_user: User = Depends(get_current_active_user)):
    # Get current month/year
    now = datetime.now(timezone.utc)
    mes = now.month
    ano = now.year
    
    # Get user's goal
    goal = await db.goals.find_one(
        {"vendedor": current_user.full_name, "mes": mes, "ano": ano}, 
        {"_id": 0}
    )
    
    if not goal:
        # Get meta from user profile
        meta_vendas = current_user.meta_mensal
        goal = {
            "vendedor": current_user.full_name,
            "mes": mes,
            "ano": ano,
            "meta_vendas": meta_vendas,
            "meta_pecas": 0,
            "vendas_realizadas": 0,
            "pecas_vendidas": 0,
            "percentual_atingido": 0
        }
    
    # Calculate sales this month
    start_date = datetime(ano, mes, 1, tzinfo=timezone.utc)
    if mes == 12:
        end_date = datetime(ano + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(ano, mes + 1, 1, tzinfo=timezone.utc)
    
    pipeline = [
        {"$match": {
            "vendedor": current_user.full_name,
            "data": {"$gte": start_date.isoformat(), "$lt": end_date.isoformat()},
            "estornada": {"$ne": True},
            "is_troca": {"$ne": True}
        }},
        {"$group": {
            "_id": None,
            "total_vendas": {"$sum": "$total"},
            "num_vendas": {"$sum": 1},
            "total_pecas": {"$sum": {"$sum": "$items.quantidade"}}
        }}
    ]
    
    result = await db.sales.aggregate(pipeline).to_list(1)
    
    if result:
        vendas_realizadas = result[0]['total_vendas']
        pecas_vendidas = result[0].get('total_pecas', 0)
        num_vendas = result[0]['num_vendas']
    else:
        vendas_realizadas = 0
        pecas_vendidas = 0
        num_vendas = 0
    
    meta = goal.get('meta_vendas', 0)
    percentual = (vendas_realizadas / meta * 100) if meta > 0 else 0
    
    # New commission system: 1% of sales + bonus by tier
    comissao_base = vendas_realizadas * 0.01  # 1% comissão
    
    # Calculate bonus tier based on percentage above meta
    # Meta 1: 16% above base = bonus R$ 40
    # Meta 2: 27% above base = bonus R$ 60
    # Meta 3: 37% above base = bonus R$ 80
    # Meta 4: 68% above base = bonus R$ 250
    
    tier = 1
    bonus_valor = 0
    meta_percentual_atingida = percentual - 100  # Quanto passou da meta base
    
    if meta_percentual_atingida >= 68:
        tier = 4
        bonus_valor = 40 + 60 + 80 + 250  # Acumula todos os bônus
    elif meta_percentual_atingida >= 37:
        tier = 3
        bonus_valor = 40 + 60 + 80
    elif meta_percentual_atingida >= 27:
        tier = 2
        bonus_valor = 40 + 60
    elif meta_percentual_atingida >= 16:
        tier = 1
        bonus_valor = 40
    else:
        tier = 0
        bonus_valor = 0
    
    comissao_total = comissao_base + bonus_valor
    
    # Calculate next tier target
    next_tier_targets = [16, 27, 37, 68]
    falta_percentual = 0
    if tier < 4:
        target_percent = next_tier_targets[tier] if tier < len(next_tier_targets) else 68
        falta_percentual = target_percent - meta_percentual_atingida
    
    return {
        "vendedor": current_user.full_name,
        "mes": mes,
        "ano": ano,
        "meta_vendas": meta,
        "vendas_realizadas": vendas_realizadas,
        "pecas_vendidas": pecas_vendidas,
        "num_vendas": num_vendas,
        "percentual_atingido": percentual,
        "percentual_acima_meta": meta_percentual_atingida,
        "tier_atual": tier,
        "bonus_valor": bonus_valor,
        "comissao_base": comissao_base,
        "comissao_total": comissao_total,
        "falta_percentual_proxima_etapa": max(0, falta_percentual)
    }


@api_router.get("/reports/pagamentos-detalhados")
async def get_pagamentos_detalhados(
    data_inicio: str, 
    data_fim: str, 
    filial_id: Optional[str] = None, 
    current_user: User = Depends(get_current_active_user)
):
    """
    Relatório detalhado de pagamentos para admins
    Mostra por vendedor: vendas, comissões, bônus, vales e total a pagar
    """
    # Only admin and gerente can access this report
    if current_user.role not in ["admin", "gerente"]:
        raise HTTPException(status_code=403, detail="Apenas administradores e gerentes têm acesso a este relatório")
    
    # Build query
    match_stage = {"estornada": {"$ne": True}, "is_troca": {"$ne": True}}  # Excluir vendas estornadas
    if filial_id:
        match_stage["filial_id"] = filial_id
    
    # Date range filter
    match_stage["data"] = {"$gte": data_inicio, "$lte": data_fim}
    
    # Aggregate sales by vendedor
    pipeline = [
        {"$match": match_stage},
        {"$group": {
            "_id": "$vendedor",
            "vendedora_id": {"$first": "$vendedora_id"},
            "total_vendas": {"$sum": "$total"},
            "num_vendas": {"$sum": 1},
            "total_pecas": {"$sum": {"$sum": "$items.quantidade"}}
        }}
    ]
    
    sales_by_vendor = await db.sales.aggregate(pipeline).to_list(100)
    
    # Get commission config for the filial
    if filial_id:
        comissao_config = await db.comissao_config.find_one({"filial_id": filial_id}, {"_id": 0})
    else:
        comissao_config = None
    
    # Use default config if not found
    if not comissao_config:
        comissao_config = {
            "percentual_comissao": 1.0,
            "bonus_tiers": [
                {"percentual_meta": 80, "valor_bonus": 100},
                {"percentual_meta": 90, "valor_bonus": 150},
                {"percentual_meta": 100, "valor_bonus": 200},
                {"percentual_meta": 110, "valor_bonus": 300},
            ]
        }
    
    # For each vendor, calculate commission, bonus, and vales
    result = []
    for vendor_data in sales_by_vendor:
        vendedor_nome = vendor_data["_id"]
        vendedora_id = vendor_data.get("vendedora_id", "")
        total_vendas = vendor_data["total_vendas"]
        num_vendas = vendor_data["num_vendas"]
        total_pecas = vendor_data.get("total_pecas", 0)
        
        # Extract month/year from date range first
        try:
            start_dt = datetime.fromisoformat(data_inicio.replace('Z', '+00:00'))
            mes_inicio = start_dt.month
            ano_inicio = start_dt.year
            end_dt = datetime.fromisoformat(data_fim.replace('Z', '+00:00'))
            mes_fim = end_dt.month
            ano_fim = end_dt.year
        except:
            mes_inicio = mes_fim = datetime.now().month
            ano_inicio = ano_fim = datetime.now().year
        
        # Calculate base commission
        percentual_comissao = comissao_config.get("percentual_comissao", 1.0)
        comissao_base = (total_vendas * percentual_comissao) / 100
        
        # Get vendor's goal (use start month/year)
        goal_doc = await db.goals.find_one(
            {"vendedor": vendedor_nome, "mes": mes_inicio, "ano": ano_inicio}, 
            {"_id": 0}
        )
        
        if goal_doc:
            meta_vendas = goal_doc.get("meta_vendas", 0)
        else:
            # Try to get from user profile
            user_doc = await db.users.find_one({"full_name": vendedor_nome}, {"_id": 0})
            meta_vendas = user_doc.get("meta_mensal", 0) if user_doc else 0
        
        # Calculate bonus based on goal achievement
        percentual_atingido = (total_vendas / meta_vendas * 100) if meta_vendas > 0 else 0
        
        # Find highest bonus tier achieved (non-cumulative)
        bonus_valor = 0
        bonus_tiers = comissao_config.get("bonus_tiers", [])
        sorted_tiers = sorted(bonus_tiers, key=lambda x: x["percentual_meta"], reverse=True)
        
        for tier in sorted_tiers:
            if percentual_atingido >= tier["percentual_meta"]:
                bonus_valor = tier["valor_bonus"]
                break
        
        # Filter vales by date range (same month/year range)
        vale_query = {"vendedora_id": vendedora_id}
        if mes_inicio == mes_fim and ano_inicio == ano_fim:
            vale_query["mes"] = mes_inicio
            vale_query["ano"] = ano_inicio
        else:
            # Multiple months - get all vales in the year range
            vale_query["ano"] = {"$gte": ano_inicio, "$lte": ano_fim}
        
        vales = await db.vales.find(vale_query, {"_id": 0}).to_list(100)
        
        total_vales = sum(v.get("valor", 0) for v in vales)
        
        # Calculate total to pay
        total_a_pagar = comissao_base + bonus_valor - total_vales
        
        result.append({
            "vendedor": vendedor_nome,
            "vendedora_id": vendedora_id,
            "total_vendas": total_vendas,
            "num_vendas": num_vendas,
            "total_pecas": total_pecas,
            "meta_vendas": meta_vendas,
            "percentual_meta": percentual_atingido,
            "comissao_base": comissao_base,
            "bonus_valor": bonus_valor,
            "vales": vales,
            "total_vales": total_vales,
            "total_a_pagar": total_a_pagar
        })
    
    return {
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "filial_id": filial_id,
        "vendedores": result,
        "percentual_comissao": comissao_config.get("percentual_comissao", 1.0)
    }

# ==================== GESTÃO DE CAIXA (ABERTURA/FECHAMENTO/MOVIMENTOS) ====================

class CaixaMovimentoBase(BaseModel):
    filial_id: str
    usuario: str
    tipo: str # "sangria" (gasto), "retirada_gerencia" (lucro), "suprimento" (entrada troco)
    valor: float
    observacao: str

class CaixaMovimento(CaixaMovimentoBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AberturaCaixa(BaseModel):
    filial_id: str
    valor_inicial: float
    usuario: str

class FechamentoCaixaBase(BaseModel):
    vendedora_id: str
    vendedora_nome: str
    filial_id: str
    data: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Valores financeiros
    saldo_inicial: float = 0.0
    total_suprimentos: float = 0.0 # Dinheiro colocado (troco/aporte)
    total_sangrias: float = 0.0 # Gastos (limpeza/lanche)
    total_retiradas_gerencia: float = 0.0 # Dinheiro recolhido pela gerencia
    
    total_dinheiro: float
    total_pix: float
    total_cartao: float
    total_credito: float
    total_geral: float
    num_vendas: int
    observacoes: Optional[str] = None
    status: str = "aberto" # aberto, fechado
    
    # Auditoria
    inconsistencia_abertura: bool = False # Se o valor de abertura não bateu com o fechamento anterior
    diferenca_abertura: float = 0.0

class FechamentoCaixa(FechamentoCaixaBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

@api_router.post("/caixa/abrir")
async def abrir_caixa(dados: AberturaCaixa, current_user: User = Depends(get_current_active_user)):
    today = datetime.now(timezone.utc).date()
    start_dt = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_dt = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)

    # 1. Verifica se já existe caixa aberto hoje NA FILIAL (Independente do usuario)
    existente = await db.fechamentos_caixa.find_one({
        "filial_id": dados.filial_id,
        "data": {"$gte": start_dt.isoformat(), "$lte": end_dt.isoformat()}
    })

    if existente:
        raise HTTPException(status_code=400, detail="O caixa desta filial já foi aberto hoje.")

    # 2. Verifica inconsistência com o dia anterior
    # Busca o último fechamento desta filial (excluindo hoje)
    ultimo_fechamento = await db.fechamentos_caixa.find_one(
        {"filial_id": dados.filial_id, "status": "fechado"},
        sort=[("data", -1)]
    )

    inconsistencia = False
    diferenca = 0.0

    if ultimo_fechamento:
        # Calcula quanto deveria ter ficado na gaveta ontem
        # Dinheiro Final Ontem = Saldo Inicial + Vendas Dinheiro + Suprimentos - Sangrias - Retiradas Gerencia
        dinheiro_ontem = (
            ultimo_fechamento.get('saldo_inicial', 0) +
            ultimo_fechamento.get('total_dinheiro', 0) +
            ultimo_fechamento.get('total_suprimentos', 0) -
            ultimo_fechamento.get('total_sangrias', 0) -
            ultimo_fechamento.get('total_retiradas_gerencia', 0)
        )
        
        # Compara com o valor que está sendo informado agora na abertura
        if abs(dinheiro_ontem - dados.valor_inicial) > 0.50: # Margem de 50 centavos
            inconsistencia = True
            diferenca = dados.valor_inicial - dinheiro_ontem

    # 3. Cria o registro inicial do dia
    novo_caixa = FechamentoCaixa(
        vendedora_id=current_user.id,
        vendedora_nome=dados.usuario,
        filial_id=dados.filial_id,
        saldo_inicial=dados.valor_inicial,
        total_dinheiro=0, total_pix=0, total_cartao=0, total_credito=0, total_geral=0, num_vendas=0,
        status="aberto",
        inconsistencia_abertura=inconsistencia,
        diferenca_abertura=diferenca
    )
    
    doc = novo_caixa.model_dump()
    doc['data'] = doc['data'].isoformat()
    await db.fechamentos_caixa.insert_one(doc)
    
    return {"message": "Caixa aberto com sucesso", "inconsistencia": inconsistencia}

@api_router.post("/caixa/movimento")
async def registrar_movimento(movimento: CaixaMovimentoBase, current_user: User = Depends(get_current_active_user)):
    mov_obj = CaixaMovimento(**movimento.model_dump())
    doc = mov_obj.model_dump()
    doc['data'] = doc['data'].isoformat()
    await db.caixa_movimentos.insert_one(doc)
    return mov_obj

@api_router.post("/fechamento-caixa")
async def salvar_fechamento(fechamento: FechamentoCaixaBase, current_user: User = Depends(get_current_active_user)):
    # Lógica de UPSERT
    today = datetime.now(timezone.utc).date()
    start_dt = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_dt = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)

    query = {
        "filial_id": fechamento.filial_id,
        "data": {"$gte": start_dt.isoformat(), "$lte": end_dt.isoformat()}
    }

    # Atualiza apenas os campos financeiros, mantendo quem abriu e o saldo inicial
    dados_atualizacao = fechamento.model_dump(exclude={'id', 'data', 'saldo_inicial', 'inconsistencia_abertura', 'diferenca_abertura'})
    dados_atualizacao['status'] = 'fechado'
    
    result = await db.fechamentos_caixa.update_one(query, {"$set": dados_atualizacao})

    if result.matched_count == 0:
        # Fallback caso não tenha aberto (raro com a nova lógica)
        fecha_obj = FechamentoCaixa(**fechamento.model_dump())
        doc = fecha_obj.model_dump()
        doc['data'] = doc['data'].isoformat()
        await db.fechamentos_caixa.insert_one(doc)
        return {"message": "Fechamento criado com sucesso"}
    
    return {"message": "Fechamento atualizado com sucesso"}

@api_router.get("/fechamento-caixa/hoje")
async def get_fechamento_hoje(filial_id: Optional[str] = None, current_user: User = Depends(get_current_active_user)):
    today = datetime.now(timezone.utc).date()
    
    # Se não passou filial_id na query, usa a do usuário. 
    # ISSO CORRIGE O PROBLEMA DO ADMIN: O Frontend deve passar a filial selecionada.
    target_filial_id = filial_id if filial_id else current_user.filial_id
    if not target_filial_id:
        target_filial_id = "default"
    
    # 1. Busca Vendas do Dia
    users_same_filial = await db.users.find({"filial_id": target_filial_id}, {"_id": 0, "full_name": 1}).to_list(100)
    vendedores_filial = [u['full_name'] for u in users_same_filial]
    
    sales_query = {
        "vendedor": {"$in": vendedores_filial},
        "data": {"$gte": today.isoformat()},
        "estornada": {"$ne": True},
        "is_troca": {"$ne": True}
    }

    sales_list = await db.sales.find(sales_query, {"_id": 0}).to_list(5000)
    
    summary = {"Dinheiro": 0, "Pix": 0, "Cartao": 0, "Credito": 0}
    vendas_por_vendedora = {}
    
    for sale in sales_list:
        valor_venda = sale['total']
        vendedor = sale['vendedor']
        
        if vendedor not in vendas_por_vendedora:
            vendas_por_vendedora[vendedor] = {"total": 0, "qtd": 0}
        vendas_por_vendedora[vendedor]["total"] += valor_venda
        vendas_por_vendedora[vendedor]["qtd"] += 1

        if sale['modalidade_pagamento'] == "Misto" and 'pagamentos' in sale:
            for p in sale['pagamentos']:
                if p['modalidade'] in summary:
                    summary[p['modalidade']] += p['valor']
        else:
            tipo = sale['modalidade_pagamento']
            if tipo in summary:
                summary[tipo] += valor_venda

    # 2. Busca Dados do Caixa do Dia
    today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    today_end = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)
    
    caixa_dia = await db.fechamentos_caixa.find_one({
        "filial_id": target_filial_id,
        "data": {"$gte": today_start.isoformat(), "$lte": today_end.isoformat()}
    })
    
    saldo_inicial = caixa_dia.get('saldo_inicial', 0.0) if caixa_dia else 0.0
    status_caixa = caixa_dia.get('status', 'nao_iniciado') if caixa_dia else 'nao_iniciado'
    inconsistencia = caixa_dia.get('inconsistencia_abertura', False) if caixa_dia else False
    diferenca = caixa_dia.get('diferenca_abertura', 0.0) if caixa_dia else 0.0

    # 3. Busca Movimentos (Sangrias, Retiradas Gerencia, Suprimentos)
    movimentos = await db.caixa_movimentos.find({
        "filial_id": target_filial_id,
        "data": {"$gte": today_start.isoformat(), "$lte": today_end.isoformat()}
    }, {"_id": 0}).to_list(100)
    
    total_sangrias = sum(m['valor'] for m in movimentos if m['tipo'] == 'sangria')
    total_retiradas_gerencia = sum(m['valor'] for m in movimentos if m['tipo'] == 'retirada_gerencia')
    total_suprimentos = sum(m['valor'] for m in movimentos if m['tipo'] == 'suprimento')

    # 4. Busca Pagamentos de Dívida
    pagamentos_divida = await db.pagamentos_saldo.find({
        "filial_id": target_filial_id,
        "data": {"$gte": today_start.isoformat(), "$lte": today_end.isoformat()}
    }, {"_id": 0}).to_list(100)
    
    for pag in pagamentos_divida:
        forma = pag.get('forma_pagamento', 'Dinheiro')
        if forma == "Cartao": summary["Cartao"] += pag.get('valor', 0)
        elif forma in ["Pix", "Transferencia"]: summary["Pix"] += pag.get('valor', 0)
        else: summary["Dinheiro"] += pag.get('valor', 0)

    lista_vendedoras = [{"nome": k, "total": v["total"], "qtd": v["qtd"]} for k, v in vendas_por_vendedora.items()]

    return {
        "status_caixa": status_caixa,
        "saldo_inicial": saldo_inicial,
        "inconsistencia_abertura": inconsistencia,
        "diferenca_abertura": diferenca,
        
        # Movimentações
        "total_suprimentos": total_suprimentos,
        "total_sangrias": total_sangrias,
        "total_retiradas_gerencia": total_retiradas_gerencia,
        "lista_movimentos": movimentos,
        
        # Vendas
        "vendas_por_vendedora": lista_vendedoras,
        
        # Totais Financeiros
        "total_dinheiro": summary["Dinheiro"],
        "total_pix": summary["Pix"],
        "total_cartao": summary["Cartao"],
        "total_credito": summary["Credito"],
        "total_geral": sum(summary.values()),
        "num_vendas": len(sales_list),
        "pagamentos_divida": pagamentos_divida,
        "filial_id": target_filial_id
    }

@api_router.get("/fechamento-caixa/historico")
async def get_historico_fechamentos(
    data_inicio: str, 
    data_fim: str, 
    filial_id: Optional[str] = None, 
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in ["admin", "gerente"]:
        raise HTTPException(status_code=403, detail="Apenas administradores e gerentes podem ver o histórico")
    
    query = {}
    if filial_id:
        query["filial_id"] = filial_id
        
    start_dt = datetime.fromisoformat(data_inicio.replace('Z', '+00:00'))
    end_dt = datetime.fromisoformat(data_fim.replace('Z', '+00:00')).replace(hour=23, minute=59, second=59)
    
    query["data"] = {"$gte": start_dt.isoformat(), "$lte": end_dt.isoformat()}
    
    fechamentos = await db.fechamentos_caixa.find(query, {"_id": 0}).sort("data", -1).to_list(100)
    
    for f in fechamentos:
        if isinstance(f.get('data'), str):
            f['data'] = datetime.fromisoformat(f['data'])
            
    return fechamentos
    
# ==================== CONFIGURAÇÕES COMISSÃO ====================

class BonusTier(BaseModel):
    percentual_meta: float  # Ex: 80, 90, 100, 110 (% da meta)
    valor_bonus: float  # Valor do bônus em R$

class ComissionConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filial_id: str
    percentual_comissao: float = 1.0  # % padrão de comissão (1%)
    bonus_tiers: List[BonusTier] = [
        BonusTier(percentual_meta=80, valor_bonus=100),
        BonusTier(percentual_meta=90, valor_bonus=150),
        BonusTier(percentual_meta=100, valor_bonus=200),
        BonusTier(percentual_meta=110, valor_bonus=300),
    ]
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: str = ""

class ComissionConfigUpdate(BaseModel):
    percentual_comissao: float
    bonus_tiers: List[BonusTier]

@api_router.get("/comissao-config/{filial_id}")
async def get_comissao_config(filial_id: str, current_user: User = Depends(get_current_active_user)):
    config = await db.comissao_config.find_one({"filial_id": filial_id}, {"_id": 0})
    
    if not config:
        # Retornar configuração padrão
        default_config = ComissionConfig(filial_id=filial_id)
        return default_config.model_dump()
    
    if isinstance(config.get('updated_at'), str):
        config['updated_at'] = datetime.fromisoformat(config['updated_at'])
    return config

@api_router.put("/comissao-config/{filial_id}")
async def update_comissao_config(
    filial_id: str, 
    config: ComissionConfigUpdate, 
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem alterar configurações")
    
    # Buscar config existente
    existing = await db.comissao_config.find_one({"filial_id": filial_id})
    
    update_data = {
        "percentual_comissao": config.percentual_comissao,
        "bonus_tiers": [tier.model_dump() for tier in config.bonus_tiers],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.username
    }
    
    if existing:
        # Atualizar existente
        await db.comissao_config.update_one(
            {"filial_id": filial_id},
            {"$set": update_data}
        )
    else:
        # Criar novo
        new_config = ComissionConfig(
            filial_id=filial_id,
            percentual_comissao=config.percentual_comissao,
            bonus_tiers=config.bonus_tiers,
            updated_by=current_user.username
        )
        doc = new_config.model_dump()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.comissao_config.insert_one(doc)
    
    return {"message": "Configuração atualizada com sucesso"}

# ==================== VALES ROUTES ====================

class ValeBase(BaseModel):
    vendedora_id: str
    vendedora_nome: str
    valor: float
    mes: int
    ano: int
    observacoes: Optional[str] = None

class Vale(ValeBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

@api_router.post("/vales")
async def create_vale(vale: ValeBase, current_user: User = Depends(get_current_active_user)):
    # Only admin and gerente can create vales
    if current_user.role not in ["admin", "gerente"]:
        raise HTTPException(status_code=403, detail="Apenas administradores e gerentes podem registrar vales")
    
    vale_obj = Vale(**vale.model_dump())
    doc = vale_obj.model_dump()
    doc['data'] = doc['data'].isoformat()
    
    await db.vales.insert_one(doc)
    return vale_obj

@api_router.get("/vales/vendedora/{vendedora_id}")
async def get_vales_vendedora(vendedora_id: str, mes: Optional[int] = None, ano: Optional[int] = None, current_user: User = Depends(get_current_active_user)):
    query = {"vendedora_id": vendedora_id}
    if mes:
        query["mes"] = mes
    if ano:
        query["ano"] = ano
    
    vales = await db.vales.find(query, {"_id": 0}).to_list(100)
    for v in vales:
        if isinstance(v.get('data'), str):
            v['data'] = datetime.fromisoformat(v['data'])
    return vales

@api_router.put("/vales/{vale_id}")
async def update_vale(vale_id: str, vale: ValeBase, current_user: User = Depends(get_current_active_user)):
    # Only admin and gerente can update vales
    if current_user.role not in ["admin", "gerente"]:
        raise HTTPException(status_code=403, detail="Apenas administradores e gerentes podem editar vales")
    
    update_data = vale.model_dump()
    result = await db.vales.update_one(
        {"id": vale_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Vale não encontrado")
    
    return {"message": "Vale atualizado com sucesso"}

@api_router.delete("/vales/{vale_id}")
async def delete_vale(vale_id: str, current_user: User = Depends(get_current_active_user)):
    # Only admin and gerente can delete vales
    if current_user.role not in ["admin", "gerente"]:
        raise HTTPException(status_code=403, detail="Apenas administradores e gerentes podem excluir vales")
    
    result = await db.vales.delete_one({"id": vale_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vale não encontrado")
    
    return {"message": "Vale excluído com sucesso"}

# ==================== TRANSFERÊNCIAS ROUTES ====================

class TransferenciaBase(BaseModel):
    vendedora_id: str
    vendedora_nome: str
    filial_id: str
    valor: float
    observacoes: Optional[str] = None

class Transferencia(TransferenciaBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

@api_router.post("/transferencias")
async def create_transferencia(transf: TransferenciaBase, current_user: User = Depends(get_current_active_user)):
    transf_obj = Transferencia(**transf.model_dump())
    doc = transf_obj.model_dump()
    doc['data'] = doc['data'].isoformat()
    
    await db.transferencias.insert_one(doc)
    return transf_obj

@api_router.get("/transferencias")
async def get_transferencias(
    filial_id: Optional[str] = None, 
    skip: int = 0, 
    limit: int = 100, 
    current_user: User = Depends(get_current_active_user)
):
    # Only admin/gerente can see all transferencias
    if current_user.role not in ["admin", "gerente"]:
        raise HTTPException(status_code=403, detail="Sem permissão para ver transferências")
    
    query = {}
    if filial_id:
        query["filial_id"] = filial_id
    
    # Add pagination
    transfs = await db.transferencias.find(query, {"_id": 0}).skip(skip).limit(min(limit, 500)).to_list(limit)
    for t in transfs:
        if isinstance(t.get('data'), str):
            t['data'] = datetime.fromisoformat(t['data'])
    return transfs

@api_router.put("/transferencias/{transf_id}")
async def update_transferencia(transf_id: str, transf_data: TransferenciaBase, current_user: User = Depends(get_current_active_user)):
    if current_user.role not in ["admin", "gerente"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    await db.transferencias.update_one(
        {"id": transf_id},
        {"$set": transf_data.model_dump(exclude={'vendedora_id', 'vendedora_nome', 'filial_id'})}
    )
    return {"message": "Transferência atualizada"}

@api_router.delete("/transferencias/{transf_id}")
async def delete_transferencia(transf_id: str, current_user: User = Depends(get_current_active_user)):
    if current_user.role not in ["admin", "gerente"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    result = await db.transferencias.delete_one({"id": transf_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transferência não encontrada")
    return {"message": "Transferência excluída"}

# ==================== FILIAIS ROUTES ====================

class FilialBase(BaseModel):
    nome: str
    endereco: Optional[str] = None
    telefone: Optional[str] = None
    ativa: bool = True

class Filial(FilialBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

@api_router.post("/filiais")
async def create_filial(filial: FilialBase, current_user: User = Depends(get_current_active_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem criar filiais")
    
    filial_obj = Filial(**filial.model_dump())
    doc = filial_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.filiais.insert_one(doc)
    return filial_obj

@api_router.get("/filiais")
async def get_filiais(current_user: User = Depends(get_current_active_user)):
    filiais = await db.filiais.find({}, {"_id": 0}).to_list(100)
    for f in filiais:
        if isinstance(f.get('created_at'), str):
            f['created_at'] = datetime.fromisoformat(f['created_at'])
    return filiais

@api_router.put("/filiais/{filial_id}")
async def update_filial(filial_id: str, filial: FilialBase, current_user: User = Depends(get_current_active_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem editar filiais")
    
    await db.filiais.update_one({"id": filial_id}, {"$set": filial.model_dump()})
    return {"message": "Filial atualizada com sucesso"}

@api_router.delete("/filiais/{filial_id}")
async def delete_filial(filial_id: str, current_user: User = Depends(get_current_active_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem excluir filiais")
    
    # Check if filial exists
    filial = await db.filiais.find_one({"id": filial_id}, {"_id": 0})
    if not filial:
        raise HTTPException(status_code=404, detail="Filial não encontrada")
    
    # CASCADE DELETE: Delete all data related to this filial
    deleted_counts = {}
    
    # Delete products
    products_result = await db.products.delete_many({"filial_id": filial_id})
    deleted_counts['products'] = products_result.deleted_count
    
    # Delete customers
    customers_result = await db.customers.delete_many({"filial_id": filial_id})
    deleted_counts['customers'] = customers_result.deleted_count
    
    # Delete sales
    sales_result = await db.sales.delete_many({"filial_id": filial_id})
    deleted_counts['sales'] = sales_result.deleted_count
    
    # Delete users (only users exclusively from this filial)
    users_result = await db.users.delete_many({
        "filial_id": filial_id,
        "role": {"$ne": "admin"}  # Don't delete admins
    })
    deleted_counts['users'] = users_result.deleted_count
    
    # Delete vales
    vales_result = await db.vales.delete_many({"filial_id": filial_id})
    deleted_counts['vales'] = vales_result.deleted_count
    
    # Delete transferencias
    transf_result = await db.transferencias.delete_many({"filial_id": filial_id})
    deleted_counts['transferencias'] = transf_result.deleted_count
    
    # Delete pagamentos_saldo
    pagamentos_result = await db.pagamentos_saldo.delete_many({"filial_id": filial_id})
    deleted_counts['pagamentos'] = pagamentos_result.deleted_count
    
    # Delete goals
    goals_result = await db.goals.delete_many({"filial_id": filial_id})
    deleted_counts['goals'] = goals_result.deleted_count
    
    # Delete commission config
    comissao_result = await db.comissao_config.delete_many({"filial_id": filial_id})
    deleted_counts['comissao_config'] = comissao_result.deleted_count
    
    # Delete balanco estoque
    balanco_result = await db.balanco_estoque.delete_many({"filial_id": filial_id})
    deleted_counts['balanco_estoque'] = balanco_result.deleted_count
    
    # Finally, delete the filial itself
    await db.filiais.delete_one({"id": filial_id})
    
    return {
        "message": "Filial e todos os dados relacionados foram excluídos com sucesso",
        "filial_nome": filial.get('nome'),
        "deleted_counts": deleted_counts
    }

# ==================== BALANÇO DE ESTOQUE ROUTES ====================

class BalancoItem(BaseModel):
    product_id: str
    codigo: str
    descricao: str
    quantidade_sistema: int
    quantidade_contada: Optional[int] = None
    diferenca: Optional[int] = None
    conferido: bool = False

class BalancoEstoqueBase(BaseModel):
    data_inicio: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data_conclusao: Optional[datetime] = None
    usuario: str
    items: List[BalancoItem]
    status: str = "em_andamento"  # em_andamento, concluido
    tipo: str = "semanal"  # semanal, mensal, completo

class BalancoEstoque(BalancoEstoqueBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

@api_router.post("/balanco-estoque/iniciar")
async def iniciar_balanco(tipo: str = "semanal", current_user: User = Depends(get_current_active_user)):
    # Get all products
    all_products = await db.products.find({}, {"_id": 0}).to_list(10000)
    
    # Get last balanco to avoid repetition
    last_balanco = await db.balancos.find_one(
        {"status": "concluido"},
        {"_id": 0},
        sort=[("data_conclusao", -1)]
    )
    
    last_product_ids = []
    if last_balanco:
        last_product_ids = [item['product_id'] for item in last_balanco.get('items', [])]
    
    # Select products based on tipo
    if tipo == "semanal":
        # Select 10-15 random products not in last balanco
        available_products = [p for p in all_products if p['id'] not in last_product_ids]
        if not available_products:
            # If all were checked, reset and use all
            available_products = all_products
        
        import random
        num_items = min(15, len(available_products))
        selected_products = random.sample(available_products, num_items)
    elif tipo == "mensal":
        # Select 30-50 random products
        import random
        num_items = min(50, len(all_products))
        available_products = [p for p in all_products if p['id'] not in last_product_ids]
        if len(available_products) < num_items:
            available_products = all_products
        selected_products = random.sample(available_products, num_items)
    else:
        # Complete: all products
        selected_products = all_products
    
    # Create balanco items
    items = [
        BalancoItem(
            product_id=p['id'],
            codigo=p['codigo'],
            descricao=p['descricao'],
            quantidade_sistema=p['quantidade'],
            quantidade_contada=None,
            diferenca=None,
            conferido=False
        )
        for p in selected_products
    ]
    
    balanco_obj = BalancoEstoque(
        usuario=current_user.full_name,
        items=items,
        tipo=tipo
    )
    
    doc = balanco_obj.model_dump()
    doc['data_inicio'] = doc['data_inicio'].isoformat()
    
    await db.balancos.insert_one(doc)
    return balanco_obj

@api_router.get("/balanco-estoque/ativo")
async def get_balanco_ativo(current_user: User = Depends(get_current_active_user)):
    balanco = await db.balancos.find_one(
        {"status": "em_andamento"},
        {"_id": 0}
    )
    
    if not balanco:
        return None
    
    if isinstance(balanco.get('data_inicio'), str):
        balanco['data_inicio'] = datetime.fromisoformat(balanco['data_inicio'])
    if balanco.get('data_conclusao') and isinstance(balanco.get('data_conclusao'), str):
        balanco['data_conclusao'] = datetime.fromisoformat(balanco['data_conclusao'])
    
    return balanco

@api_router.put("/balanco-estoque/{balanco_id}/conferir/{product_id}")
async def conferir_item_balanco(
    balanco_id: str, 
    product_id: str, 
    quantidade_contada: int,
    current_user: User = Depends(get_current_active_user)
):
    balanco = await db.balancos.find_one({"id": balanco_id}, {"_id": 0})
    if not balanco:
        raise HTTPException(status_code=404, detail="Balanço não encontrado")
    
    # Update item
    items = balanco['items']
    for item in items:
        if item['product_id'] == product_id:
            item['quantidade_contada'] = quantidade_contada
            item['diferenca'] = quantidade_contada - item['quantidade_sistema']
            item['conferido'] = True
            break
    
    await db.balancos.update_one(
        {"id": balanco_id},
        {"$set": {"items": items}}
    )
    
    return {"message": "Item conferido com sucesso"}

@api_router.post("/balanco-estoque/{balanco_id}/concluir")
async def concluir_balanco(balanco_id: str, ajustar_estoque: bool = True, current_user: User = Depends(get_current_active_user)):
    balanco = await db.balancos.find_one({"id": balanco_id}, {"_id": 0})
    if not balanco:
        raise HTTPException(status_code=404, detail="Balanço não encontrado")
    
    # If ajustar_estoque, update product quantities
    if ajustar_estoque:
        for item in balanco['items']:
            if item['conferido'] and item.get('quantidade_contada') is not None:
                await db.products.update_one(
                    {"id": item['product_id']},
                    {"$set": {
                        "quantidade": item['quantidade_contada'],
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
    
    # Mark as concluido
    await db.balancos.update_one(
        {"id": balanco_id},
        {"$set": {
            "status": "concluido",
            "data_conclusao": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Balanço concluído com sucesso"}

@api_router.get("/balanco-estoque/historico")
async def get_historico_balancos(current_user: User = Depends(get_current_active_user)):
    balancos = await db.balancos.find(
        {"status": "concluido"},
        {"_id": 0}
    ).sort("data_conclusao", -1).limit(20).to_list(20)
    
    for b in balancos:
        if isinstance(b.get('data_inicio'), str):
            b['data_inicio'] = datetime.fromisoformat(b['data_inicio'])
        if b.get('data_conclusao') and isinstance(b.get('data_conclusao'), str):
            b['data_conclusao'] = datetime.fromisoformat(b['data_conclusao'])
    
    return balancos

# ==================== ROOT ROUTE ====================

@api_router.get("/")
async def root():
    return {"message": "ExploTrack API v2.0 - Sistema de Gestão de Varejo"}

# Include router
app.include_router(api_router)

# Startup event - Seed database
@app.on_event("startup")
async def startup_event():
    await seed_database(db)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
