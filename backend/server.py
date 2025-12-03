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
    customer_id: Optional[str] = None
    observacoes: Optional[str] = None
    online: bool = False
    encomenda: bool = False
    is_troca: bool = False  # Se é uma troca

class SaleCreate(SaleBase):
    pass

class Sale(SaleBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    hora: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%H:%M:%S"))

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
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role
        }
    )

@api_router.get("/auth/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

@api_router.get("/users", response_model=List[User])
async def get_all_users(current_user: User = Depends(get_current_active_user)):
    # Only admin can list users
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem listar usuários")
    
    users = await db.users.find({}, {"_id": 0, "hashed_password": 0}).to_list(100)
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
    
    # Check if codigo exists
    existing = await db.products.find_one({"codigo": product.codigo}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Código de produto já existe")
    
    product_obj = Product(**product.model_dump())
    doc = product_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.products.insert_one(doc)
    return product_obj

@api_router.get("/products", response_model=List[Product])
async def get_products(current_user: User = Depends(get_current_active_user)):
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
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
async def get_product_by_barcode(codigo: str, current_user: User = Depends(get_current_active_user)):
    product = await db.products.find_one({"codigo": codigo}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    if isinstance(product.get('created_at'), str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    if isinstance(product.get('updated_at'), str):
        product['updated_at'] = datetime.fromisoformat(product['updated_at'])
    return Product(**product)

@api_router.get("/products/search/{query}", response_model=List[Product])
async def search_products(query: str, current_user: User = Depends(get_current_active_user)):
    # Search by codigo or descricao (case insensitive)
    products = await db.products.find({
        "$or": [
            {"codigo": {"$regex": query, "$options": "i"}},
            {"descricao": {"$regex": query, "$options": "i"}}
        ]
    }, {"_id": 0}).limit(10).to_list(10)
    
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
    customer_obj = Customer(**customer.model_dump())
    doc = customer_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.customers.insert_one(doc)
    return customer_obj

@api_router.get("/customers", response_model=List[Customer])
async def get_customers(current_user: User = Depends(get_current_active_user)):
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
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
    sale_obj = Sale(**sale.model_dump())
    doc = sale_obj.model_dump()
    doc['data'] = doc['data'].isoformat()
    
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

@api_router.get("/sales", response_model=List[Sale])
async def get_sales(current_user: User = Depends(get_current_active_user)):
    sales = await db.sales.find({}, {"_id": 0}).to_list(1000)
    for s in sales:
        if isinstance(s.get('data'), str):
            s['data'] = datetime.fromisoformat(s['data'])
    return sales

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
            {"$set": {"credito_loja": new_credit}}
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

# ==================== REPORTS ROUTES ====================

@api_router.get("/reports/dashboard")
async def get_dashboard_stats(current_user: User = Depends(get_current_active_user)):
    # Vendedoras cannot access general dashboard
    if current_user.role == "vendedora":
        raise HTTPException(status_code=403, detail="Vendedoras não têm acesso ao dashboard geral")
    
    # Total products
    total_products = await db.products.count_documents({})
    
    # Total sales today
    today = datetime.now(timezone.utc).date()
    sales_today = await db.sales.count_documents({
        "data": {"$gte": today.isoformat()}
    })
    
    # Revenue today
    sales_pipeline = [
        {"$match": {"data": {"$gte": today.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]
    revenue_result = await db.sales.aggregate(sales_pipeline).to_list(1)
    revenue_today = revenue_result[0]['total'] if revenue_result else 0
    
    # Total customers
    total_customers = await db.customers.count_documents({})
    
    # Low stock products (< 5)
    low_stock = await db.products.count_documents({"quantidade": {"$lt": 5}})
    
    return {
        "total_products": total_products,
        "sales_today": sales_today,
        "revenue_today": revenue_today,
        "total_customers": total_customers,
        "low_stock_products": low_stock
    }

@api_router.get("/reports/sales-by-vendor")
async def get_sales_by_vendor(mes: Optional[int] = None, ano: Optional[int] = None, current_user: User = Depends(get_current_active_user)):
    # Vendedoras cannot access this report
    if current_user.role == "vendedora":
        raise HTTPException(status_code=403, detail="Vendedoras não têm acesso a relatórios gerais")
    match_stage = {}
    if mes and ano:
        # Filter by month and year
        start_date = datetime(ano, mes, 1, tzinfo=timezone.utc)
        if mes == 12:
            end_date = datetime(ano + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_date = datetime(ano, mes + 1, 1, tzinfo=timezone.utc)
        match_stage = {"data": {"$gte": start_date.isoformat(), "$lt": end_date.isoformat()}}
    
    pipeline = [
        {"$match": match_stage} if match_stage else {"$match": {}},
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
async def get_inventory_value(current_user: User = Depends(get_current_active_user)):
    pipeline = [
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
            "data": {"$gte": start_date.isoformat(), "$lt": end_date.isoformat()}
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

# ==================== FECHAMENTO DE CAIXA ROUTES ====================

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

@api_router.post("/fechamento-caixa")
async def create_fechamento(fechamento: FechamentoCaixaBase, current_user: User = Depends(get_current_active_user)):
    fecha_obj = FechamentoCaixa(**fechamento.model_dump())
    doc = fecha_obj.model_dump()
    doc['data'] = doc['data'].isoformat()
    
    await db.fechamentos_caixa.insert_one(doc)
    return fecha_obj

@api_router.get("/fechamento-caixa/vendedora/{vendedora_id}")
async def get_fechamentos_vendedora(vendedora_id: str, current_user: User = Depends(get_current_active_user)):
    fechamentos = await db.fechamentos_caixa.find({"vendedora_id": vendedora_id}, {"_id": 0}).to_list(100)
    for f in fechamentos:
        if isinstance(f.get('data'), str):
            f['data'] = datetime.fromisoformat(f['data'])
    return fechamentos

@api_router.get("/fechamento-caixa/hoje")
async def get_fechamento_hoje(current_user: User = Depends(get_current_active_user)):
    # Get sales from today for current user
    today = datetime.now(timezone.utc).date()
    
    pipeline = [
        {"$match": {
            "vendedor": current_user.full_name,
            "data": {"$gte": today.isoformat()}
        }},
        {"$group": {
            "_id": "$modalidade_pagamento",
            "total": {"$sum": "$total"},
            "count": {"$sum": 1}
        }}
    ]
    
    results = await db.sales.aggregate(pipeline).to_list(10)
    
    summary = {
        "Dinheiro": 0,
        "Pix": 0,
        "Cartao": 0,
        "Credito": 0,
        "Misto": 0
    }
    num_vendas = 0
    
    for r in results:
        if r['_id'] in summary:
            summary[r['_id']] = r['total']
        num_vendas += r['count']
    
    return {
        "total_dinheiro": summary["Dinheiro"],
        "total_pix": summary["Pix"],
        "total_cartao": summary["Cartao"],
        "total_credito": summary["Credito"],
        "total_misto": summary["Misto"],
        "total_geral": sum(summary.values()),
        "num_vendas": num_vendas
    }

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
    # Only admin can create vales
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem registrar vales")
    
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

# ==================== TRANSFERÊNCIAS ROUTES ====================

class TransferenciaBase(BaseModel):
    vendedora_id: str
    vendedora_nome: str
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
async def get_transferencias(current_user: User = Depends(get_current_active_user)):
    # Only admin can see all transferencias
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem ver transferências")
    
    transfs = await db.transferencias.find({}, {"_id": 0}).to_list(1000)
    for t in transfs:
        if isinstance(t.get('data'), str):
            t['data'] = datetime.fromisoformat(t['data'])
    return transfs

# ==================== ROOT ROUTE ====================

@api_router.get("/")
async def root():
    return {"message": "ExploTrack API v2.0 - Sistema de Gestão de Varejo"}

# Include router
app.include_router(api_router)

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
