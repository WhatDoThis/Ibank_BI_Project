"""
Backend.auth_server.schemas (Pydantic 요청·응답)
==============================================
/api/auth 요청 바디·응답 모델. 신규 password 필드는 min_length 10(세부 정책은 security.validate_password_strength).

[Main Functions]
===========
- SignupBody, CreateOrgBody, LoginBody, VerifyLoginBody, RefreshBody
- MeUpdateBody, PasswordChangeBody

[Dependencies]
=========
- pydantic
"""

from pydantic import BaseModel, Field


class SignupBody(BaseModel):
    invite_code: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3, max_length=200)
    password: str = Field(..., min_length=10)
    nickname: str = Field(default="", max_length=100)


class CreateOrgBody(BaseModel):
    org_name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=3, max_length=200)
    password: str = Field(..., min_length=10)
    nickname: str = Field(default="", max_length=100)


class LoginBody(BaseModel):
    email: str = Field(..., min_length=3, max_length=200)
    password: str


class VerifyLoginBody(BaseModel):
    pre_auth_token: str = Field(..., min_length=10)
    code: str = Field(..., min_length=4, max_length=10)


class RefreshBody(BaseModel):
    refresh_token: str = Field(..., min_length=10)


class MeUpdateBody(BaseModel):
    nickname: str | None = Field(default=None, max_length=100)


class PasswordChangeBody(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=10)
