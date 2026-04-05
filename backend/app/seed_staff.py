"""Seed HR and Manager accounts on startup."""
from app.core.database import async_session
from app.models.user import User, UserRole
from sqlalchemy import select, func
from passlib.context import CryptContext

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
HASH = pwd.hash("password123")


async def seed_staff():
    async with async_session() as db:
        count = (await db.execute(select(func.count()).select_from(User))).scalar()
        if count > 0:
            return

        db.add(User(name="HR Координатор", email="hr@test.com", phone="87001000001", hashed_password=HASH, role=UserRole.HR))
        db.add(User(name="Комиссия Председатель", email="manager@test.com", phone="87001000002", hashed_password=HASH, role=UserRole.MANAGER))
        await db.commit()
        print("Seeded: HR + Manager accounts")
