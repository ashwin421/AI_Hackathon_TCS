"""
main.py — FastAPI backend for WorkAccess RMS with Copilot-like Chatbot
Run: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime, timedelta
import sqlite3, json, re, os, uuid
from contextlib import asynccontextmanager

# ─── Optional AI ────────────────────────────────────────────────────────────
try:
    import litellm, httpx
    from dotenv import load_dotenv
    load_dotenv()
    AI_KEY = os.getenv("GENAI_API_KEY", "")
    AI_BASE = os.getenv("GENAI_BASE_URL", "https://genailab.tcs.in/v1")
    AI_MODEL = os.getenv("GENAI_MODEL", "openai/genailab-maas-gpt-4o")
    if AI_KEY:
        litellm.client_session = httpx.Client(verify=False)
    AI_ENABLED = bool(AI_KEY)
except ImportError:
    AI_ENABLED = False
    print("⚠️ AI modules not installed. Chatbot will use rule-based responses.")

# ═══════════════════════════════════════════════════════════════════════════════
# APP SETUP
# ═══════════════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app):
    init_db()
    print("✅ WorkAccess RMS API started — http://localhost:8000")
    print("📚 Swagger docs — http://localhost:8000/docs")
    print(f"🤖 AI Chatbot: {'Enabled' if AI_ENABLED else 'Disabled (using rules)'}")
    yield

app = FastAPI(title="WorkAccess RMS API", version="2.0.0", lifespan=lifespan)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173", 
        "http://localhost:5174",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

DB = "workplace_rms.db"

# ──────────────────────────────────────────────────────────────────────────────
# PYDANTIC MODELS
# ──────────────────────────────────────────────────────────────────────────────

class ApprovalEntry(BaseModel):
    level: int
    role: str
    approverId: Optional[str] = None
    status: str
    comment: str = ""
    ts: str = ""

class HistoryEntry(BaseModel):
    action: str
    by: str
    ts: str
    note: str = ""

class Comment(BaseModel):
    id: str
    authorId: str
    author: str
    text: str
    ts: str

class RequestBody(BaseModel):
    id: str
    type: str
    title: str
    submitterId: str
    submitter: str
    dept: str
    priority: str
    status: str
    created: str
    updated: str
    requestedDate: str
    description: str
    assignedTo: str
    assignedDept: str
    eta: str
    progress: int
    requiresApproval: bool
    escalationDays: int
    approvalChain: List[ApprovalEntry] = []
    comments: List[Comment] = []
    history: List[HistoryEntry] = []

    class Config:
        schema_extra = {
            "example": {
                "id": "REQ-0006",
                "type": "System Access",
                "title": "Example Request",
                "submitterId": "u3",
                "submitter": "John Employee",
                "dept": "IT",
                "priority": "High",
                "status": "Submitted",
                "created": "2024-01-01",
                "updated": "2024-01-01",
                "requestedDate": "2024-01-05",
                "description": "Description here",
                "assignedTo": "IT Department",
                "assignedDept": "IT",
                "eta": "2024-01-04",
                "progress": 5,
                "requiresApproval": True,
                "escalationDays": 3,
                "approvalChain": [],
                "comments": [],
                "history": []
            }
        }

class LoginRequest(BaseModel):
    email: str
    password: str

class AIAnalyzeRequest(BaseModel):
    title: str
    description: str

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    request_context: Optional[dict] = None  # Current request being viewed

# ──────────────────────────────────────────────────────────────────────────────
# DATABASE SETUP
# ──────────────────────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id      TEXT PRIMARY KEY,
            name    TEXT NOT NULL,
            email   TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role    TEXT NOT NULL,
            dept    TEXT NOT NULL,
            avatar  TEXT NOT NULL
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS requests (
            id               TEXT PRIMARY KEY,
            type             TEXT NOT NULL,
            title            TEXT NOT NULL,
            submitter_id     TEXT NOT NULL,
            submitter        TEXT NOT NULL,
            dept             TEXT NOT NULL,
            priority         TEXT NOT NULL,
            status           TEXT NOT NULL,
            created          TEXT NOT NULL,
            updated          TEXT NOT NULL,
            requested_date   TEXT NOT NULL,
            description      TEXT NOT NULL,
            assigned_to      TEXT NOT NULL,
            assigned_dept    TEXT NOT NULL,
            eta              TEXT NOT NULL,
            progress         INTEGER NOT NULL DEFAULT 5,
            requires_approval INTEGER NOT NULL DEFAULT 0,
            escalation_days  INTEGER NOT NULL DEFAULT 3,
            approval_chain   TEXT NOT NULL DEFAULT '[]',
            comments         TEXT NOT NULL DEFAULT '[]',
            history          TEXT NOT NULL DEFAULT '[]'
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id       TEXT PRIMARY KEY,
            user_id  TEXT,
            msg      TEXT NOT NULL,
            ts       TEXT NOT NULL,
            is_read  INTEGER NOT NULL DEFAULT 0
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            message     TEXT NOT NULL,
            response    TEXT NOT NULL,
            timestamp   TEXT NOT NULL,
            context     TEXT
        )
    """)

    conn.commit()
    conn.close()
    _seed_users()
    _seed_requests()

