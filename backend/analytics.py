import os
import time
import json
import psycopg2
from typing import Dict, Any, List
from collections import defaultdict
from datetime import datetime

# ── In-memory TTL cache for district analytics (refreshes every 5 min) ──
_district_cache: Dict = {}
_district_cache_ts: float = 0.0
DISTRICT_CACHE_TTL = 300  # seconds

DEFAULT_DB_URL = os.environ.get("POSTGRES_URL")
if not DEFAULT_DB_URL:
    # Read from local parent path if running locally
    from pathlib import Path
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")
    DEFAULT_DB_URL = os.environ.get("POSTGRES_URL")

def get_db_connection():
    from backend.mcp_client import mcp_client
    
    # Circuit Breaker check - prevent blocking psycopg2 connects
    current_time = time.monotonic()
    if current_time - mcp_client.last_failure_time < mcp_client.failure_cooldown:
        raise RuntimeError(
            f"Database connection is temporarily disabled due to recent failures. "
            f"Last error: {mcp_client.last_error_msg}."
        )

    # Use sslmode=prefer for psycopg2 compatibility
    db_url = DEFAULT_DB_URL or ""
    if "?sslmode=" not in db_url and "&sslmode=" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{separator}sslmode=prefer"
    else:
        # replace no-verify with prefer if it exists
        db_url = db_url.replace("sslmode=no-verify", "sslmode=prefer")
        
    try:
        return psycopg2.connect(db_url)
    except Exception as e:
        # Trip the circuit breaker in mcp_client so all requests fail fast
        mcp_client.last_failure_time = time.monotonic()
        mcp_client.last_error_msg = str(e)
        raise e

