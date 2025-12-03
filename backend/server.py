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

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    meta_mensal: float = 0.0

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
    saldo_devedor: float = 0.0

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

# Sale Models
class SaleBase(BaseModel):
    items: List[SaleItem]
    total: float
    modalidade_pagamento: str  # "Dinheiro", "Cartao", "Pix", "Credito"
    parcelas: int = 1
    desconto: float = 0.0
    vendedor: str
    customer_id: Optional[str] = None
    observacoes: Optional[str] = None
    online: bool = False
    encomenda: bool = False

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

# ==================== PRODUCT ROUTES ====================

@api_router.post("/products", response_model=Product)
async def create_product(product: ProductCreate, current_user: User = Depends(get_current_active_user)):
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

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, product: ProductCreate, current_user: User = Depends(get_current_active_user)):
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
    # Update product quantities
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
    
    # Update customer credit if applicable
    if sale.customer_id and sale.modalidade_pagamento == "Credito":
        customer = await db.customers.find_one({"id": sale.customer_id}, {"_id": 0})
        if customer:
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

# ==================== REPORTS ROUTES ====================

@api_router.get("/reports/dashboard")
async def get_dashboard_stats(current_user: User = Depends(get_current_active_user)):
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
