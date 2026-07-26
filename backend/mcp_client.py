import os
import json
import asyncio
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.client.sse import sse_client
from dotenv import load_dotenv

# Load env variables at module init
load_dotenv()
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

DEFAULT_DB_URL = os.environ.get("POSTGRES_URL")
if not DEFAULT_DB_URL:
    raise ValueError(
        "CRITICAL ERROR: POSTGRES_URL environment variable is not set! "
        "Please check your backend/.env file and ensure it is defined."
    )

def is_connectivity_error(error_msg: str) -> bool:
    err = error_msg.lower()
    # SQL query exceptions (the connection is fine, but table/syntax is wrong)
    if "relation" in err and "does not exist" in err:
        return False
    if "column" in err and "does not exist" in err:
        return False
    if "syntax error" in err:
        return False
    if "permission denied" in err:
        return False
        
    # Known network/connectivity failure keywords
    connectivity_keywords = [
        "connect", "timeout", "etimedout", "econnrefused",
        "refused", "closed", "unreachable", "socket",
        "dns", "host", "port 5432", "taskgroup", "cancelled"
    ]
    for kw in connectivity_keywords:
        if kw in err:
            return True
            
    # psycopg2 connection error indicator
    if "connection to server at" in err and "failed" in err:
        return True
        
    return False

