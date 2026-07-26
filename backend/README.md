# Datathon-26 Backend Documentation Guide

This document provides a comprehensive guide to the Datathon-26 Backend, covering installation, execution workflows, system architecture, and a file-by-file breakdown of each python module.

---

## Project Execution Guide

Follow these steps to set up and run the database, backend server, and frontend client.

### Step 1: Local PostgreSQL Database Setup
Since remote network configurations may restrict access to public AWS RDS database instances (resulting in `ETIMEDOUT` errors), running a local PostgreSQL instance is recommended:
1. **Install PostgreSQL:** Download and install PostgreSQL on your local system (or run it via Docker).
2. **Create Database:** Initialize a database named `postgres` (or a custom name).
3. **Configure Environment:** Update your local `backend/.env` file to point to your local PostgreSQL server:
   ```env
   POSTGRES_URL=postgresql://postgres:your_password@localhost:5432/postgres
   ```

### Step 2: Import the Dataset
To load the datathon dataset into your local PostgreSQL database:
1. Open a terminal at the project root folder.
2. Run the bulk import script:
   ```bash
   python import_dataset.py
   ```
   *This script connects to your PostgreSQL database, drops any existing `crime_cases` tables, creates the table structure with 29 analytical columns, and bulk-inserts all records from `synthetic_fir_dataset.csv` in a single optimized batch.*

### Step 3: Run the FastAPI Backend Server
1. **Create and Activate Virtual Environment:**
   ```bash
   python -m venv .venv
   # On Windows:
   .venv\Scripts\activate
   # On macOS/Linux:
   source .venv/bin/activate
   ```
2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Set Up Keys:** Ensure your `backend/.env` contains your `GEMINI_API_KEY` and database URLs.
4. **Start Backend Server:**
   ```bash
   python backend/main.py
   ```
   *The FastAPI server will start on `http://127.0.0.1:8000` with hot-reloading active.*

### Step 4: Run the Vite Frontend Client
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. **Install NodeJS Packages:**
   ```bash
   npm install
   ```
3. **Start Development Server:**
   ```bash
   npm run dev
   ```
   *The React client will launch on `http://localhost:5173` (or similar port indicated in the terminal).*

### Step 5: Multi-Container Docker Deployment
To run the entire ecosystem (the standalone PostgreSQL MCP server and the FastAPI backend) inside Docker containers:
1. Make sure your local terminal environment has `POSTGRES_URL` and `GEMINI_API_KEY` set.
2. Build and launch the containers:
   ```bash
   docker-compose up --build
   ```
   *This command spins up two services: the `mcp-server` (SSE wrapper) on port `5000` and the `backend` (FastAPI client) on port `8000`.*

---

## Backend Architecture Diagram

Below is the visual map of how the frontend, backend server, database layers, and external integrations connect:

```mermaid
graph TD
    Client[React Frontend] -->|REST HTTP requests| FastAPI[FastAPI Server: main.py]
    
    subgraph Core Backend Modules
        FastAPI -->|Computes dashboard metrics| Analytics[analytics.py]
        FastAPI -->|Chat loops / process_chat| LLM[llm_handler.py]
        FastAPI -->|Chat exports| PDF[pdf_generator.py]
        FastAPI -->|Doc Sync & RAG API| Zoho_KB[catalyst_kb.py]
    end
    
    subgraph Database Layer
        Analytics -->|psycopg2 direct connection| DB[(PostgreSQL Database)]
        
        %% LLM Database exploration flow
        LLM -->|Invokes tools| MCP_Client[mcp_client.py: PostgresMCPClient]
        MCP_Client -->|Launches Node subprocess| MCP_Server[Postgres MCP Server]
        MCP_Server -->|Executes query| DB
    end
    
    subgraph External AI Services
        LLM -->|Generative Chat API| Gemini[Google Gemini SDK]
        Zoho_KB -->|Document store link| Zoho_Catalyst[Zoho Catalyst Cloud]
        Zoho_KB -->|Risk calculations| Zoho_QuickML[Zoho QuickML Engine]
    end

    classDef module fill:#2b3a4a,stroke:#3b82f6,stroke-width:2px,color:#fff;
    classDef database fill:#1a233a,stroke:#10b981,stroke-width:2px,color:#fff;
    classDef external fill:#2d1a3a,stroke:#8b5cf6,stroke-width:2px,color:#fff;
    
    class Analytics,LLM,PDF,Zoho_KB,MCP_Client module;
    class DB database;
    class Gemini,Zoho_Catalyst,Zoho_QuickML external;
```

---

## Detailed File-by-File Module Breakdown