def _seed_users():
    users = [
        ("u1", "Admin User", "admin@company.com", "admin123", "Admin", "IT", "AU"),
        ("u2", "Sarah Manager", "manager@company.com", "manager123", "Manager", "Operations", "SM"),
        ("u3", "John Employee", "employee@company.com", "emp123", "Employee", "Finance", "JE"),
        ("u4", "IT Staff", "itstaff@company.com", "staff123", "Staff", "IT", "IS"),
        ("u5", "HR Staff", "hrstaff@company.com", "hrstaff123", "Staff", "HR", "HS"),
    ]
    conn = get_db()
    for u in users:
        conn.execute(
            "INSERT OR IGNORE INTO users (id,name,email,password,role,dept,avatar) VALUES (?,?,?,?,?,?,?)", u
        )
    conn.commit()
    conn.close()

def _seed_requests():
    samples = [
        {
            "id": "REQ-0001", "type": "System Access",
            "title": "Admin access to CRM system",
            "submitterId": "u3", "submitter": "John Employee", "dept": "Finance",
            "priority": "High", "status": "Under Review",
            "created": "2026-02-25", "updated": "2026-02-26", "requestedDate": "2026-03-01",
            "description": "Need admin access to manage customer records and run analytics reports.",
            "assignedTo": "IT Department", "assignedDept": "IT",
            "eta": "2026-03-04", "progress": 35, "requiresApproval": True, "escalationDays": 3,
            "approvalChain": [
                {"level": 1, "role": "Manager", "approverId": None, "status": "Pending", "comment": "", "ts": ""},
                {"level": 2, "role": "Admin", "approverId": None, "status": "Pending", "comment": "", "ts": ""},
            ],
            "comments": [],
            "history": [
                {"action": "Submitted", "by": "John Employee", "ts": "2026-02-25", "note": ""},
                {"action": "Under Review", "by": "IT Department", "ts": "2026-02-26", "note": ""},
            ],
        },
        {
            "id": "REQ-0002", "type": "Equipment Request",
            "title": "Laptop replacement - broken screen",
            "submitterId": "u3", "submitter": "John Employee", "dept": "Finance",
            "priority": "High", "status": "Approved",
            "created": "2026-02-26", "updated": "2026-02-27", "requestedDate": "2026-03-01",
            "description": "Laptop screen cracked and unusable. Need urgent replacement.",
            "assignedTo": "Procurement", "assignedDept": "IT",
            "eta": "2026-03-02", "progress": 65, "requiresApproval": True, "escalationDays": 3,
            "approvalChain": [
                {"level": 1, "role": "Manager", "approverId": "u2", "status": "Approved", "comment": "Approved urgently.", "ts": "2026-02-27"},
                {"level": 2, "role": "Admin", "approverId": "u1", "status": "Approved", "comment": "", "ts": "2026-02-27"},
            ],
            "comments": [],
            "history": [
                {"action": "Submitted", "by": "John Employee", "ts": "2026-02-26", "note": ""},
                {"action": "Under Review", "by": "Procurement", "ts": "2026-02-26", "note": ""},
                {"action": "Approved", "by": "Sarah Manager", "ts": "2026-02-27", "note": "Approved urgently."},
            ],
        },
        {
            "id": "REQ-0003", "type": "Facility Request",
            "title": "Conference room booking - weekly standup",
            "submitterId": "u3", "submitter": "John Employee", "dept": "Operations",
            "priority": "Medium", "status": "Submitted",
            "created": "2026-03-01", "updated": "2026-03-01", "requestedDate": "2026-03-05",
            "description": "Need conference room B every Monday 10-11am for weekly team standup.",
            "assignedTo": "Facilities Management", "assignedDept": "Facilities",
            "eta": "2026-03-04", "progress": 10, "requiresApproval": False, "escalationDays": 2,
            "approvalChain": [], "comments": [],
            "history": [{"action": "Submitted", "by": "John Employee", "ts": "2026-03-01", "note": ""}],
        },
        {
            "id": "REQ-0004", "type": "General Service",
            "title": "Seating change - move to open floor",
            "submitterId": "u2", "submitter": "Sarah Manager", "dept": "HR",
            "priority": "Low", "status": "Fulfilled",
            "created": "2026-02-20", "updated": "2026-02-28", "requestedDate": "2026-03-01",
            "description": "Move my workstation to open collaboration area on floor 3.",
            "assignedTo": "HR Department", "assignedDept": "HR",
            "eta": "2026-02-28", "progress": 100, "requiresApproval": False, "escalationDays": 4,
            "approvalChain": [],
            "comments": [{"id": "c1", "authorId": "u1", "author": "Admin User",
                          "text": "Move completed. Please confirm with facilities.", "ts": "2026-02-28"}],
            "history": [
                {"action": "Submitted", "by": "Sarah Manager", "ts": "2026-02-20", "note": ""},
                {"action": "Under Review", "by": "HR Department", "ts": "2026-02-21", "note": ""},
                {"action": "Fulfilled", "by": "HR Staff", "ts": "2026-02-28", "note": "Seating move completed."},
            ],
        },
        {
            "id": "REQ-0005", "type": "System Access",
            "title": "Read-only DB access for analytics",
            "submitterId": "u3", "submitter": "John Employee", "dept": "Analytics",
            "priority": "Low", "status": "Closed",
            "created": "2026-02-10", "updated": "2026-02-15", "requestedDate": "2026-02-14",
            "description": "Need read-only access to production database for monthly reporting.",
            "assignedTo": "IT Department", "assignedDept": "IT",
            "eta": "2026-02-14", "progress": 100, "requiresApproval": True, "escalationDays": 3,
            "approvalChain": [
                {"level": 1, "role": "Manager", "approverId": "u2", "status": "Approved", "comment": "", "ts": "2026-02-11"},
                {"level": 2, "role": "Admin", "approverId": "u1", "status": "Approved", "comment": "", "ts": "2026-02-11"},
            ],
            "comments": [],
            "history": [
                {"action": "Submitted", "by": "John Employee", "ts": "2026-02-10", "note": ""},
                {"action": "Approved", "by": "Admin User", "ts": "2026-02-11", "note": ""},
                {"action": "Fulfilled", "by": "IT Staff", "ts": "2026-02-14", "note": "Access granted."},
                {"action": "Closed", "by": "Admin User", "ts": "2026-02-15", "note": ""},
            ],
        },
    ]
    conn = get_db()
    for r in samples:
        existing = conn.execute("SELECT id FROM requests WHERE id=?", (r["id"],)).fetchone()
        if not existing:
            _insert_request(conn, r)
    conn.commit()
    conn.close()

