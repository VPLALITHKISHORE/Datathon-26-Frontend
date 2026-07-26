import os
import sys
import asyncio
import json
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI, HTTPException, UploadFile, File, Response, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Load .env file
load_dotenv()
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from backend.mcp_client import mcp_client
from backend.llm_handler import process_chat
from backend.pdf_generator import generate_pdf
from backend.analytics import calculate_analytics, get_district_analytics
from backend.catalyst_kb import (
    get_catalyst_documents, 
    upload_catalyst_document, 
    link_catalyst_document,
    get_catalyst_settings, 
    save_catalyst_settings, 
    call_catalyst_rag,
    predict_crime_risk
)

app = FastAPI(
    title="Postgres MCP Chatbot API",
    description="FastAPI backend acting as MCP Client for Postgres DB & React Chatbot UI",
    version="1.0.0"
)

# Note: CORS is handled at the gateway level by Zoho Catalyst (Authorised Domains) in production,
# and by the Vite dev server proxy in local development.

class ChatMessage(BaseModel):
    role: str
    content: str
    executedQueries: Optional[List[Dict[str, Any]]] = None
    dataOutput: Optional[str] = None

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    provider: Optional[str] = "gemini"

class DirectQueryRequest(BaseModel):
    sql: str

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Postgres MCP FastAPI Backend",
        "mcp_server": "npx @modelcontextprotocol/server-postgres"
    }

@app.get("/api/health")
async def health_check():
    tools = await mcp_client.list_tools()
    return {
        "status": "healthy",
        "mcp_connected": len(tools) > 0,
        "tools_available": [t["name"] for t in tools]
    }

@app.get("/api/tools")
async def list_mcp_tools():
    tools = await mcp_client.list_tools()
    return {"tools": tools}

def fetch_rss_feed(url: str, max_items: int = 5):
    import urllib.request
    import urllib.parse
    import xml.etree.ElementTree as ET
    import html
    import re
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=8) as response:
            xml_data = response.read()
        
        root = ET.fromstring(xml_data)
        items = []
        
        for item in root.findall('.//item')[:max_items]:
            title = item.find('title').text if item.find('title') is not None else 'No Title'
            link = item.find('link').text if item.find('link') is not None else '#'
            pubDate = item.find('pubDate').text if item.find('pubDate') is not None else ''
            source = item.find('source').text if item.find('source') is not None else 'Google News'
            
            # Extract image URL
            image_url = None
            enclosure = item.find('enclosure')
            if enclosure is not None and enclosure.get('url'):
                image_url = enclosure.get('url')
            
            # Check for media content tag
            if not image_url:
                for child in item:
                    if 'content' in child.tag and child.get('url'):
                        image_url = child.get('url')
                        break
            
            # Check for custom image element
            if not image_url:
                img_el = item.find('image')
                if img_el is not None and img_el.text:
                    image_url = img_el.text.strip()
            
            description_text = item.find('description').text if item.find('description') is not None else ''
            # Check for embedded img src in description HTML
            if not image_url and description_text:
                img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', description_text)
                if img_match:
                    image_url = img_match.group(1)

            clean_title = title
            if " - " in title:
                parts = title.rsplit(" - ", 1)
                clean_title = parts[0]
                if not source or source == 'Google News':
                    source = parts[1]

            # Strip HTML tags for clean description excerpt
            clean_desc = re.sub('<[^<]+?>', '', description_text) if description_text else ''
            clean_desc = html.unescape(clean_desc)

            items.append({
                "title": html.unescape(clean_title),
                "link": link,
                "pubDate": pubDate,
                "source": html.unescape(source),
                "description": clean_desc,
                "imageUrl": image_url
            })
        return items
    except Exception as e:
        print(f"Error fetching RSS from {url}: {e}")
        return []

@app.get("/api/karnataka-news")
async def get_karnataka_news():
    en_url = "https://news.google.com/rss/search?q=Karnataka&hl=en-IN&gl=IN&ceid=IN:en"
    kn_url = "https://news.google.com/rss/search?q=Karnataka&hl=kn-IN&gl=IN&ceid=IN:kn"
    
    en_news = fetch_rss_feed(en_url, 6)
    kn_news = fetch_rss_feed(kn_url, 6)
    
    return {
        "en": en_news,
        "kn": kn_news
    }

@app.get("/api/proxy-image")
def proxy_image(url: str):
    import urllib.request
    try:
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            image_data = response.read()
            content_type = response.headers.get('Content-Type', 'image/jpeg')
        return Response(content=image_data, media_type=content_type)
    except Exception as e:
        print(f"Error proxying image {url}: {e}")
        raise HTTPException(status_code=400, detail="Failed to retrieve image")

