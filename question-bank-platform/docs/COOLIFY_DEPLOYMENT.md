# Coolify Deployment Guide

This guide contains the exact steps for deploying the Question Bank Platform on Coolify.

## 1. Create Project
1. Log into your Coolify instance.
2. Go to **Projects** and click **Create New Project**.
3. Name it `Question Bank Platform`.

## 2. Connect Repository
1. Inside the project, click **New Resource** -> **Docker Compose**.
2. Select your Git provider (e.g., GitHub).
3. Choose the repository `question-bank-platform`.
4. Set the Base Directory to `/` (or leave default).

## 3. Configure Compose
1. Ensure the `docker-compose.coolify.yml` file is selected or copy-paste its contents if deploying manually.
2. Do **NOT** deploy yet.

## 4. Add Environment Variables
Navigate to the **Environment Variables** tab and add the following required secrets:
- `POSTGRES_PASSWORD` (e.g. `strong_db_password`)
- `REDIS_PASSWORD` (e.g. `strong_redis_password`)
- `JWT_ACCESS_SECRET` (at least 32 characters)
- `JWT_REFRESH_SECRET` (at least 32 characters)
- `PROVIDER_CREDENTIALS_MASTER_KEY` (base64 string, 32 bytes)
- `ADMIN_PUBLIC_URL` (e.g. `https://admin.yourdomain.com`)

*(See `coolify-environment-variables.md` for the full list)*

## 5. Add API Domain
1. Go to the **Services** or **Containers** list.
2. Select the `backend` service.
3. In the **Domains** section, enter the API domain (e.g., `https://api.yourdomain.com`).

## 6. Add Admin Domain
1. Select the `admin` service.
2. In the **Domains** section, enter the Admin domain (e.g., `https://admin.yourdomain.com`).

## 7. Deploy
1. Click the **Deploy** button.
2. Wait for the build process to finish. Backend and Admin will automatically build their respective Dockerfiles.

## 8. Database Migrations
1. Once deployed, open the **Terminal** for the `backend` container.
2. Run the migration command:
   ```bash
   npx prisma migrate deploy
   ```

## 9. Restore Database (Optional)
If you have a database dump:
1. Open the **Terminal** for the `postgres` container.
2. Use `psql` to restore the backup file.

## 10. Verify Data
1. Open the Admin dashboard at your `ADMIN_PUBLIC_URL`.
2. Login with the Super Admin credentials.
3. Verify that the Question count is ~19,862.

## 11. External Configurations
1. From the Admin dashboard, navigate to **Providers**.
2. Add your AI Provider API Keys (e.g., OpenAI).
3. Navigate to **Feature Flags** (if applicable) and toggle features on.

## 12. Build Flutter App
1. On your local machine, run the Flutter build with your new API domain:
   ```bash
   flutter build apk --release --dart-define=API_BASE_URL=https://api.yourdomain.com/api/v1
   ```
2. Distribute the APK for testing.
