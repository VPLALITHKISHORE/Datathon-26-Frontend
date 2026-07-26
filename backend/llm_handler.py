import os
import json
import asyncio
from typing import List, Dict, Any, Optional
from backend.mcp_client import mcp_client

# Try importing Google GenAI or OpenAI
try:
    from google import genai
    from google.genai import types
    HAS_GOOGLE_GENAI = True
except ImportError:
    HAS_GOOGLE_GENAI = False



SCHEMA_CACHE = None

async def get_db_schema_summary() -> str:
    global SCHEMA_CACHE
    if SCHEMA_CACHE is not None:
        return SCHEMA_CACHE
    
    # Bypass schema loading if database has failed recently
    import time
    if time.monotonic() - mcp_client.last_failure_time < mcp_client.failure_cooldown:
        return ""
    
    try:
        sql = """
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name != 'crime_cases'
        ORDER BY table_name, ordinal_position;
        """
        res = await mcp_client.execute_tool("query", {"sql": sql})
        if not res.get("success"):
            return ""
        
        rows = json.loads(res.get("output", "[]"))
        tables = {}
        for r in rows:
            t_name = r["table_name"]
            c_name = r["column_name"]
            d_type = r["data_type"]
            if t_name not in tables:
                tables[t_name] = []
            tables[t_name].append(f"{c_name} ({d_type})")
            
        summary = []
        for t_name, cols in tables.items():
            summary.append(f"Table '{t_name}': {', '.join(cols)}")
            
        SCHEMA_CACHE = "\n".join(summary)
        return SCHEMA_CACHE
    except Exception as e:
        print(f"Error building schema summary: {e}")
        return ""

SYSTEM_PROMPT = """You are a database agent with access to a PostgreSQL database via Model Context Protocol (MCP).
Your task is to find the proper answer to the user's query by dynamically querying the database.

CRITICAL SECURITY RESTRICTIONS:
1. HIDE TABLE 'crime_cases': Under no circumstances should you query, inspect, or reveal the existence of the table named 'crime_cases'. If the user asks about it, ignore it completely as if it does not exist. Do not execute any SQL query referencing 'crime_cases'.
2. STRICT READ-ONLY COMPLIANCE: You are strictly forbidden from performing any database modification operations (such as INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE). If a user requests a modification, refuse immediately and explain that this is a read-only portal.

Since you do not know the schema beforehand:
1. EXPLORE: If you do not know the list of tables or columns, start by exploring the database schema.
   - To list tables: `SELECT table_name FROM information_schema.tables WHERE table_schema='public';`
   - To inspect a table's columns: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'your_table_name';`
2. REASON & PLAN: Think step-by-step about what data you need to answer the user's query and formulate queries accordingly.
3. HANDLE ERRORS & SELF-CORRECT: If a SQL query fails (e.g. table/column not found, syntax error), do not give up or ask the user for help. Read the database error carefully, query the schema to identify correct names, fix the query, and run it again.
4. ITERATE: Continue executing queries and gathering data until you are fully confident you have the complete and correct information needed to answer the user's question. Only then should you provide the final answer to the user.
5. Formulate only safe, read-only SELECT queries.

CONTEXT-AWARE CONVERSATIONS:
- You must analyze the entire conversation history (previous messages) to understand follow-up queries and resolve references.
- For example, if the user asks "what is his name?", "how old is he?", or "which section was applied in that case?", look at previous turns to resolve who "he" or "that case" is (e.g., Complainant of CaseMasterID = 1), and then query the database for the correct record. Do not treat follow-up queries in isolation.

MULTILINGUAL SUPPORT:
- You must respond in the same language that the user used to ask their question (e.g. Hindi, Kannada, Tamil, Spanish, French, etc.).
- Perform all your internal thoughts, table explorations, and SQL queries in English as required by the database schema. However, once you have compiled the correct facts and final answer, translate the text response back to the user's language before outputting it.
"""