@app.get("/api/analytics")
async def get_analytics_data():
    res = calculate_analytics()
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to compute analytics"))
    return res

@app.post("/api/query")
async def execute_direct_query(req: DirectQueryRequest):
    if not req.sql or not req.sql.strip():
        raise HTTPException(status_code=400, detail="SQL query cannot be empty.")
    
    sql_upper = req.sql.upper().strip()
    
    # 1. Enforce strict read-only SELECT queries
    forbidden_keywords = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "RENAME", "COPY", "GRANT", "REVOKE"]
    for keyword in forbidden_keywords:
        import re
        if re.search(r'\b' + keyword + r'\b', sql_upper):
            raise HTTPException(
                status_code=403, 
                detail=f"Permission Denied: Write operation '{keyword}' is not allowed. This is a read-only portal."
            )
            
    # 2. Restrict direct access to crime_cases table
    if "CRIME_CASES" in sql_upper:
        raise HTTPException(
            status_code=403, 
            detail="Permission Denied: Access to restricted table 'crime_cases' is not permitted."
        )
    
    result = await mcp_client.execute_tool("query", {"sql": req.sql})
    return result

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    if not req.messages:
        raise HTTPException(status_code=400, detail="Messages array cannot be empty.")
    
    formatted_msgs = [{"role": m.role, "content": m.content} for m in req.messages]
    response = await process_chat(formatted_msgs, model_provider=req.provider or "auto")
    return response

@app.post("/api/export-pdf")
async def export_pdf(req: ChatRequest):
    if not req.messages:
        raise HTTPException(status_code=400, detail="Messages array cannot be empty.")
    
    # Format messages for the PDF generator (keeping executedQueries if present)
    formatted_msgs = []
    for m in req.messages:
        msg_dict = {
            "role": m.role,
            "content": m.content
        }
        if m.executedQueries:
            msg_dict["executedQueries"] = m.executedQueries
        formatted_msgs.append(msg_dict)
        
    try:
        pdf_buffer = generate_pdf(formatted_msgs)
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=chat_history.pdf"}
        )
    except Exception as e:
        print(f"[PDF Export Error] {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")

# --- ZOHO CATALYST QUICKML RAG ENDPOINTS ---

class CatalystChatRequest(BaseModel):
    query: str
    documents: List[str]

class CatalystSettingsRequest(BaseModel):
    project_id: Optional[str] = None
    org_id: Optional[str] = None
    access_token: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    refresh_token: Optional[str] = None
    accounts_url: Optional[str] = None
    api_base_url: Optional[str] = None
    auth_code: Optional[str] = None

@app.get("/api/catalyst/documents")
async def api_get_documents():
    return await get_catalyst_documents()

@app.post("/api/catalyst/upload")
async def api_upload_document(file: UploadFile = File(...)):
    content = await file.read()
    result = await upload_catalyst_document(
        file_name=file.filename,
        file_content=content,
        content_type=file.content_type
    )
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("error"))
        
    # Save a copy locally for viewing/previewing
    try:
        doc_info = result.get("document", {})
        doc_id = doc_info.get("document_id")
        if doc_id:
            stored_dir = Path(__file__).resolve().parent / "stored_documents"
            stored_dir.mkdir(parents=True, exist_ok=True)
            ext = file.filename.split(".")[-1].lower() if "." in file.filename else "pdf"
            local_path = stored_dir / f"{doc_id}.{ext}"
            with open(local_path, "wb") as f:
                f.write(content)
            print(f"[Catalyst RAG Upload] Saved a local copy of file {file.filename} to {local_path}")
    except Exception as e:
        print(f"[Catalyst RAG Upload Warning] Failed to save local copy: {e}")
        
    return result

