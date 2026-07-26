import http from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import pg from "pg";

const databaseUrl = process.env.POSTGRES_URL;
if (!databaseUrl) {
  console.error("CRITICAL: POSTGRES_URL environment variable is not set!");
  process.exit(1);
}

// 1. Initialize Postgres connection pool
const pool = new pg.Pool({
  connectionString: databaseUrl,
});

const resourceBaseUrl = new URL(databaseUrl);
resourceBaseUrl.protocol = "postgres:";
resourceBaseUrl.password = "";
const SCHEMA_PATH = "schema";

// 2. Initialize MCP Server
const mcpServer = new Server(
  {
    name: "production-postgres-sse-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// 3. Set Request Handlers (equivalent to modelcontextprotocol/server-postgres)
mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    return {
      resources: result.rows.map((row) => ({
        uri: new URL(`${row.table_name}/${SCHEMA_PATH}`, resourceBaseUrl).href,
        mimeType: "application/json",
        name: `"${row.table_name}" database schema`,
      })),
    };
  } finally {
    client.release();
  }
});

mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resourceUrl = new URL(request.params.uri);
  const pathComponents = resourceUrl.pathname.split("/");
  const schema = pathComponents.pop();
  const tableName = pathComponents.pop();
  
  if (schema !== SCHEMA_PATH) {
    throw new Error("Invalid resource URI");
  }
  
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1",
      [tableName]
    );
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(result.rows, null, 2),
        },
      ],
    };
  } finally {
    client.release();
  }
});

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query",
        description: "Run a read-only SQL query",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string" },
          },
        },
      },
    ],
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "query") {
    const sql = request.params.arguments?.sql;
    const client = await pool.connect();
    try {
      await client.query("BEGIN TRANSACTION READ ONLY");
      const result = await client.query(sql);
      return {
        content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
        isError: false,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  }
  throw new Error(`Tool not found: ${request.params.name}`);
});

// 4. Expose over SSE (Server-Sent Events) HTTP Transport
let transport = null;

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url || "", `http://${req.headers.host}`);

  if (url.pathname === "/sse") {
    console.log("[MCP SSE] New client connecting to SSE endpoint");
    transport = new SSEServerTransport("/message", res);
    await mcpServer.connect(transport);
    
    req.on("close", () => {
      console.log("[MCP SSE] Client disconnected");
    });
  } else if (url.pathname === "/message" && req.method === "POST") {
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("No active SSE session initialized.");
    }
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[MCP SSE Server] Listening on http://localhost:${PORT}`);
});
