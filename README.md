# 🤖 AI Chat Backend v2 — Enterprise Structure

Production-ready NestJS backend with enterprise-grade folder structure.

---

## 🏗️ Architecture

```
src/
├── main.ts                          # Bootstrap
├── app.module.ts                    # Root module
├── app.controller.ts                # Health check
│
├── core/                            # Global singleton infrastructure
│   ├── database/                    # Prisma (Global)
│   ├── config/                      # Env validation + app config
│   └── logger/                      # Custom logger
│
├── common/                          # Shared reusable utilities
│   ├── decorators/                  # @CurrentUser, @Public, @Roles
│   ├── filters/                     # GlobalExceptionFilter
│   ├── guards/                      # JwtAuthGuard, RefreshTokenGuard, RolesGuard
│   ├── interceptors/                # ResponseInterceptor
│   ├── enums/                       # UserRole, UserStatus, Languages
│   ├── interfaces/                  # JwtPayload, ApiResponse, RequestUser
│   └── utils/                       # bcrypt.util, token.util
│
├── integrations/                    # External services
│   ├── email/                       # EmailService (Global)
│   └── storage/                     # CloudinaryService (placeholder)
│
├── modules/                         # Business / Domain logic
│   ├── auth/                        # Auth (register, login, tokens...)
│   │   ├── dto/                     # RegisterDto, LoginDto, etc.
│   │   └── strategies/              # JwtStrategy, RefreshStrategy
│   └── users/                       # Users CRUD + block system
│       ├── dto/                     # UpdateProfileDto, SearchUsersDto
│       └── users.repository.ts      # DB layer (Repository pattern)
│
└── shared/                          # Future feature modules
    ├── redis/                        # Redis (placeholder)
    ├── cache/                        # Cache (placeholder)
    └── queue/                        # BullMQ (placeholder)
```

---

## 🚀 Tech Stack

| Technology | Purpose |
|-----------|---------|
| **NestJS 10** | Backend framework |
| **PostgreSQL** | Primary database |
| **Prisma ORM** | Type-safe DB client & migrations |
| **JWT + Passport** | Authentication |
| **bcryptjs** | Password hashing (12 rounds) |
| **Nodemailer** | Transactional emails |
| **Throttler** | Rate limiting (per-route) |
| **Helmet** | Security HTTP headers |
| **compression** | Gzip response compression |
| **class-validator** | DTO validation |

---

## ⚙️ Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Database
```bash
npx prisma migrate dev --name init
npx prisma generate
npm run prisma:seed       # Optional: seed test users
```

### 4. Run
```bash
npm run start:dev         # Development (watch mode)
npm run start:prod        # Production
npm run build             # Build only
```

---

## 📡 API Reference

**Base URL:** `http://localhost:5000/api/v1`

### Standard Response
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["email must be an email"],
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/auth/login"
}
```

---

### 🔐 Auth Endpoints

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|-----------|-------------|
| `POST` | `/auth/register` | ❌ | 3/hour | Register |
| `POST` | `/auth/login` | ❌ | 5/15min | Login |
| `POST` | `/auth/logout` | ✅ JWT | — | Logout |
| `POST` | `/auth/refresh-token` | 🍪 Cookie | — | Refresh access token |
| `POST` | `/auth/forgot-password` | ❌ | 3/hour | Send reset email |
| `POST` | `/auth/reset-password` | ❌ | 5/hour | Reset with token |
| `PATCH` | `/auth/change-password` | ✅ JWT | — | Change password |
| `GET` | `/auth/verify-email?token=` | ❌ | — | Verify email |
| `GET` | `/auth/me` | ✅ JWT | — | Get current user |

#### Register
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "John@12345",
  "preferredLanguage": "en"
}
```

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "John@12345"
}
```
→ Returns `accessToken`. Refresh token set as `HttpOnly` cookie automatically.

#### Authenticated Requests
```http
GET /api/v1/auth/me
Authorization: Bearer <accessToken>
```

---

### 👤 Users Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users/me` | Own profile |
| `PATCH` | `/users/update-profile` | Update profile |
| `GET` | `/users?q=&page=&limit=` | Search users |
| `GET` | `/users/blocked` | My blocked list |
| `GET` | `/users/:id` | User by ID |
| `POST` | `/users/block/:id` | Block user |
| `DELETE` | `/users/block/:id` | Unblock user |
| `PATCH` | `/users/status` | Update online status |

All users endpoints require `Authorization: Bearer <accessToken>`.

#### Search Users
```http
GET /api/v1/users?q=john&page=1&limit=10
Authorization: Bearer <accessToken>
```

#### Update Profile
```http
PATCH /api/v1/users/update-profile
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "John Updated",
  "bio": "Hello!",
  "preferredLanguage": "bn"
}
```

#### Update Status
```http
PATCH /api/v1/users/status
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "status": "ONLINE" }
```

#### Health Check
```http
GET /api/v1/health
```

---

## 🔒 Security

| Feature | Implementation |
|---------|---------------|
| Password hashing | bcrypt (12 rounds) |
| Access token | JWT, 15 min expiry |
| Refresh token | JWT, 7 day expiry, DB-stored, rotated on use |
| Refresh transport | HttpOnly cookie (not exposed in body) |
| Rate limiting | Per-route via `@nestjs/throttler` |
| Input validation | `class-validator` + `whitelist: true` |
| Security headers | `helmet` |
| Compression | `compression` (gzip, >1KB, configurable) |
| CORS | Configured for `CLIENT_URL` only |
| Email enumeration | Forgot password always returns same message |
| Session revocation | Refresh tokens revoked on password change/reset |
| Inactive accounts | Blocked at JWT validate layer |

---

## 🧪 Testing

```bash
npm run test              # All unit tests
npm run test:cov          # Coverage report
npm run test:watch        # Watch mode
```

Test files:
- `src/modules/auth/auth.service.spec.ts`
- `src/modules/users/users.service.spec.ts`

---

## 🌱 Seed Credentials

```bash
npm run prisma:seed
```

| Role | Email | Password |
|------|-------|----------|
| ADMIN | admin@aichat.com | Admin@12345 |
| USER | alice@example.com | User@12345 |
| USER | bob@example.com | User@12345 |
| USER | carol@example.com | User@12345 |

---

## 🗺️ Roadmap

- [ ] Chat Module (WebSocket / Socket.io)
- [ ] AI Translation Module
- [ ] File Upload (Cloudinary integration)
- [ ] Redis session store
- [ ] BullMQ email queue
- [ ] Voice/Video (WebRTC signaling)
- [ ] Subscription (Stripe)
- [ ] Google OAuth
- [ ] E2E tests

---

## 📝 Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number or special character

## 🌐 Supported Languages

`en` `bn` `es` `fr` `de` `ar` `zh` `ja` `ko` `hi`
