# Money Matters - Asset Management & Tracking

A comprehensive asset management and tracking application that consolidates multiple asset classes from various sources into a unified view. Track stocks, crypto, ETFs, mutual funds, bonds, real estate, gold, and cash with real-time market data from free APIs.

## Features

- **Multi-Asset Class Support**: Stocks, ETFs, Mutual Funds, Cryptocurrency, Bonds, Real Estate, Gold/Precious Metals, Cash
- **Free Market Data APIs**: Yahoo Finance, CoinGecko, Metals.live, Frankfurter (exchange rates)
- **Tagging & Classification**: Create custom tags to categorize assets (e.g., "Retirement", "Emergency Fund", "High Risk")
- **Smart Views**: Filter assets by class, tags, or custom combinations
- **Portfolio Analytics**: Track total value, gains/losses, asset allocation, top/worst performers
- **CSV Import**: Import holdings from broker statements with configurable column mapping
- **Real-time Price Updates**: Automatic price refresh with background scheduler

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS + Recharts |
| Backend | Node.js + Fastify + TypeScript |
| Database | SQLite (via better-sqlite3) - zero config, portable |
| ORM | Drizzle ORM - type-safe, lightweight |

## Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm 8+

### Installation

```bash
# Clone the repository
cd moneyMatters

# Install dependencies
pnpm install

# Start development servers (both backend and frontend)
pnpm dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Development Commands

```bash
# Run both servers
pnpm dev

# Run only backend
pnpm dev:backend

# Run only frontend
pnpm dev:frontend

# Build for production
pnpm build
```

## Project Structure

```
moneyMatters/
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── routes/           # API endpoints
│   │   │   ├── services/         # Business logic
│   │   │   ├── providers/        # Market data providers
│   │   │   └── db/               # Database schema
│   │   └── package.json
│   └── frontend/
│       ├── src/
│       │   ├── components/       # Reusable UI components
│       │   ├── pages/            # Page components
│       │   ├── api/              # API client & hooks
│       │   └── lib/              # Utility functions
│       └── package.json
├── package.json                  # Workspace root
└── README.md
```

## API Endpoints

### Assets
- `GET /api/assets` - List all assets
- `GET /api/assets/:id` - Get asset with tags
- `POST /api/assets` - Create asset
- `PUT /api/assets/:id` - Update asset
- `DELETE /api/assets/:id` - Delete asset
- `PUT /api/assets/:id/tags` - Set asset tags

### Holdings
- `GET /api/holdings` - List all holdings
- `GET /api/holdings/with-assets` - List holdings with asset details
- `POST /api/holdings` - Create holding
- `PUT /api/holdings/:id` - Update holding
- `DELETE /api/holdings/:id` - Delete holding

### Tags
- `GET /api/tags` - List all tags
- `GET /api/tags/with-counts` - List tags with asset counts
- `POST /api/tags` - Create tag
- `PUT /api/tags/:id` - Update tag
- `DELETE /api/tags/:id` - Delete tag

### Portfolio
- `GET /api/portfolio/summary` - Get portfolio summary
- `GET /api/portfolio/allocation` - Get asset allocation
- `GET /api/portfolio/holdings` - Get holdings with calculated values
- `GET /api/portfolio/top-performers` - Get top performing holdings
- `GET /api/portfolio/worst-performers` - Get worst performing holdings

### Market Data
- `GET /api/market-data/search?query=AAPL` - Search for assets
- `GET /api/market-data/quote?symbol=AAPL` - Get quote for symbol
- `POST /api/market-data/refresh` - Trigger price refresh
- `GET /api/market-data/convert?amount=100&from=USD&to=EUR` - Convert currency

### Import
- `POST /api/import/holdings` - Import holdings from JSON
- `POST /api/import/csv/preview` - Preview CSV import
- `POST /api/import/csv/import` - Import from CSV data

## Free API Limits

| Asset Class | API | Free Tier Limits |
|-------------|-----|------------------|
| Stocks/ETFs/Mutual Funds | Yahoo Finance | Unlimited (unofficial) |
| Cryptocurrency | CoinGecko | 30 calls/min |
| Gold/Silver | metals.live | Unlimited |
| Forex/Exchange Rates | frankfurter.app | Unlimited |

## Database

The application uses SQLite for data persistence. The database file is stored at:
```
packages/backend/data/money-matters.db
```

The database is created automatically on first run with all necessary tables.

## License

MIT
