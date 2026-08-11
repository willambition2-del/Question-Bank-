# Coolify Environment Variables Configuration

This document lists all the necessary environment variables required for deploying the Question Bank Platform on Coolify.

## 1. Backend API (`question-bank-api`)

| Variable | Type | Description | Default / Example |
|---|---|---|---|
| `NODE_ENV` | RUNTIME | Application environment | `production` |
| `API_PUBLIC_URL` | RUNTIME | Public URL for the API (Coolify domain) | `https://api.example.com` |
| `DATABASE_URL` | SECRET/RUNTIME | PostgreSQL connection string | `postgresql://user:pass@postgres:5432/question_bank` |
| `REDIS_URL` | SECRET/RUNTIME | Redis connection string | `redis://:pass@redis:6379` |
| `JWT_ACCESS_SECRET` | SECRET | Secret for signing access tokens | `min_32_chars...` |
| `JWT_REFRESH_SECRET` | SECRET | Secret for signing refresh tokens | `min_32_chars...` |
| `PROVIDER_CREDENTIALS_MASTER_KEY`| SECRET | Encryption key for AI Provider keys | `base64_32_bytes_...` |
| `CORS_ORIGINS` | RUNTIME | Allowed origins for CORS | `https://admin.example.com` |
| `GOOGLE_AUTH_ENABLED` | RUNTIME/OPTIONAL| Feature flag for Google Auth | `false` |
| `GOOGLE_CLIENT_ID` | SECRET/OPTIONAL | Google OAuth Client ID | `...` |

## 2. Admin Dashboard (`admin-dashboard`)

| Variable | Type | Description | Default / Example |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | BUILD_TIME | Admin Dashboard public URL | `https://admin.example.com` |
| `BACKEND_INTERNAL_URL` | RUNTIME | Internal URL of backend container | `http://backend:3000/api/v1` |

## 3. Flutter Mobile App

| Variable | Type | Description | Default / Example |
|---|---|---|---|
| `API_BASE_URL` | BUILD_TIME | Passed via `--dart-define` | `https://api.example.com/api/v1` |
