import os
import json
import asyncio
import httpx
from pathlib import Path
from datetime import datetime

def _load_settings() -> dict:
    """Reads settings from os.environ, falling back to default values if not defined."""
    linked_docs_raw = os.environ.get("ZOHO_LINKED_DOCUMENTS", "[]")
    try:
        linked_docs = json.loads(linked_docs_raw)
    except Exception:
        linked_docs = []
        
    return {
        "project_id": os.environ.get("ZOHO_PROJECT_ID", ""),
        "org_id": os.environ.get("ZOHO_ORG_ID", ""),
        "access_token": os.environ.get("ZOHO_ACCESS_TOKEN", ""),
        "client_id": os.environ.get("ZOHO_CLIENT_ID", ""),
        "client_secret": os.environ.get("ZOHO_CLIENT_SECRET", ""),
        "refresh_token": os.environ.get("ZOHO_REFRESH_TOKEN", ""),
        "accounts_url": os.environ.get("ZOHO_ACCOUNTS_URL", "https://accounts.zoho.in"),
        "api_base_url": os.environ.get("ZOHO_API_BASE_URL", "https://api.catalyst.zoho.in"),
        "quickml_endpoint_key": os.environ.get("ZOHO_QUICKML_ENDPOINT_KEY", ""),
        "linked_documents": linked_docs
    }

def _save_settings(settings: dict):
    """Saves settings back to the .env file and updates current os.environ."""
    env_path = Path(__file__).resolve().parent / ".env"
    
    # Map dictionary keys back to environment variable names
    mappings = {
        "project_id": "ZOHO_PROJECT_ID",
        "org_id": "ZOHO_ORG_ID",
        "access_token": "ZOHO_ACCESS_TOKEN",
        "client_id": "ZOHO_CLIENT_ID",
        "client_secret": "ZOHO_CLIENT_SECRET",
        "refresh_token": "ZOHO_REFRESH_TOKEN",
        "accounts_url": "ZOHO_ACCOUNTS_URL",
        "api_base_url": "ZOHO_API_BASE_URL",
        "quickml_endpoint_key": "ZOHO_QUICKML_ENDPOINT_KEY",
        "linked_documents": "ZOHO_LINKED_DOCUMENTS"
    }
    
    updates = {}
    for k, env_name in mappings.items():
        val = settings.get(k)
        if k == "linked_documents":
            val_str = json.dumps(val)
        else:
            val_str = str(val) if val is not None else ""
        updates[env_name] = val_str
        # Also update current process environment immediately
        os.environ[env_name] = val_str

    try:
        lines = []
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        
        new_lines = []
        processed_keys = set()
        
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and "=" in stripped:
                key, val = stripped.split("=", 1)
                key = key.strip()
                if key in updates:
                    new_lines.append(f"{key}={updates[key]}\n")
                    processed_keys.add(key)
                    continue
            new_lines.append(line)
            
        for key, val in updates.items():
            if key not in processed_keys:
                new_lines.append(f"{key}={val}\n")
                
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
            
    except Exception as e:
        print(f"[Catalyst Config Save Error] {e}")

def get_catalyst_settings() -> dict:
    """Public helper to get settings."""
    return _load_settings()

async def swap_zoho_code(client_id: str, client_secret: str, code: str, redirect_uri: str, accounts_url: str = "https://accounts.zoho.in") -> dict:
    """Swaps Zoho OAuth authorization code for access and refresh tokens."""
    url = f"{accounts_url}/oauth/v2/token"
    data = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }
    async with httpx.AsyncClient() as client:
        print(f"[Catalyst Auth] Exchange code request to {url} (client_id={client_id})")
        res = await client.post(url, data=data)
        if res.status_code == 200:
            res_data = res.json()
            if "access_token" in res_data:
                return res_data
            else:
                raise Exception(f"OAuth Swap Error: {res_data.get('error', 'Unknown Error')}")
        else:
            raise Exception(f"Failed to swap Zoho code: HTTP {res.status_code} - {res.text}")

