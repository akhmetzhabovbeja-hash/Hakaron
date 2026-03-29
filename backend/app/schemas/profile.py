from pydantic import BaseModel


class ProfileUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    bio: str | None = None


class AvatarResponse(BaseModel):
    avatar_url: str