### 1. `main.py` (FastAPI Entry Point & Router)
Serves as the main controller for the backend application, orchestrating routes and managing application lifecycle hooks.
- **Startup listener (`@app.on_event("startup")`):** Establishes a persistent background connection to the PostgreSQL MCP server on boot.
- **REST Endpoints:**
  - **`/api/health`:** Calls the MCP client to fetch available tools. Acts as the primary status check for the frontend database indicator.
  - **`/api/chat`:** Forwards user chat payloads to the Gemini agent loop in `llm_handler.py`.
  - **`/api/query`:** Accepts direct SQL query strings, filtering out modifying verbs (e.g. `UPDATE`, `DROP`, `DELETE`) to ensure strictly read-only execution.
  - **`/api/map/districts` & `/api/map/insights`:** Integrates map coordinates and aggregates and requests Zoho QuickML predictions.
  - **`/api/export-pdf`:** Receives chat history and streams a compiled PDF down to the user.
- **RSS News Scraper & Safe Image Proxy:** Downloads RSS bulletins from local outlets and exposes an endpoint `/api/proxy-image` to fetch and stream external image assets safely, preventing CORS issues in the React frontend.

### 2. `llm_handler.py` (Gemini Agent reasoning Loop)
Manages the connection to the Google GenAI SDK and handles the autonomous reasoning loop for database queries.
- **Schema Auto-Injection:** Inspects the database tables and columns, caching the schema structure, and appends it to the system prompts so the LLM is aware of the current tables.
- **Autonomous Tool Execution:** Maps the MCP tools (like `query`) into Gemini's `FunctionDeclaration` schema. It reads the model's requested function calls, executes them on the PostgreSQL database via `mcp_client.py`, and feeds the data back to the model.
- **Self-Correction Logic:** If a query fails with a database exception (e.g. a typo in a column name), the agent captures the database error, analyzes the correct columns, rewrites the query, and re-executes it automatically without interrupting the user.
- **Model Fallback Chain:** Iterates through available Gemini models (`gemini-3.5-flash-lite`, `gemini-2.0-flash-lite`, `gemini-3.6-flash`, etc.) to guarantee high availability and bypass API quota limitations.
- **Multilingual Wrapper:** Automatically detects the user's input language. It conducts all internal thoughts and database searches in English, but translates the final compiled output back to the user's regional language (e.g. Kannada, Hindi).

### 3. `mcp_client.py` (Postgres MCP Client)
Implements Model Context Protocol (MCP) clients to manage persistent sessions.
- **Standard Stdio & SSE execution:**
  - `stdio` mode: Spawns NodeJS as a subprocess running `@modelcontextprotocol/server-postgres/dist/index.js` and communicates over standard input/output streams.
  - `sse` mode: Connects to a remote server endpoint via HTTP Server-Sent Events (SSE).
- **Persistent Session & Idle Manager:** Holds the background session open across calls to minimize setup latency. Tracks activities and closes connections when an idle threshold is crossed.
- **Circuit Breaker System:** Prevents the FastAPI server from locking up when database nodes are unreachable. If a connection timeout occurs, the Circuit Breaker opens for **30 seconds**, failing subsequent requests instantly in **0ms** with the cached error, bypassing connection delays.

### 4. `analytics.py` (Direct Database Calculations)
Performs fast analytical calculations on PostgreSQL database tables.
- **Direct psycopg2 Connection:** Unlike the LLM agent, this module bypasses the MCP subprocess and connects directly using `psycopg2` for rapid data processing.
- **Key Analytics Functions:**
  - Aggregates cases by district to render thematic map visualizers.
  - Summarizes accused demographics (such as age groups and gender distributions).
  - Summarizes crime classifications (`CrimeGroupName`) to build monthly trends and hourly crime lists.

### 5. `pdf_generator.py` (ReportLab PDF Generation)
Generates high-quality document records of chat histories.
- **Unicode Font Registration:** Registers the `Nirmala UI` font. This handles Indic scripts (like Kannada, Hindi, and Tamil) correctly, preventing missing characters in the exported PDF files.
- **Dynamic NumberedCanvas:** Overrides the canvas engine to perform a two-pass calculation, drawing headers, footers, and page numbers ("Page X of Y") dynamically on every sheet.

### 6. `catalyst_kb.py` (Zoho Catalyst RAG & QuickML Client)
Interfaces with Zoho Catalyst Cloud services.
- **OAuth Automation:** Manages token exchanges, swapping OAuth authorization codes for access and refresh tokens, and automatically refreshing expired tokens before requests.
- **Settings Sync:** Persists token changes, linked documents, and configurations by writing them directly into the local `backend/.env` file.
- **QuickML Prediction Wrapper:** Packages district statistics and posts them to Zoho QuickML endpoints to predict crime risk indexes.
- **RAG Document Manager:** Syncs PDF case folders to Zoho Catalyst knowledge bases for semantic searches.

### 7. `run.py` (FastAPI Start Helper)
Helper script that adds the bundled dependency directory (`./lib`) to `sys.path` and runs FastAPI using `uvicorn`. Reads the Zoho Catalyst AppSail port `X_ZOHO_CATALYST_LISTEN_PORT` (defaulting to port `9000`) for deployment.