async def save_catalyst_settings(new_settings: dict) -> bool:
    """Updates settings in the local JSON config file and exchanges authorization code if provided."""
    try:
        settings = _load_settings()
        for k, v in new_settings.items():
            if v is not None and k != "auth_code":
                settings[k] = v
                
        auth_code = new_settings.get("auth_code")
        if auth_code and auth_code.strip():
            client_id = settings.get("client_id")
            client_secret = settings.get("client_secret")
            accounts_url = settings.get("accounts_url", "https://accounts.zoho.in")
            
            print(f"[Catalyst Settings] Swapping authorization code: {auth_code}")
            tokens = await swap_zoho_code(
                client_id=client_id,
                client_secret=client_secret,
                code=auth_code.strip(),
                redirect_uri="http://localhost:8000/oauth/callback",
                accounts_url=accounts_url
            )
            settings["access_token"] = tokens.get("access_token", "")
            if tokens.get("refresh_token"):
                settings["refresh_token"] = tokens.get("refresh_token")
                
        _save_settings(settings)
        return True
    except Exception as e:
        print(f"[Settings Save Error] {e}")
        raise e

async def refresh_zoho_token(client_id: str, client_secret: str, refresh_token: str, accounts_url: str = "https://accounts.zoho.in") -> str:
    """Hits Zoho OAuth token endpoint to refresh the access token."""
    url = f"{accounts_url}/oauth/v2/token"
    data = {
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "refresh_token"
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.post(url, data=data)
        if res.status_code == 200:
            res_data = res.json()
            if "access_token" in res_data:
                return res_data["access_token"]
            else:
                raise Exception(f"OAuth Server Response Error: {res_data.get('error', 'Unknown Error')}")
        else:
            raise Exception(f"Failed to connect to Zoho OAuth: HTTP {res.status_code} - {res.text}")

async def get_catalyst_documents() -> list:
    """Queries Zoho Catalyst RAG documents API directly."""
    settings = _load_settings()
    
    project_id = settings.get("project_id")
    org_id = settings.get("org_id")
    access_token = settings.get("access_token", "")
    client_id = settings.get("client_id")
    client_secret = settings.get("client_secret")
    refresh_token = settings.get("refresh_token")
    accounts_url = settings.get("accounts_url", "https://accounts.zoho.in")
    api_base_url = settings.get("api_base_url", "https://api.catalyst.zoho.in")

    url = f"{api_base_url}/quickml/v1/project/{project_id}/rag/documents"
    
    # Auto-refresh if access token is empty but refresh credentials are set
    if not access_token and client_id and client_secret and refresh_token:
        print("[Catalyst RAG] Access token is empty. Attempting initial refresh...")
        try:
            new_token = await refresh_zoho_token(client_id, client_secret, refresh_token, accounts_url)
            settings["access_token"] = new_token
            _save_settings(settings)
            access_token = new_token
        except Exception as rex:
            print(f"[Catalyst Initial Refresh Exception] {rex}")

    headers = {}
    if org_id:
        headers["CATALYST-ORG"] = org_id
    if access_token:
        headers["Authorization"] = f"Zoho-oauthtoken {access_token}"
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            print(f"[Catalyst RAG] Querying Zoho documents list: {url}")
            res = await client.get(url, headers=headers)
            
            # Auto refresh token on 401
            if (res.status_code == 401 or "invalid_token" in res.text or "invalid access token" in res.text.lower()) and client_id and client_secret and refresh_token:
                print("[Catalyst RAG] Token expired or invalid. Attempting refresh...")
                try:
                    new_token = await refresh_zoho_token(client_id, client_secret, refresh_token, accounts_url)
                    settings["access_token"] = new_token
                    _save_settings(settings)
                    headers["Authorization"] = f"Zoho-oauthtoken {new_token}"
                    print("[Catalyst RAG] Retrying documents list request...")
                    res = await client.get(url, headers=headers)
                except Exception as rex:
                    print(f"[Catalyst Refresh Exception] Token refresh failed: {rex}")
                
            if res.status_code == 200:
                data = res.json()
                doc_list = []
                raw_docs = []
                if isinstance(data, list):
                    raw_docs = data
                elif isinstance(data, dict):
                    raw_docs = data.get("documents") or data.get("data") or []
                
                # Parse Zoho document items
                for d in raw_docs:
                    doc_id = d.get("documentId") or d.get("document_id") or d.get("id") or "unknown"
                    doc_title = d.get("documentName") or d.get("title") or d.get("name") or "Unnamed Document"
                    
                    uploaded_time = d.get("createdTime") or d.get("uploaded_at") or d.get("created_time")
                    if isinstance(uploaded_time, (int, float)):
                        uploaded_str = datetime.fromtimestamp(uploaded_time / 1000.0).strftime("%Y-%m-%d %H:%M:%S")
                    else:
                        uploaded_str = str(uploaded_time) if uploaded_time else str(datetime.now())[:19]
                        
                    doc_list.append({
                        "id": doc_id,
                        "document_id": doc_id,
                        "title": doc_title,
                        "uploaded_at": uploaded_str,
                        "file_size": d.get("file_size") or d.get("size") or 0,
                        "file_type": d.get("file_type") or d.get("extension") or "pdf"
                    })
                
                # Merge manually linked documents
                linked_docs = settings.get("linked_documents", [])
                # Ensure no duplicate document IDs are shown
                seen_ids = {doc["document_id"] for doc in doc_list}
                for ld in linked_docs:
                    if ld["document_id"] not in seen_ids:
                        doc_list.append(ld)
                        
                return doc_list
            else:
                raise Exception(f"Zoho API returned HTTP {res.status_code}: {res.text}")
        except Exception as e:
            print(f"[Catalyst Documents API Error] {e}")
            # If the API call fails, we still return the manually linked documents so the user can use them!
            return settings.get("linked_documents", [])

async def upload_catalyst_document(file_name: str, file_content: bytes, content_type: str) -> dict:
    """Uploads file content directly to Zoho Catalyst RAG index endpoint."""
    settings = _load_settings()
    
    project_id = settings.get("project_id")
    org_id = settings.get("org_id")
    access_token = settings.get("access_token", "")
    client_id = settings.get("client_id")
    client_secret = settings.get("client_secret")
    refresh_token = settings.get("refresh_token")
    accounts_url = settings.get("accounts_url", "https://accounts.zoho.in")
    api_base_url = settings.get("api_base_url", "https://api.catalyst.zoho.in")

    url = f"{api_base_url}/quickml/v1/project/{project_id}/rag/documents"
    
    # Auto-refresh if access token is empty but refresh credentials are set
    if not access_token and client_id and client_secret and refresh_token:
        print("[Catalyst RAG] Access token is empty before upload. Attempting initial refresh...")
        try:
            new_token = await refresh_zoho_token(client_id, client_secret, refresh_token, accounts_url)
            settings["access_token"] = new_token
            _save_settings(settings)
            access_token = new_token
        except Exception as rex:
            print(f"[Catalyst Initial Refresh Exception] {rex}")

    headers = {}
    if org_id:
        headers["CATALYST-ORG"] = org_id
    if access_token:
        headers["Authorization"] = f"Zoho-oauthtoken {access_token}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            print(f"[Catalyst RAG Upload] POSTing file {file_name} to Zoho RAG: {url}")
            data = {"documentName": file_name}
            files = {"file": (file_name, file_content, content_type)}
            response = await client.post(url, headers=headers, data=data, files=files)
            
            # Auto refresh token on 401
            if (response.status_code == 401 or "invalid_token" in response.text or "invalid access token" in response.text.lower()) and client_id and client_secret and refresh_token:
                print("[Catalyst RAG Upload] Token expired. Attempting refresh...")
                try:
                    new_token = await refresh_zoho_token(client_id, client_secret, refresh_token, accounts_url)
                    settings["access_token"] = new_token
                    _save_settings(settings)
                    headers["Authorization"] = f"Zoho-oauthtoken {new_token}"
                    print("[Catalyst RAG Upload] Retrying upload request...")
                    response = await client.post(url, headers=headers, data=data, files=files)
                except Exception as rex:
                    print(f"[Catalyst Upload Refresh Exception] Token refresh failed: {rex}")
                
            if response.status_code in (200, 201):
                res_data = response.json()
                document_id = res_data.get("document_id") or res_data.get("id") or res_data.get("document", {}).get("id")
                if document_id:
                    ext = file_name.split(".")[-1].lower() if "." in file_name else "pdf"
                    doc_obj = {
                        "id": document_id,
                        "document_id": document_id,
                        "title": file_name,
                        "uploaded_at": str(datetime.now())[:19],
                        "file_size": len(file_content),
                        "file_type": ext
                    }
                    return {
                        "status": "success",
                        "document": doc_obj
                    }
            return {
                "status": "error",
                "error": f"Zoho API returned HTTP {response.status_code}: {response.text}"
            }
        except Exception as e:
            return {
                "status": "error",
                "error": f"Exception calling Catalyst RAG upload: {str(e)}"
            }

def link_catalyst_document(document_id: str, title: str, file_type: str) -> dict:
    """Saves a manually linked Zoho Catalyst Document ID into settings."""
    try:
        settings = _load_settings()
        linked_docs = settings.get("linked_documents", [])
        
        doc_obj = {
            "id": document_id.strip(),
            "document_id": document_id.strip(),
            "title": title.strip(),
            "uploaded_at": str(datetime.now())[:19],
            "file_size": 0,
            "file_type": file_type.strip().lower()
        }
        
        # Check if already exists in linked docs and overwrite/update it
        linked_docs = [ld for ld in linked_docs if ld["document_id"] != document_id.strip()]
        linked_docs.append(doc_obj)
        settings["linked_documents"] = linked_docs
        _save_settings(settings)
        
        return {
            "status": "success",
            "document": doc_obj
        }
    except Exception as e:
        return {
            "status": "error",
            "error": f"Failed to save linked document: {str(e)}"
        }

async def call_catalyst_rag(query: str, documents: list[str]) -> dict:
    """Queries the Zoho Catalyst QuickML RAG endpoint directly."""
    settings = _load_settings()
        
    project_id = settings.get("project_id")
    org_id = settings.get("org_id")
    access_token = settings.get("access_token", "")
    client_id = settings.get("client_id")
    client_secret = settings.get("client_secret")
    refresh_token = settings.get("refresh_token")
    accounts_url = settings.get("accounts_url", "https://accounts.zoho.in")
    api_base_url = settings.get("api_base_url", "https://api.catalyst.zoho.in")

    url = f"{api_base_url}/quickml/v1/project/{project_id}/rag/answer"
    
    # Auto-refresh if access token is empty but refresh credentials are set
    if not access_token and client_id and client_secret and refresh_token:
        print("[Catalyst RAG] Access token is empty before query. Attempting initial refresh...")
        try:
            new_token = await refresh_zoho_token(client_id, client_secret, refresh_token, accounts_url)
            settings["access_token"] = new_token
            _save_settings(settings)
            access_token = new_token
        except Exception as rex:
            print(f"[Catalyst Initial Refresh Exception] {rex}")

    headers = {
        "Content-Type": "application/json"
    }
    if org_id:
        headers["CATALYST-ORG"] = org_id
    if access_token:
        headers["Authorization"] = f"Zoho-oauthtoken {access_token}"
    
    # Enhance the user's query with instructions to return evidence (file name, page numbers, etc.)
    enhanced_query = (
        f"{query}\n\n"
        f"--- IMPORTANT CITATION INSTRUCTIONS ---\n"
        f"1. You must answer using ONLY the content from the selected documents.\n"
        f"2. Cite the source file name, section, and page number (if available) for all key facts/claims in your response (e.g., '[Source: file.pdf, Page: 4]').\n"
        f"3. If page number is not available, cite the document title/ID.\n"
        f"4. If the documents do not contain the answer, state that clearly. Do not assume or extrapolate."
    )
    
    body = {
        "query": enhanced_query,
        "documents": documents
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            print(f"[Catalyst RAG] Querying Zoho RAG: {query} with docs: {documents}")
            response = await client.post(url, headers=headers, json=body)
            
            # Detect token expiration
            is_unauthorized = response.status_code == 401 or "invalid_token" in response.text or "invalid access token" in response.text.lower()
            
            if is_unauthorized and client_id and client_secret and refresh_token:
                print("[Catalyst RAG] Token expired. Attempting OAuth refresh...")
                try:
                    new_token = await refresh_zoho_token(client_id, client_secret, refresh_token, accounts_url)
                    settings["access_token"] = new_token
                    _save_settings(settings)
                    
                    headers["Authorization"] = f"Zoho-oauthtoken {new_token}"
                    print("[Catalyst RAG] Retrying RAG query request...")
                    response = await client.post(url, headers=headers, json=body)
                except Exception as ex:
                    print(f"[Catalyst RAG Refresh Error] Token refresh/retry failed: {ex}")
            
            if response.status_code == 200:
                res_data = response.json()
                if isinstance(res_data, dict) and "status" not in res_data:
                    res_data["status"] = "success"
                return res_data
            else:
                return {
                    "status": "error",
                    "error": f"Zoho API returned HTTP {response.status_code}",
                    "details": response.text
                }
        except Exception as e:
            return {
                "status": "error",
                "error": f"Exception calling Catalyst RAG: {str(e)}"
            }

def local_fallback_predict(input_data: dict) -> dict:
    """Calculates risk levels locally based on formula rules if QuickML isn't configured."""
    stress = float(input_data.get("economic_stress_index", 0.5))
    disorder = float(input_data.get("neighborhood_disorder", 0.5))
    migration = float(input_data.get("migration_rate", 15.0))
    cohesion = float(input_data.get("community_cohesion", 0.5))
    alcohol = float(input_data.get("alcohol_drug_exposure", 0.5))
    access = float(input_data.get("police_accessibility", 0.5))
    
    # Calculate score
    risk_score = (
        stress * 0.25 +
        disorder * 0.20 +
        (migration / 100.0) * 0.15 +
        (1.0 - cohesion) * 0.15 +
        alcohol * 0.15 +
        (1.0 - access) * 0.10
    )
    
    # Map to level
    if risk_score < 0.42:
        level = "Low"
    elif risk_score < 0.65:
        level = "Medium"
    else:
        level = "High"
        
    return {
        "status": "success",
        "data": {
            "prediction": level,
            "probability": round(risk_score, 4),
            "fallback": True
        }
    }

async def predict_crime_risk(input_data: dict) -> dict:
    """Invokes the Zoho Catalyst QuickML model prediction endpoint."""
    settings = _load_settings()
        
    project_id = settings.get("project_id")
    org_id = settings.get("org_id")
    access_token = settings.get("access_token", "")
    client_id = settings.get("client_id")
    client_secret = settings.get("client_secret")
    refresh_token = settings.get("refresh_token")
    accounts_url = settings.get("accounts_url", "https://accounts.zoho.in")
    api_base_url = settings.get("api_base_url", "https://api.catalyst.zoho.in")
    endpoint_key = settings.get("quickml_endpoint_key", "")
    
    if not endpoint_key:
        print("[QuickML] ZOHO_QUICKML_ENDPOINT_KEY not set. Using local prediction fallback.")
        return local_fallback_predict(input_data)

    url = f"{api_base_url}/quickml/v1/project/{project_id}/endpoints/predict?explainModel=true"
    
    # Auto-refresh if access token is empty
    if not access_token and client_id and client_secret and refresh_token:
        try:
            new_token = await refresh_zoho_token(client_id, client_secret, refresh_token, accounts_url)
            settings["access_token"] = new_token
            _save_settings(settings)
            access_token = new_token
        except Exception as rex:
            print(f"[QuickML Auth Refresh Error] {rex}")

    headers = {
        "Content-Type": "application/json",
        "X-QUICKML-ENDPOINT-KEY": endpoint_key,
        "Environment": "Development"
    }
    if org_id:
        headers["CATALYST-ORG"] = org_id
    if access_token:
        headers["Authorization"] = f"Zoho-oauthtoken {access_token}"
        
    # QuickML predict API expects the dictionary of features inside "data"
    body = {
        "data": input_data
    }
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            print(f"[QuickML Predict] POSTing to {url}")
            response = await client.post(url, headers=headers, json=body)
            
            # Detect token expiration
            is_unauthorized = response.status_code == 401 or "invalid_token" in response.text or "invalid access token" in response.text.lower()
            if is_unauthorized and client_id and client_secret and refresh_token:
                print("[QuickML] Access token expired, refreshing...")
                try:
                    new_token = await refresh_zoho_token(client_id, client_secret, refresh_token, accounts_url)
                    settings["access_token"] = new_token
                    _save_settings(settings)
                    headers["Authorization"] = f"Zoho-oauthtoken {new_token}"
                    response = await client.post(url, headers=headers, json=body)
                except Exception as ex:
                    print(f"[QuickML Retry Error] {ex}")
                    
            if response.status_code == 200:
                return {
                    "status": "success",
                    "data": response.json()
                }
            else:
                return {
                    "status": "error",
                    "error": f"Zoho QuickML returned HTTP {response.status_code}",
                    "details": response.text
                }
        except Exception as e:
            return {
                "status": "error",
                "error": f"Exception calling Zoho QuickML: {str(e)}"
            }