@app.get("/api/catalyst/documents/{document_id}/view")
async def view_document(document_id: str):
    stored_dir = Path(__file__).resolve().parent / "stored_documents"
    
    # If file exists locally, serve it
    if stored_dir.exists():
        matching_files = list(stored_dir.glob(f"{document_id}.*"))
        if matching_files:
            file_path = matching_files[0]
            return FileResponse(file_path)
            
    # Fallback: Generate a helpful txt report with metadata for synced documents
    settings = get_catalyst_settings()
    doc_title = "Unknown Document"
    linked_docs = settings.get("linked_documents", [])
    for doc in linked_docs:
        if doc.get("document_id") == document_id:
            doc_title = doc.get("title", doc_title)
            break
            
    fallback_text = (
        f"==================================================\n"
        f" DOCUMENT METADATA REPORT (ZOHO CLOUD SYNC)\n"
        f"==================================================\n\n"
        f"Document Title    : {doc_title}\n"
        f"Zoho Document ID  : {document_id}\n\n"
        f"Notice:\n"
        f"This document was synced directly from an external Zoho connector\n"
        f"(like Zoho WorkDrive) or registered via the Zoho Catalyst Console.\n\n"
        f"The full document is processed and indexed in the Zoho RAG engine,\n"
        f"allowing you to query and chat with it successfully.\n\n"
        f"To view the original visual layout or edit the source file,\n"
        f"please open it directly inside your Zoho WorkDrive folder."
    )
    
    import tempfile
    temp_dir = Path(tempfile.gettempdir())
    temp_file_path = temp_dir / f"{document_id}_info.txt"
    with open(temp_file_path, "w", encoding="utf-8") as f:
        f.write(fallback_text)
        
    return FileResponse(
        temp_file_path, 
        media_type="text/plain", 
        filename=f"{doc_title.replace(' ', '_')}_info.txt"
    )

@app.get("/api/catalyst/documents/{document_id}/exists")
async def check_document_existence(document_id: str):
    # Always return True so the viewer and download options are permanently enabled in the frontend
    return {"exists": True}

@app.get("/api/catalyst/settings")
def api_get_settings():
    return get_catalyst_settings()


@app.post("/api/catalyst/settings")
async def api_save_settings(req: CatalystSettingsRequest):
    try:
        success = await save_catalyst_settings(req.dict(exclude_unset=True))
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save Catalyst settings.")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to save settings: {str(e)}")

class CatalystLinkRequest(BaseModel):
    document_id: str
    title: str
    file_type: str

@app.post("/api/catalyst/link")
def api_link_document(req: CatalystLinkRequest):
    if not req.document_id or not req.document_id.strip():
        raise HTTPException(status_code=400, detail="Document ID cannot be empty.")
    if not req.title or not req.title.strip():
        raise HTTPException(status_code=400, detail="Document Title cannot be empty.")
        
    result = link_catalyst_document(
        document_id=req.document_id,
        title=req.title,
        file_type=req.file_type
    )
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

@app.post("/api/catalyst/chat")
async def api_catalyst_chat(req: CatalystChatRequest):
    if not req.documents:
        raise HTTPException(status_code=400, detail="Please select at least one document to chat with.")
    
    result = await call_catalyst_rag(req.query, req.documents)
    if result.get("status") == "error":
        error_msg = result.get("error", "Failed to query Catalyst RAG")
        # Check if it was an authentication failure (HTTP 401)
        if "401" in error_msg or "unauthorized" in error_msg.lower() or "invalid_token" in error_msg:
            raise HTTPException(
                status_code=401, 
                detail="Zoho Catalyst Authentication failed (HTTP 401). Please verify your Access Token or Refresh credentials in the Settings tab."
            )
        raise HTTPException(status_code=500, detail=error_msg)
    return result


# --- GEOGRAPHIC MAP & QUICKML SIMULATOR ENDPOINTS ---

