"""
main.py — FastAPI backend for WorkAccess RMS
Integrates exactly with App.jsx:
  - Every JSON field name matches the React state objects
  - Every endpoint matches what the frontend needs to call
  - Auth uses the same 5 demo users as MOCK_USERS in App.jsx
  - Request shape mirrors INITIAL_REQUESTS exactly
Run:
    pip install fastapi uvicorn python-dotenv litellm httpx
    uvicorn main:app --reload --port 8000
Frontend must set:  const API = "http://localhost:8000"
"""

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import sqlite3, json, re, os, uuid
from contextlib import asynccontextmanager

# ─── Optional AI (graceful fallback if not configured) ────────────────────────
try:
    import litellm, httpx
    from dotenv import load_dotenv
    load_dotenv()
    AI_KEY  = os.getenv("GENAI_API_KEY", "")
    AI_BASE = os.getenv("GENAI_BASE_URL", "https://genailab.tcs.in/v1")
    AI_MODEL = os.getenv("GENAI_MODEL", "openai/genailab-maas-gpt-4o")
    if AI_KEY:
        litellm.client_session = httpx.Client(verify=False)
    AI_ENABLED = bool(AI_KEY)
except ImportError:
    AI_ENABLED = False


# ═══════════════════════════════════════════════════════════════════════════════
# APP SETUP
# ═══════════════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app):
    # Run initialization on application startup
    init_db()
    print("✅ WorkAccess RMS API started — http://localhost:8000")
    print("📚 Swagger docs  — http://localhost:8000/docs")
    yield