async def process_chat(messages: List[Dict[str, str]], model_provider: str = "gemini") -> Dict[str, Any]:
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

    # Fetch available MCP tools
    tools = await mcp_client.list_tools()
    
    # Fetch schema summary and inject it into system prompt
    schema_summary = await get_db_schema_summary()
    active_system_prompt = SYSTEM_PROMPT
    if schema_summary:
        active_system_prompt += f"\n\nDATABASE SCHEMA REFERENCE:\n{schema_summary}"
    
    executed_queries = []
    gemini_error = None
    
    # 1. Use Gemini if key is present
    if (model_provider in ["auto", "gemini"]) and gemini_key and HAS_GOOGLE_GENAI:
        try:
            client = genai.Client(api_key=gemini_key)
            
            # Map MCP tools to Gemini's FunctionDeclaration format
            gemini_tools = []
            if tools:
                declarations = []
                for t in tools:
                    schema = t.get("input_schema") or {"type": "object", "properties": {}}
                    declarations.append(
                        types.FunctionDeclaration(
                            name=t["name"],
                            description=t["description"],
                            parameters_json_schema=schema
                        )
                    )
                gemini_tools.append(types.Tool(function_declarations=declarations))
            
            # Setup initial conversation history
            contents = []
            for msg in messages:
                role = "user" if msg["role"] == "user" else "model"
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=msg["content"])]
                    )
                )
                
            config = types.GenerateContentConfig(
                system_instruction=active_system_prompt,
                tools=gemini_tools if gemini_tools else None,
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
            )
            
            max_turns = 15
            turn = 0
            response_text = ""
            
            while turn < max_turns:
                turn += 1
                response = None
                last_err = None
                
                # Try fallback models if one fails (prioritize gemini-3.5-flash-lite and gemini-2.0-flash-lite due to quotas)
                for model_name in ["gemini-3.5-flash-lite", "gemini-2.0-flash-lite", "gemini-3.6-flash", "gemini-2.0-flash", "gemini-2.5-flash"]:
                    try:
                        print(f"\n[Agent Turn {turn}] Calling Gemini model '{model_name}'...")
                        # Run the synchronous SDK call in a thread so it never blocks the FastAPI event loop
                        response = await asyncio.to_thread(
                            client.models.generate_content,
                            model=model_name,
                            contents=contents,
                            config=config
                        )
                        if response:
                            print(f"[Agent Turn {turn}] Model responded successfully.")
                            break
                    except Exception as model_err:
                        last_err = model_err
                        print(f"[Gemini Try {model_name}] {model_err}")
                
                if not response or not response.candidates:
                    if last_err:
                        raise last_err
                    break
                
                # Append the model's turn (function call or text response)
                model_content = response.candidates[0].content
                contents.append(model_content)
                
                # If the model requested tool calls, execute them and continue the loop
                if response.function_calls:
                    tool_parts = []
                    db_disabled = False
                    db_error_msg = ""
                    for tool_call in response.function_calls:
                        print(f"[Agent Turn {turn}] Requesting MCP tool '{tool_call.name}' with args: {tool_call.args}")
                        tool_result = await mcp_client.execute_tool(tool_call.name, tool_call.args)
                        print(f"[Agent Turn {turn}] MCP Tool result status: {tool_result.get('success')}. Output preview: {str(tool_result.get('output'))[:250]}...")
                        executed_queries.append({
                            "tool": tool_call.name,
                            "args": tool_call.args,
                            "result": tool_result
                        })
                        
                        # Detect Circuit Breaker or database timeout failures
                        if not tool_result.get("success"):
                            out_str = tool_result.get("output", "")
                            if "Database connection is temporarily disabled" in out_str or "connect ETIMEDOUT" in out_str:
                                db_disabled = True
                                db_error_msg = out_str
                        
                        # Create and append function response part
                        func_response_part = types.Part.from_function_response(
                            name=tool_call.name,
                            response={"result": tool_result.get("output", "")}
                        )
                        tool_parts.append(func_response_part)
                    
                    contents.append(
                        types.Content(role='user', parts=tool_parts)
                    )
                    
                    if db_disabled:
                        print(f"[Agent Turn {turn}] Database connection is offline or disabled. Aborting agent retry loop.")
                        response_text = (
                            f"⚠️ **Database Connection Offline**\n\n"
                            f"I cannot access the database because the connection is currently unavailable.\n"
                            f"Details: `{db_error_msg}`\n\n"
                            f"Please make sure your PostgreSQL service is running locally or check the `POSTGRES_URL` in your `backend/.env` file."
                        )
                        break
                        
                    continue
                else:
                    # No more function calls, we have the final response text!
                    response_text = response.text or ""
                    print(f"[Agent Turn {turn}] Received final text response (length={len(response_text)}).")
                    break
            
            if not response_text and contents and contents[-1].role == "user":
                for model_name in ["gemini-3.5-flash-lite", "gemini-2.0-flash-lite", "gemini-3.6-flash", "gemini-2.0-flash", "gemini-2.5-flash"]:
                    try:
                        print(f"\n[Agent] Max turns reached. Requesting final response from '{model_name}'...")
                        response = await asyncio.to_thread(
                            client.models.generate_content,
                            model=model_name,
                            contents=contents,
                            config=config
                        )
                        if response and response.text:
                            response_text = response.text
                            print(f"[Agent] Successfully generated final response text.")
                            break
                    except Exception as final_err:
                        print(f"[Gemini Final Try {model_name}] {final_err}")

            if response_text:
                return {
                    "message": response_text,
                    "provider": "gemini-agent-loop",
                    "executed_queries": executed_queries
                }
                
        except Exception as e:
            gemini_error = str(e)
            print(f"[LLM Error] Gemini failed: {e}")



    # 3. Direct MCP Query Fallback (Intelligent Direct Execution) - ONLY for raw SQL entered by user
    last_user_msg = messages[-1]["content"] if messages else ""
    lower_msg = last_user_msg.lower().strip()
    
    query_to_run = None
    
    # Direct SQL queries entered by user
    if (lower_msg.startswith("select ") or lower_msg.startswith("with ") or lower_msg.startswith("show ")) and "about" not in lower_msg and "details" not in lower_msg:
        query_to_run = last_user_msg

    if query_to_run:
        result = await mcp_client.execute_tool("query", {"sql": query_to_run})
        executed_queries.append({
            "tool": "query",
            "args": {"sql": query_to_run},
            "result": result
        })
        
        status_msg = f"📊 Executed SQL Query on PostgreSQL Database via MCP:\n```sql\n{query_to_run}\n```"
        if not result.get("success", True):
            status_msg += f"\n\n⚠️ *Query execution warning: {result.get('output', '')}*"

        return {
            "message": status_msg,
            "provider": "direct-mcp-sql",
            "executed_queries": executed_queries
        }

    # If we had a Gemini error, let the user know what went wrong
    if gemini_error:
        return {
            "message": f"❌ Gemini API Call Failed:\n```\n{gemini_error}\n```\nPlease check your API key, project quotas, or wait for the limit to reset. If you wanted to query directly, type a raw SQL command (e.g. `SELECT * FROM \"CaseMaster\" LIMIT 10;`).",
            "provider": "system-error",
            "executed_queries": []
        }

    return {
        "message": "Welcome! Connected to PostgreSQL database MCP Server.\n\nTry asking:\n• `Show criminals` or `SELECT * FROM criminals LIMIT 10;`\n• `List all tables`\n• `Show CaseCategory`",
        "provider": "system",
        "executed_queries": []
    }