class PostgresMCPClient:
    def __init__(self, db_url: str = DEFAULT_DB_URL):
        self.db_url = db_url
        self._tools_cache: Optional[List[Dict[str, Any]]] = None
        self.idle_timeout = int(os.environ.get("POSTGRES_MCP_IDLE_TIMEOUT", "300"))
        self.last_activity = time.monotonic()
        
        # Circuit Breaker state
        self.last_failure_time = 0.0
        self.failure_cooldown = 30.0  # Don't try to reconnect for 30 seconds after a failure
        self.last_error_msg = ""
        
        # Check if Node.js or npx is available on the system PATH
        import shutil
        has_node = shutil.which("node") is not None
        has_npx = shutil.which("npx") is not None
        self.use_python_fallback = not (has_node or has_npx)
        
        if self.use_python_fallback:
            print("[MCP] Node.js and npx not found on system PATH. Enabling pure Python psycopg2 fallback for SQL executions.")
            self.server_params = None
        else:
            # Check if local installation exists to run node directly (prevents Windows command hang)
            project_root = Path(__file__).resolve().parent.parent
            local_script = project_root / "node_modules" / "@modelcontextprotocol" / "server-postgres" / "dist" / "index.js"
            
            if local_script.exists():
                print(f"[MCP] Local server script found at {local_script}. Using node execution directly.")
                env_vars = dict(os.environ)
                env_vars["NODE_TLS_REJECT_UNAUTHORIZED"] = "0"
                self.server_params = StdioServerParameters(
                    command="node",
                    args=[
                        str(local_script),
                        self.db_url
                    ],
                    env=env_vars
                )
            else:
                # Ensure command resolution on Windows (npx / npx.cmd)
                npx_cmd = "npx.cmd" if os.name == "nt" else "npx"
                print(f"[MCP] Local server script not found. Falling back to {npx_cmd} execution.")
                env_vars = dict(os.environ)
                env_vars["NODE_TLS_REJECT_UNAUTHORIZED"] = "0"
                self.server_params = StdioServerParameters(
                    command=npx_cmd,
                    args=[
                        "-y",
                        "@modelcontextprotocol/server-postgres",
                        self.db_url
                    ],
                    env=env_vars
                )
        self._session: Optional[ClientSession] = None
        self._bg_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    async def _run_server(self):
        """Dedicated background task to run the client session and hold it open indefinitely or until idle timeout."""
        mode = os.environ.get("POSTGRES_MCP_MODE", "stdio").lower()
        try:
            if mode == "sse":
                sse_url = os.environ.get("POSTGRES_MCP_SSE_URL", "http://localhost:5000/sse")
                print(f"[MCP] Connecting to remote Postgres MCP Server over SSE at {sse_url}...")
                async with sse_client(sse_url) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        self._session = session
                        print("[MCP] Remote Postgres MCP session established successfully via SSE!")
                        
                        # Monitor idle timeout periodically
                        while True:
                            await asyncio.sleep(2)
                            current_time = time.monotonic()
                            if current_time - self.last_activity > self.idle_timeout:
                                print(f"[MCP] Idle timeout of {self.idle_timeout}s reached. Closing connection...")
                                self._session = None
                                break
            else:
                # stdio / local subprocess execution
                async with stdio_client(self.server_params) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        self._session = session
                        print("[MCP] Persistent Postgres MCP server session established successfully!")
                        
                        # Monitor idle timeout periodically
                        while True:
                            await asyncio.sleep(2)
                            current_time = time.monotonic()
                            if current_time - self.last_activity > self.idle_timeout:
                                print(f"[MCP] Idle timeout of {self.idle_timeout}s reached. Closing connection...")
                                self._session = None
                                break
        except asyncio.CancelledError:
            print("[MCP] Persistent session background task cancelled.")
        except Exception as e:
            print(f"[MCP Exception] Error in background session task: {e}")
            self.last_failure_time = time.monotonic()
            self.last_error_msg = str(e)
        finally:
            self._session = None
            print("[MCP] Connection closed.")

    async def get_session(self) -> ClientSession:
        """Get or initialize the persistent MCP ClientSession using a dedicated background task."""
        if self.use_python_fallback:
            raise RuntimeError("Database connection is using direct Python fallback mode (Node/npx not present).")

        # Fast fail if Circuit Breaker is active (prevents freezing backend on timeouts)
        current_time = time.monotonic()
        if self._session is None and (current_time - self.last_failure_time < self.failure_cooldown):
            wait_time = int(self.failure_cooldown - (current_time - self.last_failure_time))
            raise RuntimeError(
                f"Database connection is temporarily disabled due to recent failures. "
                f"Last error: {self.last_error_msg}. Retrying in {wait_time} seconds."
            )

        async with self._lock:
            # Re-check inside lock
            current_time = time.monotonic()
            if self._session is None and (current_time - self.last_failure_time < self.failure_cooldown):
                raise RuntimeError(
                    f"Database connection is temporarily disabled due to recent failures. Last error: {self.last_error_msg}"
                )

            # Update last activity time upon session request
            self.last_activity = time.monotonic()
            # If the session is gone, or the background task has crashed/completed, restart it
            if self._session is None or self._bg_task is None or self._bg_task.done():
                if self._bg_task and not self._bg_task.done():
                    self._bg_task.cancel()
                
                print("[MCP] Starting background task for persistent Postgres MCP server...")
                self._session = None
                self._bg_task = asyncio.create_task(self._run_server())
                
                # Wait for the session to be initialized by the background task (timeout 15 seconds)
                start_time = time.monotonic()
                while self._session is None:
                    if self._bg_task.done():
                        # If the task failed during startup, fetch its exception
                        exc = self._bg_task.exception()
                        self.last_failure_time = time.monotonic()
                        self.last_error_msg = str(exc)
                        raise RuntimeError(f"Background task failed to start: {exc}")
                    
                    if time.monotonic() - start_time > 15:
                        self.last_failure_time = time.monotonic()
                        self.last_error_msg = "Timeout waiting for persistent MCP session to establish"
                        if not self._bg_task.done():
                            self._bg_task.cancel()
                        raise TimeoutError("Timeout waiting for persistent MCP session to establish")
                    
                    await asyncio.sleep(0.1)
                    
            return self._session

    async def list_tools(self) -> List[Dict[str, Any]]:
        """Fetch available tools from the Postgres MCP server."""
        if self.use_python_fallback:
            return [{
                "name": "query",
                "description": "Run a read-only SQL query",
                "input_schema": {"type": "object", "properties": {"sql": {"type": "string"}}}
            }]

        if self._tools_cache is not None:
            return self._tools_cache

        try:
            session = await self.get_session()
            tools_result = await session.list_tools()
            tools_data = []
            for tool in tools_result.tools:
                tools_data.append({
                    "name": tool.name,
                    "description": tool.description,
                    "input_schema": tool.inputSchema
                })
            self._tools_cache = tools_data
            return tools_data
        except Exception as e:
            print(f"[MCP Error] Failed to list tools: {e}")
            return [{
                "name": "query",
                "description": "Run a read-only SQL query",
                "input_schema": {"type": "object", "properties": {"sql": {"type": "string"}}}
            }]

    async def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a specific tool on the Postgres MCP server."""
        if self.use_python_fallback:
            return await self._execute_python_fallback(tool_name, arguments)

        try:
            session = await self.get_session()
            result = await session.call_tool(tool_name, arguments=arguments)
            
            # Process response content
            output_text = ""
            for content in result.content:
                if hasattr(content, "text"):
                    output_text += content.text
                else:
                    output_text += str(content)
                    
            return {
                "success": not result.isError,
                "output": output_text,
                "raw": output_text
            }
        except Exception as e:
            err_msg = str(e)
            print(f"[MCP Error] Tool call failed, cancelling background session: {err_msg}")
            # Only trip/update Circuit Breaker if this is a fresh database failure, NOT a Circuit Breaker bypass exception itself
            # AND only if this is an actual network connectivity issue
            if "Database connection is temporarily disabled" not in err_msg and is_connectivity_error(err_msg):
                self.last_failure_time = time.monotonic()
                self.last_error_msg = err_msg
                async with self._lock:
                    if self._bg_task and not self._bg_task.done():
                        self._bg_task.cancel()
                    self._session = None
            return {
                "success": False,
                "error": err_msg,
                "output": f"Error executing tool {tool_name}: {err_msg}"
            }

    async def _execute_python_fallback(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback tool executor that runs SQL queries directly using Python and psycopg2."""
        if tool_name != "query":
            return {
                "success": False,
                "error": f"Tool {tool_name} not supported in fallback mode.",
                "output": f"Error: Tool {tool_name} is not supported in Python fallback mode."
            }
            
        sql_query = arguments.get("sql")
        if not sql_query:
            return {
                "success": False,
                "error": "Missing sql argument",
                "output": "Error: Missing 'sql' argument in query tool call."
            }
            
        # Execute query in a thread pool to avoid blocking the main event loop
        loop = asyncio.get_running_loop()
        try:
            output_text = await loop.run_in_executor(None, self._run_sql_via_psycopg2, sql_query)
            return {
                "success": True,
                "output": output_text,
                "raw": output_text
            }
        except Exception as e:
            err_msg = str(e)
            return {
                "success": False,
                "error": err_msg,
                "output": f"Error executing tool {tool_name}: {err_msg}"
            }

    def _run_sql_via_psycopg2(self, sql_query: str) -> str:
        """Synchronous query runner executed in loop's thread pool."""
        import psycopg2
        from psycopg2.extras import DictCursor
        
        conn = None
        try:
            conn = psycopg2.connect(self.db_url, connect_timeout=10)
            conn.set_session(readonly=True, autocommit=True)
            with conn.cursor(cursor_factory=DictCursor) as cursor:
                cursor.execute(sql_query)
                if cursor.description:
                    rows = cursor.fetchall()
                    if not rows:
                        return "Query returned 0 rows successfully."
                    
                    headers = [desc[0] for desc in cursor.description]
                    header_row = " | ".join(headers)
                    sep_row = " | ".join(["---"] * len(headers))
                    
                    body_rows = []
                    for row in rows:
                        row_str = " | ".join([str(row[h]) if row[h] is not None else "NULL" for h in headers])
                        body_rows.append(row_str)
                    
                    return "\n".join([header_row, sep_row] + body_rows)
                else:
                    return f"Query executed successfully. Status: {cursor.statusmessage}"
        finally:
            if conn:
                conn.close()

# Singleton helper
mcp_client = PostgresMCPClient()