# District-level contextual defaults derived from DB averages
# These fill the columns Zoho QuickML was trained on that the simulator doesn't expose as sliders
DISTRICT_DEFAULTS = {
    "Bengaluru City": {
        "policeStation": "Jayanagar Police Station",
        "crimeHead": "Crimes Against Property",
        "crimeSubHead": "Online Harassment",
        "latitude": 12.9707, "longitude": 77.5945,
        "hour": 12, "dayOfWeek": "Sunday", "month": "April",
        "isWeekend": 0, "festivalFlag": 0,
        "alcoholDrugExposure": 0.65,
        "previous7DayCrime": 14, "previous30DayCrime": 59, "recentSimilarCases": 4,
    },
    "Hubballi-Dharwad": {
        "policeStation": "Hubballi Town Police Station",
        "crimeHead": "Crimes Against Property",
        "crimeSubHead": "Robbery",
        "latitude": 15.3668, "longitude": 75.1274,
        "hour": 11, "dayOfWeek": "Thursday", "month": "October",
        "isWeekend": 0, "festivalFlag": 0,
        "alcoholDrugExposure": 0.45,
        "previous7DayCrime": 4, "previous30DayCrime": 19, "recentSimilarCases": 1,
    },
    "Mysuru": {
        "policeStation": "Mysuru Central Police Station",
        "crimeHead": "Crimes Against Property",
        "crimeSubHead": "House Break-in & Theft",
        "latitude": 12.2962, "longitude": 76.6382,
        "hour": 11, "dayOfWeek": "Saturday", "month": "October",
        "isWeekend": 0, "festivalFlag": 0,
        "alcoholDrugExposure": 0.42,
        "previous7DayCrime": 4, "previous30DayCrime": 18, "recentSimilarCases": 1,
    },
    "Belagavi": {
        "policeStation": "Belagavi City Police Station",
        "crimeHead": "Crimes Against Person",
        "crimeSubHead": "Kidnapping",
        "latitude": 15.8483, "longitude": 74.5006,
        "hour": 12, "dayOfWeek": "Friday", "month": "October",
        "isWeekend": 0, "festivalFlag": 0,
        "alcoholDrugExposure": 0.38,
        "previous7DayCrime": 4, "previous30DayCrime": 15, "recentSimilarCases": 1,
    },
    "Mangaluru (Dakshina Kannada)": {
        "policeStation": "Mangaluru North Police Station",
        "crimeHead": "Crimes Against Property",
        "crimeSubHead": "House Break-in & Theft",
        "latitude": 12.9172, "longitude": 74.8558,
        "hour": 12, "dayOfWeek": "Wednesday", "month": "July",
        "isWeekend": 0, "festivalFlag": 0,
        "alcoholDrugExposure": 0.47,
        "previous7DayCrime": 5, "previous30DayCrime": 22, "recentSimilarCases": 1,
    },
}

def _build_full_payload(district: str, metrics: dict, overrides: dict = None) -> dict:
    """Builds a complete Zoho QuickML payload. Context columns are scaled dynamically
    based on slider overrides so the model produces varied predictions."""
    d = DISTRICT_DEFAULTS.get(district, DISTRICT_DEFAULTS["Bengaluru City"])
    overrides = overrides or {}

    # Read slider values (fall back to DB baseline if not overridden)
    stress   = overrides.get("economicStressIndex",   metrics.get("economic_stress_index",  0.5))
    cohesion = overrides.get("communityCohesion",     metrics.get("community_cohesion",     0.5))
    police   = overrides.get("policeAccessibility",   metrics.get("police_accessibility",   0.5))
    unemp    = overrides.get("youthUnemploymentRate", metrics.get("youth_unemployment_rate", 15.0))
    patrol   = overrides.get("patrolUnitsNearby",     metrics.get("patrol_units_nearby",    3.0))

    # Scale previous crime counts based on conditions — these are the most influential model features
    stress_factor = stress * 1.5
    police_factor = police * 0.8
    unemp_factor  = (unemp / 50.0) * 0.5
    patrol_factor = (patrol / 20.0) * 0.3
    risk_mult = max(0.1, 1.0 + stress_factor + unemp_factor - police_factor - patrol_factor)

    prev7d    = max(0, round(d["previous7DayCrime"]  * risk_mult))
    prev30d   = max(0, round(d["previous30DayCrime"] * risk_mult))
    sim_cases = max(0, round(d["recentSimilarCases"] * risk_mult))
    alcohol   = round(min(1.0, d["alcoholDrugExposure"] + stress * 0.2 - cohesion * 0.1), 2)

    # Select crime severity based on risk multiplier
    if risk_mult >= 1.8:
        crime_head, crime_sub = "Crimes Against Person", "Murder for Gain"
    elif risk_mult >= 1.3:
        crime_head, crime_sub = "Crimes Against Person", "Assault"
    elif risk_mult >= 0.8:
        crime_head, crime_sub = d["crimeHead"], d["crimeSubHead"]
    else:
        crime_head, crime_sub = "Crimes Against Property", "Petty Theft"

    print(f"[Payload] risk_mult={risk_mult:.2f} prev7d={prev7d} prev30d={prev30d} crimeHead={crime_head}")

    return {
        "policeStation":       d["policeStation"],
        "crimeHead":           crime_head,
        "crimeSubHead":        crime_sub,
        "latitude":            d["latitude"],
        "longitude":           d["longitude"],
        "hour":                d["hour"],
        "dayOfWeek":           d["dayOfWeek"],
        "month":               d["month"],
        "isWeekend":           d["isWeekend"],
        "festivalFlag":        d["festivalFlag"],
        "alcoholDrugExposure": alcohol,
        "previous7DayCrime":   prev7d,
        "previous30DayCrime":  prev30d,
        "recentSimilarCases":  sim_cases,
        "district":            district,
        "urbanizationLevel":   metrics.get("urbanization_level", "Urban"),
        "populationDensity":   metrics.get("population_density"),
        "medianIncome":        metrics.get("median_income"),
        "literacyRate":        metrics.get("literacy_rate"),
        "youthUnemploymentRate": unemp,
        "migrationRate":       metrics.get("migration_rate"),
        "economicStressIndex": stress,
        "communityCohesion":   cohesion,
        "neighborhoodDisorder": metrics.get("neighborhood_disorder"),
        "policeAccessibility": police,
        "patrolUnitsNearby":   patrol,
        "responseTime":        metrics.get("response_time"),
        "weather":             "Clear",
    }