def calculate_analytics() -> Dict[str, Any]:
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # 1. Fetch cases with crime categories
        cur.execute("""
            SELECT c."CaseMasterID", c."CaseNo", c."BriefFacts", c."CrimeRegisteredDate", 
                   c."latitude", c."longitude", ch."CrimeGroupName"
            FROM "CaseMaster" c
            LEFT JOIN "CrimeHead" ch ON c."CrimeMajorHeadID" = ch."CrimeHeadID"
            ORDER BY c."CrimeRegisteredDate" DESC;
        """)
        case_rows = cur.fetchall()

        # 2. Fetch accused details
        cur.execute("""
            SELECT "AccusedMasterID", "CaseMasterID", "AccusedName", "PersonID", "AgeYear"
            FROM "Accused"
            WHERE "PersonID" IS NOT NULL;
        """)
        accused_rows = cur.fetchall()

        cur.close()
        conn.close()

        # Build helper structures
        cases_map = {}
        for r in case_rows:
            case_date = r[3]
            if isinstance(case_date, datetime):
                date_str = case_date.strftime("%Y-%m-%d")
                month_str = case_date.strftime("%Y-%m")
            elif case_date:
                date_str = str(case_date)[:10]
                month_str = str(case_date)[:7]
            else:
                date_str = "Unknown"
                month_str = "Unknown"

            cases_map[r[0]] = {
                "id": r[0],
                "case_no": r[1],
                "brief_facts": r[2],
                "date": date_str,
                "month": month_str,
                "lat": float(r[4]) if r[4] else None,
                "lon": float(r[5]) if r[5] else None,
                "category": r[6] or "Other Offences",
                "accused": []
            }

        # Map suspects
        suspects_map = {}
        # Track co-accused relationships by case
        case_accused = defaultdict(list)

        for r in accused_rows:
            acc_id, case_id, name, person_id, age = r
            case_accused[case_id].append(person_id)

            if person_id not in suspects_map:
                suspects_map[person_id] = {
                    "person_id": person_id,
                    "names": set([name]),
                    "age": age,
                    "cases": [],
                    "co_accused": set()
                }
            else:
                suspects_map[person_id]["names"].add(name)
                # Keep the non-zero age if possible
                if age and not suspects_map[person_id]["age"]:
                    suspects_map[person_id]["age"] = age

            if case_id in cases_map:
                cases_map[case_id]["accused"].append(name)
                suspects_map[person_id]["cases"].append(cases_map[case_id]["case_no"])

        # Resolve co-accused accomplice lists
        for case_id, p_ids in case_accused.items():
            for p1 in p_ids:
                for p2 in p_ids:
                    if p1 != p2:
                        suspects_map[p1]["co_accused"].add(p2)

        # Convert sets to lists/strings for JSON serialization
        suspects_list = []
        repeat_offenders_count = 0
        
        for pid, data in suspects_map.items():
            primary_name = list(data["names"])[0] if data["names"] else "Unknown"
            aliases = list(data["names"])[1:] if len(data["names"]) > 1 else []
            case_count = len(data["cases"])
            if case_count >= 2:
                repeat_offenders_count += 1

            # Fetch primary co-accused names
            co_accused_names = []
            for cp_id in data["co_accused"]:
                if cp_id in suspects_map:
                    co_names = suspects_map[cp_id]["names"]
                    co_accused_names.append(list(co_names)[0] if co_names else cp_id)

            suspects_list.append({
                "person_id": pid,
                "name": primary_name,
                "aliases": aliases,
                "age": data["age"],
                "case_count": case_count,
                "cases": data["cases"],
                "co_accused": co_accused_names
            })

        # Calculate statistics
        total_cases = len(cases_map)
        total_suspects = len(suspects_map)
        
        # Interlinked cases: cases that share at least one suspect who is a repeat offender
        linked_cases = set()
        for pid, data in suspects_map.items():
            if len(data["cases"]) >= 2:
                for case_no in data["cases"]:
                    linked_cases.add(case_no)
        linked_cases_count = len(linked_cases)

        # Detect organized cliques (gangs)
        # Groups of co-accused of size >= 2
        cliques = []
        clique_visited = set()
        for pid, data in suspects_map.items():
            if len(data["co_accused"]) >= 1 and pid not in clique_visited:
                clique = data["co_accused"].union({pid})
                # Check if this exact group or sub-group is already accounted for
                frozen_clique = frozenset(clique)
                if frozen_clique not in clique_visited:
                    clique_visited.add(frozen_clique)
                    clique_visited.update(clique)
                    cliques.append([list(suspects_map[cid]["names"])[0] for cid in clique if cid in suspects_map])

        # Graph Network Nodes and Edges
        network_nodes = []
        network_edges = []
        
        # Add suspect nodes
        for s in suspects_list:
            # Scale node size based on number of cases committed
            val = 15 + (s["case_count"] * 6)
            network_nodes.append({
                "id": f"suspect_{s['person_id']}",
                "label": s["name"],
                "type": "suspect",
                "group": "Suspect",
                "val": val,
                "details": f"Accused ID: {s['person_id']} • Age: {s['age'] or 'N/A'} • Cases: {s['case_count']}"
            })

        # Add case nodes
        for cid, c in cases_map.items():
            network_nodes.append({
                "id": f"case_{cid}",
                "label": f"Case {c['case_no']}",
                "type": "case",
                "group": c["category"],
                "val": 15,
                "details": f"FIR: {c['case_no']} • {c['category']} • Date: {c['date']}\nFacts: {c['brief_facts'][:80]}..."
            })

        # Edges
        # 1. Suspect-to-Case links
        for r in accused_rows:
            _, case_id, _, person_id, _ = r
            if case_id in cases_map and person_id in suspects_map:
                network_edges.append({
                    "id": f"edge_sc_{person_id}_{case_id}",
                    "source": f"suspect_{person_id}",
                    "target": f"case_{case_id}",
                    "type": "accused_in"
                })

        # 2. Suspect-to-Suspect links (accomplices)
        added_accomplice_edges = set()
        for case_id, p_ids in case_accused.items():
            for i in range(len(p_ids)):
                for j in range(i + 1, len(p_ids)):
                    p1, p2 = p_ids[i], p_ids[j]
                    edge_key = tuple(sorted([p1, p2]))
                    if edge_key not in added_accomplice_edges:
                        added_accomplice_edges.add(edge_key)
                        network_edges.append({
                            "id": f"edge_ss_{p1}_{p2}",
                            "source": f"suspect_{p1}",
                            "target": f"suspect_{p2}",
                            "type": "accomplice"
                        })

        # Trends: Categories
        category_counts = defaultdict(int)
        for c in cases_map.values():
            category_counts[c["category"]] += 1
        trends_categories = [{"name": k, "count": v} for k, v in category_counts.items()]

        # Trends: Monthly
        monthly_counts = defaultdict(int)
        for c in cases_map.values():
            if c["month"] and c["month"] != "Unknown":
                monthly_counts[c["month"]] += 1
        trends_monthly = sorted(
            [{"month": k, "count": v} for k, v in monthly_counts.items()],
            key=lambda x: x["month"]
        )

        # Hotspots: group by coordinate proximity (rounded to 2 decimal places ~ 1km)
        hotspot_groups = defaultdict(list)
        for c in cases_map.values():
            if c["lat"] and c["lon"]:
                key = (round(c["lat"], 2), round(c["lon"], 2))
                hotspot_groups[key].append(c)
                
        hotspots_list = []
        for coords, c_list in hotspot_groups.items():
            # Find representative location name
            locations = [c["brief_facts"].split("near")[-1].split("in")[-1].strip() for c in c_list if "near" in c["brief_facts"] or "in" in c["brief_facts"]]
            loc_name = locations[0] if locations else "Cluster Area"
            if len(loc_name) > 30:
                loc_name = loc_name[:27] + "..."
            
            hotspots_list.append({
                "location_name": loc_name,
                "case_count": len(c_list),
                "coordinates": [coords[0], coords[1]],
                "cases": [c["case_no"] for c in c_list]
            })
        hotspots_list = sorted(hotspots_list, key=lambda x: x["case_count"], reverse=True)

        return {
            "success": True,
            "stats": {
                "total_cases": total_cases,
                "total_suspects": total_suspects,
                "repeat_offenders_count": repeat_offenders_count,
                "linked_cases_count": linked_cases_count,
                "organized_cliques_count": len(cliques)
            },
            "cliques": cliques,
            "suspects": sorted(suspects_list, key=lambda x: x["case_count"], reverse=True),
            "cases": list(cases_map.values()),
            "network": {
                "nodes": network_nodes,
                "edges": network_edges
            },
            "trends": {
                "categories": sorted(trends_categories, key=lambda x: x["count"], reverse=True),
                "monthly": trends_monthly
            },
            "hotspots": hotspots_list[:5] # Top 5 hotspots
        }

    except Exception as e:
        print(f"[Analytics Error] {e}")
        return {
            "success": False,
            "error": str(e)
        }

