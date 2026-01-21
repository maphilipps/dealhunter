# Deployment Guide

This guide covers deploying Dealhunter to Vercel and other production environments.

## Prerequisites

- Vercel account ([vercel.com](https://vercel.com))
- Node.js 20+ installed locally
- Git repository connected to Vercel
- Access to adesso AI Hub API

## Vercel Deployment (Recommended)

### 1. Connect Repository

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Select the repository and click "Import"

### 2. Configure Project

Vercel will auto-detect Next.js. Configure as follows:

| Setting              | Value           |
| -------------------- | --------------- |
| **Framework Preset** | Next.js         |
| **Build Command**    | `npm run build` |
| **Output Directory** | `.next`         |
| **Install Command**  | `npm install`   |
| **Node Version**     | 20.x            |

### 3. Environment Variables

Add the following environment variables in Vercel Project Settings → Environment Variables:

```bash
# Required - AI Configuration
OPENAI_API_KEY=your-adesso-ai-hub-api-key
OPENAI_BASE_URL=https://adesso-ai-hub.3asabc.de/v1

# Required - Authentication
AUTH_SECRET=your-generated-secret  # Generate: openssl rand -base64 32

# Required - Inngest (Background Jobs)
INNGEST_SIGNING_KEY=your-inngest-signing-key  # From https://app.inngest.com

# Optional - Anthropic (if using Claude)
ANTHROPIC_API_KEY=your-anthropic-key
ANTHROPIC_BASE_URL=https://adesso-ai-hub.3asabc.de

# Optional - Web Search
EXA_API_KEY=your-exa-api-key

# Optional - Slack Notifications
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_CHANNEL_ID=C01234567
```

**IMPORTANT:**

- Use the "Production", "Preview", and "Development" scopes appropriately
- Never commit `.env.local` or secrets to Git
- Generate a strong `AUTH_SECRET` using `openssl rand -base64 32`

### 4. Database Configuration

Dealhunter uses SQLite for local development and can use PostgreSQL for production.

#### SQLite (Development/Small Deployments)

No additional configuration needed. The database file (`local.db`) is created automatically.

**Note:** SQLite is suitable for development and small deployments but has limitations:

- No concurrent writes from multiple instances
- File-based storage may not persist across Vercel deployments

#### PostgreSQL (Production Recommended)

For production, use a managed PostgreSQL service:

**Vercel Postgres:**

1. Go to your Vercel project → Storage → Create Database
2. Select "Postgres"
3. Copy the `DATABASE_URL` connection string
4. Add to Environment Variables

**Alternative Providers:**

- [Neon](https://neon.tech) - Serverless Postgres
- [Supabase](https://supabase.com) - Postgres with extras
- [Railway](https://railway.app) - Simple deployment

Update `DATABASE_URL` in Environment Variables:

```bash
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

**Run migrations:**

```bash
npm run db:push
```

### 5. Deploy

1. Click "Deploy"
2. Wait for build to complete
3. Visit your deployment URL
4. Run database seed (first deployment only):
   ```bash
   # SSH into Vercel deployment or use Vercel CLI
   vercel env pull .env.local
   npm run db:seed
   ```

### 6. Verify Deployment

- Visit `https://your-project.vercel.app`
- Login with default admin credentials:
  - Email: `admin@adesso.de`
  - Password: `admin123`
- **IMPORTANT:** Change default password immediately!

## Vercel CLI Deployment

For advanced deployments, use the Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Pull environment variables
vercel env pull .env.local

# Add environment variable
vercel env add AUTH_SECRET production
```

## Database Management

### Run Migrations

```bash
# Push schema changes to database
npm run db:push

# Open Drizzle Studio (local only)
npm run db:studio
```

### Seed Database

```bash
# Seed initial data (Business Lines, Technologies, etc.)
npm run db:seed
```

### Backup Database (SQLite)

```bash
# Copy database file
cp local.db local.db.backup

# Or use SQLite backup command
sqlite3 local.db ".backup local.db.backup"
```

### Backup Database (PostgreSQL)

```bash
# Using pg_dump
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

## Background Jobs (Inngest)

Dealhunter uses Inngest for background job processing (Deep Analysis, etc.).

### Setup Inngest

1. Sign up at [inngest.com](https://inngest.com)
2. Create a new app
3. Get your signing key from Dashboard → Settings → Signing Key
4. Add `INNGEST_SIGNING_KEY` to Environment Variables
5. Deploy to Vercel

Inngest will automatically discover your functions at `/api/inngest`.

### Monitor Jobs

- View running jobs in [Inngest Dashboard](https://app.inngest.com)
- Check function logs and execution history
- Retry failed jobs manually

## Custom Domain

1. Go to Vercel Project → Settings → Domains
2. Add your custom domain (e.g., `dealhunter.adesso.de`)
3. Configure DNS records as shown
4. Wait for SSL certificate to provision
5. Update `AUTH_URL` if using custom domain

## Performance Optimization

### Enable Caching

Vercel automatically caches static assets. For API routes:

```typescript
export const dynamic = 'force-static'; // Static generation
export const revalidate = 3600; // ISR (1 hour)
```

### Image Optimization

Next.js Image component is used throughout. Configure in `next.config.js`:

```javascript
images: {
  domains: ['your-image-domain.com'],
  formats: ['image/avif', 'image/webp'],
}
```

### Edge Functions

For low-latency responses, use Edge Runtime:

```typescript
export const runtime = 'edge';
```

## Monitoring

### Vercel Analytics

Enable in Project Settings → Analytics:

- Web Vitals
- Page views
- User sessions

### Error Tracking

Add Sentry integration:

```bash
npm install @sentry/nextjs

# Initialize
npx @sentry/wizard -i nextjs
```

Add `SENTRY_DSN` to Environment Variables.

### Logging

View logs in Vercel Dashboard → Deployments → [Your Deployment] → Functions.

For structured logging, use:

```typescript
console.log(JSON.stringify({ level: 'info', message: 'Event', data }));
```

## Troubleshooting

### Build Errors

**Error:** `Cannot find module '@/lib/...'`

- **Fix:** Check `tsconfig.json` paths configuration

**Error:** `Database connection failed`

- **Fix:** Verify `DATABASE_URL` in Environment Variables

### Runtime Errors

**Error:** `401 Unauthorized` on AI requests

- **Fix:** Check `OPENAI_API_KEY` and `OPENAI_BASE_URL`

**Error:** `Invalid AUTH_SECRET`

- **Fix:** Generate new secret: `openssl rand -base64 32`

### Performance Issues

**Slow page loads:**

- Enable Vercel Analytics to identify bottlenecks
- Check database query performance
- Use ISR or Static Generation where possible

**AI timeouts:**

- Increase function timeout in `vercel.json`:
  ```json
  {
    "functions": {
      "app/api/**/*.ts": {
        "maxDuration": 300
      }
    }
  }
  ```

## Security Checklist

- [ ] Change default admin password
- [ ] Enable HTTPS (automatic on Vercel)
- [ ] Set secure `AUTH_SECRET`
- [ ] Configure CORS if needed
- [ ] Enable Vercel Authentication (optional)
- [ ] Set up rate limiting for API routes
- [ ] Review and restrict Inngest signing key access
- [ ] Enable Vercel Firewall (Enterprise)
- [ ] Regular dependency updates (`npm audit`)

## Production Checklist

- [ ] All environment variables configured
- [ ] Database migrated (`npm run db:push`)
- [ ] Database seeded (`npm run db:seed`)
- [ ] Default credentials changed
- [ ] Inngest configured and connected
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active
- [ ] Analytics enabled
- [ ] Error tracking configured
- [ ] Backup strategy in place
- [ ] Monitoring alerts configured

## Alternative Deployment Options

### Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t dealhunter .
docker run -p 3000:3000 --env-file .env.local dealhunter
```

### Self-Hosted

```bash
# Build
npm run build

# Start production server
npm start
```

Use PM2 for process management:

```bash
npm i -g pm2
pm2 start npm --name dealhunter -- start
pm2 save
pm2 startup
```

## Support

For deployment issues:

- Check [Vercel Documentation](https://vercel.com/docs)
- Review [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- Contact adesso DevOps team