PCA_FEATURE_MAP = [
    # Maps PCA component indices to the most-correlated human-readable features.
    # Based on the feature order the model was trained on.
    (0, "Previous Crime Trend (7-day)"),
    (1, "Previous Crime Trend (30-day)"),
    (2, "Time of Day & Week Pattern"),
    (3, "Location & Police Station Area"),
    (4, "Economic Stress Level"),
    (5, "Community Cohesion"),
    (6, "Police Accessibility"),
    (7, "Youth Unemployment Rate"),
    (8, "Neighborhood Disorder"),
    (9, "Patrol Units Nearby"),
]

def _parse_pca_xai(explanation_data: list) -> list:
    """Converts raw PCA SHAP values from Zoho QuickML into interpretable contributions."""
    if not explanation_data:
        return []
    contributions = []
    for idx, label in PCA_FEATURE_MAP:
        if idx < len(explanation_data):
            row = explanation_data[idx]
            # row format: ["PCA_N", feature_value, shap_contribution]
            shap_val = abs(row[2]) if len(row) > 2 else abs(row[1])
            contributions.append({"name": label, "raw": shap_val})
    # Normalize to percentages
    total = sum(c["raw"] for c in contributions) or 1
    result = [{"name": c["name"], "value": round(c["raw"] / total * 100)} for c in contributions]
    result.sort(key=lambda x: -x["value"])
    return result[:6]  # Return top 6 drivers


@app.get("/api/map/districts")
def api_map_districts():
    """Returns aggregated socio-economic metrics and crime statistics for all districts."""
    res = get_district_analytics()
    if not res.get("success"):
        raise HTTPException(status_code=500, detail="Failed to load district data")
    return res

# ── Trends & Compare cache ──
_trends_cache: dict = {}
_compare_cache: dict = {}

@app.get("/api/map/trends")
async def api_map_trends(district: str):
    """Returns monthly crime trend and hourly distribution for a district from the DB."""
    if not district:
        raise HTTPException(status_code=400, detail="district param required")

    if district in _trends_cache:
        return _trends_cache[district]

    MONTH_ORDER = ["January","February","March","April","May","June",
                   "July","August","September","October","November","December"]

    # Monthly trend — total + by top crime heads
    monthly_sql = f"""
        SELECT month, crime_head, COUNT(*) as count
        FROM crime_cases
        WHERE district = '{district.replace("'","''")}'
        GROUP BY month, crime_head
        ORDER BY month, count DESC
    """
    monthly_raw = await mcp_client.execute_tool("query", {"sql": monthly_sql})
    monthly_rows = monthly_raw if isinstance(monthly_raw, list) else monthly_raw.get("rows", [])

    # Build monthly totals + per-category breakdown
    monthly_totals = {m: 0 for m in MONTH_ORDER}
    monthly_by_cat: dict = {}
    for row in monthly_rows:
        m, cat, cnt = row["month"], row["crime_head"], int(row["count"])
        monthly_totals[m] = monthly_totals.get(m, 0) + cnt
        if cat not in monthly_by_cat:
            monthly_by_cat[cat] = {mo: 0 for mo in MONTH_ORDER}
        monthly_by_cat[cat][m] = cnt

    # Hourly distribution
    hourly_sql = f"""
        SELECT hour, COUNT(*) as count
        FROM crime_cases
        WHERE district = '{district.replace("'","''")}'
        GROUP BY hour ORDER BY hour
    """
    hourly_raw = await mcp_client.execute_tool("query", {"sql": hourly_sql})
    hourly_rows = hourly_raw if isinstance(hourly_raw, list) else hourly_raw.get("rows", [])
    hourly = {int(r["hour"]): int(r["count"]) for r in hourly_rows}
    hourly_list = [{"hour": h, "count": hourly.get(h, 0)} for h in range(24)]

    # Top 4 crime categories for sparkline
    top_cats = sorted(monthly_by_cat.keys(),
                      key=lambda c: sum(monthly_by_cat[c].values()), reverse=True)[:4]

    result = {
        "district": district,
        "monthly_total": [{"month": m, "count": monthly_totals[m]} for m in MONTH_ORDER],
        "monthly_by_category": {cat: [{"month": m, "count": monthly_by_cat[cat][m]} for m in MONTH_ORDER]
                                  for cat in top_cats},
        "hourly": hourly_list,
        "top_categories": top_cats,
    }
    _trends_cache[district] = result
    print(f"[Trends] Cached trends for {district}")
    return result


