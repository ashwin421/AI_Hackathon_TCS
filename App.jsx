import { useState, useEffect } from "react";

// ─── API CONFIGURATION ──────────────────────────────────────────────────────
const API = "http://localhost:8000";

// ─── REQUEST TYPE CONFIG ──────────────────────────────────────────────────────
const REQUEST_TYPE_CONFIG = {
  "System Access": {
    color: "#6366f1", assignedTo: "IT Department", assignedDept: "IT",
    requiresApproval: true, turnaround: { High: 3, Medium: 7, Low: 14 },
    examples: "Access to application, shared folder, internal tool",
    escalationDays: 3,
  },
  "Equipment Request": {
    color: "#0ea5e9", assignedTo: "Procurement", assignedDept: "IT",
    requiresApproval: true, turnaround: { High: 2, Medium: 5, Low: 10 },
    examples: "Laptop, Monitor, Headset, ID Card replacement",
    escalationDays: 3,
  },
  "Facility Request": {
    color: "#84cc16", assignedTo: "Facilities Management", assignedDept: "Facilities",
    requiresApproval: false, turnaround: { High: 1, Medium: 3, Low: 7 },
    examples: "Meeting room booking, Parking access, Visitor pass",
    escalationDays: 2,
  },
  "General Service": {
    color: "#ec4899", assignedTo: "HR Department", assignedDept: "HR",
    requiresApproval: false, turnaround: { High: 2, Medium: 5, Low: 10 },
    examples: "Workplace change, Seating issue, Basic support need",
    escalationDays: 4,
  },
};

const STATUS_FLOW = ["Submitted", "Under Review", "Approved", "Fulfilled", "Closed"];
const REJECTED = "Rejected";
const DEPARTMENTS = ["IT", "HR", "Facilities", "Finance", "Operations", "Security", "Sales", "Analytics"];
const PRIORITIES = ["High", "Medium", "Low"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function daysAgo(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000);
}

function today() { return new Date().toISOString().split("T")[0]; }

function autoCategorize(title, desc) {
  const t = (title + " " + desc).toLowerCase();
  if (/access|permission|login|account|password|admin|role|software|license|system/.test(t)) return "System Access";
  if (/laptop|computer|phone|equipment|device|monitor|keyboard|mouse|server|hardware|printer|headset|id card/.test(t)) return "Equipment Request";
  if (/room|parking|visitor|pass|building|facility|space|floor|maintenance|booking/.test(t)) return "Facility Request";
  if (/seat|desk|workplace|change|support|issue|basic/.test(t)) return "General Service";
  return null;
}

function predictPriority(type, desc) {
  const rules = {
    "System Access": { high: ["admin", "critical", "urgent", "root"], low: ["view", "read", "basic"] },
    "Equipment Request": { high: ["broken", "urgent", "damaged", "replacement"], low: ["cable", "mouse", "accessory"] },
    "Facility Request": { high: ["emergency", "urgent", "today"], low: ["routine", "next week"] },
    "General Service": { high: ["urgent", "critical", "immediately"], low: ["minor", "whenever"] },
  };
  if (!type || !rules[type]) return "Medium";
  const r = rules[type]; const t = desc.toLowerCase();
  for (const k of (r.high || [])) if (t.includes(k)) return "High";
  for (const k of (r.low || [])) if (t.includes(k)) return "Low";
  return "Medium";
}

