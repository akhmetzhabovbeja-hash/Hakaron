from pydantic import BaseModel


class RegisterRequest(BaseModel):
    email: str
    phone: str
    name: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: str
    phone: str
    name: str
    role: str
    bio: str = ""
    avatar_url: str | None = None

    model_config = {"from_attributes": True}
