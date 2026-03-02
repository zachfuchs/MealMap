# MealMap — Replit Project Guide

## Overview

MealMap is a full-stack family meal planning web app. It helps households of adults (2+) manage their shared cooking life, including:

- A **recipe library** (import from URL, generate with AI, or enter manually)
- A **pantry tracker** (what's in the fridge, freezer, pantry)
- A **weekly meal planner** (assign recipes to breakfast/lunch/dinner/snack slots per day)
- A **grocery list** (auto-generated from meal plan + pantry)
- **Household sharing** (multiple adults per household share the same data via invite codes)
- **AI-powered features** (recipe extraction from URLs, recipe generation from prompts, ingredient categorization — via Anthropic Claude)

The app is designed mobile-first but works across all screen sizes.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend

- **Framework:** React (with Vite as the build tool)
- **Routing:** `wouter` (lightweight client-side routing)
- **State / Data Fetching:** TanStack React Query (v5) for all server state; local component state for UI
- **UI Components:** shadcn/ui (built on Radix UI primitives) with Tailwind CSS
- **Auth State:** Stored in `localStorage` (JWT token, user object, household object). The `client/src/lib/auth.ts` module handles get/set/clear. Auth headers are attached to all API requests via `queryClient.ts`.
- **Pages:**
  - `/auth` — Login / Register (create or join a household)
  - `/recipes` — Recipe library with search and filters
  - `/recipes/:id` — Recipe detail (ingredients, steps, cook modal, rating)
  - `/add-recipe` — Add recipe via URL import, AI generation, or manual entry
  - `/pantry` — Pantry items by location (pantry / fridge / freezer / snack bin)
  - `/meal-planner` — Weekly calendar grid
  - `/grocery` — Grocery list by ingredient category
  - `/settings` — Profile and household settings (invite code)
- **Theme:** Light/dark mode via CSS variables. Primary color is green (142 76% 36%).

### Backend

- **Runtime:** Node.js with TypeScript (`tsx` for dev, `esbuild` for production build)
- **Framework:** Express.js
- **Entry point:** `server/index.ts` → `server/routes.ts`
- **Auth:** JWT-based. Tokens are signed with `SESSION_SECRET` env var. The `authMiddleware` function in `routes.ts` validates the Bearer token on protected routes.
- **Password hashing:** `bcryptjs`
- **AI integration:** Anthropic Claude SDK (`@anthropic-ai/sdk`). Uses `AI_INTEGRATIONS_ANTHROPIC_API_KEY` and `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` env vars.
- **URL scraping:** `axios` + `cheerio` for server-side HTML fetching before passing to Claude for recipe parsing.
- **Storage layer:** `server/storage.ts` defines an `IStorage` interface. The implementation uses Drizzle ORM queries directly against PostgreSQL.
- **Dev server:** Vite middleware is mounted in Express during development (`server/vite.ts`). In production, static files are served from `dist/public`.
- **Replit integrations:** `server/replit_integrations/` contains optional chat (conversation history with Claude) and batch processing utilities.

### Database

- **Database:** PostgreSQL
- **ORM:** Drizzle ORM (`drizzle-orm/node-postgres`)
- **Schema file:** `shared/schema.ts` (shared between client and server via `@shared/*` alias)
- **Migrations:** `drizzle-kit push` (`db:push` script) — pushes schema directly to the database
- **Connection:** Pool via `pg` using `DATABASE_URL` env var

**Key tables:**
| Table | Purpose |
|---|---|
| `households` | A household group; has a random invite code |
| `users` | Members of a household; email + bcrypt password |
| `recipes` | Recipes belonging to a household; supports imported/generated/manual source types |
| `ingredients` | Per-recipe ingredient rows with quantity, unit, category, pantry-staple flag |
| `recipe_steps` | Ordered step-by-step instructions per recipe |
| `pantry_items` | Household pantry inventory by location (pantry/fridge/freezer/snack_bin) |
| `meal_plans` | A week's plan per household (keyed by week start date) |
| `meal_plan_entries` | Individual day + slot (breakfast/lunch/dinner/snack) entries |
| `grocery_lists` | A list per week with status (draft/finalized/shopping/completed) |
| `grocery_list_items` | Items on the grocery list with checked state and category |
| `conversations` / `messages` | Chat history for the Replit AI chat integration |

### Monorepo Structure

```
/
├── client/          # React frontend (Vite root)
│   └── src/
│       ├── pages/   # One file per route
│       ├── components/ui/  # shadcn/ui components
│       ├── hooks/   # Custom React hooks
│       └── lib/     # auth.ts, queryClient.ts, utils.ts
├── server/          # Express backend
│   ├── index.ts     # App entry point
│   ├── routes.ts    # All API route handlers
│   ├── storage.ts   # IStorage interface + Drizzle implementation
│   ├── db.ts        # Drizzle + pg Pool setup
│   ├── seed.ts      # Demo data seeder
│   ├── vite.ts      # Vite dev middleware
│   ├── static.ts    # Production static file serving
│   └── replit_integrations/  # Chat + batch utilities
├── shared/
│   └── schema.ts    # Drizzle schema + Zod insert schemas (shared)
├── script/build.ts  # Production build (Vite + esbuild)
└── drizzle.config.ts
```

### Key Design Decisions

1. **Shared schema:** `shared/schema.ts` is imported by both client (for TypeScript types) and server (for Drizzle queries). This eliminates type drift between frontend and backend.
2. **JWT in localStorage:** Simple approach; no cookie/session complexity. Works well for mobile-first apps.
3. **IStorage interface:** The storage layer is abstracted behind an interface, making it easy to swap implementations or add caching later.
4. **Monorepo, single process:** Both frontend dev server (Vite middleware) and backend API run in one Express process during development. In production, the frontend is built to `dist/public` and served as static files.
5. **AI prompt parsing:** Claude responses are stripped of markdown fences before JSON parsing (`parseClaudeJson` in `routes.ts`) to handle model formatting variations.

---

## External Dependencies

| Dependency | Purpose | Env Var |
|---|---|---|
| **Anthropic Claude API** | Recipe extraction from URLs, recipe generation from prompts, ingredient categorization | `AI_INTEGRATIONS_ANTHROPIC_API_KEY`, `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` |
| **PostgreSQL** | Primary relational database | `DATABASE_URL` |
| **JWT** (`jsonwebtoken`) | Stateless auth tokens | `SESSION_SECRET` |
| **Google Fonts** | DM Sans, Geist Mono, Fira Code, Architects Daughter (loaded via CDN in `index.html`) | none |

### Environment Variables Required

```
DATABASE_URL       # PostgreSQL connection string
SESSION_SECRET     # JWT signing secret
AI_INTEGRATIONS_ANTHROPIC_API_KEY   # Anthropic API key
AI_INTEGRATIONS_ANTHROPIC_BASE_URL  # Anthropic base URL (for Replit proxy)
```