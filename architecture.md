# 🏛️ Karnataka Crime Intelligence Portal — System Architecture

> **Version:** 1.1 · **Stack:** FastAPI + React + PostgreSQL + Zoho QuickML + Gemini AI + MCP + Clerk Auth

---

## 1. High-Level System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                                   │
│                                                                         │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────────┐   │
│   │ Landing  │   │   Chat   │   │ Crime    │   │   Analytics      │   │
│   │ Page /   │   │ Window   │   │ Map      │   │   Dashboard      │   │
│   │ Login    │   │ /chat    │   │ /insights│   │   /network       │   │
│   └────┬─────┘   └──────────┘   └──────────┘   └──────────────────┘   │
│        │                                                                │
│   ┌────▼─────┐   ┌─────────────────────────┐                            │
│   │  Clerk   │   │   Zoho Catalyst KB       │                            │
│   │  Auth    │   │   /catalyst              │                            │
│   └──────────┘   └─────────────────────────┘                            │
│                                                                         │
│   React 18 + Vite · React Router DOM · Leaflet.js · SVG Charts         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTP/JSON (Vite Proxy → :8000)
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                       FASTAPI BACKEND (:8000)                            │
│                         backend/main.py                                  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Chat & SQL   │  │ Map &        │  │ Zoho Catalyst│  │ News &     │  │
│  │ /api/chat    │  │ Simulator    │  │ RAG API      │  │ Analytics  │  │
│  │ /api/query   │  │ /api/map/*   │  │ /api/catalyst│  │ /api/...   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                 │                  │                │         │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐  ┌────▼──────┐  │
│  │ llm_handler  │  │ analytics.py │  │ catalyst_kb  │  │pdf_genera │  │
│  │    .py       │  │  (metrics)   │  │    .py       │  │  tor.py   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  └───────────┘  │
│         │                 │                                             │
│  ┌──────▼───────┐  ┌──────▼───────┐                                    │
│  │ mcp_client   │  │ mcp_client   │                                    │
│  │    .py       │  │    .py       │                                    │
│  └──────┬───────┘  └──────┬───────┘                                    │
└─────────┼─────────────────┼───────────────────────────────────────────-┘
          └────────┬────────┘
                   │ MCP Protocol (subprocess or SSE)
                   │
┌──────────────────▼──────────────────────────────────────────────────────┐
│              MCP POSTGRES SERVER (node_modules)                          │
│         @modelcontextprotocol/server-postgres                            │
│                     Tool: "query" (SELECT only)                          │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ PostgreSQL Wire Protocol
                                   │
┌──────────────────────────────────▼──────────────────────────────────────┐
│           POSTGRESQL DATABASE (AWS RDS — eu-north-1)                     │
│   Table: crime_cases (10,000 rows — 29 columns)                         │
│   Districts: Bengaluru City · Mysuru · Belagavi · Hubballi-Dharwad      │
│              · Mangaluru (Dakshina Kannada)                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Architecture

### Routing & Authentication (Clerk)
* **Clerk SDK Integration:** Managed at the root using `ClerkProvider` in `main.jsx`.
* **Private Route Gatekeeping:** The `App.jsx` router secures all portal components. Unauthenticated users are strictly locked to the government landing login page and cannot view other console dashboards.

### Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `LandingPage.jsx` | Welcome page featuring Clerk login and state bulletins |
| `/dashboard` | `DashboardHub.jsx` | Dynamic state portal home with live RSS feeds & server status |
| `/chat` | `ChatWindow.jsx` | AI-powered SQL chat interface |
| `/insights` | `CrimeMap.jsx` | Interactive crime map with AI predictions |
| `/network` | `AnalyticsDashboard.jsx` | District analytics and data visualizations |
| `/catalyst` | `CatalystKB.jsx` | Zoho Catalyst RAG document Q&A |

### Component Tree

```
App.jsx (Router + Auth Gatekeeping + Theme Context)
├── Navbar.jsx                   — Top navigation bar, theme toggler, API status indicator, sign out
│
├── LandingPage.jsx              — Public landing page containing Clerk Login/Sign-In gateway
│
├── DashboardHub.jsx             — Unified cloud console home
│   ├── State Bulletins & Server Health cards
│   ├── RSS News Feeds tab (English / Kannada from OneIndia)
│   └── Image proxy loader (bypasses hotlink protection)
│
├── ChatWindow.jsx               — AI chat interface
│   ├── Message history display
│   ├── SQL badge renderer (SQLBadge.jsx)
│   ├── Gemini / MCP agent query flow
│   └── PDF export button
│
├── CrimeMap.jsx                 — Crime intelligence map
│   ├── MapContainer (Leaflet.js + OpenStreetMap)
│   │   └── CircleMarkers (5 districts, color = risk level)
│   ├── District pills (selector)
│   ├── Compare dropdown → CompareCard
│   │   └── Side-by-side metrics, winner highlighting in green
│   └── Sidebar (scrollable, sticky, calc(100vh - 200px))
│       ├── Tab: 🔍 Insights
│       │   ├── Risk badge (High / Medium / Low)
│       │   ├── Stats grid (6 live metrics)
│       │   ├── XAI bars (Zoho SHAP explanation, top 6 factors)
│       │   ├── Sociological Assessment (Gemini AI)
│       │   │   ├── ⚠️ Why is it risky?
│       │   │   └── ✅ How to control the risk
│       │   └── Crime Categories (filter pills + list)
│       └── Tab: ⚡ Policy Simulator
│           ├── 5 friendly sliders (icon + label + color + scale)
│           ├── 🔮 Predict Crime Risk button
│           ├── Result card (emoji + headline + meaning + action)
│           └── AI explanation (plain-English narrative + mini bars)
│
├── AnalyticsDashboard.jsx       — District analytics
│   ├── Summary stats cards
│   ├── Crime distribution charts
│   └── District comparison tables
│
└── CatalystKB.jsx               — Document RAG interface
    ├── Document upload / link
    ├── Document list viewer
    ├── Chat with documents (RAG)
    └── Settings (Zoho credentials)
```

---

## 3. Backend API Endpoints

```
FastAPI Backend — Deployed on Zoho AppSail (Port 9000)

── Health & Tools ─────────────────────────────────────────────
GET  /                          → Service info
GET  /api/health                → Backend + MCP connection status
GET  /api/tools                 → List available MCP tools

── State Portal News ──────────────────────────────────────────
GET  /api/karnataka-news        → Live English & Kannada regional OneIndia RSS feeds
GET  /api/proxy-image           → Backend-proxied image resolver (bypasses CORS/hotlink protection)

── Chat & SQL ─────────────────────────────────────────────────
POST /api/chat                  → Gemini AI agent (reads DB via MCP)
POST /api/query                 → Direct SQL (SELECT only, restricted)
POST /api/export-pdf            → Generate PDF from chat history

── Crime Map & Simulator ──────────────────────────────────────
GET  /api/map/districts         → 5 districts with aggregated metrics
GET  /api/map/insights          → Risk prediction + XAI + crime list
                                  (cached 10 min per district)
GET  /api/map/advice            → Gemini sociological assessment
                                  Returns: Why risky + How to control
POST /api/map/simulate          → Policy simulator (Zoho QuickML)
                                  Input: 5 slider values
                                  Output: risk + XAI + confidence
GET  /api/map/compare           → Side-by-side district comparison
GET  /api/map/trends            → Monthly + hourly crime breakdown

── Zoho Catalyst RAG ──────────────────────────────────────────
GET  /api/catalyst/documents             → List RAG documents
POST /api/catalyst/upload                → Upload PDF to Zoho
POST /api/catalyst/link                  → Link external document
GET  /api/catalyst/documents/{id}/view   → View stored document
POST /api/catalyst/chat                  → Query via RAG
GET  /api/catalyst/settings              → Get Zoho config
POST /api/catalyst/settings              → Save Zoho credentials
```

---

## 4. AI / ML Integration

### A — Gemini AI (Google)
```
User Query
    │
    ▼
llm_handler.process_chat()
    ├── 1. List available MCP tools
    ├── 2. Fetch DB schema → inject into system prompt
    ├── 3. Send to Gemini (asyncio.to_thread — non-blocking)
    │
    └── Agent Loop (max 15 turns):
        ├── Model returns function_call → execute MCP tool → append result
        └── Model returns text → done ✓
```

### B — Zoho QuickML (Predictor & SHAP XAI)
```
Policy Simulator (5 slider inputs)
    │
    ▼
main._build_full_payload()
    ├── Reads district baseline from DISTRICT_DEFAULTS
    ├── Computes risk_multiplier from sliders
    └── Scales: previous7DayCrime, previous30DayCrime,
               recentSimilarCases, alcoholDrugExposure
```

### C — Zoho Catalyst RAG
```
Document Upload → Zoho Object Store → RAG Engine (indexing)
                                             │
User Question → POST /api/catalyst/chat
                         │
                         ▼
               catalyst_kb.call_catalyst_rag()
```

---

## 5. MCP (Model Context Protocol) Layer
```
mcp_client.py
│
├── Mode 1 (Local Dev):
│     Spawns subprocess: node node_modules/@modelcontextprotocol/server-postgres/dist/index.js
│     Communicates via stdio protocol
│
└── Mode 2 (Docker/Production):
      POSTGRES_MCP_MODE=sse
      Connects to http://mcp-server:5000/sse
```

---

## 6. Environment Configurations

All configurations are driven by environment variables, keeping credentials out of version control.

### Frontend Configurations (`frontend/.env`)
* `VITE_CLERK_PUBLISHABLE_KEY`: Public key to bootstrap Clerk authentication.
* `VITE_API_URL`: Proxied backend server root.

### Backend Configurations (`backend/.env` / Catalyst Environment)
* `POSTGRES_URL`: PostgreSQL connection string (SSL mode required).
* `GEMINI_API_KEY`: API credential key for Google AI.
* `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`: OAuth credentials for Zoho Catalyst API access.
* `ZOHO_PROJECT_ID`, `ZOHO_ORG_ID`: Zoho tenant targets.
* `ZOHO_QUICKML_ENDPOINT_KEY`: Secret key to fetch Zoho QuickML predictions.