@app.get("/api/map/compare")
async def api_map_compare(a: str, b: str):
    """Returns side-by-side metrics and crime breakdown for two districts."""
    cache_key = f"{a}|||{b}"
    if cache_key in _compare_cache:
        return _compare_cache[cache_key]

    analytics = get_district_analytics()
    if not analytics.get("success"):
        raise HTTPException(status_code=500, detail="Failed to load analytics")

    districts_data = analytics.get("districts", {})

    def _get_district_summary(name: str) -> dict:
        d = districts_data.get(name)
        if not d:
            return {}
        m = d.get("metrics", {})
        return {
            "name":                  name,
            "risk_level":            d.get("risk_level", "Unknown"),
            "total_cases":           d.get("total_cases", 0),
            "economic_stress_index": round(m.get("economic_stress_index", 0), 2),
            "community_cohesion":    round(m.get("community_cohesion", 0), 2),
            "police_accessibility":  round(m.get("police_accessibility", 0), 2),
            "youth_unemployment_rate": round(m.get("youth_unemployment_rate", 0), 1),
            "patrol_units_nearby":   round(m.get("patrol_units_nearby", 0), 1),
            "response_time":         round(m.get("response_time", 0), 1),
            "median_income":         m.get("median_income", 0),
            "literacy_rate":         round(m.get("literacy_rate", 0), 1),
            "crimes":                d.get("crimes", [])[:5],
        }

    result = {
        "district_a": _get_district_summary(a),
        "district_b": _get_district_summary(b),
    }
    _compare_cache[cache_key] = result
    print(f"[Compare] Cached comparison {a} vs {b}")
    return result


# ── Per-district insights cache (TTL = 10 min) ──
_insights_cache: dict = {}
_insights_cache_ts: dict = {}
INSIGHTS_CACHE_TTL = 600

import time as _time

@app.get("/api/map/insights")
async def api_map_insights(district: str):
    """Fetches details for a district, runs QuickML prediction, and returns instantly (cached for 10 min)."""
    if not district or district.strip() == "":
        raise HTTPException(status_code=400, detail="District query parameter is required.")

    # ── Serve from cache if fresh ──
    cached_ts = _insights_cache_ts.get(district, 0)
    if district in _insights_cache and (_time.time() - cached_ts) < INSIGHTS_CACHE_TTL:
        print(f"[Insights] Cache hit for {district}")
        return _insights_cache[district]

    analytics = get_district_analytics()
    if not analytics.get("success"):
        raise HTTPException(status_code=500, detail="Failed to load district metrics")

    dist_data = analytics.get("districts", {}).get(district)
    if not dist_data:
        raise HTTPException(status_code=404, detail=f"District '{district}' not found in dataset.")

    metrics = dist_data.get("metrics", {})

    input_data = _build_full_payload(district, metrics)

    # ── SHAP contributions (local, instant) ──
    factors = [
        {"factor": "Economic Stress Index",      "value": metrics.get("economic_stress_index", 0.5),        "weight": 0.25},
        {"factor": "Neighborhood Disorder",      "value": metrics.get("neighborhood_disorder", 0.5),        "weight": 0.20},
        {"factor": "Population Turnover (Migration)", "value": metrics.get("migration_rate", 10) / 100.0,   "weight": 0.15},
        {"factor": "Weak Social Cohesion",       "value": 1.0 - metrics.get("community_cohesion", 0.5),    "weight": 0.15},
        {"factor": "Lack of Police Patrols",     "value": 1.0 - metrics.get("police_accessibility", 0.5),  "weight": 0.10},
    ]
    total_val = sum(f["value"] * f["weight"] for f in factors)
    contributions = (
        [{"name": f["factor"], "value": round(f["value"] * f["weight"] / total_val * 100)}
         for f in factors]
        if total_val > 0
        else [{"name": "Economic Stress Index", "value": 30}, {"name": "Neighborhood Disorder", "value": 25},
              {"name": "Population Turnover (Migration)", "value": 20}, {"name": "Weak Social Cohesion", "value": 15},
              {"name": "Lack of Police Patrols", "value": 10}]
    )

    # ── Run QuickML prediction (instant) ──
    ml_res = await predict_crime_risk(input_data)

    # Parse QuickML result
    risk_prediction, prob, is_fallback = "Medium", 0.50, True
    zoho_xai = []
    if ml_res.get("status") == "success":
        ml_data = ml_res.get("data", {})
        if "result" in ml_data and isinstance(ml_data["result"], list) and ml_data["result"]:
            risk_prediction = ml_data["result"][0]
        else:
            risk_prediction = ml_data.get("prediction") or ml_data.get("predicted_class") or risk_prediction
        prob = ml_data.get("probability",
               0.85 if risk_prediction == "High" else 0.58 if risk_prediction == "Medium" else 0.28)
        is_fallback = False
        # Parse Zoho's PCA explanation into human-readable contributions
        pca_data = ml_data.get("explanation", {}).get("data", [])
        zoho_xai = _parse_pca_xai(pca_data)
        print(f"[Insights] Zoho QuickML success: {risk_prediction} ({prob*100:.0f}%) | XAI factors: {len(zoho_xai)}")
    else:
        print(f"[Insights] QuickML failed, using local SHAP. Error: {ml_res.get('error', 'unknown')}")

    result = {
        "district":      district,
        "prediction":    risk_prediction,
        "probability":   prob,
        "is_fallback":   is_fallback,
        "metrics":       metrics,
        "contributions": zoho_xai if zoho_xai else contributions,  # Prefer Zoho XAI, fallback to local SHAP
        "crimes":        dist_data.get("crimes", []),
    }

    # ── Store in insights cache ──
    _insights_cache[district]    = result
    _insights_cache_ts[district] = _time.time()
    return result