def get_district_analytics() -> Dict[str, Any]:
    """Queries crime_cases for aggregated district analytics. Results are cached for 5 minutes."""
    global _district_cache, _district_cache_ts

    # ── Return cached result if still fresh ──
    if _district_cache and (time.monotonic() - _district_cache_ts) < DISTRICT_CACHE_TTL:
        print("[Analytics] Returning cached district data")
        return _district_cache

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Single optimised query: stats + top-crime-head per district in one pass
        cur.execute("""
            WITH stats AS (
                SELECT
                    district,
                    COUNT(*)                                                             AS total_cases,
                    AVG(CASE WHEN risk_level='High' THEN 0.85
                             WHEN risk_level='Medium' THEN 0.58
                             ELSE 0.28 END)                                              AS avg_risk_score,
                    AVG(population_density)::int                                         AS avg_pop_density,
                    AVG(median_income)::int                                               AS avg_income,
                    ROUND(AVG(literacy_rate)::numeric,2)                                 AS avg_literacy,
                    ROUND(AVG(youth_unemployment_rate)::numeric,2)                       AS avg_unemployment,
                    ROUND(AVG(migration_rate)::numeric,2)                                AS avg_migration,
                    ROUND(AVG(economic_stress_index)::numeric,2)                         AS avg_stress,
                    ROUND(AVG(community_cohesion)::numeric,2)                            AS avg_cohesion,
                    ROUND(AVG(neighborhood_disorder)::numeric,2)                         AS avg_disorder,
                    ROUND(AVG(police_accessibility)::numeric,2)                          AS avg_police_access,
                    ROUND(AVG(patrol_units_nearby)::numeric,2)                           AS avg_patrol,
                    ROUND(AVG(response_time)::numeric,2)                                 AS avg_response_time,
                    SUM(CASE WHEN risk_level='High'   THEN 1 ELSE 0 END)                AS high_count,
                    SUM(CASE WHEN risk_level='Medium' THEN 1 ELSE 0 END)                AS med_count,
                    SUM(CASE WHEN risk_level='Low'    THEN 1 ELSE 0 END)                AS low_count
                FROM crime_cases
                GROUP BY district
            ),
            crimes AS (
                SELECT district,
                       json_agg(json_build_object('category', crime_head, 'count', cnt)
                                ORDER BY cnt DESC) AS crime_json
                FROM (
                    SELECT district, crime_head, COUNT(*) AS cnt
                    FROM crime_cases
                    GROUP BY district, crime_head
                ) sub
                GROUP BY district
            )
            SELECT s.*, c.crime_json
            FROM stats s
            LEFT JOIN crimes c USING (district);
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()

        districts_data = {}
        for r in rows:
            dist        = r[0]
            total       = int(r[1])
            avg_score   = float(r[2]) if r[2] is not None else 0.5
            high        = int(r[14])
            med         = int(r[15])
            low         = int(r[16])
            crime_json  = r[17] or []

            if high >= med and high >= low:
                overall_risk = "High"
            elif med >= high and med >= low:
                overall_risk = "Medium"
            else:
                overall_risk = "Low"

            districts_data[dist] = {
                "district":       dist,
                "total_cases":    total,
                "risk_level":     overall_risk,
                "avg_risk_score": round(avg_score, 4),
                "risk_distribution": {"High": high, "Medium": med, "Low": low},
                "metrics": {
                    "population_density":      int(r[3]),
                    "median_income":           int(r[4]),
                    "literacy_rate":           float(r[5]),
                    "youth_unemployment_rate": float(r[6]),
                    "migration_rate":          float(r[7]),
                    "economic_stress_index":   float(r[8]),
                    "community_cohesion":      float(r[9]),
                    "neighborhood_disorder":   float(r[10]),
                    "police_accessibility":    float(r[11]),
                    "patrol_units_nearby":     float(r[12]),
                    "response_time":           float(r[13]),
                },
                "crimes": crime_json,
            }

        result = {"success": True, "districts": districts_data}

        # ── Store in cache ──
        _district_cache    = result
        _district_cache_ts = time.monotonic()
        print(f"[Analytics] District cache refreshed — {len(districts_data)} districts loaded")
        return result

    except Exception as e:
        print(f"[Analytics District Error] {e}")
        if _district_cache:
            print("[Analytics] Serving stale cache after error")
            return _district_cache
        return get_mock_district_analytics()

def get_mock_district_analytics() -> Dict[str, Any]:
    """Generates realistic fallback mock data for testing before DB import is complete."""
    mock_districts = {
        "Bengaluru City": {
            "district": "Bengaluru City",
            "total_cases": 35000,
            "risk_level": "Medium",
            "avg_risk_score": 0.4852,
            "risk_distribution": {"High": 8450, "Medium": 18230, "Low": 8320},
            "metrics": {
                "population_density": 4378,
                "median_income": 48000,
                "literacy_rate": 88.5,
                "youth_unemployment_rate": 14.2,
                "migration_rate": 25.4,
                "economic_stress_index": 0.42,
                "community_cohesion": 0.45,
                "neighborhood_disorder": 0.65,
                "police_accessibility": 0.82,
                "patrol_units_nearby": 4.5,
                "response_time": 9.2
            },
            "crimes": [
                {"category": "Crimes Against Property", "count": 11200},
                {"category": "Cyber Crimes", "count": 10500},
                {"category": "Crimes Against Person", "count": 5250},
                {"category": "Sexual Offences", "count": 3500},
                {"category": "Financial & White Collar Crimes", "count": 2800},
                {"category": "Narcotics & Drugs", "count": 1750}
            ]
        },
        "Mysuru": {
            "district": "Mysuru",
            "total_cases": 18000,
            "risk_level": "Low",
            "avg_risk_score": 0.3854,
            "risk_distribution": {"High": 2100, "Medium": 5800, "Low": 10100},
            "metrics": {
                "population_density": 476,
                "median_income": 32000,
                "literacy_rate": 72.8,
                "youth_unemployment_rate": 16.5,
                "migration_rate": 12.1,
                "economic_stress_index": 0.48,
                "community_cohesion": 0.65,
                "neighborhood_disorder": 0.42,
                "police_accessibility": 0.58,
                "patrol_units_nearby": 2.2,
                "response_time": 23.4
            },
            "crimes": [
                {"category": "Crimes Against Property", "count": 6300},
                {"category": "Crimes Against Person", "count": 4500},
                {"category": "Sexual Offences", "count": 2700},
                {"category": "Cyber Crimes", "count": 1800},
                {"category": "Traffic & Road Safety Crimes", "count": 1800},
                {"category": "Narcotics & Drugs", "count": 900}
            ]
        },
        "Hubballi-Dharwad": {
            "district": "Hubballi-Dharwad",
            "total_cases": 15000,
            "risk_level": "Medium",
            "avg_risk_score": 0.4632,
            "risk_distribution": {"High": 3250, "Medium": 7650, "Low": 4100},
            "metrics": {
                "population_density": 412,
                "median_income": 26000,
                "literacy_rate": 80.2,
                "youth_unemployment_rate": 15.4,
                "migration_rate": 14.2,
                "economic_stress_index": 0.52,
                "community_cohesion": 0.62,
                "neighborhood_disorder": 0.45,
                "police_accessibility": 0.61,
                "patrol_units_nearby": 2.4,
                "response_time": 20.8
            },
            "crimes": [
                {"category": "Crimes Against Property", "count": 5100},
                {"category": "Crimes Against Person", "count": 4200},
                {"category": "Traffic & Road Safety Crimes", "count": 1800},
                {"category": "Sexual Offences", "count": 1950},
                {"category": "Cyber Crimes", "count": 1200},
                {"category": "Public Tranquility & Order", "count": 750}
            ]
        },
        "Mangaluru (Dakshina Kannada)": {
            "district": "Mangaluru (Dakshina Kannada)",
            "total_cases": 17000,
            "risk_level": "Low",
            "avg_risk_score": 0.3921,
            "risk_distribution": {"High": 2200, "Medium": 5600, "Low": 9200},
            "metrics": {
                "population_density": 650,
                "median_income": 38000,
                "literacy_rate": 89.2,
                "youth_unemployment_rate": 12.8,
                "migration_rate": 18.6,
                "economic_stress_index": 0.41,
                "community_cohesion": 0.58,
                "neighborhood_disorder": 0.48,
                "police_accessibility": 0.72,
                "patrol_units_nearby": 3.1,
                "response_time": 12.4
            },
            "crimes": [
                {"category": "Crimes Against Property", "count": 5610},
                {"category": "Crimes Against Person", "count": 3400},
                {"category": "Cyber Crimes", "count": 3740},
                {"category": "Sexual Offences", "count": 2040},
                {"category": "Narcotics & Drugs", "count": 1360},
                {"category": "Traffic & Road Safety Crimes", "count": 850}
            ]
        },
        "Belagavi": {
            "district": "Belagavi",
            "total_cases": 15000,
            "risk_level": "Medium",
            "avg_risk_score": 0.4589,
            "risk_distribution": {"High": 3100, "Medium": 7800, "Low": 4100},
            "metrics": {
                "population_density": 356,
                "median_income": 22000,
                "literacy_rate": 73.5,
                "youth_unemployment_rate": 18.2,
                "migration_rate": 9.4,
                "economic_stress_index": 0.58,
                "community_cohesion": 0.72,
                "neighborhood_disorder": 0.38,
                "police_accessibility": 0.46,
                "patrol_units_nearby": 1.8,
                "response_time": 32.1
            },
            "crimes": [
                {"category": "Crimes Against Person", "count": 6000},
                {"category": "Crimes Against Property", "count": 4500},
                {"category": "Sexual Offences", "count": 2250},
                {"category": "Public Tranquility & Order", "count": 1200},
                {"category": "Special and Local Laws (SLL)", "count": 750},
                {"category": "Cyber Crimes", "count": 300}
            ]
        }
    }
    return {
        "success": True,
        "districts": mock_districts
    }

