# 🧇 Waffles

**The World Will Waffle!!!**

A real-time multiplayer trivia platform built on Farcaster, where players compete for prizes in themed quiz games.

---

## 🚀 Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with React 19
- **Database**: PostgreSQL 17 (Docker)
- **ORM**: [Prisma v7](https://www.prisma.io/) with database adapters
- **Web3**: Coinbase OnchainKit, Wagmi, Viem
- **Social**: Farcaster MiniKit, Neynar SDK
- **Styling**: Tailwind CSS v4
- **Package Manager**: Bun

---

## 📋 Prerequisites

- **Node.js** ≥ 20.19
- **Bun** 1.3.4+
- **Docker** (for PostgreSQL)

---

## 🛠️ Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Start PostgreSQL

```bash
docker run --name waffles-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=waffles \
  -p 5432:5432 \
  -d postgres:17
```

### 3. Configure Environment

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/waffles"

# Add your other environment variables here
# NEYNAR_API_KEY=
# NEXT_PUBLIC_APP_FID=
# etc.
```

### 4. Run Migrations

```bash
bunx --bun prisma migrate dev
```

### 5. Seed Database

```bash
bunx --bun prisma db seed
```

---

## 🏃 Development

### Start Dev Server

```bash
bun run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

### Other Commands

```bash
# Build for production
bun run build

# Start production server
bun run start

# Open Prisma Studio (database GUI)
bunx --bun prisma studio

# Generate Prisma Client
bunx --bun prisma generate

# Run migrations
bunx --bun prisma migrate dev

# Lint code
bun run lint
```

---

## 🗄️ Database Management

### Docker PostgreSQL Commands

```bash
# Check container status
docker ps | grep waffles-postgres

# Stop database
docker stop waffles-postgres

# Start database
docker start waffles-postgres

# View logs
docker logs waffles-postgres

# Remove container (data will be lost)
docker rm -f waffles-postgres
```

### Prisma Commands

```bash
# Create a new migration
bunx --bun prisma migrate dev --name migration_name

# Reset database (⚠️ deletes all data)
bunx --bun prisma migrate reset

# Pull schema from database
bunx --bun prisma db pull

# Push schema to database (without migrations)
bunx --bun prisma db push
```

---

## 📁 Project Structure

```
waffles/frontend/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── generated/             # Generated Prisma Client
│   ├── migrations/            # Database migrations
│   └── seed.ts               # Database seeding script
├── src/
│   ├── app/                  # Next.js App Router
│   │   └── (platform)/       # Platform routes
│   │       └── game/         # Game-related pages
│   ├── actions/              # Server Actions
│   ├── components/           # React components
│   ├── hooks/                # Custom React hooks
│   └── lib/                  # Utilities & configs
│       └── db.ts             # Prisma client instance
├── scripts/                  # Utility scripts
├── public/                   # Static assets
├── prisma.config.ts          # Prisma configuration
└── next.config.ts            # Next.js configuration
```

---

## 🎮 Key Features

### 1. User & Growth

- Farcaster integration for authentication
- Referral system with invite codes
- Waitlist management
- Reward system for inviting friends

### 2. The Arena

- Themed trivia games (Football, Movies, Anime, Politics, Crypto)
- Configurable game parameters (entry fee, prize pool, duration)
- Real-time game status tracking
- Leaderboard system

### 3. The Action

- Ticket-based entry system (USDC)
- Live gameplay with question rounds
- Scoring with latency-based points
- Real-time chat during games

---

## 🔧 Database Schema

The database is organized into 4 main layers:

1. **User & Growth**: User accounts, referrals, rewards
2. **The Arena**: Games, questions, themes
3. **The Action**: Tickets, players, answers
4. **Utils**: Chat, notifications

See [`prisma/schema.prisma`](prisma/schema.prisma) for the complete schema.

---

## 🚢 Deployment

### Environment Variables

Ensure all required environment variables are set in your production environment:

- `DATABASE_URL` - Production PostgreSQL connection string
- `NEYNAR_API_KEY` - For Farcaster integration
- `NEXT_PUBLIC_APP_FID` - Your Farcaster app FID
- Additional API keys as needed

### Build

```bash
bun run build
```

### Run Production

```bash
bun run start
```

---

## 📚 Additional Resources

- [Prisma v7 Documentation](https://www.prisma.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Farcaster Developer Docs](https://docs.farcaster.xyz/)
- [Coinbase OnchainKit](https://onchainkit.xyz/)

---

**Built with ❤️ by the Waffles team**
qwe9