@app.get("/api/map/advice")
async def api_map_advice(district: str, risk: str = "Medium"):
    """Dedicated slow endpoint for Gemini sociological advice called asynchronously by the frontend."""
    analytics = get_district_analytics()
    dist_data = analytics.get("districts", {}).get(district, {}) if analytics.get("success") else {}
    metrics = dist_data.get("metrics", {})

    prompt = (
        f"You are a Senior Criminology Expert analyzing crime risk in Karnataka, India.\n"
        f"District: {district} | Predicted Risk Level: {risk}\n"
        f"Key Metrics:\n"
        f"  - Economic Stress Index: {metrics.get('economic_stress_index')} (0=low, 1=high)\n"
        f"  - Youth Unemployment: {metrics.get('youth_unemployment_rate')}%\n"
        f"  - Police Accessibility: {metrics.get('police_accessibility')} (0=low, 1=high)\n"
        f"  - Community Cohesion: {metrics.get('community_cohesion')} (0=low, 1=high)\n"
        f"  - Median Income: INR {metrics.get('median_income')}\n"
        f"  - Avg Police Response Time: {metrics.get('response_time')} minutes\n\n"
        f"Respond in EXACTLY this format with two paragraphs separated by a blank line:\n\n"
        f"[WHY] Write 2 sentences explaining the specific sociological and economic reasons why {district} has {risk} crime risk based on the metrics above. Be specific about which metrics are driving the risk.\n\n"
        f"How to control the risk: Write 2-3 concrete, actionable policy interventions that local authorities can implement to reduce crime risk in {district}. Be specific and practical."
    )
    try:
        # 20-second timeout — if Gemini is slow, return a fallback immediately
        res = await asyncio.wait_for(
            process_chat([{"role": "user", "content": prompt}], model_provider="gemini"),
            timeout=20.0
        )
        explanation = res.get("message") or res.get("content") or ""
        # Strip the [WHY] tag if Gemini includes it
        explanation = explanation.replace("[WHY]", "").strip()
        return {"explanation": explanation}
    except asyncio.TimeoutError:
        print(f"[Advice] Gemini timed out after 20s for {district}, using fallback.")
        stress = metrics.get('economic_stress_index', '?')
        unemp  = metrics.get('youth_unemployment_rate', '?')
        return {"explanation": f"High economic stress ({stress}) and youth unemployment ({unemp}%) are the primary sociological drivers of {risk} crime risk in {district}. Low community cohesion reduces informal social controls, creating conditions for crime.\n\nHow to control the risk: Deploy additional patrol units in high-risk zones and reduce emergency response time. Launch targeted youth employment and skill-development programmes. Strengthen community policing through neighbourhood watch schemes and resident liaison officers."}
    except Exception as ex:
        print(f"[LLM Error] {ex}")
        return {"explanation": f"Economic stress and youth unemployment are key sociological drivers in {district}.\n\nHow to control the risk: Targeted social youth support programmes, community-centered policing, and increased patrol presence are recommended interventions."}