app = FastAPI(title="WorkAccess RMS API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB = "workplace_rms.db"

# Add to Pydantic models
class ChatRequest(BaseModel):
    message: str
    history: List[dict] = []

# Add this endpoint to the bottom of main.py
@app.post("/ai/chat")
async def ai_chat(req: ChatRequest, current_user: dict = Depends(_get_current_user)):
    """
    POST /ai/chat — Chat with the AI assistant about workplace requests.
    Uses the litellm configuration already defined in main.py.
    """
    if not AI_ENABLED:
        return {"reply": "AI is currently disabled in the backend configuration."}
    
    try:
        # System prompt defines the bot's persona and context
        messages = [
            {"role": "system", "content": f"You are the WorkAccess RMS AI Assistant. You help {current_user['name']} ({current_user['role']}) manage workplace requests, tracking, and fulfillment. Be professional and concise."}
        ] + req.history + [{"role": "user", "content": req.message}]

        response = litellm.completion(
            model=AI_MODEL,
            messages=messages,
            api_key=AI_KEY,
            base_url=AI_BASE
        )
        reply = response.choices[0].message.content
        return {"reply": reply}
    except Exception as e:
        # Graceful error handling for AI service issues
        raise HTTPException(status_code=500, detail=str(e))

# ═══════════════════════════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════════════════════════

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

    # Requests — searchable columns stored flat; nested arrays stored as JSON
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

    conn.commit()
    conn.close()
    _seed_users()
    _seed_requests()


# ─── Seed users — identical to App.jsx MOCK_USERS ────────────────────────────
def _seed_users():
    users = [
        ("u1", "Admin User",    "admin@company.com",    "admin123",    "Admin",    "IT",         "AU"),
        ("u2", "Sarah Manager", "manager@company.com",  "manager123",  "Manager",  "Operations", "SM"),
        ("u3", "John Employee", "employee@company.com", "emp123",      "Employee", "Finance",    "JE"),
        ("u4", "IT Staff",      "itstaff@company.com",  "staff123",    "Staff",    "IT",         "IS"),
        ("u5", "HR Staff",      "hrstaff@company.com",  "hrstaff123",  "Staff",    "HR",         "HS"),
    ]
    conn = get_db()
    for u in users:
        conn.execute(
            "INSERT OR IGNORE INTO users (id,name,email,password,role,dept,avatar) VALUES (?,?,?,?,?,?,?)", u
        )
    conn.commit()
    conn.close()


# ─── Seed requests — identical to App.jsx INITIAL_REQUESTS ───────────────────
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
                {"level": 2, "role": "Admin",   "approverId": None, "status": "Pending", "comment": "", "ts": ""},
            ],
            "comments": [],
            "history": [
                {"action": "Submitted",    "by": "John Employee", "ts": "2026-02-25", "note": ""},
                {"action": "Under Review", "by": "IT Department", "ts": "2026-02-26", "note": ""},
            ],
        },
        {
            "id": "REQ-0002", "type": "Equipment Request",
            "title": "Laptop replacement - broken screen",
            "submitterId": "u3", "submitter": "John Employee", "dept": "Finance",
            "priority": "High", "status": "Approved",
            "created": "2026-02-26", "updated": "2026-02-27", "requestedDate": "2026-03-01",
            "description": "Laptop screen cracked and unusable. Need urgent replacement to continue work.",
            "assignedTo": "Procurement", "assignedDept": "IT",
            "eta": "2026-03-02", "progress": 65, "requiresApproval": True, "escalationDays": 3,
            "approvalChain": [
                {"level": 1, "role": "Manager", "approverId": "u2", "status": "Approved", "comment": "Approved urgently.", "ts": "2026-02-27"},
                {"level": 2, "role": "Admin",   "approverId": "u1", "status": "Approved", "comment": "",                  "ts": "2026-02-27"},
            ],
            "comments": [],
            "history": [
                {"action": "Submitted",    "by": "John Employee",  "ts": "2026-02-26", "note": ""},
                {"action": "Under Review", "by": "Procurement",    "ts": "2026-02-26", "note": ""},
                {"action": "Approved",     "by": "Sarah Manager",  "ts": "2026-02-27", "note": "Approved urgently."},
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
            "description": "Request to move my workstation to the open collaboration area on floor 3.",
            "assignedTo": "HR Department", "assignedDept": "HR",
            "eta": "2026-02-28", "progress": 100, "requiresApproval": False, "escalationDays": 4,
            "approvalChain": [],
            "comments": [{"id": "c1", "authorId": "u1", "author": "Admin User",
                          "text": "Move completed. Please confirm with facilities.", "ts": "2026-02-28"}],
            "history": [
                {"action": "Submitted",    "by": "Sarah Manager", "ts": "2026-02-20", "note": ""},
                {"action": "Under Review", "by": "HR Department",  "ts": "2026-02-21", "note": ""},
                {"action": "Fulfilled",    "by": "HR Staff",       "ts": "2026-02-28", "note": "Seating move completed."},
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
                {"level": 2, "role": "Admin",   "approverId": "u1", "status": "Approved", "comment": "", "ts": "2026-02-11"},
            ],
            "comments": [],
            "history": [
                {"action": "Submitted",    "by": "John Employee", "ts": "2026-02-10", "note": ""},
                {"action": "Approved",     "by": "Admin User",    "ts": "2026-02-11", "note": ""},
                {"action": "Fulfilled",    "by": "IT Staff",      "ts": "2026-02-14", "note": "Access granted."},
                {"action": "Closed",       "by": "Admin User",    "ts": "2026-02-15", "note": ""},
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


# ─── DB helpers ───────────────────────────────────────────────────────────────

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
    """Convert a DB row → dict with exact field names App.jsx expects."""
    d = dict(row)
    return {
        "id":               d["id"],
        "type":             d["type"],
        "title":            d["title"],
        "submitterId":      d["submitter_id"],   # camelCase for React
        "submitter":        d["submitter"],
        "dept":             d["dept"],
        "priority":         d["priority"],
        "status":           d["status"],
        "created":          d["created"],
        "updated":          d["updated"],
        "requestedDate":    d["requested_date"],  # camelCase for React
        "description":      d["description"],
        "assignedTo":       d["assigned_to"],     # camelCase for React
        "assignedDept":     d["assigned_dept"],   # camelCase for React
        "eta":              d["eta"],
        "progress":         d["progress"],
        "requiresApproval": bool(d["requires_approval"]),  # bool for React
        "escalationDays":   d["escalation_days"],          # camelCase for React
        "approvalChain":    json.loads(d["approval_chain"]),
        "comments":         json.loads(d["comments"]),
        "history":          json.loads(d["history"]),
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


# ═══════════════════════════════════════════════════════════════════════════════
# PYDANTIC SCHEMAS  — field names mirror App.jsx objects exactly
# ═══════════════════════════════════════════════════════════════════════════════

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
    """Used for both POST /requests and PUT /requests/{id}.
    Mirrors the object that handleSubmit() and handleUpdate() produce."""
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


class LoginRequest(BaseModel):
    email: str
    password: str


class AIAnalyzeRequest(BaseModel):
    title: str
    description: str


# ─── Simple token store (in-memory; swap for JWT in production) ───────────────
_sessions: dict[str, dict] = {}   # token → user dict

def _make_token(user_id: str) -> str:
    token = str(uuid.uuid4())
    _sessions[token] = user_id
    return token

def _get_current_user(authorization: str = Header(default="")) -> dict:
    """Extract Bearer token and return the user dict, or raise 401."""
    token = authorization.replace("Bearer ", "").strip()
    user_id = _sessions.get(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
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
def login(body: LoginRequest):
    """
    Called when user clicks Sign In on LoginScreen.
    Returns the user object that App.jsx stores in useState(user).

    App.jsx usage:
        const res = await fetch(`${API}/auth/login`, {
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({ email, password })
        });
        const { user, token } = await res.json();
        // store token in localStorage, set user state
    """
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

    return {
        "user": user,    # exact shape of MOCK_USERS entries in App.jsx
        "token": token,
    }


@app.post("/auth/logout")
def logout(authorization: str = Header(default="")):
    """Invalidate session token."""
    token = authorization.replace("Bearer ", "").strip()
    _sessions.pop(token, None)
    return {"success": True}


@app.get("/auth/me")
def me(current_user: dict = Depends(_get_current_user)):
    """Return current user — useful to restore session on page reload."""
    return current_user


# ═══════════════════════════════════════════════════════════════════════════════
# USERS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/users")
def get_users(current_user: dict = Depends(_get_current_user)):
    """
    Returns all users — used by DetailPanel to resolve approverId → name
    in the approval chain (replacing the MOCK_USERS.find() calls).

    App.jsx usage:
        const users = await fetch(`${API}/users`, { headers }).then(r => r.json());
        // replace MOCK_USERS with this array
    """
    conn = get_db()
    rows = conn.execute("SELECT id,name,email,role,dept,avatar FROM users").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ═══════════════════════════════════════════════════════════════════════════════
# REQUESTS — core CRUD
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/requests")
def list_requests(
    # Role-based filtering
    submitter_id: Optional[str] = None,   # Employee: pass user.id
    assigned_dept: Optional[str] = None,  # Staff: pass user.dept
    # RegisterView filter bar
    type:          Optional[str] = None,
    status:        Optional[str] = None,
    priority:      Optional[str] = None,
    date_from:     Optional[str] = None,
    date_to:       Optional[str] = None,
    search:        Optional[str] = None,
    current_user: dict = Depends(_get_current_user),
):
    """
    GET /requests — returns the full requests array that App.jsx holds in
    useState(requests).  All filtering that App.jsx does client-side can
    alternatively be done here via query params.

    Role-based query params mirror App.jsx visibility rules:
      Employee → pass ?submitter_id={user.id}
      Staff    → pass ?assigned_dept={user.dept}
      Manager / Admin → no filter (see everything)

    App.jsx usage:
        // On login / mount:
        const role = user.role;
        const params = role === "Employee" ? `?submitter_id=${user.id}`
                     : role === "Staff"    ? `?assigned_dept=${user.dept}`
                     : "";
        const reqs = await fetch(`${API}/requests${params}`, { headers }).then(r=>r.json());
        setRequests(reqs);
    """
    conn = get_db()
    sql = "SELECT * FROM requests WHERE 1=1"
    params = []

    if submitter_id:
        sql += " AND submitter_id=?"; params.append(submitter_id)
    if assigned_dept:
        sql += " AND assigned_dept=?"; params.append(assigned_dept)
    if type and type != "All":
        sql += " AND type=?"; params.append(type)
    if status and status != "All":
        sql += " AND status=?"; params.append(status)
    if priority and priority != "All":
        sql += " AND priority=?"; params.append(priority)
    if date_from:
        sql += " AND created>=?"; params.append(date_from)
    if date_to:
        sql += " AND created<=?"; params.append(date_to)
    if search:
        s = f"%{search}%"
        sql += " AND (title LIKE ? OR id LIKE ? OR submitter LIKE ? OR dept LIKE ?)"
        params.extend([s, s, s, s])

    sql += " ORDER BY created DESC"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


@app.get("/requests/{req_id}")
def get_request(req_id: str, current_user: dict = Depends(_get_current_user)):
    """
    GET /requests/{id} — fetch a single request by ID.

    App.jsx usage:
        const req = await fetch(`${API}/requests/${id}`, { headers }).then(r=>r.json());
        setSelected(req);
    """
    conn = get_db()
    row = conn.execute("SELECT * FROM requests WHERE id=?", (req_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail=f"Request {req_id} not found")
    return _row_to_dict(row)


@app.post("/requests", status_code=201)
def create_request(body: RequestBody, current_user: dict = Depends(_get_current_user)):
    """
    POST /requests — create a new request.
    Called from handleSubmit() in App.jsx after NewRequestModal builds the
    full request object locally.  The body shape is exactly what
    NewRequestModal's handleSubmit() passes to onSubmit().

    App.jsx usage:
        // In handleSubmit (App component):
        const res = await fetch(`${API}/requests`, {
            method: "POST",
            headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
            body: JSON.stringify(req)    // full request object from modal
        });
        const saved = await res.json();
        setRequests(r => [saved, ...r]);
    """
    conn = get_db()

    # Guard: reject duplicate IDs
    if conn.execute("SELECT id FROM requests WHERE id=?", (body.id,)).fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail=f"Request {body.id} already exists")

    r = body.model_dump()
    _insert_request(conn, r)
    conn.commit()
    conn.close()

    # Persist notification
    _save_notification(
        f"notif_{body.id}_created",
        None,
        f"📨 {body.id} submitted — \"{body.title}\" routed to {body.assignedTo}",
        body.created,
    )

    return r   # return full request so React can setRequests([saved, ...r])


@app.put("/requests/{req_id}")
def update_request(
    req_id: str,
    body: RequestBody,
    current_user: dict = Depends(_get_current_user),
):
    """
    PUT /requests/{id} — full update of a request.
    Called from handleUpdate() in App.jsx.  The body is the complete updated
    request object (same shape as GET response), including the mutated
    approvalChain, comments, history, status, progress etc.

    This single endpoint handles ALL mutations from DetailPanel:
      • approve / reject (approvalChain + status change)
      • advance status
      • close request
      • save inline edits (title, description, priority)
      • add comment (comments array)

    App.jsx usage:
        // In handleUpdate (App component):
        await fetch(`${API}/requests/${req.id}`, {
            method: "PUT",
            headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
            body: JSON.stringify(req)    // full updated request object
        });
        setRequests(r => r.map(x => x.id===req.id ? req : x));
    """
    conn = get_db()
    if not conn.execute("SELECT id FROM requests WHERE id=?", (req_id,)).fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail=f"Request {req_id} not found")

    if body.id != req_id:
        conn.close()
        raise HTTPException(status_code=400, detail="ID in URL and body must match")

    r = body.model_dump()
    _update_request_in_db(conn, r)
    conn.commit()
    conn.close()

    # Auto-generate notifications for key status transitions
    _auto_notify(r)

    return r   # return updated request so React can update state


@app.delete("/requests/{req_id}", status_code=204)
def delete_request(req_id: str, current_user: dict = Depends(_get_current_user)):
    """
    DELETE /requests/{id} — admin only hard delete.
    App.jsx doesn't call this in the current version, but it's here for admin use.
    """
    if current_user["role"] != "Admin":
        raise HTTPException(status_code=403, detail="Admin only")
    conn = get_db()
    conn.execute("DELETE FROM requests WHERE id=?", (req_id,))
    conn.commit()
    conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
# NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _save_notification(notif_id: str, user_id: Optional[str], msg: str, ts: str):
    conn = get_db()
    conn.execute(
        "INSERT OR IGNORE INTO notifications (id,user_id,msg,ts,is_read) VALUES (?,?,?,?,0)",
        (notif_id, user_id, msg, ts)
    )
    conn.commit()
    conn.close()


def _auto_notify(r: dict):
    """Create a DB notification whenever a request reaches a key status."""
    msg_map = {
        "Approved":  f"✅ {r['id']} approved! Email sent to {r['submitter']}",
        "Rejected":  f"❌ {r['id']} rejected. Email sent to {r['submitter']}",
        "Fulfilled": f"🎉 {r['id']} fulfilled! Email sent to {r['submitter']}",
        "Closed":    f"🔒 {r['id']} closed.",
    }
    if r["status"] in msg_map:
        _save_notification(
            f"notif_{r['id']}_{r['status'].lower()}",
            None,
            msg_map[r["status"]],
            r["updated"],
        )


@app.get("/notifications")
def get_notifications(current_user: dict = Depends(_get_current_user)):
    """
    GET /notifications — returns the notifications array that App.jsx holds
    in useState(notifs).  Returns shape: [{id, msg, ts, read}, ...]

    App.jsx usage:
        const notifs = await fetch(`${API}/notifications`, { headers }).then(r=>r.json());
        setNotifs(notifs);
    """
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
def create_notification_endpoint(
    body: dict,
    current_user: dict = Depends(_get_current_user),
):
    """
    POST /notifications — save a notification generated by the frontend.

    App.jsx usage:
        // In handleSubmit / handleUpdate, after state update:
        await fetch(`${API}/notifications`, {
            method: "POST",
            headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
            body: JSON.stringify({ id, msg, ts, read: false })
        });
    """
    _save_notification(
        body.get("id", str(uuid.uuid4())),
        None,
        body["msg"],
        body["ts"],
    )
    return {"success": True}


@app.put("/notifications/read-all")
def mark_all_read(current_user: dict = Depends(_get_current_user)):
    """
    PUT /notifications/read-all — mark all notifications as read.
    Called when user clicks "Mark all read" in NotifPanel.

    App.jsx usage:
        // In onClear handler:
        await fetch(`${API}/notifications/read-all`, {
            method: "PUT", headers: { Authorization:`Bearer ${token}` }
        });
        setNotifs(n => n.map(x => ({...x, read: true})));
    """
    conn = get_db()
    conn.execute("UPDATE notifications SET is_read=1")
    conn.commit()
    conn.close()
    return {"success": True}


# ═══════════════════════════════════════════════════════════════════════════════
# AI ENDPOINT  — backs the "Analyze with AI" button in NewRequestModal
# ═══════════════════════════════════════════════════════════════════════════════

# Request type config — mirrors REQUEST_TYPE_CONFIG in App.jsx
_TYPE_CONFIG = {
    "System Access":    {"assignedTo": "IT Department",       "assignedDept": "IT",          "requiresApproval": True,  "turnaround": {"High": 3,  "Medium": 7,  "Low": 14}, "escalationDays": 3},
    "Equipment Request":{"assignedTo": "Procurement",         "assignedDept": "IT",          "requiresApproval": True,  "turnaround": {"High": 2,  "Medium": 5,  "Low": 10}, "escalationDays": 3},
    "Facility Request": {"assignedTo": "Facilities Management","assignedDept": "Facilities",  "requiresApproval": False, "turnaround": {"High": 1,  "Medium": 3,  "Low": 7},  "escalationDays": 2},
    "General Service":  {"assignedTo": "HR Department",       "assignedDept": "HR",          "requiresApproval": False, "turnaround": {"High": 2,  "Medium": 5,  "Low": 10}, "escalationDays": 4},
}

def _local_categorize(title: str, desc: str) -> Optional[str]:
    """Mirror of autoCategorize() in App.jsx."""
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
    """Mirror of predictPriority() in App.jsx."""
    rules = {
        "System Access":    {"high": ["admin","critical","urgent","root"],           "low": ["view","read","basic"]},
        "Equipment Request":{"high": ["broken","urgent","damaged","replacement"],    "low": ["cable","mouse","accessory"]},
        "Facility Request": {"high": ["emergency","urgent","today"],                 "low": ["routine","next week"]},
        "General Service":  {"high": ["urgent","critical","immediately"],            "low": ["minor","whenever"]},
    }
    if not req_type or req_type not in rules:
        return "Medium"
    r = rules[req_type]; t = desc.lower()
    for k in r["high"]:
        if k in t: return "High"
    for k in r["low"]:
        if k in t: return "Low"
    return "Medium"

def _calc_eta(req_type: Optional[str], priority: str) -> str:
    """Mirror of calcETA() in App.jsx."""
    days = 7
    if req_type and req_type in _TYPE_CONFIG:
        days = _TYPE_CONFIG[req_type]["turnaround"].get(priority, 7)
    return (datetime.today() + timedelta(days=days)).strftime("%Y-%m-%d")


@app.post("/ai/analyze")
def ai_analyze(body: AIAnalyzeRequest, current_user: dict = Depends(_get_current_user)):
    """
    POST /ai/analyze — backs the "Analyze with AI" button in NewRequestModal.
    Returns the same shape as aiSug state in NewRequestModal so React can
    apply it directly.

    Response shape (matches aiSug object in App.jsx):
        { type, priority, routing, eta }

    App.jsx usage:
        // Replaces the local runAI() function:
        const res = await fetch(`${API}/ai/analyze`, {
            method: "POST",
            headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
            body: JSON.stringify({ title: form.title, description: form.description })
        });
        const aiSug = await res.json();
        setAiSug(aiSug);
    """
    title = body.title
    desc  = body.description

    # Try LLM first; fall back to local keyword rules
    if AI_ENABLED:
        try:
            prompt = f"""You are a workplace IT assistant. Analyze this service request and respond ONLY with a JSON object — no markdown, no explanation.

Title: {title}
Description: {desc}

Respond with exactly this JSON:
{{
  "type": "<one of: System Access | Equipment Request | Facility Request | General Service>",
  "priority": "<one of: High | Medium | Low>",
  "reasoning": "<one sentence>"
}}"""
            response = litellm.completion(
                model=AI_MODEL,
                api_base=AI_BASE,
                api_key=AI_KEY,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=150,
                headers={"Authorization": f"Bearer {AI_KEY}"},
                drop_params=True,
            )
            raw = response.choices[0].message.content.strip()
            raw = re.sub(r"```[a-z]*", "", raw).replace("```", "").strip()
            parsed = json.loads(raw)
            req_type = parsed.get("type")
            priority = parsed.get("priority", "Medium")
        except Exception as e:
            print(f"⚠️  AI call failed, using local rules: {e}")
            req_type = _local_categorize(title, desc)
            priority = _local_priority(req_type, desc)
    else:
        req_type = _local_categorize(title, desc)
        priority = _local_priority(req_type, desc)

    routing = _TYPE_CONFIG.get(req_type, {}).get("assignedTo", "General Admin") if req_type else "General Admin"
    eta     = _calc_eta(req_type, priority)

    # Exact shape of aiSug in NewRequestModal
    return {
        "type":     req_type,   # may be None if undetected
        "priority": priority,
        "routing":  routing,
        "eta":      eta,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# REQUEST ID GENERATOR  — mirrors genId() in App.jsx
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/requests/next-id")
def next_request_id(current_user: dict = Depends(_get_current_user)):
    """
    GET /requests/next-id — returns the next available REQ-XXXX id.
    Replaces the client-side reqCounter / genId() in App.jsx so IDs are
    generated server-side and guaranteed to be unique.

    App.jsx usage:
        // At the start of NewRequestModal handleSubmit, replace genId():
        const { id } = await fetch(`${API}/requests/next-id`, { headers }).then(r=>r.json());
    """
    conn = get_db()
    row = conn.execute(
        "SELECT id FROM requests ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conn.close()

    if not row:
        next_num = 1
    else:
        # Parse the number from the last ID like REQ-0005
        last = row["id"]  # e.g. "REQ-0005"
        try:
            next_num = int(last.split("-")[-1]) + 1
        except ValueError:
            next_num = 1

    return {"id": f"REQ-{str(next_num).zfill(4)}"}


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/")
def health():
    return {
        "status": "ok",
        "service": "WorkAccess RMS API",
        "ai_enabled": AI_ENABLED,
        "docs": "/docs",
    }