def _insert_request(conn, r: dict):
    conn.execute("""
        INSERT INTO requests (
            id, type, title, submitter_id, submitter, dept,
            priority, status, created, updated, requested_date,
            description, assigned_to, assigned_dept, eta, progress,
            requires_approval, escalation_days,
            approval_chain, comments, history
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        r["id"], r["type"], r["title"],
        r["submitterId"], r["submitter"], r["dept"],
        r["priority"], r["status"],
        r["created"], r["updated"], r["requestedDate"],
        r["description"], r["assignedTo"], r["assignedDept"],
        r["eta"], r["progress"],
        1 if r.get("requiresApproval") else 0,
        r.get("escalationDays", 3),
        json.dumps(r.get("approvalChain", [])),
        json.dumps(r.get("comments", [])),
        json.dumps(r.get("history", [])),
    ))

def _row_to_dict(row) -> dict:
    d = dict(row)
    return {
        "id": d["id"],
        "type": d["type"],
        "title": d["title"],
        "submitterId": d["submitter_id"],
        "submitter": d["submitter"],
        "dept": d["dept"],
        "priority": d["priority"],
        "status": d["status"],
        "created": d["created"],
        "updated": d["updated"],
        "requestedDate": d["requested_date"],
        "description": d["description"],
        "assignedTo": d["assigned_to"],
        "assignedDept": d["assigned_dept"],
        "eta": d["eta"],
        "progress": d["progress"],
        "requiresApproval": bool(d["requires_approval"]),
        "escalationDays": d["escalation_days"],
        "approvalChain": json.loads(d["approval_chain"]),
        "comments": json.loads(d["comments"]),
        "history": json.loads(d["history"]),
    }

def _update_request_in_db(conn, r: dict):
    conn.execute("""
        UPDATE requests SET
            type=?, title=?, submitter_id=?, submitter=?, dept=?,
            priority=?, status=?, created=?, updated=?, requested_date=?,
            description=?, assigned_to=?, assigned_dept=?, eta=?, progress=?,
            requires_approval=?, escalation_days=?,
            approval_chain=?, comments=?, history=?
        WHERE id=?
    """, (
        r["type"], r["title"],
        r["submitterId"], r["submitter"], r["dept"],
        r["priority"], r["status"],
        r["created"], r["updated"], r["requestedDate"],
        r["description"], r["assignedTo"], r["assignedDept"],
        r["eta"], r["progress"],
        1 if r.get("requiresApproval") else 0,
        r.get("escalationDays", 3),
        json.dumps(r.get("approvalChain", [])),
        json.dumps(r.get("comments", [])),
        json.dumps(r.get("history", [])),
        r["id"],
    ))

# ──────────────────────────────────────────────────────────────────────────────
# AUTHENTICATION
# ──────────────────────────────────────────────────────────────────────────────

_sessions: dict[str, str] = {}

def _make_token(user_id: str) -> str:
    token = str(uuid.uuid4())
    _sessions[token] = user_id
    return token

def _get_current_user(authorization: str = Header(default="")) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.replace("Bearer ", "").strip()
    user_id = _sessions.get(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    conn = get_db()
    row = conn.execute(
        "SELECT id,name,email,role,dept,avatar FROM users WHERE id=?", (user_id,)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="User not found")
    return dict(row)

# ═══════════════════════════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/auth/login")
async def login(body: LoginRequest):
    try:
        conn = get_db()
        row = conn.execute(
            "SELECT id,name,email,role,dept,avatar FROM users WHERE email=? AND password=?",
            (body.email, body.password)
        ).fetchone()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        
        user = dict(row)
        token = _make_token(user["id"])
        
        return JSONResponse(
            content={"user": user, "token": token},
            status_code=200
        )
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/auth/logout")
async def logout(authorization: str = Header(default="")):
    token = authorization.replace("Bearer ", "").strip()
    _sessions.pop(token, None)
    return {"success": True}

@app.get("/auth/me")
async def me(current_user: dict = Depends(_get_current_user)):
    return current_user

# ═══════════════════════════════════════════════════════════════════════════════
# USERS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/users")
async def get_users(current_user: dict = Depends(_get_current_user)):
    conn = get_db()
    rows = conn.execute("SELECT id,name,email,role,dept,avatar FROM users").fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ═══════════════════════════════════════════════════════════════════════════════
# REQUESTS - FIXED ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/requests")
async def list_requests(
    submitter_id: Optional[str] = None,
    assigned_dept: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(_get_current_user),
):
    try:
        conn = get_db()
        sql = "SELECT * FROM requests WHERE 1=1"
        params = []

        if submitter_id:
            sql += " AND submitter_id=?"
            params.append(submitter_id)
        if assigned_dept:
            sql += " AND assigned_dept=?"
            params.append(assigned_dept)
        if type and type != "All":
            sql += " AND type=?"
            params.append(type)
        if status and status != "All":
            sql += " AND status=?"
            params.append(status)
        if priority and priority != "All":
            sql += " AND priority=?"
            params.append(priority)
        if date_from:
            sql += " AND created>=?"
            params.append(date_from)
        if date_to:
            sql += " AND created<=?"
            params.append(date_to)
        if search:
            s = f"%{search}%"
            sql += " AND (title LIKE ? OR id LIKE ? OR submitter LIKE ? OR dept LIKE ?)"
            params.extend([s, s, s, s])

        sql += " ORDER BY created DESC"
        rows = conn.execute(sql, params).fetchall()
        conn.close()
        return [_row_to_dict(r) for r in rows]
    except Exception as e:
        print(f"Error listing requests: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch requests")

@app.get("/requests/{req_id}")
async def get_request(req_id: str, current_user: dict = Depends(_get_current_user)):
    conn = get_db()
    row = conn.execute("SELECT * FROM requests WHERE id=?", (req_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail=f"Request {req_id} not found")
    return _row_to_dict(row)

@app.post("/requests", status_code=201)
async def create_request(body: RequestBody, current_user: dict = Depends(_get_current_user)):
    try:
        conn = get_db()
        # Check if ID already exists
        existing = conn.execute("SELECT id FROM requests WHERE id=?", (body.id,)).fetchone()
        if existing:
            conn.close()
            raise HTTPException(status_code=409, detail=f"Request {body.id} already exists")
        
        # Convert Pydantic model to dict
        r = body.dict()
        
        # Insert into database
        _insert_request(conn, r)
        conn.commit()
        conn.close()
        
        # Create notification
        _save_notification(
            f"notif_{body.id}_created",
            None,
            f"📨 {body.id} submitted — \"{body.title}\" routed to {body.assignedTo}",
            body.created,
        )
        
        return JSONResponse(content=r, status_code=201)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating request: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create request: {str(e)}")

@app.put("/requests/{req_id}")
async def update_request(
    req_id: str,
    body: RequestBody,
    current_user: dict = Depends(_get_current_user),
):
    try:
        conn = get_db()
        existing = conn.execute("SELECT id FROM requests WHERE id=?", (req_id,)).fetchone()
        if not existing:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Request {req_id} not found")
        
        if body.id != req_id:
            conn.close()
            raise HTTPException(status_code=400, detail="ID in URL and body must match")
        
        r = body.dict()
        _update_request_in_db(conn, r)
        conn.commit()
        conn.close()
        
        _auto_notify(r)
        return r
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating request: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update request: {str(e)}")

@app.delete("/requests/{req_id}", status_code=204)
async def delete_request(req_id: str, current_user: dict = Depends(_get_current_user)):
    if current_user["role"] != "Admin":
        raise HTTPException(status_code=403, detail="Admin only")
    conn = get_db()
    conn.execute("DELETE FROM requests WHERE id=?", (req_id,))
    conn.commit()
    conn.close()

# ═══════════════════════════════════════════════════════════════════════════════
# REQUEST ID GENERATOR - FIXED
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/requests/next-id")
async def next_request_id(current_user: dict = Depends(_get_current_user)):
    try:
        conn = get_db()
        # Get all request IDs and find the max number
        rows = conn.execute("SELECT id FROM requests").fetchall()
        conn.close()

        max_num = 0
        for row in rows:
            id_str = row["id"]
            if id_str.startswith("REQ-"):
                try:
                    num = int(id_str[4:])
                    if num > max_num:
                        max_num = num
                except ValueError:
                    continue

        next_num = max_num + 1
        new_id = f"REQ-{str(next_num).zfill(4)}"
        print(f"Generated next ID: {new_id}")
        return {"id": new_id}
    except Exception as e:
        print(f"Error generating next ID: {e}")
        # Fallback to timestamp-based ID
        fallback_id = f"REQ-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        return {"id": fallback_id}

# ═══════════════════════════════════════════════════════════════════════════════
# NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _save_notification(notif_id: str, user_id: Optional[str], msg: str, ts: str):
    try:
        conn = get_db()
        conn.execute(
            "INSERT OR IGNORE INTO notifications (id,user_id,msg,ts,is_read) VALUES (?,?,?,?,0)",
            (notif_id, user_id, msg, ts)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error saving notification: {e}")

def _auto_notify(r: dict):
    msg_map = {
        "Approved": f"✅ {r['id']} approved! Email sent to {r['submitter']}",
        "Rejected": f"❌ {r['id']} rejected. Email sent to {r['submitter']}",
        "Fulfilled": f"🎉 {r['id']} fulfilled! Email sent to {r['submitter']}",
        "Closed": f"🔒 {r['id']} closed.",
    }
    if r["status"] in msg_map:
        _save_notification(
            f"notif_{r['id']}_{r['status'].lower()}",
            None,
            msg_map[r["status"]],
            r["updated"],
        )

@app.get("/notifications")
async def get_notifications(current_user: dict = Depends(_get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM notifications ORDER BY ts DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return [
        {"id": r["id"], "msg": r["msg"], "ts": r["ts"], "read": bool(r["is_read"])}
        for r in rows
    ]

@app.post("/notifications")
async def create_notification_endpoint(
    body: dict,
    current_user: dict = Depends(_get_current_user),
):
    _save_notification(
        body.get("id", str(uuid.uuid4())),
        None,
        body["msg"],
        body["ts"],
    )
    return {"success": True}

@app.put("/notifications/read-all")
async def mark_all_read(current_user: dict = Depends(_get_current_user)):
    conn = get_db()
    conn.execute("UPDATE notifications SET is_read=1")
    conn.commit()
    conn.close()
    return {"success": True}

# ═══════════════════════════════════════════════════════════════════════════════
# AI ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

_REQUEST_TYPE_CONFIG = {
    "System Access": {"assignedTo": "IT Department", "assignedDept": "IT", "requiresApproval": True, "turnaround": {"High": 3, "Medium": 7, "Low": 14}, "escalationDays": 3},
    "Equipment Request": {"assignedTo": "Procurement", "assignedDept": "IT", "requiresApproval": True, "turnaround": {"High": 2, "Medium": 5, "Low": 10}, "escalationDays": 3},
    "Facility Request": {"assignedTo": "Facilities Management", "assignedDept": "Facilities", "requiresApproval": False, "turnaround": {"High": 1, "Medium": 3, "Low": 7}, "escalationDays": 2},
    "General Service": {"assignedTo": "HR Department", "assignedDept": "HR", "requiresApproval": False, "turnaround": {"High": 2, "Medium": 5, "Low": 10}, "escalationDays": 4},
}

def _local_categorize(title: str, desc: str) -> Optional[str]:
    t = (title + " " + desc).lower()
    if re.search(r"access|permission|login|account|password|admin|role|software|license|system", t):
        return "System Access"
    if re.search(r"laptop|computer|phone|equipment|device|monitor|keyboard|mouse|server|hardware|printer|headset|id card", t):
        return "Equipment Request"
    if re.search(r"room|parking|visitor|pass|building|facility|space|floor|maintenance|booking", t):
        return "Facility Request"
    if re.search(r"seat|desk|workplace|change|support|issue|basic", t):
        return "General Service"
    return None

def _local_priority(req_type: Optional[str], desc: str) -> str:
    rules = {
        "System Access": {"high": ["admin", "critical", "urgent", "root"], "low": ["view", "read", "basic"]},
        "Equipment Request": {"high": ["broken", "urgent", "damaged", "replacement"], "low": ["cable", "mouse", "accessory"]},
        "Facility Request": {"high": ["emergency", "urgent", "today"], "low": ["routine", "next week"]},
        "General Service": {"high": ["urgent", "critical", "immediately"], "low": ["minor", "whenever"]},
    }
    if not req_type or req_type not in rules:
        return "Medium"
    r = rules[req_type]
    t = desc.lower()
    for k in r["high"]:
        if k in t:
            return "High"
    for k in r["low"]:
        if k in t:
            return "Low"
    return "Medium"

def _calc_eta(req_type: Optional[str], priority: str) -> str:
    days = 7
    if req_type and req_type in _REQUEST_TYPE_CONFIG:
        days = _REQUEST_TYPE_CONFIG[req_type]["turnaround"].get(priority, 7)
    return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")

@app.post("/ai/analyze")
async def ai_analyze(body: AIAnalyzeRequest, current_user: dict = Depends(_get_current_user)):
    try:
        title = body.title
        desc = body.description

        if AI_ENABLED:
            try:
                prompt = f"""You are a workplace IT assistant. Analyze this service request and respond ONLY with a JSON object.

Title: {title}
Description: {desc}

Respond with exactly:
{{
  "type": "<System Access | Equipment Request | Facility Request | General Service>",
  "priority": "<High | Medium | Low>"
}}"""
                response = litellm.completion(
                    model=AI_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    api_key=AI_KEY,
                    base_url=AI_BASE,
                    temperature=0.1,
                    max_tokens=150
                )
                raw = response.choices[0].message.content.strip()
                raw = re.sub(r"```[a-z]*", "", raw).replace("```", "").strip()
                parsed = json.loads(raw)
                req_type = parsed.get("type")
                priority = parsed.get("priority", "Medium")
            except Exception as e:
                print(f"⚠️ AI call failed: {e}")
                req_type = _local_categorize(title, desc)
                priority = _local_priority(req_type, desc)
        else:
            req_type = _local_categorize(title, desc)
            priority = _local_priority(req_type, desc)

        routing = _REQUEST_TYPE_CONFIG.get(req_type, {}).get("assignedTo", "General Admin") if req_type else "General Admin"
        eta = _calc_eta(req_type, priority)

        return {
            "type": req_type,
            "priority": priority,
            "routing": routing,
            "eta": eta,
        }
    except Exception as e:
        print(f"AI analyze error: {e}")
        raise HTTPException(status_code=500, detail="AI analysis failed")

# ═══════════════════════════════════════════════════════════════════════════════
# CHATBOT ENDPOINT - Copilot-like Feature
# ═══════════════════════════════════════════════════════════════════════════════

def _get_rule_based_response(message: str, user: dict, context: Optional[dict] = None) -> str:
    """Generate rule-based responses when AI is not available"""
    message_lower = message.lower()
    
    # Help with requests
    if "how to" in message_lower or "create" in message_lower and "request" in message_lower:
        return "To create a new request, click the 'New Request' button in the top right corner. You'll go through a 3-step process to provide details, select type and priority, and review before submitting."
    
    # Check status
    if "status" in message_lower or "where is" in message_lower or "my request" in message_lower:
        return "You can check your request status in the Dashboard or Request Register. Click on any request to see detailed progress including approval chain and history."
    
    # Approval help
    if "approve" in message_lower or "approval" in message_lower:
        if user["role"] in ["Manager", "Admin"]:
            return f"As a {user['role']}, you can approve requests that are 'Under Review'. Open a request and click the 'Approve' button in the actions panel."
        else:
            return "Approval requests are automatically routed to managers and admins based on the request type. You'll be notified when action is needed."
    
    # SLA questions
    if "sla" in message_lower or "how long" in message_lower or "eta" in message_lower:
        return "SLA (Service Level Agreement) times vary by request type:\n- System Access: 3-14 days\n- Equipment Request: 2-10 days\n- Facility Request: 1-7 days\n- General Service: 2-10 days\n\nHigh priority requests get faster turnaround."
    
    # Export help
    if "export" in message_lower or "download" in message_lower or "csv" in message_lower or "pdf" in message_lower:
        return "Admins and Managers can export requests as CSV or PDF using the buttons next to the notification bell in the header."
    
    # General help
    if "help" in message_lower or "what can you" in message_lower:
        return "I'm your WorkAccess RMS assistant! I can help you with:\n- Creating and tracking requests\n- Understanding approval workflows\n- Checking SLA timelines\n- Exporting reports\n- Navigating the system\n\nWhat would you like to know?"
    
    # Default response
    return f"Hi {user['name']}! I'm here to help with workplace requests. You can ask me about creating requests, checking status, approvals, SLA times, or exporting data. How can I assist you today?"

@app.post("/ai/chat")
async def ai_chat(request: ChatRequest, current_user: dict = Depends(_get_current_user)):
    """Chatbot endpoint - similar to Microsoft Copilot"""
    try:
        message = request.message
        history = request.history
        context = request.request_context
        
        # Save to chat history
        chat_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        # Try AI if enabled
        if AI_ENABLED:
            try:
                # Build context-aware system prompt
                system_prompt = f"""You are WorkAccess Copilot, an AI assistant for workplace request management. 
Current user: {current_user['name']} ({current_user['role']} in {current_user['dept']})
Today's date: {datetime.now().strftime('%Y-%m-%d')}

You help with:
- Creating and tracking workplace requests
- Understanding approval workflows
- SLA and turnaround times
- System navigation and features
- Request status and escalations

Be concise, professional, and helpful. If asked about specific requests, guide users to check their dashboard."""

                # Add request context if available
                if context:
                    system_prompt += f"\n\nCurrently viewing request: {context.get('id', 'Unknown')} - {context.get('title', '')}"

                # Build messages
                messages = [{"role": "system", "content": system_prompt}]
                
                # Add history
                for h in history[-5:]:  # Last 5 messages for context
                    messages.append({"role": h.role, "content": h.content})
                
                # Add current message
                messages.append({"role": "user", "content": message})

                response = litellm.completion(
                    model=AI_MODEL,
                    messages=messages,
                    api_key=AI_KEY,
                    base_url=AI_BASE,
                    temperature=0.7,
                    max_tokens=500
                )
                reply = response.choices[0].message.content
                
            except Exception as e:
                print(f"AI chat failed: {e}")
                reply = _get_rule_based_response(message, current_user, context)
        else:
            reply = _get_rule_based_response(message, current_user, context)
        
        # Save to database (optional)
        try:
            conn = get_db()
            conn.execute(
                "INSERT INTO chat_history (id, user_id, message, response, timestamp, context) VALUES (?, ?, ?, ?, ?, ?)",
                (chat_id, current_user["id"], message, reply, timestamp, json.dumps(context) if context else None)
            )
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error saving chat history: {e}")
        
        return {
            "reply": reply,
            "timestamp": timestamp,
            "suggestions": _get_suggestions(message, current_user)
        }
        
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _get_suggestions(message: str, user: dict) -> List[str]:
    """Get contextual suggestions based on user role and message"""
    suggestions = []
    
    if "request" in message.lower() or "create" in message.lower():
        suggestions = ["How do I create a new request?", "What types of requests are there?", "How long does approval take?"]
    elif "approve" in message.lower() or "pending" in message.lower():
        if user["role"] in ["Manager", "Admin"]:
            suggestions = ["Show pending approvals", "How to approve a request?", "What happens after approval?"]
    elif "status" in message.lower() or "track" in message.lower():
        suggestions = ["Check my request status", "What does 'Under Review' mean?", "Why is my request escalated?"]
    elif "sla" in message.lower() or "eta" in message.lower():
        suggestions = ["What are SLA times?", "Why is my request delayed?", "How to escalate?"]
    else:
        # Default suggestions based on role
        if user["role"] == "Admin":
            suggestions = ["Show all pending approvals", "Export reports", "System configuration"]
        elif user["role"] == "Manager":
            suggestions = ["Approve requests", "Team dashboard", "Department reports"]
        elif user["role"] == "Staff":
            suggestions = ["My assigned requests", "Fulfillment view", "Update request status"]
        else:  # Employee
            suggestions = ["My requests", "Create new request", "Request status"]
    
    return suggestions[:3]  # Return top 3 suggestions

@app.get("/ai/chat/history")
async def get_chat_history(current_user: dict = Depends(_get_current_user)):
    """Get user's chat history"""
    try:
        conn = get_db()
        rows = conn.execute(
            "SELECT message, response, timestamp FROM chat_history WHERE user_id=? ORDER BY timestamp DESC LIMIT 20",
            (current_user["id"],)
        ).fetchall()
        conn.close()
        
        return [
            {
                "message": r["message"],
                "response": r["response"],
                "timestamp": r["timestamp"]
            }
            for r in rows
        ]
    except Exception as e:
        print(f"Error fetching chat history: {e}")
        return []

# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/")
async def health():
    return {
        "status": "ok",
        "service": "WorkAccess RMS API",
        "ai_enabled": AI_ENABLED,
        "chatbot": "enabled",
        "docs": "/docs",
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}