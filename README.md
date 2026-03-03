# WorkAccess RMS
## Workplace Access & Resource Request Management System

---

## 📁 Project Structure

```
workplace-rms/
├── src/
│   ├── App.jsx          ← Main React frontend (all UI + logic)
│   ├── main.tsx         ← React entry point
│   └── index.css        ← Base styles
├── backend/
│   ├── main.py          ← Python CLI entry point
│   ├── models.py        ← Pydantic data models
│   ├── Database.py      ← SQLite database layer
│   ├── request_handler.py ← Business logic
│   ├── ai_assistant.py  ← AI integration (LiteLLM)
│   └── requirements.txt ← Python dependencies
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 🚀 Running the React Frontend (Web App)

### Step 1 — Install Node.js
Download from https://nodejs.org (LTS version)

### Step 2 — Open this folder in VS Code Terminal
```bash
cd workplace-rms
```

### Step 3 — Install dependencies
```bash
npm install
```

### Step 4 — Start the app
```bash
npm run dev
```

### Step 5 — Open in browser
Go to: **http://localhost:5173**

---

## 🐍 Running the Python Backend (CLI)

### Step 1 — Install Python 3.9+
Download from https://python.org

### Step 2 — Navigate to backend folder
```bash
cd backend
```

### Step 3 — Install Python dependencies
```bash
pip install pydantic rich python-dotenv litellm httpx
```

### Step 4 — Configure AI (optional)
Create a `.env` file in the backend folder:
```
GENAI_API_KEY=your_api_key_here
```

### Step 5 — Run the CLI
```bash
python main.py
```

---

## 🔐 Demo Login Credentials (Frontend)

| Role     | Email                    | Password    | Access |
|----------|--------------------------|-------------|--------|
| Admin    | admin@company.com        | admin123    | Full access |
| Manager  | manager@company.com      | manager123  | Approve/reject |
| Employee | employee@company.com     | emp123      | Own requests only |
| IT Staff | itstaff@company.com      | staff123    | IT dept requests |

---

## ✅ Features

### Request Types (Configurable)
- **System Access** — App access, shared folder, internal tools
- **Equipment Request** — Laptop, monitor, headset, ID card
- **Facility Request** — Meeting room, parking, visitor pass
- **General Service** — Workplace change, seating, basic support

### Core Functions
- ✅ 3-step request submission with AI analysis
- ✅ Auto-generated unique Request ID (REQ-XXXX)
- ✅ Status flow: Submitted → Under Review → Approved → Fulfilled → Closed
- ✅ Priority-based ETA calculation (configurable per type)
- ✅ Editable only while status is "Submitted"
- ✅ Only "Fulfilled" requests can be closed
- ✅ Closed/Rejected requests are read-only

### Request Register & Tracking
- ✅ Searchable table with all fields
- ✅ Filter by: Type, Status, Priority, Date Range
- ✅ Sortable columns (click headers)
- ✅ Shows: ID, Type, Submitter, Created, Requested Date, Target ETA, Status

### Approval Workflow
- ✅ Multi-level approval chain (Manager → Admin)
- ✅ Rejection with mandatory comments
- ✅ SLA escalation alerts when overdue
- ✅ Configurable escalation days per request type

### Fulfillment & Closure
- ✅ Kanban-style fulfillment board
- ✅ One-click status advancement
- ✅ Activity history log on every request
- ✅ Comment threads

### Export & Acknowledgement
- ✅ Export all requests to CSV
- ✅ Export full PDF report (all or single request)
- ✅ PDF includes: request details, approval history, activity log, comments
- ✅ AI acknowledgement message on every request

### AI Features
- ✅ Auto-categorize request type from title/description
- ✅ Smart priority prediction
- ✅ Smart routing to correct department
- ✅ SLA insight alerts on dashboard

---

## 🛠️ Troubleshooting

| Error | Fix |
|-------|-----|
| `npm not found` | Install Node.js from nodejs.org |
| `Cannot find module` | Run `npm install` first |
| `index.css not found` | File is in src/ — already included |
| Python `ModuleNotFoundError` | Run `pip install -r requirements.txt` |
| AI not working | Add GENAI_API_KEY to backend/.env |