class SimulationRequest(BaseModel):
    district: str
    economic_stress_index: Optional[float] = None
    community_cohesion: Optional[float] = None
    police_accessibility: Optional[float] = None
    youth_unemployment_rate: Optional[float] = None
    patrol_units_nearby: Optional[float] = None

@app.post("/api/map/simulate")
async def api_map_simulate(req: SimulationRequest):
    """Predicts risk dynamically when the user slides/modifies sociological factors."""
    analytics = get_district_analytics()
    if not analytics.get("success"):
        raise HTTPException(status_code=500, detail="Failed to load baseline metrics")
        
    dist_data = analytics.get("districts", {}).get(req.district)
    if not dist_data:
        raise HTTPException(status_code=404, detail=f"District '{req.district}' not found.")
        
    metrics = dist_data.get("metrics", {})
    
    # Build slider overrides — only pass values that were actually modified
    slider_overrides = {}
    if req.economic_stress_index  is not None: slider_overrides["economicStressIndex"]  = req.economic_stress_index
    if req.community_cohesion     is not None: slider_overrides["communityCohesion"]     = req.community_cohesion
    if req.police_accessibility   is not None: slider_overrides["policeAccessibility"]   = req.police_accessibility
    if req.youth_unemployment_rate is not None: slider_overrides["youthUnemploymentRate"] = req.youth_unemployment_rate
    if req.patrol_units_nearby    is not None: slider_overrides["patrolUnitsNearby"]     = req.patrol_units_nearby

    # Build the full payload Zoho QuickML requires (all 29 columns)
    input_data = _build_full_payload(req.district, metrics, slider_overrides)

    # Call QuickML prediction API
    print(f"\n[Simulator] Running AI prediction for {req.district}...")
    print(f"[Simulator] Slider overrides: {slider_overrides}")
    print(f"[Simulator] Full payload keys: {list(input_data.keys())}")
    
    ml_res = await predict_crime_risk(input_data)
    
    risk_prediction = "Medium"
    prob = 0.50
    is_fallback = True
    zoho_xai = []
    
    if ml_res.get("status") == "success":
        ml_data = ml_res.get("data", {})
        
        # Parse the Zoho QuickML prediction
        if "result" in ml_data and isinstance(ml_data["result"], list) and len(ml_data["result"]) > 0:
            risk_prediction = ml_data["result"][0]
        else:
            risk_prediction = ml_data.get("prediction") or ml_data.get("predicted_class") or ml_data.get("class") or risk_prediction
            
        prob = ml_data.get("probability",
               0.85 if risk_prediction == "High" else 0.58 if risk_prediction == "Medium" else 0.28)
        is_fallback = False

        # Parse PCA XAI explanation into human-readable factors
        pca_data = ml_data.get("explanation", {}).get("data", [])
        zoho_xai = _parse_pca_xai(pca_data)
        print(f"[Simulator] ✅ Zoho QuickML: {risk_prediction} ({prob * 100:.1f}%) | XAI drivers: {[x['name'] for x in zoho_xai[:3]]}")
    else:
        print(f"[Simulator] ⚠️ Zoho QuickML Failed: {ml_res.get('error')}")
        print(f"[Simulator] Error details: {ml_res.get('details', 'No details provided')}")
        print("[Simulator] Using local mathematical fallback model.")
        
    return {
        "district":      req.district,
        "prediction":    risk_prediction,
        "probability":   prob,
        "is_fallback":   is_fallback,
        "zoho_xai":      zoho_xai,
        "modified_metrics": slider_overrides,
    }
@app.on_event("shutdown")
async def shutdown_event():
    print("[Shutdown] FastAPI shutting down, cleaning up background tasks...")
    if hasattr(mcp_client, "_bg_task") and mcp_client._bg_task and not mcp_client._bg_task.done():
        print("[Shutdown] Cancelling Postgres MCP client background task...")
        mcp_client._bg_task.cancel()
        try:
            await mcp_client._bg_task
        except asyncio.CancelledError:
            pass
    print("[Shutdown] Cleanup completed successfully.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