function calcETA(type, priority) {
  const days = REQUEST_TYPE_CONFIG[type]?.turnaround[priority] || 7;
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ─── ICON ─────────────────────────────────────────────────────────────────────
const PATHS = {
  dashboard: "M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z",
  request: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  track: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  plus: "M12 4v16m8-8H4", close: "M6 18L18 6M6 6l12 12", check: "M5 13l4 4L19 7",
  bell: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", arrow: "M9 5l7 7-7 7",
  ai: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  download: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
  approve: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  reject: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
  escalate: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  comment: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  mail: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  shield: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  edit: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  history: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  file: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  lock: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
};

const Icon = ({ name, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {(PATHS[name] || "").split("M").filter(Boolean).map((d, i) => <path key={i} d={"M" + d} />)}
  </svg>
);

// ─── BADGE ────────────────────────────────────────────────────────────────────
const BC = {
  High: "#fee2e2;#b91c1c;#fecaca", Medium: "#fef3c7;#b45309;#fde68a", Low: "#d1fae5;#065f46;#a7f3d0",
  Submitted: "#f1f5f9;#475569;#e2e8f0", "Under Review": "#dbeafe;#1d4ed8;#bfdbfe",
  Approved: "#cffafe;#0e7490;#a5f3fc", "In Progress": "#ffedd5;#c2410c;#fed7aa",
  Fulfilled: "#d1fae5;#065f46;#a7f3d0", Closed: "#f3f4f6;#6b7280;#e5e7eb",
  Rejected: "#fee2e2;#991b1b;#fecaca", Pending: "#fef9c3;#a16207;#fef08a",
  "System Access": "#e0e7ff;#4338ca;#c7d2fe", "Equipment Request": "#e0f2fe;#0369a1;#bae6fd",
  "Facility Request": "#ecfccb;#3f6212;#d9f99d", "General Service": "#fce7f3;#9d174d;#fbcfe8",
};

const Badge = ({ label }) => {
  const [bg, color, border] = (BC[label] || "#f3f4f6;#374151;#e5e7eb").split(";");
  return <span style={{ background: bg, color, border: `1px solid ${border}`, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center" }}>{label}</span>;
};

const ProgressBar = ({ value, color = "#6366f1" }) => (
  <div style={{ width: "100%", background: "#f1f5f9", borderRadius: 99, height: 6, overflow: "hidden" }}>
    <div style={{ width: `${value}%`, height: "100%", borderRadius: 99, background: color, transition: "width 0.7s" }} />
  </div>
);

const Toast = ({ toasts }) => (
  <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 200, display: "flex", flexDirection: "column", gap: 8 }}>
    {toasts.map(t => (
      <div key={t.id} style={{ background: t.type === "error" ? "#fef2f2" : t.type === "warn" ? "#fffbeb" : "#111827", color: t.type === "error" ? "#991b1b" : t.type === "warn" ? "#92400e" : "#fff", padding: "12px 18px", borderRadius: 14, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: 8, minWidth: 260 }}>
        <Icon name={t.type === "error" ? "reject" : t.type === "warn" ? "escalate" : "check"} size={14} />{t.msg}
      </div>
    ))}
  </div>
);

// ─── NOTIFICATION BELL ────────────────────────────────────────────────────────
const NotifPanel = ({ notifs, onClear }) => {
  const [open, setOpen] = useState(false);
  const unread = notifs.filter(n => !n.read).length;
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", position: "relative", padding: 4 }}>
        <Icon name="bell" size={20} />
        {unread > 0 && <div style={{ position: "absolute", top: -2, right: -2, width: 16, height: 16, background: "#ef4444", borderRadius: "50%", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{unread}</div>}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 36, width: 340, background: "#fff", borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.15)", border: "1px solid #f1f5f9", zIndex: 100 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
            <button onClick={() => { onClear(); setOpen(false); }} style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Mark all read</button>
          </div>
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {notifs.length === 0
              ? <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>No notifications</div>
              : notifs.slice(0, 12).map(n => (
                <div key={n.id} style={{ padding: "12px 16px", borderBottom: "1px solid #f9fafb", background: n.read ? "#fff" : "#f5f3ff" }}>
                  <div style={{ fontSize: 13, color: "#111827", fontWeight: n.read ? 400 : 600 }}>{n.msg}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{n.ts}</div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
};
// ═══════════════════════════════════════════════════════════════════════════════
// CHATBOT COMPONENT - Copilot-like Feature
// ═══════════════════════════════════════════════════════════════════════════════

const ChatBot = ({ user, currentRequest, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(true);
  const messagesEndRef = useRef(null);

  // Initial greeting based on user role
  useEffect(() => {
    const greeting = {
      Admin: "Hello Admin! I'm your WorkAccess Copilot. I can help you manage all requests, approvals, and system configurations. What would you like to know?",
      Manager: `Hi ${user.name}! I'm here to help you with approvals, team requests, and department reports. How can I assist you today?`,
      Staff: `Welcome back! I can help you manage requests assigned to ${user.dept}. Need help with fulfillment or updates?`,
      Employee: `Hello ${user.name}! I'm your personal assistant for workplace requests. Ask me about creating requests, checking status, or understanding the process.`
    };
    
    setMessages([{
      role: "assistant",
      content: greeting[user.role] || "Hi! I'm your WorkAccess Copilot. How can I help you today?",
      timestamp: new Date().toISOString()
    }]);
  }, [user]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: "user",
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          message: input,
          history: messages.slice(-5), // Send last 5 messages for context
          request_context: currentRequest || null
        })
      });

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply,
        timestamp: data.timestamp || new Date().toISOString()
      }]);

      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I'm having trouble connecting. Please try again in a moment.",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
    setTimeout(() => sendMessage(), 100);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 60,
          height: 60,
          borderRadius: "30px",
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          border: "none",
          boxShadow: "0 8px 24px rgba(99,102,241,0.3)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          zIndex: 1000,
          transition: "transform 0.2s"
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        <Icon name="ai" size={28} />
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      right: 24,
      width: 380,
      height: 600,
      background: "#fff",
      borderRadius: 24,
      boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      display: "flex",
      flexDirection: "column",
      zIndex: 1000,
      overflow: "hidden",
      border: "1px solid #f1f5f9"
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
        color: "#fff",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            background: "#fff",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Icon name="ai" size={18} color="#6366f1" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>WorkAccess Copilot</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>AI Assistant · {user.role}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setIsOpen(false)}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", opacity: 0.9 }}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      </div>

      {/* Request Context Banner (if viewing a request) */}
      {currentRequest && (
        <div style={{
          padding: "10px 16px",
          background: "#f5f3ff",
          borderBottom: "1px solid #e0e7ff",
          fontSize: 12,
          color: "#4338ca",
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          <Icon name="file" size={14} />
          <span><strong>{currentRequest.id}</strong>: {currentRequest.title}</span>
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: "#fafafa"
      }}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start"
            }}
          >
            <div style={{
              background: msg.role === "user" ? "#6366f1" : "#fff",
              color: msg.role === "user" ? "#fff" : "#111827",
              padding: "10px 14px",
              borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              fontSize: 13,
              lineHeight: 1.5,
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              border: msg.role === "user" ? "none" : "1px solid #f1f5f9",
              wordBreak: "break-word"
            }}>
              {msg.content}
            </div>
            <span style={{
              fontSize: 10,
              color: "#9ca3af",
              marginTop: 4,
              marginLeft: msg.role === "user" ? 0 : 8,
              marginRight: msg.role === "user" ? 8 : 0
            }}>
              {formatTime(msg.timestamp)}
            </span>
          </div>
        ))}
        
        {isLoading && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: "#fff",
            borderRadius: "18px 18px 18px 4px",
            border: "1px solid #f1f5f9",
            width: "fit-content"
          }}>
            <div style={{ display: "flex", gap: 4 }}>
              <div style={{
                width: 6,
                height: 6,
                background: "#6366f1",
                borderRadius: "50%",
                animation: "bounce 1.4s infinite ease-in-out"
              }} />
              <div style={{
                width: 6,
                height: 6,
                background: "#6366f1",
                borderRadius: "50%",
                animation: "bounce 1.4s infinite ease-in-out 0.2s"
              }} />
              <div style={{
                width: 6,
                height: 6,
                background: "#6366f1",
                borderRadius: "50%",
                animation: "bounce 1.4s infinite ease-in-out 0.4s"
              }} />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && !isLoading && (
        <div style={{
          padding: "12px 16px",
          borderTop: "1px solid #f1f5f9",
          background: "#fff",
          display: "flex",
          flexWrap: "wrap",
          gap: 8
        }}>
          {suggestions.map((sugg, idx) => (
            <button
              key={idx}
              onClick={() => handleSuggestionClick(sugg)}
              style={{
                padding: "6px 12px",
                background: "#f5f3ff",
                border: "1px solid #e0e7ff",
                borderRadius: 16,
                fontSize: 11,
                color: "#4338ca",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#ede9fe"}
              onMouseLeave={e => e.currentTarget.style.background = "#f5f3ff"}
            >
              {sugg}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: "16px",
        borderTop: "1px solid #f1f5f9",
        background: "#fff",
        display: "flex",
        gap: 8
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask me anything..."
          style={{
            flex: 1,
            border: "1px solid #e5e7eb",
            borderRadius: 20,
            padding: "10px 16px",
            fontSize: 13,
            outline: "none",
            fontFamily: "inherit"
          }}
          disabled={isLoading}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: !input.trim() || isLoading ? "#f1f5f9" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
            border: "none",
            cursor: !input.trim() || isLoading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: !input.trim() || isLoading ? "#9ca3af" : "#fff",
            transition: "all 0.2s"
          }}
        >
          <Icon name="arrow" size={18} style={{ transform: "rotate(180deg)" }} />
        </button>
      </div>

      {/* Add animation keyframes */}
      <style>
        {`
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
            40% { transform: scale(1.2); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  
  const demo = [
    { label: "Admin", email: "admin@company.com", pass: "admin123", color: "#6366f1" },
    { label: "Manager", email: "manager@company.com", pass: "manager123", color: "#0ea5e9" },
    { label: "Employee", email: "employee@company.com", pass: "emp123", color: "#10b981" },
    { label: "IT Staff", email: "itstaff@company.com", pass: "staff123", color: "#f59e0b" },
  ];
  
  const inp = { width: "100%", border: "1px solid #e5e7eb", borderRadius: 12, padding: "11px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  
  const handleLogin = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");
      localStorage.setItem("token", data.token);
      onLogin(data.user);
    } catch (error) {
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e40af 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12, boxShadow: "0 8px 24px rgba(99,102,241,0.4)" }}><Icon name="shield" size={26} /></div>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>WorkAccess RMS</div>
          <div style={{ color: "#a5b4fc", fontSize: 13, marginTop: 4 }}>Workplace Access & Resource Request Management</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 24, padding: 32, boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Welcome back</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>Sign in to your account</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email</label><input style={inp} type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} /></div>
            <div><label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Password</label><input style={inp} type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} /></div>
            {err && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{err}</div>}
            <button onClick={handleLogin} disabled={loading} style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </div>
          <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 24, paddingTop: 20 }}>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12, fontWeight: 600, textAlign: "center" }}>DEMO QUICK LOGIN</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {demo.map(d => <button key={d.label} onClick={() => { setEmail(d.email); setPass(d.pass); }} style={{ padding: "8px 12px", border: `1px solid ${d.color}33`, background: `${d.color}11`, borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600, color: d.color }}>{d.label}</button>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// NEW REQUEST MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const NewRequestModal = ({ user, onClose, onSubmit }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", dept: user.dept, type: "", priority: "", requestedDate: "", escalationDays: 3, justification: "" });
  const [aiSug, setAiSug] = useState(null); 
  const [applied, setApplied] = useState(false);
  
  const inp = { width: "100%", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 14px", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const lbl = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 };

  const runAI = async () => {
    if (!form.title || !form.description) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/ai/analyze`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ title: form.title, description: form.description })
      });
      const data = await res.json();
      setAiSug(data);
      setApplied(false);
    } catch (error) {
      console.error("AI analysis failed:", error);
      const cat = autoCategorize(form.title, form.description);
      const pri = predictPriority(cat, form.description);
      setAiSug({ type: cat, priority: pri, routing: cat ? REQUEST_TYPE_CONFIG[cat]?.assignedTo : "General Admin", eta: cat ? calcETA(cat, pri) : "—" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const type = form.type || aiSug?.type || "General Service";
      const priority = form.priority || aiSug?.priority || "Medium";
      const cfg = REQUEST_TYPE_CONFIG[type];
      
      // Get next ID from server
      const idRes = await fetch(`${API}/requests/next-id`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const { id } = await idRes.json();
      
      const requestData = {
        id, 
        type, 
        title: form.title, 
        submitterId: user.id, 
        submitter: user.name, 
        dept: form.dept, 
        priority,
        status: "Submitted", 
        created: today(), 
        updated: today(), 
        requestedDate: form.requestedDate || calcETA(type, priority),
        description: form.description + (form.justification ? `\n\nJustification: ${form.justification}` : ""),
        assignedTo: cfg?.assignedTo || "General Admin", 
        assignedDept: cfg?.assignedDept || "IT",
        eta: calcETA(type, priority), 
        progress: 5, 
        requiresApproval: cfg?.requiresApproval || false,
        escalationDays: form.escalationDays,
        approvalChain: cfg?.requiresApproval ? [
          { level: 1, role: "Manager", approverId: null, status: "Pending", comment: "", ts: "" },
          { level: 2, role: "Admin", approverId: null, status: "Pending", comment: "", ts: "" }
        ] : [],
        comments: [],
        history: [{ action: "Submitted", by: user.name, ts: today(), note: "Request created." }],
      };

      const res = await fetch(`${API}/requests`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });
      
      if (!res.ok) throw new Error("Failed to create request");
      const saved = await res.json();
      onSubmit(saved);
      onClose();
    } catch (error) {
      console.error("Submit failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", width: "100%", maxWidth: 620, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #f1f5f9" }}>
          <div><div style={{ fontWeight: 700, fontSize: 18, color: "#111827" }}>New Service Request</div><div style={{ fontSize: 12, color: "#9ca3af" }}>Step {step} of 3</div></div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><Icon name="close" size={20} /></button>
        </div>

        <div style={{ display: "flex", padding: "12px 24px", gap: 8 }}>
          {["Details", "Type & Priority", "Review"].map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ height: 4, borderRadius: 99, background: step > i ? "#6366f1" : step === i + 1 ? "#6366f1" : "#f1f5f9", marginBottom: 6 }} />
              <span style={{ fontSize: 11, color: step === i + 1 ? "#6366f1" : "#9ca3af", fontWeight: step === i + 1 ? 700 : 400 }}>{s}</span>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={lbl}>Department</label>
                <select style={{ ...inp, background: "#fff" }} value={form.dept} onChange={e => setForm(f => ({ ...f, dept: e.target.value }))}>
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select></div>
              <div><label style={lbl}>Requested Date</label>
                <input style={inp} type="date" value={form.requestedDate} min={today()} onChange={e => setForm(f => ({ ...f, requestedDate: e.target.value }))} /></div>
            </div>
            <div><label style={lbl}>Request Title *</label>
              <input style={inp} placeholder="Brief, clear title for your request" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><label style={lbl}>Short Description *</label>
              <textarea style={{ ...inp, resize: "none", height: 80 }} placeholder="What do you need? (brief)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><label style={lbl}>Detailed Justification / Comments</label>
              <textarea style={{ ...inp, resize: "none", height: 80 }} placeholder="Why do you need this? Business justification..." value={form.justification} onChange={e => setForm(f => ({ ...f, justification: e.target.value }))} /></div>
            <div><label style={lbl}>Escalation if no response (days)</label>
              <input style={{ ...inp, width: 100 }} type="number" min={1} max={30} value={form.escalationDays} onChange={e => setForm(f => ({ ...f, escalationDays: +e.target.value }))} /></div>
            <button onClick={runAI} disabled={loading || !form.title || !form.description} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#eef2ff", border: "none", borderRadius: 12, color: "#4338ca", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "fit-content", opacity: (!form.title || !form.description) ? 0.5 : 1 }}>
              <Icon name="ai" size={15} /> {loading ? "Analyzing..." : "Analyze with AI"}
            </button>
            {aiSug && (
              <div style={{ background: "linear-gradient(135deg,#eef2ff,#ede9fe)", border: "1px solid #c7d2fe", borderRadius: 16, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#4338ca", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Icon name="ai" size={13} /> AI Suggestions</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, marginBottom: 12 }}>
                  {[["Category", aiSug.type || "Undetected"], ["Priority", aiSug.priority], ["Route to", aiSug.routing], ["ETA", aiSug.eta]].map(([k, v]) => (
                    <div key={k}><span style={{ color: "#6b7280" }}>{k}: </span><strong>{v}</strong></div>
                  ))}
                </div>
                {!applied
                  ? <button onClick={() => { setForm(f => ({ ...f, type: aiSug.type || f.type, priority: aiSug.priority })); setApplied(true); }} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Apply Suggestions</button>
                  : <span style={{ fontSize: 12, color: "#059669", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Icon name="check" size={12} /> Applied</span>
                }
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setStep(2)} disabled={!form.title || !form.description} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: (!form.title || !form.description) ? 0.4 : 1 }}>Next →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div><label style={lbl}>Request Type *</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {Object.entries(REQUEST_TYPE_CONFIG).map(([t, cfg]) => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                    style={{ textAlign: "left", padding: 14, borderRadius: 14, border: form.type === t ? `2px solid ${cfg.color}` : "1px solid #e5e7eb", background: form.type === t ? cfg.color + "11" : "#fff", cursor: "pointer" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: form.type === t ? cfg.color : "#374151" }}>{t}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{cfg.examples}</div>
                  </button>
                ))}
              </div>
            </div>
            <div><label style={lbl}>Priority *</label>
              <div style={{ display: "flex", gap: 10 }}>
                {PRIORITIES.map(p => {
                  const pc = { High: "#ef4444", Medium: "#f59e0b", Low: "#10b981" }[p];
                  return <button key={p} onClick={() => setForm(f => ({ ...f, priority: p }))}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: form.priority === p ? `2px solid ${pc}` : "1px solid #e5e7eb", background: form.priority === p ? pc + "11" : "#fff", color: form.priority === p ? pc : "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{p}</button>;
                })}
              </div>
            </div>
            {form.type && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 14, padding: 14, fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: "#065f46", marginBottom: 8 }}>ℹ️ Request Info</div>
              <div style={{ color: "#374151" }}>Requires Approval: <strong>{REQUEST_TYPE_CONFIG[form.type]?.requiresApproval ? "Yes" : "No"}</strong></div>
              <div style={{ color: "#374151" }}>Routed to: <strong>{REQUEST_TYPE_CONFIG[form.type]?.assignedTo}</strong></div>
              {form.priority && <div style={{ color: "#374151" }}>Target Resolution: <strong>{calcETA(form.type, form.priority)}</strong></div>}
            </div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, border: "1px solid #e5e7eb", background: "#fff", borderRadius: 12, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#374151" }}>← Back</button>
              <button onClick={() => setStep(3)} disabled={!form.type || !form.priority} style={{ flex: 1, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 12, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: (!form.type || !form.priority) ? 0.4 : 1 }}>Next →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>Review Your Request</div>
            <div style={{ background: "#f9fafb", borderRadius: 16, padding: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", fontSize: 13 }}>
                {[["Title", form.title], ["Type", form.type || "—"], ["Priority", form.priority || "—"], ["Department", form.dept], ["Requested Date", form.requestedDate || "Auto"], ["Target ETA", form.type && form.priority ? calcETA(form.type, form.priority) : "—"], ["Routed to", form.type ? REQUEST_TYPE_CONFIG[form.type]?.assignedTo : "—"], ["Approval Required", form.type ? (REQUEST_TYPE_CONFIG[form.type]?.requiresApproval ? "Yes" : "No") : "—"]].map(([k, v]) => (
                  <div key={k}><span style={{ color: "#9ca3af", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 2 }}>{k}</span><strong style={{ color: "#111827" }}>{v}</strong></div>
                ))}
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
                <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>DESCRIPTION</div>
                <p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.6 }}>{form.description}</p>
                {form.justification && <><div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 600, marginTop: 10, marginBottom: 4 }}>JUSTIFICATION</div><p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.6 }}>{form.justification}</p></>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, border: "1px solid #e5e7eb", background: "#fff", borderRadius: 12, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#374151" }}>← Back</button>
              <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Submitting..." : "✓ Submit Request"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL / APPROVAL PANEL
// ═══════════════════════════════════════════════════════════════════════════════
const DetailPanel = ({ req, user, onClose, onUpdate, addToast }) => {
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [newComment, setNewComment] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ title: req.title, description: req.description, priority: req.priority, requestedDate: req.requestedDate });
  const [activeTab, setActiveTab] = useState("details");
  const [loading, setLoading] = useState(false);

  const curIdx = STATUS_FLOW.indexOf(req.status);
  const cfg = REQUEST_TYPE_CONFIG[req.type];
  const c = cfg?.color || "#6366f1";
  const isClosed = req.status === "Closed" || req.status === REJECTED;
  const isEditable = req.status === "Submitted" && req.submitterId === user.id;
  const canApprove = (user.role === "Manager" || user.role === "Admin") && req.status === "Under Review" && req.requiresApproval;
  const canAdvance = (user.role === "Admin" || user.role === "Staff") && !isClosed;
  const canClose = req.status === "Fulfilled" && (user.role === "Admin" || user.role === "Manager");
  const isEscalated = req.status === "Under Review" && daysAgo(req.updated) >= (req.escalationDays || 3);

  const getPendingLevel = () => req.approvalChain?.find(a => a.status === "Pending");

  const advance = async () => {
    if (isClosed) return;
    setLoading(true);
    try {
      let newStatus, newProgress;
      if (req.requiresApproval && req.status === "Submitted") {
        newStatus = "Under Review"; newProgress = 25;
      } else if (req.status === "Approved" || (!req.requiresApproval && req.status === "Under Review")) {
        newStatus = "Fulfilled"; newProgress = 100;
      } else if (req.status === "Submitted" && !req.requiresApproval) {
        newStatus = "Under Review"; newProgress = 25;
      } else {
        const next = STATUS_FLOW[Math.min(curIdx + 1, STATUS_FLOW.length - 1)];
        newStatus = next; newProgress = Math.min(100, req.progress + 20);
      }
      const hist = [...(req.history || []), { action: newStatus, by: user.name, ts: today(), note: "" }];
      const updated = { ...req, status: newStatus, progress: newProgress, updated: today(), history: hist };
      await performUpdate(updated);
      addToast(`Status → "${newStatus}"`);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    const pending = getPendingLevel(); if (!pending) return;
    setLoading(true);
    try {
      const newChain = req.approvalChain.map(a => a.level === pending.level ? { ...a, status: "Approved", approverId: user.id, ts: today() } : a);
      const allApproved = newChain.every(a => a.status === "Approved");
      const hist = [...(req.history || []), { action: `Level ${pending.level} Approved`, by: user.name, ts: today(), note: "" }];
      const updated = { ...req, approvalChain: newChain, status: allApproved ? "Approved" : "Under Review", progress: allApproved ? 65 : 40, updated: today(), history: hist };
      await performUpdate(updated);
      addToast(allApproved ? "✅ Fully approved!" : `Level ${pending.level} approved!`);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    const pending = getPendingLevel(); if (!pending) return;
    setLoading(true);
    try {
      const newChain = req.approvalChain.map(a => a.level === pending.level ? { ...a, status: "Rejected", approverId: user.id, comment: rejectComment, ts: today() } : a);
      const hist = [...(req.history || []), { action: "Rejected", by: user.name, ts: today(), note: rejectComment }];
      const updated = { ...req, approvalChain: newChain, status: REJECTED, progress: 0, updated: today(), history: hist };
      await performUpdate(updated);
      setRejectModal(false);
      addToast("Request rejected.", "warn");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    setLoading(true);
    try {
      const hist = [...(req.history || []), { action: "Closed", by: user.name, ts: today(), note: "Request closed." }];
      const updated = { ...req, status: "Closed", updated: today(), history: hist };
      await performUpdate(updated);
      addToast("🔒 Request closed.");
    } finally {
      setLoading(false);
    }
  };

  const saveEdit = async () => {
    setLoading(true);
    try {
      const updated = { ...req, ...editForm, updated: today() };
      await performUpdate(updated);
      setEditMode(false);
      addToast("Request updated.");
    } finally {
      setLoading(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      const c2 = { id: "c" + Date.now(), authorId: user.id, author: user.name, text: newComment, ts: new Date().toLocaleString() };
      const updated = { ...req, comments: [...(req.comments || []), c2] };
      await performUpdate(updated);
      setNewComment("");
      addToast("Comment added.");
    } finally {
      setLoading(false);
    }
  };

  const performUpdate = async (updated) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API}/requests/${req.id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(updated)
    });
    if (!res.ok) throw new Error("Update failed");
    const saved = await res.json();
    onUpdate(saved);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: 12 }}>
      <div style={{ background: "#fff", borderRadius: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", width: "100%", maxWidth: 540, maxHeight: "94vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>

        <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: "#9ca3af", marginBottom: 3 }}>{req.id} · {req.created}</div>
            {editMode
              ? <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={{ fontSize: 15, fontWeight: 700, border: "1px solid #e5e7eb", borderRadius: 8, padding: "4px 8px", width: "100%", outline: "none", fontFamily: "inherit" }} />
              : <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{req.title}</div>
            }
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <Badge label={req.type} /><Badge label={req.status} /><Badge label={req.priority} />
              {isClosed && <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6b7280" }}><Icon name="lock" size={11} /> Read-only</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: 12 }}>
            {isEditable && !isClosed && <button onClick={() => setEditMode(e => !e)} style={{ background: editMode ? "#6366f1" : "#f9fafb", color: editMode ? "#fff" : "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}><Icon name="edit" size={14} /></button>}
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><Icon name="close" size={20} /></button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #f1f5f9", padding: "0 24px" }}>
          {["details", "approval", "history", "comments"].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, border: "none", borderBottom: activeTab === t ? "2px solid #6366f1" : "2px solid transparent", background: "none", color: activeTab === t ? "#6366f1" : "#6b7280", cursor: "pointer", textTransform: "capitalize" }}>{t}</button>
          ))}
        </div>

        <div style={{ padding: 24, flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

          {isEscalated && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 14, padding: 14, display: "flex", gap: 10 }}>
              <span style={{ color: "#d97706" }}><Icon name="escalate" size={18} /></span>
              <div><div style={{ fontWeight: 700, color: "#92400e", fontSize: 13 }}>⚠️ Escalation Alert</div>
                <div style={{ fontSize: 12, color: "#92400e", marginTop: 2 }}>Pending {daysAgo(req.updated)} days — exceeds {req.escalationDays}-day SLA.</div></div>
            </div>
          )}

          {activeTab === "details" && (
            <>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Progress</div>
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <div style={{ position: "absolute", top: 11, left: 0, right: 0, height: 2, background: "#f1f5f9" }} />
                  <div style={{ position: "absolute", top: 11, left: 0, height: 2, background: c, width: `${Math.max(0, (Math.max(0, curIdx) / (STATUS_FLOW.length - 1)) * 100)}%`, transition: "width 0.5s" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
                    {STATUS_FLOW.map((s, i) => (
                      <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${i <= curIdx ? c : "#e5e7eb"}`, background: i < curIdx ? c : "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: i === curIdx ? `0 0 0 3px ${c}22` : "none" }}>
                          {i < curIdx ? <Icon name="check" size={10} /> : <div style={{ width: 6, height: 6, borderRadius: "50%", background: i === curIdx ? c : "#d1d5db" }} />}
                        </div>
                        <span style={{ fontSize: 8, color: "#9ca3af", textAlign: "center", maxWidth: 48 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <ProgressBar value={req.progress} color={c} />
                <div style={{ textAlign: "right", fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{req.progress}% complete</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["Assigned To", req.assignedTo], ["Submitter", req.submitter], ["Department", req.dept], ["Created", req.created], ["Requested Date", req.requestedDate], ["Target ETA", req.eta], ["Requires Approval", req.requiresApproval ? "Yes" : "No"], ["Last Updated", req.updated]].map(([k, v]) => (
                  <div key={k} style={{ background: "#f9fafb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>{k}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: "#f9fafb", borderRadius: 16, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Description</div>
                {editMode
                  ? <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none", resize: "none", height: 80, boxSizing: "border-box", fontFamily: "inherit" }} />
                  : <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, margin: 0 }}>{req.description}</p>
                }
              </div>
              {editMode && (
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setEditMode(false)} style={{ flex: 1, border: "1px solid #e5e7eb", background: "#fff", borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button onClick={saveEdit} disabled={loading} style={{ flex: 1, background: "#6366f1", color: "#fff", border: "none", borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>Save Changes</button>
                </div>
              )}

              <div style={{ background: "linear-gradient(135deg,#eef2ff,#ede9fe)", border: "1px solid #c7d2fe", borderRadius: 16, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#4338ca", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Icon name="ai" size={13} /> AI Acknowledgement</div>
                <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, margin: 0 }}>
                  Your <strong>{req.type}</strong> request is routed to <strong>{req.assignedTo}</strong>. Priority: <strong>{req.priority}</strong>. Target resolution: <strong>{req.eta}</strong>. Status: <strong>{req.status}</strong>.
                  {isEscalated && " ⚠️ This request has exceeded the SLA window and requires immediate attention."}
                  {isClosed && " This request is now closed and read-only."}
                </p>
              </div>
            </>
          )}

          {activeTab === "approval" && (
            <div>
              {!req.requiresApproval
                ? <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}><Icon name="approve" size={28} /><div style={{ marginTop: 8 }}>This request type does not require approval</div></div>
                : req.approvalChain.map((a, i) => {
                  const approver = a.approverId ? req.submitterId === a.approverId ? { name: req.submitter } : null : null;
                  const sc = { Approved: "#059669", Pending: "#d97706", Rejected: "#dc2626" }[a.status] || "#6b7280";
                  return (
                    <div key={i} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: i < req.approvalChain.length - 1 ? "1px dashed #f1f5f9" : "none" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: sc + "22", color: sc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                        {a.status === "Approved" ? "✓" : a.status === "Rejected" ? "✗" : a.level}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Level {a.level} — {a.role}</div>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{a.approverId ? `By ${a.approverId === user.id ? user.name : "Unknown"} on ${a.ts}` : "Awaiting approval"}</div>
                        {a.comment && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, fontStyle: "italic", background: "#f9fafb", padding: "6px 10px", borderRadius: 8 }}>"{a.comment}"</div>}
                      </div>
                      <Badge label={a.status} />
                    </div>
                  );
                })
              }
            </div>
          )}

          {activeTab === "history" && (
            <div>
              {(req.history || []).map((h, i) => (
                <div key={i} style={{ display: "flex", gap: 12, paddingBottom: 14, marginBottom: 14, borderBottom: i < req.history.length - 1 ? "1px dashed #f1f5f9" : "none" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{h.action}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>By {h.by} · {h.ts}</div>
                    {h.note && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{h.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "comments" && (
            <div>
              {(req.comments || []).map(c2 => (
                <div key={c2.id} style={{ background: "#f9fafb", borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{c2.author}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{c2.ts}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{c2.text}</p>
                </div>
              ))}
              {(req.comments || []).length === 0 && <div style={{ textAlign: "center", padding: 32, color: "#9ca3af", fontSize: 13 }}>No comments yet</div>}
              {!isClosed && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === "Enter" && addComment()} placeholder="Add a comment..." style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                  <button onClick={addComment} disabled={loading} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, opacity: loading ? 0.7 : 1 }}>Post</button>
                </div>
              )}
            </div>
          )}
        </div>

        {!isClosed && (
          <div style={{ padding: "14px 24px", borderTop: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 8 }}>
            {canApprove && (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleApprove} disabled={loading} style={{ flex: 1, background: "#059669", color: "#fff", border: "none", borderRadius: 12, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: loading ? 0.7 : 1 }}>
                  <Icon name="approve" size={15} /> Approve
                </button>
                <button onClick={() => setRejectModal(true)} disabled={loading} style={{ flex: 1, background: "#dc2626", color: "#fff", border: "none", borderRadius: 12, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: loading ? 0.7 : 1 }}>
                  <Icon name="reject" size={15} /> Reject
                </button>
              </div>
            )}
            {canAdvance && !canApprove && req.status !== "Fulfilled" && (
              <button onClick={advance} disabled={loading} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 12, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: loading ? 0.7 : 1 }}>
                <Icon name="arrow" size={14} /> Advance Status
              </button>
            )}
            {canClose && (
              <button onClick={handleClose} disabled={loading} style={{ background: "#374151", color: "#fff", border: "none", borderRadius: 12, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: loading ? 0.7 : 1 }}>
                <Icon name="lock" size={14} /> Close Request
              </button>
            )}
          </div>
        )}
      </div>

      {rejectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#111827", marginBottom: 4 }}>Reject Request</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Please provide a reason for rejection (required).</div>
            <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} placeholder="Reason for rejection..." style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 14px", fontSize: 13, outline: "none", resize: "none", height: 100, boxSizing: "border-box", fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setRejectModal(false)} style={{ flex: 1, border: "1px solid #e5e7eb", background: "#fff", borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleReject} disabled={!rejectComment.trim() || loading} style={{ flex: 1, background: "#dc2626", color: "#fff", border: "none", borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: (!rejectComment.trim() || loading) ? 0.5 : 1 }}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
const StatCard = ({ label, value, sub, color, icon }) => (
  <div style={{ background: "#fff", borderRadius: 20, padding: 20, border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 16 }}>
    <div style={{ width: 48, height: 48, borderRadius: 14, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", color }}><Icon name={icon} size={22} /></div>
    <div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

const RequestCard = ({ req, onClick }) => {
  const [hover, setHover] = useState(false);
  const c = REQUEST_TYPE_CONFIG[req.type]?.color || "#6b7280";
  const isEscalated = req.status === "Under Review" && daysAgo(req.updated) >= (req.escalationDays || 3);
  return (
    <div onClick={() => onClick(req)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: "#fff", borderRadius: 20, border: isEscalated ? "1px solid #fde68a" : hover ? "1px solid #a5b4fc" : "1px solid #f1f5f9", padding: 18, cursor: "pointer", transition: "all 0.2s", boxShadow: hover ? "0 4px 16px rgba(99,102,241,0.1)" : "0 1px 3px rgba(0,0,0,0.06)", position: "relative" }}>
      {isEscalated && <div style={{ position: "absolute", top: 12, right: 12, fontSize: 15 }}>⚠️</div>}
      {(req.status === "Closed" || req.status === "Rejected") && <div style={{ position: "absolute", top: 12, right: 12 }}><Icon name="lock" size={13} /></div>}
      <div style={{ fontSize: 11, fontFamily: "monospace", color: "#9ca3af", marginBottom: 4 }}>{req.id} · {req.created}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: hover ? "#4f46e5" : "#111827", lineHeight: 1.4, marginBottom: 10 }}>{req.title}</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}><Badge label={req.type} /><Badge label={req.status} /><Badge label={req.priority} /></div>
      <ProgressBar value={req.progress} color={c} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11, color: "#9ca3af" }}>
        <span>{req.submitter} · {req.dept}</span><span>ETA {req.eta}</span>
      </div>
    </div>
  );
};

const DashboardView = ({ requests, user, onCard }) => {
  const vis = user.role === "Employee" ? requests.filter(r => r.submitterId === user.id) : user.role === "Staff" ? requests.filter(r => r.assignedDept === user.dept) : requests;
  const total = vis.length, open = vis.filter(r => !["Fulfilled", "Closed", "Rejected"].includes(r.status)).length;
  const high = vis.filter(r => r.priority === "High" && !["Fulfilled", "Closed"].includes(r.status)).length;
  const pending = vis.filter(r => r.status === "Under Review" && r.requiresApproval).length;
  const escalated = vis.filter(r => r.status === "Under Review" && daysAgo(r.updated) >= (r.escalationDays || 3)).length;
  const byType = Object.keys(REQUEST_TYPE_CONFIG).map(t => ({ type: t, count: vis.filter(r => r.type === t).length }));
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(175px,1fr))", gap: 14 }}>
        <StatCard label="Total Requests" value={total} icon="request" color="#6366f1" />
        <StatCard label="Open" value={open} icon="track" color="#f59e0b" sub="Active" />
        <StatCard label="Awaiting Approval" value={pending} icon="shield" color="#8b5cf6" />
        <StatCard label="High Priority" value={high} icon="bell" color="#ef4444" sub="Critical" />
        {escalated > 0 && <StatCard label="Escalated" value={escalated} icon="escalate" color="#dc2626" sub="Overdue SLA" />}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>Recent Requests</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
            {vis.slice(0, 4).map(r => <RequestCard key={r.id} req={r} onClick={onCard} />)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #f1f5f9", padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 14 }}>By Category</div>
            {byType.map(({ type, count }) => (
              <div key={type} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#374151", marginBottom: 4 }}><span>{type}</span><strong>{count}</strong></div>
                <ProgressBar value={total ? (count / total) * 100 : 0} color={REQUEST_TYPE_CONFIG[type].color} />
              </div>
            ))}
          </div>
          <div style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", borderRadius: 20, padding: 20, color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontWeight: 700, fontSize: 14 }}><Icon name="ai" size={16} /> AI Insight</div>
            <p style={{ fontSize: 13, color: "#c7d2fe", lineHeight: 1.6, margin: 0 }}>
              {escalated > 0 ? `🚨 ${escalated} request(s) exceeded SLA. Escalation needed.` : high > 1 ? `${high} high-priority requests need attention.` : "✅ All requests within SLA bounds."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST REGISTER (TRACKER)
// ═══════════════════════════════════════════════════════════════════════════════
const RegisterView = ({ requests, user, onCard }) => {
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("All");
  const [statusF, setStatusF] = useState("All");
  const [priorityF, setPriorityF] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("created");
  const [sortDir, setSortDir] = useState("desc");

  const vis = user.role === "Employee" ? requests.filter(r => r.submitterId === user.id) : user.role === "Staff" ? requests.filter(r => r.assignedDept === user.dept) : requests;

  const filtered = vis.filter(r =>
    (typeF === "All" || r.type === typeF) &&
    (statusF === "All" || r.status === statusF) &&
    (priorityF === "All" || r.priority === priorityF) &&
    (!dateFrom || r.created >= dateFrom) &&
    (!dateTo || r.created <= dateTo) &&
    (r.title.toLowerCase().includes(search.toLowerCase()) || r.id.includes(search) || r.submitter.toLowerCase().includes(search.toLowerCase()) || r.dept.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => {
    const va = a[sortBy] || ""; const vb = b[sortBy] || "";
    return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const Th = ({ k, label }) => (
    <th onClick={() => { if (sortBy === k) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortBy(k); setSortDir("asc"); } }}
      style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6b7280", background: "#f9fafb", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
      {label} {sortBy === k ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );

  const inp = { border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", background: "#fff" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}><Icon name="search" size={14} /></span>
            <input style={{ ...inp, paddingLeft: 32, width: "100%", boxSizing: "border-box" }} placeholder="Search ID, title, submitter..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select style={inp} value={typeF} onChange={e => setTypeF(e.target.value)}>
            <option value="All">All Types</option>{Object.keys(REQUEST_TYPE_CONFIG).map(t => <option key={t}>{t}</option>)}
          </select>
          <select style={inp} value={statusF} onChange={e => setStatusF(e.target.value)}>
            <option value="All">All Statuses</option>{[...STATUS_FLOW, "Rejected"].map(s => <option key={s}>{s}</option>)}
          </select>
          <select style={inp} value={priorityF} onChange={e => setPriorityF(e.target.value)}>
            <option value="All">All Priorities</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Date Range:</span>
          <input style={{ ...inp, fontSize: 12 }} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From" />
          <span style={{ color: "#9ca3af" }}>—</span>
          <input style={{ ...inp, fontSize: 12 }} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To" />
          {(typeF !== "All" || statusF !== "All" || priorityF !== "All" || dateFrom || dateTo || search) &&
            <button onClick={() => { setTypeF("All"); setStatusF("All"); setPriorityF("All"); setDateFrom(""); setDateTo(""); setSearch(""); }} style={{ fontSize: 12, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Clear All</button>}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>{filtered.length} request(s)</span>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <Th k="id" label="Request ID" />
                <Th k="type" label="Type" />
                <Th k="title" label="Title" />
                <Th k="submitter" label="Submitter" />
                <Th k="created" label="Created" />
                <Th k="requestedDate" label="Requested Date" />
                <Th k="eta" label="Target Resolution" />
                <Th k="priority" label="Priority" />
                <Th k="status" label="Status" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 48, color: "#9ca3af", fontSize: 13 }}>No requests match your filters</td></tr>
                : filtered.map((r, i) => (
                  <tr key={r.id} onClick={() => onCard(r)} style={{ cursor: "pointer", background: i % 2 === 0 ? "#fff" : "#fafafa" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#eef2ff"} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafafa"}>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "monospace", color: "#6366f1", fontWeight: 600, whiteSpace: "nowrap" }}>{r.id}</td>
                    <td style={{ padding: "10px 14px" }}><Badge label={r.type} /></td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "#111827", maxWidth: 220 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{r.submitter}<br /><span style={{ color: "#9ca3af" }}>{r.dept}</span></td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{r.created}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{r.requestedDate}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{r.eta}</td>
                    <td style={{ padding: "10px 14px" }}><Badge label={r.priority} /></td>
                    <td style={{ padding: "10px 14px" }}><Badge label={r.status} /></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// FULFILLMENT VIEW
// ═══════════════════════════════════════════════════════════════════════════════
const FulfillmentView = ({ requests, user, onCard }) => {
  const vis = user.role === "Staff" ? requests.filter(r => r.assignedDept === user.dept) : requests;
  const groups = [
    { title: "New Submissions", color: "#f59e0b", items: vis.filter(r => r.status === "Submitted") },
    { title: "Under Review", color: "#8b5cf6", items: vis.filter(r => r.status === "Under Review") },
    { title: "Approved / Active", color: "#6366f1", items: vis.filter(r => r.status === "Approved") },
    { title: "Fulfilled", color: "#10b981", items: vis.filter(r => r.status === "Fulfilled") },
    { title: "Closed / Rejected", color: "#6b7280", items: vis.filter(r => ["Closed", "Rejected"].includes(r.status)) },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20 }}>
      {groups.map(({ title, color, items }) => (
        <div key={title}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{title}</span>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>({items.length})</span>
          </div>
          {items.length === 0 ? <div style={{ fontSize: 12, color: "#9ca3af", paddingLeft: 18 }}>None</div>
            : items.map(r => (
              <div key={r.id} onClick={() => onCard(r)}
                style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #f1f5f9", borderRadius: 14, padding: 12, cursor: "pointer", marginBottom: 8 }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#a5b4fc"} onMouseLeave={e => e.currentTarget.style.borderColor = "#f1f5f9"}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "#9ca3af" }}>{r.id}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{r.assignedTo} · ETA {r.eta}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <Badge label={r.priority} /><span style={{ fontSize: 11, color: "#9ca3af" }}>{r.progress}%</span>
                </div>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS VIEW
// ═══════════════════════════════════════════════════════════════════════════════
const NotifView = ({ requests }) => {
  const notifs = [];
  requests.forEach(r => {
    if (r.status === "Under Review" && daysAgo(r.updated) >= (r.escalationDays || 3))
      notifs.push({ id: r.id + "_esc", type: "escalate", msg: `⚠️ ${r.id} — "${r.title}" exceeded ${r.escalationDays}-day SLA`, ts: r.updated });
    if (r.status === "Approved") notifs.push({ id: r.id + "_app", type: "approve", msg: `✅ ${r.id} — "${r.title}" was fully approved`, ts: r.updated });
    if (r.status === "Rejected") notifs.push({ id: r.id + "_rej", type: "reject", msg: `❌ ${r.id} — "${r.title}" was rejected`, ts: r.updated });
    if (r.status === "Fulfilled") notifs.push({ id: r.id + "_ful", type: "approve", msg: `🎉 ${r.id} — "${r.title}" fulfilled successfully`, ts: r.updated });
    if (r.status === "Closed") notifs.push({ id: r.id + "_cls", type: "close", msg: `🔒 ${r.id} — "${r.title}" has been closed`, ts: r.updated });
    (r.comments || []).forEach(c => notifs.push({ id: c.id, type: "comment", msg: `💬 ${r.id} — ${c.author}: "${c.text.slice(0, 50)}"`, ts: c.ts }));
  });
  
  const tc = { escalate: "#fffbeb", approve: "#f0fdf4", reject: "#fef2f2", comment: "#f5f3ff", close: "#f3f4f6" };
  const ic = { escalate: "#d97706", approve: "#059669", reject: "#dc2626", comment: "#7c3aed", close: "#6b7280" };
  const ii = { escalate: "escalate", approve: "check", reject: "reject", comment: "comment", close: "lock" };
  
  return (
    <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #f1f5f9", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: 15, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="bell" size={18} /> Notifications & Email Log
      </div>
      {notifs.length === 0
        ? <div style={{ padding: 48, textAlign: "center", color: "#9ca3af" }}>No notifications yet</div>
        : notifs.sort((a,b) => new Date(b.ts) - new Date(a.ts)).map(n => (
          <div key={n.id} style={{ display: "flex", gap: 14, padding: "14px 20px", borderBottom: "1px solid #f9fafb", background: tc[n.type] || "#fff" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: ic[n.type] + "22", color: ic[n.type], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name={ii[n.type]} size={14} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>{n.msg}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
                <Icon name="mail" size={11} /> Email dispatched · {n.ts}
              </div>
            </div>
          </div>
        ))
      }
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
function exportCSV(requests) {
  const headers = ["Request ID", "Type", "Title", "Submitter", "Department", "Priority", "Status", "Assigned To", "Created Date", "Requested Date", "Target Resolution Date", "Description"];
  const rows = requests.map(r => [r.id, r.type, `"${r.title}"`, r.submitter, r.dept, r.priority, r.status, r.assignedTo, r.created, r.requestedDate, r.eta, `"${r.description}"`]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `requests_${today()}.csv`; a.click();
}

function exportPDF(requests, single = null) {
  const list = single ? [single] : requests;
  const w = window.open("", "_blank"); if (!w) return;
  
  const approvalRows = r => r.approvalChain?.map(a => {
    return `<tr><td>Level ${a.level} (${a.role})</td><td>${a.status}</td><td>${a.approverId || "—"}</td><td>${a.ts || "—"}</td><td>${a.comment || "—"}</td></tr>`;
  }).join("") || "";
  
  const histRows = r => r.history?.map(h => `<tr><td>${h.action}</td><td>${h.by}</td><td>${h.ts}</td><td>${h.note || "—"}</td></tr>`).join("") || "";
  
  const body = list.map(r => `
    <div class="req">
      <h2>${r.id} — ${r.title}</h2>
      <table class="meta"><tr><th>Type</th><td>${r.type}</td><th>Priority</th><td>${r.priority}</td></tr>
      <tr><th>Submitter</th><td>${r.submitter}</td><th>Department</th><td>${r.dept}</td></tr>
      <tr><th>Status</th><td><strong>${r.status}</strong></td><th>Assigned To</th><td>${r.assignedTo}</td></tr>
      <tr><th>Created</th><td>${r.created}</td><th>Requested Date</th><td>${r.requestedDate}</td></tr>
      <tr><th>Target Resolution</th><td>${r.eta}</td><th>Progress</th><td>${r.progress}%</td></tr></table>
      <h3>Description</h3><p>${r.description}</p>
      ${r.approvalChain?.length ? `<h3>Approval History</h3><table><tr><th>Level</th><th>Status</th><th>Approver</th><th>Date</th><th>Comment</th></tr>${approvalRows(r)}</table>` : ""}
      <h3>Activity History</h3><table><tr><th>Action</th><th>By</th><th>Date</th><th>Note</th></tr>${histRows(r)}</table>
      ${r.comments?.length ? `<h3>Comments</h3>${r.comments.map(c => `<div class="comment"><strong>${c.author}</strong> (${c.ts}): ${c.text}</div>`).join("")}` : ""}
    </div>`).join("<hr/>");
  
  w.document.write(`<!DOCTYPE html><html><head><title>Request Summary</title><style>
    body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{color:#4f46e5;font-size:20px}h2{color:#4f46e5;font-size:16px;margin-top:24px}h3{font-size:13px;color:#374151;margin:16px 0 8px}
    table{border-collapse:collapse;width:100%;margin-bottom:12px}th,td{border:1px solid #ddd;padding:7px 10px;font-size:12px;text-align:left}th{background:#f3f4f6;font-weight:600;width:140px}
    .meta td{width:auto}.req{margin-bottom:40px}hr{margin:32px 0;border:none;border-top:2px solid #e5e7eb}
    .comment{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px;margin-bottom:8px;font-size:12px}
    p{font-size:13px;line-height:1.6;color:#374151}.footer{color:#9ca3af;font-size:11px;margin-top:32px}
  </style></head><body>
  <h1>WorkAccess RMS — Request Summary Report</h1>
  <p class="footer">Generated: ${new Date().toLocaleString()} | Total: ${list.length} request(s)</p>
  ${body}
  </body></html>`);
  w.document.close(); setTimeout(() => w.print(), 600);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState("dashboard");
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load user from token on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`${API}/auth/me`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
    .then(res => {
      if (!res.ok) {
        // Token is stale (server restarted, DB wiped, etc.) — clear it
        localStorage.removeItem("token");
        setLoading(false);
        return null;
      }
      return res.json();
    })
    .then(data => {
      if (!data) return;        // already handled above
      setUser(data);
      loadRequests(token);
      loadNotifications(token);
    })
    .catch(() => {
      localStorage.removeItem("token");
      setLoading(false);
    });
  }, []);
  const loadRequests = async (token) => {
    try {
      const res = await fetch(`${API}/requests`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setRequests(data);
    } catch (error) {
      console.error("Failed to load requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async (token) => {
    try {
      const res = await fetch(`${API}/notifications`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setNotifs(data);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  };

  const addToast = (msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };

  const handleSubmit = async (req) => {
    setRequests(r => [req, ...r]);
    setNotifs(n => [{ id: "n" + Date.now(), msg: `📨 ${req.id} submitted — "${req.title}" routed to ${req.assignedTo}`, ts: today(), read: false }, ...n]);
    addToast(`${req.id} submitted! Routed to ${req.assignedTo}`);
  };

  const handleUpdate = (req) => {
    setRequests(r => r.map(x => x.id === req.id ? req : x));
    if (selected?.id === req.id) setSelected(req);
    const sn = { 
      Approved: `✅ ${req.id} approved!`, 
      Rejected: `❌ ${req.id} rejected.`, 
      Fulfilled: `🎉 ${req.id} fulfilled!`, 
      Closed: `🔒 ${req.id} closed.` 
    };
    if (sn[req.status]) {
      setNotifs(n => [{ 
        id: "n" + Date.now(), 
        msg: sn[req.status] + " Email sent to " + req.submitter, 
        ts: today(), 
        read: false 
      }, ...n]);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    loadRequests(localStorage.getItem("token"));
    loadNotifications(localStorage.getItem("token"));
    setTab("dashboard");
  };

  const handleLogout = () => {
    const token = localStorage.getItem("token");
    if (token) {
      fetch(`${API}/auth/logout`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      }).finally(() => {
        localStorage.removeItem("token");
        setUser(null);
        setRequests([]);
        setNotifs([]);
      });
    } else {
      setUser(null);
    }
  };

  const markAllRead = async () => {
    const token = localStorage.getItem("token");
    try {
      await fetch(`${API}/notifications/read-all`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      setNotifs(n => n.map(x => ({ ...x, read: true })));
    } catch (error) {
      console.error("Failed to mark all read:", error);
    }
  };

  const roleColors = { Admin: "#6366f1", Manager: "#0ea5e9", Employee: "#10b981", Staff: "#f59e0b" };
  const canSubmit = user && ["Employee", "Manager", "Admin"].includes(user.role);

  const TABS = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard", roles: ["Admin", "Manager", "Employee", "Staff"] },
    { id: "register", label: "Request Register", icon: "track", roles: ["Admin", "Manager", "Employee", "Staff"] },
    { id: "fulfillment", label: "Fulfillment", icon: "approve", roles: ["Admin", "Manager", "Staff"] },
    { id: "notifs", label: "Notifications", icon: "mail", roles: ["Admin", "Manager"] },
  ].filter(t => !user || t.roles.includes(user.role));

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div style={{ textAlign: "center" }}><Icon name="shield" size={40} color="#6366f1" /><p>Loading...</p></div>
    </div>;
  }

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <header style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Icon name="shield" size={18} /></div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>WorkAccess RMS</div>
              <div style={{ fontSize: 10, color: "#9ca3af" }}>Workplace Access & Resource Request Management</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <NotifPanel notifs={notifs} onClear={markAllRead} />
            {(user.role === "Admin" || user.role === "Manager") && (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => exportCSV(requests)} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#059669", borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><Icon name="download" size={13} /> CSV</button>
                <button onClick={() => exportPDF(requests)} style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><Icon name="download" size={13} /> PDF</button>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f9fafb", border: "1px solid #f1f5f9", borderRadius: 12, padding: "6px 12px" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: roleColors[user.role] + "22", color: roleColors[user.role], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{user.avatar}</div>
              <div><div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{user.name}</div><div style={{ fontSize: 10, color: roleColors[user.role], fontWeight: 600 }}>{user.role} · {user.dept}</div></div>
            </div>
            <button onClick={handleLogout} title="Logout" style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><Icon name="logout" size={18} /></button>
            {canSubmit && <button onClick={() => setShowNew(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 12, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}><Icon name="plus" size={14} /> New Request</button>}
          </div>
        </div>
      </header>

      <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px", display: "flex", gap: 4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "13px 16px", fontSize: 13, fontWeight: 600, border: "none", borderBottom: tab === t.id ? "2px solid #6366f1" : "2px solid transparent", background: "none", color: tab === t.id ? "#6366f1" : "#6b7280", cursor: "pointer" }}>
              <Icon name={t.icon} size={14} />{t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: roleColors[user.role] + "0d", borderBottom: `1px solid ${roleColors[user.role]}22`, padding: "7px 24px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", fontSize: 12, color: roleColors[user.role], fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="shield" size={12} />
          {user.role === "Admin" && "Admin — Full access to all requests, approvals, exports and system configuration."}
          {user.role === "Manager" && "Manager — Approve/reject requests, view department activity, export reports."}
          {user.role === "Employee" && "Employee — Submit and track your own requests. Only your requests are shown."}
          {user.role === "Staff" && `Staff (${user.dept}) — View and fulfill requests assigned to your department.`}
        </div>
      </div>

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
        {tab === "dashboard" && <DashboardView requests={requests} user={user} onCard={setSelected} />}
        {tab === "register" && <RegisterView requests={requests} user={user} onCard={setSelected} />}
        {tab === "fulfillment" && <FulfillmentView requests={requests} user={user} onCard={setSelected} />}
        {tab === "notifs" && <NotifView requests={requests} />}
      </main>

      {showNew && <NewRequestModal user={user} onClose={() => setShowNew(false)} onSubmit={handleSubmit} />}
      {selected && <DetailPanel req={selected} user={user} onClose={() => setSelected(null)} onUpdate={handleUpdate} addToast={addToast} />}
      <Toast toasts={toasts} />
    </div>
  );
}