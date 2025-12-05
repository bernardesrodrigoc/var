"""
Seed data script to initialize database with default admin user and filial
"""
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
from datetime import datetime, timezone
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed_database(db):
    """
    Create default admin user and filial if they don't exist
    """
    print("🌱 Checking seed data...")
    
    # Check if admin exists
    admin = await db.users.find_one({"username": "admin"})
    
    if not admin:
        print("📝 Creating default admin user...")
        admin_user = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "full_name": "Administrador",
            "role": "admin",
            "active": True,
            "hashed_password": pwd_context.hash("admin123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "meta_mensal": 0.0,
            "filial_id": None,
            "filiais_acesso": []
        }
        await db.users.insert_one(admin_user)
        print("✅ Admin user created (username: admin, password: admin123)")
    else:
        print("✅ Admin user already exists")
    
    # Check if filial exists
    filial_count = await db.filiais.count_documents({})
    
    if filial_count == 0:
        print("📝 Creating default filial...")
        default_filial = {
            "id": str(uuid.uuid4()),
            "nome": "Loja Principal",
            "endereco": "Rua Principal, 100 - Centro",
            "telefone": "(00) 0000-0000",
            "ativa": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.filiais.insert_one(default_filial)
        print(f"✅ Default filial created: {default_filial['nome']}")
    else:
        print(f"✅ Found {filial_count} filial(s) in database")
    
    print("🌱 Seed data check complete!\n")
