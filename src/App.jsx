import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard, FilePlus2, CheckSquare, CalendarDays, BarChart3,
  LogOut, ChevronLeft, ChevronRight, Clock, User, Building2, X, Check,
  AlertCircle, Download, Filter, Menu, Users, TrendingUp, ClipboardList,
  Loader2, Inbox
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from "recharts";

/* ---------------------------------------------------------------------- */
/*  Tokens                                                                 */
/* ---------------------------------------------------------------------- */

const C = {
  ink: "#1B2A4A",
  inkSoft: "#48577A",
  paper: "#F1EFE4",
  paperDeep: "#E7E3D3",
  rule: "#CFC9B3",
  card: "#FBFAF4",
  brass: "#A6813E",
  brassDeep: "#8A6A2E",
  stampGreen: "#3F6B4A",
  stampRed: "#A23B2E",
  stampAmber: "#B8862E",
  casual: "#A6813E",
  sick: "#A2483A",
  earned: "#3B5680",
  onduty: "#4C7A5A",
};

const DEPARTMENTS = [
  "Computer Science", "Mathematics", "Physics", "Chemistry",
  "English", "Commerce", "Mechanical Engineering", "Electrical Engineering", "Civil Engineering",
];

const LEAVE_CATEGORIES = ["Casual Leave", "Sick Leave", "Earned Leave", "On Duty"];

const CATEGORY_COLOR = {
  "Casual Leave": C.casual,
  "Sick Leave": C.sick,
  "Earned Leave": C.earned,
  "On Duty": C.onduty,
};

const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');";

/* ---------------------------------------------------------------------- */
/*  Supabase (real database) connection                                    */
/* ---------------------------------------------------------------------- */

const SUPABASE_URL = "https://jwgynlwyrtiqqndxkkze.supabase.co";
const SUPABASE_KEY = "sb_publishable_4TyTJXHXorZ_i4EESV4vaQ_-zl8sgH0";
const REST = `${SUPABASE_URL}/rest/v1`;

async function authSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.msg || "Invalid email or password.");
  }
  return data; // { access_token, refresh_token, user: { user_metadata: {...} } }
}
function authHeaders(accessToken) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

// DB row (snake_case) -> app record (camelCase)
function fromDb(row) {
  return {
    id: row.id,
    requestNo: row.request_no,
    facultyName: row.faculty_name,
    department: row.department,
    requestType: row.request_type,
    leaveCategory: row.leave_category,
    fromDate: row.from_date,
    toDate: row.to_date,
    days: row.days,
    date: row.perm_date,
    fromTime: row.from_time,
    toTime: row.to_time,
    reason: row.reason,
    status: row.status,
    hodComment: row.hod_comment,
    appliedOn: row.applied_on,
    actionedOn: row.actioned_on,
  };
}
// app record (camelCase) -> DB insert payload (snake_case)
function toDbInsert(record) {
  return {
    request_no: record.requestNo,
    faculty_name: record.facultyName,
    department: record.department,
    request_type: record.requestType,
    leave_category: record.leaveCategory,
    from_date: record.fromDate || null,
    to_date: record.toDate || null,
    days: record.days || null,
    perm_date: record.date || null,
    from_time: record.fromTime || null,
    to_time: record.toTime || null,
    reason: record.reason,
    status: record.status,
  };
}

async function fetchAllRequests(token) {
  const res = await fetch(`${REST}/requests?select=*&order=applied_on.desc`, { headers: authHeaders(token) });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Fetch failed (${res.status}): ${detail}`);
  }
  const rows = await res.json();
  return rows.map(fromDb);
}
async function insertRequestDb(record, token) {
  const res = await fetch(`${REST}/requests`, {
    method: "POST",
    headers: { ...authHeaders(token), Prefer: "return=representation" },
    body: JSON.stringify(toDbInsert(record)),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Insert failed (${res.status}): ${detail}`);
  }
  const rows = await res.json();
  return fromDb(rows[0]);
}
async function updateRequestDb(id, status, hodComment, token) {
  const res = await fetch(`${REST}/requests?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...authHeaders(token), Prefer: "return=representation" },
    body: JSON.stringify({ status, hod_comment: hodComment || null, actioned_on: new Date().toISOString() }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Update failed (${res.status}): ${detail}`);
  }
  const rows = await res.json();
  return fromDb(rows[0]);
}

/* ---------------------------------------------------------------------- */
/*  Local profile memory (device-only, not shared)                         */
/* ---------------------------------------------------------------------- */

const PROFILE_KEY = "my-profile-v1";

async function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
async function persistProfile(p) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* non-fatal */
  }
}
async function clearProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* non-fatal */
  }
}

/* ---------------------------------------------------------------------- */
/*  Utilities                                                              */
/* ---------------------------------------------------------------------- */

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}
function daysBetween(from, to) {
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  return Math.round((b - a) / 86400000) + 1;
}
function nextRequestNo(existing) {
  const year = new Date().getFullYear();
  const count = existing.filter((r) => r.requestNo && r.requestNo.startsWith(`REQ-${year}`)).length + 1;
  return `REQ-${year}-${String(count).padStart(4, "0")}`;
}
function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
function dateInRange(dateStr, from, to) {
  return dateStr >= from && dateStr <= to;
}

/* ---------------------------------------------------------------------- */
/*  Small UI atoms                                                         */
/* ---------------------------------------------------------------------- */

function Toast({ toast }) {
  if (!toast) return null;
  const bg = toast.type === "error" ? C.stampRed : toast.type === "warn" ? C.stampAmber : C.stampGreen;
  return (
    <div
      style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        background: C.ink, color: C.paper, padding: "10px 18px", borderRadius: 6,
        borderLeft: `4px solid ${bg}`, fontFamily: "Inter, sans-serif", fontSize: 14,
        zIndex: 100, boxShadow: "0 8px 24px rgba(27,42,74,0.35)", maxWidth: "90vw",
      }}
    >
      {toast.message}
    </div>
  );
}

function StatusStamp({ status, size = "md" }) {
  const cfg = {
    Approved: { color: C.stampGreen, label: "APPROVED", r: -7 },
    Rejected: { color: C.stampRed, label: "REJECTED", r: 6 },
    Pending: { color: C.stampAmber, label: "PENDING", r: -3 },
  }[status];
  const pad = size === "sm" ? "3px 8px" : "5px 12px";
  const fs = size === "sm" ? 10 : 12;
  return (
    <span
      className="stamp-el"
      style={{
        "--r": `${cfg.r}deg`,
        display: "inline-block", border: `2px solid ${cfg.color}`, color: cfg.color,
        borderRadius: 4, padding: pad, fontFamily: "'IBM Plex Mono', monospace",
        fontWeight: 600, fontSize: fs, letterSpacing: "0.12em",
        transform: `rotate(${cfg.r}deg)`, background: "rgba(255,255,255,0.4)",
      }}
    >
      {cfg.label}
    </span>
  );
}

function EmptyState({ icon: Icon, title, sub }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 20px", color: C.inkSoft }}>
      <Icon size={30} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
      <div style={{ fontFamily: "Lora, serif", fontSize: 17, color: C.ink, marginBottom: 4 }}>{title}</div>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13 }}>{sub}</div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div
      style={{
        background: C.card, border: `1px solid ${C.rule}`, borderTop: `3px solid ${accent || C.brass}`,
        borderRadius: 8, padding: "16px 18px", flex: "1 1 140px", minWidth: 140,
      }}
    >
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 600, color: C.ink }}>
        {value}
      </div>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, color: C.inkSoft, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Onboarding                                                             */
/* ---------------------------------------------------------------------- */

function Login({ onDone }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit = email.trim().length > 3 && password.length > 0 && !loading;

  async function handleSubmit() {
    setErr("");
    setLoading(true);
    try {
      const data = await authSignIn(email.trim(), password);
      const meta = data.user?.user_metadata || {};
      if (!meta.role || !meta.department) {
        throw new Error("This account is missing role/department info. Ask your admin to set it up.");
      }
      onDone({
        role: meta.role,
        name: meta.name || data.user.email,
        department: meta.department,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      });
    } catch (e) {
      setErr(e.message || "Couldn't sign in.");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.paper, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{FONT_IMPORT}</style>
      <div style={{ width: "100%", maxWidth: 420, background: C.card, border: `1px solid ${C.rule}`, borderRadius: 12, padding: "36px 32px", boxShadow: "0 20px 50px rgba(27,42,74,0.12)" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.18em", color: C.brassDeep, textTransform: "uppercase", marginBottom: 6 }}>
          Sign In
        </div>
        <h1 style={{ fontFamily: "Lora, serif", fontSize: 26, color: C.ink, margin: "0 0 6px" }}>Faculty Leave Ledger</h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13.5, color: C.inkSoft, margin: "0 0 24px" }}>
          Sign in with the email and password given to you by your administrator.
        </p>

        <label style={{ display: "block", fontFamily: "Inter, sans-serif", fontSize: 12.5, color: C.inkSoft, marginBottom: 6 }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@college.edu"
          style={inputStyle}
          onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
        />

        <label style={{ display: "block", fontFamily: "Inter, sans-serif", fontSize: 12.5, color: C.inkSoft, margin: "16px 0 6px" }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
          style={inputStyle}
          onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
        />

        {err && (
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start", color: C.stampRed, fontSize: 12.5, marginTop: 12, fontFamily: "Inter, sans-serif" }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {err}
          </div>
        )}

        <button
          disabled={!canSubmit}
          onClick={handleSubmit}
          style={{
            marginTop: 24, width: "100%", padding: "12px 0", borderRadius: 7, border: "none",
            background: canSubmit ? C.ink : C.rule, color: C.paper, fontFamily: "Inter, sans-serif",
            fontWeight: 600, fontSize: 14.5, cursor: canSubmit ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {loading && <Loader2 size={15} className="spin" />}
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: C.inkSoft, marginTop: 18, textAlign: "center" }}>
          Don't have an account? Ask your administrator to create one for you.
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 6,
  border: `1.5px solid ${C.rule}`, background: "#fff", color: C.ink,
  fontFamily: "Inter, sans-serif", fontSize: 14, outline: "none",
};

/* ---------------------------------------------------------------------- */
/*  New Request form                                                       */
/* ---------------------------------------------------------------------- */

function NewRequestForm({ profile, requests, onSubmit }) {
  const [type, setType] = useState("Leave");
  const [category, setCategory] = useState(LEAVE_CATEGORIES[0]);
  const [fromDate, setFromDate] = useState(isoToday());
  const [toDate, setToDate] = useState(isoToday());
  const [permDate, setPermDate] = useState(isoToday());
  const [fromTime, setFromTime] = useState("10:00");
  const [toTime, setToTime] = useState("12:00");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  const days = type === "Leave" ? daysBetween(fromDate, toDate) : null;

  function handleSubmit() {
    setErr("");
    if (reason.trim().length < 6) {
      setErr("Please add a brief reason (at least a few words).");
      return;
    }
    if (type === "Leave" && toDate < fromDate) {
      setErr("End date can't be before the start date.");
      return;
    }
    const base = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      requestNo: nextRequestNo(requests),
      facultyName: profile.name,
      department: profile.department,
      requestType: type,
      reason: reason.trim(),
      status: "Pending",
      appliedOn: new Date().toISOString(),
      actionedOn: null,
      hodComment: "",
    };
    const record =
      type === "Leave"
        ? { ...base, leaveCategory: category, fromDate, toDate, days: daysBetween(fromDate, toDate) }
        : { ...base, leaveCategory: "Permission", date: permDate, fromTime, toTime };
    onSubmit(record);
    setReason("");
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <SectionHeading eyebrow="New Entry" title="File a leave or permission request" />
      <div style={cardStyle}>
        <FieldLabel>Request type</FieldLabel>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {["Leave", "Permission"].map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 6, cursor: "pointer",
                border: `1.5px solid ${type === t ? C.brass : C.rule}`,
                background: type === t ? "rgba(166,129,62,0.12)" : "transparent",
                color: type === t ? C.brassDeep : C.inkSoft, fontFamily: "Inter, sans-serif",
                fontWeight: 600, fontSize: 13.5,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {type === "Leave" ? (
          <>
            <FieldLabel>Leave category</FieldLabel>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }}>
              {LEAVE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <FieldLabel>From</FieldLabel>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabel>To</FieldLabel>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: C.inkSoft, marginBottom: 16 }}>
              {days > 0 ? `${days} day${days > 1 ? "s" : ""} total` : "--"}
            </div>
          </>
        ) : (
          <>
            <FieldLabel>Date</FieldLabel>
            <input type="date" value={permDate} onChange={(e) => setPermDate(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <FieldLabel>From time</FieldLabel>
                <input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabel>To time</FieldLabel>
                <input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </>
        )}

        <FieldLabel>Reason</FieldLabel>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Brief reason for this request..."
          style={{ ...inputStyle, resize: "vertical", marginBottom: 8, fontFamily: "Inter, sans-serif" }}
        />
        {err && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", color: C.stampRed, fontSize: 12.5, marginBottom: 10, fontFamily: "Inter, sans-serif" }}>
            <AlertCircle size={14} /> {err}
          </div>
        )}
        <button onClick={handleSubmit} style={primaryBtnStyle}>
          Submit request
        </button>
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: C.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {children}
    </div>
  );
}
function SectionHeading({ eyebrow, title, right }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.16em", color: C.brassDeep, textTransform: "uppercase", marginBottom: 4 }}>
          {eyebrow}
        </div>
        <h2 style={{ fontFamily: "Lora, serif", fontSize: 22, color: C.ink, margin: 0 }}>{title}</h2>
      </div>
      {right}
    </div>
  );
}
const cardStyle = { background: C.card, border: `1px solid ${C.rule}`, borderRadius: 10, padding: 22 };
const primaryBtnStyle = {
  padding: "11px 22px", borderRadius: 7, border: "none", background: C.ink, color: C.paper,
  fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer",
};

/* ---------------------------------------------------------------------- */
/*  Request card (list item)                                               */
/* ---------------------------------------------------------------------- */

function RequestCard({ req, showFaculty, actions }) {
  const catColor = CATEGORY_COLOR[req.leaveCategory] || C.brass;
  return (
    <div style={{ ...cardStyle, padding: 16, display: "flex", flexDirection: "column", gap: 10, borderLeft: `4px solid ${catColor}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: C.inkSoft, marginBottom: 3 }}>
            {req.requestNo} - {req.department}
          </div>
          {showFaculty && (
            <div style={{ fontFamily: "Lora, serif", fontSize: 16, color: C.ink, fontWeight: 600 }}>{req.facultyName}</div>
          )}
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13.5, color: C.ink, marginTop: 2 }}>
            <span style={{ fontWeight: 600, color: catColor }}>{req.leaveCategory}</span>
            {" - "}
            {req.requestType === "Leave"
              ? `${fmtDate(req.fromDate)} -> ${fmtDate(req.toDate)} (${req.days} day${req.days > 1 ? "s" : ""})`
              : `${fmtDate(req.date)}, ${req.fromTime}-${req.toTime}`}
          </div>
        </div>
        <StatusStamp status={req.status} />
      </div>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13.5, color: C.inkSoft, lineHeight: 1.5 }}>{req.reason}</div>
      {req.status !== "Pending" && req.hodComment && (
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, color: C.inkSoft, background: C.paperDeep, borderRadius: 6, padding: "8px 10px" }}>
          <strong style={{ color: C.ink }}>HOD note:</strong> {req.hodComment}
        </div>
      )}
      {actions}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Approval action row                                                    */
/* ---------------------------------------------------------------------- */

function ApprovalActions({ req, onAction }) {
  const [comment, setComment] = useState("");
  return (
    <div style={{ borderTop: `1px dashed ${C.rule}`, paddingTop: 10, marginTop: 2 }}>
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional note for the faculty member..."
        style={{ ...inputStyle, marginBottom: 8, fontSize: 13 }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onAction(req.id, "Approved", comment)}
          style={{ ...primaryBtnStyle, background: C.stampGreen, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <Check size={15} /> Approve
        </button>
        <button
          onClick={() => onAction(req.id, "Rejected", comment)}
          style={{ ...primaryBtnStyle, background: "transparent", color: C.stampRed, border: `1.5px solid ${C.stampRed}`, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <X size={15} /> Reject
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Calendar view                                                          */
/* ---------------------------------------------------------------------- */

function CalendarView({ requests }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const approvedLeaves = useMemo(
    () => requests.filter((r) => r.requestType === "Leave" && r.status === "Approved"),
    [requests]
  );

  function leavesOnDay(dateStr) {
    return approvedLeaves.filter((r) => dateInRange(dateStr, r.fromDate, r.toDate));
  }

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedList = selectedDay ? leavesOnDay(selectedDay) : [];

  return (
    <div>
      <SectionHeading
        eyebrow="Register"
        title="Leave calendar"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setCursor(new Date(year, month - 1, 1))} style={iconBtnStyle}><ChevronLeft size={16} /></button>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.ink, minWidth: 130, textAlign: "center" }}>
              {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </div>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))} style={iconBtnStyle}><ChevronRight size={16} /></button>
          </div>
        }
      />

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ ...cardStyle, flex: "2 1 460px", padding: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 8 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} style={{ textAlign: "center", fontFamily: "Inter, sans-serif", fontSize: 11.5, color: C.inkSoft, fontWeight: 600 }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const list = leavesOnDay(dateStr);
              const isToday = dateStr === isoToday();
              const isSel = dateStr === selectedDay;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(dateStr)}
                  style={{
                    minHeight: 56, borderRadius: 6, border: `1.5px solid ${isSel ? C.brass : isToday ? C.ink : C.rule}`,
                    background: isSel ? "rgba(166,129,62,0.12)" : "#fff", padding: 5, cursor: "pointer", textAlign: "left",
                    display: "flex", flexDirection: "column", gap: 3,
                  }}
                >
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: C.ink }}>{d}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                    {list.slice(0, 3).map((r) => (
                      <span key={r.id} style={{ width: 6, height: 6, borderRadius: "50%", background: CATEGORY_COLOR[r.leaveCategory] }} />
                    ))}
                    {list.length > 3 && <span style={{ fontSize: 9, color: C.inkSoft }}>+{list.length - 3}</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 16 }}>
            {LEAVE_CATEGORIES.map((c) => (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "Inter, sans-serif", fontSize: 11.5, color: C.inkSoft }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORY_COLOR[c] }} /> {c}
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle, flex: "1 1 240px", padding: 18 }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 15.5, color: C.ink, marginBottom: 10 }}>
            {selectedDay ? fmtDate(selectedDay) : "Select a day"}
          </div>
          {!selectedDay && <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.inkSoft }}>Click a date to see who's on leave.</div>}
          {selectedDay && selectedList.length === 0 && (
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.inkSoft }}>No approved leave on this date.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {selectedList.map((r) => (
              <div key={r.id} style={{ borderLeft: `3px solid ${CATEGORY_COLOR[r.leaveCategory]}`, paddingLeft: 10 }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13.5, fontWeight: 600, color: C.ink }}>{r.facultyName}</div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: C.inkSoft }}>{r.department} - {r.leaveCategory}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
const iconBtnStyle = {
  width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
  borderRadius: 6, border: `1.5px solid ${C.rule}`, background: "#fff", cursor: "pointer", color: C.ink,
};

/* ---------------------------------------------------------------------- */
/*  Reports view                                                           */
/* ---------------------------------------------------------------------- */

function ReportsView({ requests, scopeLabel }) {
  const total = requests.length;
  const approved = requests.filter((r) => r.status === "Approved").length;
  const rejected = requests.filter((r) => r.status === "Rejected").length;
  const pending = requests.filter((r) => r.status === "Pending").length;
  const approvalRate = total ? Math.round((approved / (approved + rejected || 1)) * 100) : 0;

  const byCategory = useMemo(() => {
    const map = {};
    requests.forEach((r) => { map[r.leaveCategory] = (map[r.leaveCategory] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [requests]);

  const byMonth = useMemo(() => {
    const map = {};
    requests.forEach((r) => {
      const m = new Date(r.appliedOn).toLocaleDateString("en-US", { month: "short" });
      map[m] = (map[m] || 0) + 1;
    });
    const order = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return order.filter((m) => map[m]).map((m) => ({ month: m, count: map[m] }));
  }, [requests]);

  function exportCsv() {
    const header = ["Request No", "Faculty", "Department", "Type", "Category", "From/Date", "To/Time", "Status", "Reason", "Applied On"];
    const rows = requests.map((r) => [
      r.requestNo, r.facultyName, r.department, r.requestType, r.leaveCategory,
      r.requestType === "Leave" ? r.fromDate : r.date,
      r.requestType === "Leave" ? r.toDate : r.toTime,
      r.status, `"${(r.reason || "").replace(/"/g, "'")}"`,
      new Date(r.appliedOn).toISOString().slice(0, 10),
    ]);
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "leave-requests.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <SectionHeading
        eyebrow={scopeLabel}
        title="Reports"
        right={
          <button onClick={exportCsv} style={{ ...primaryBtnStyle, background: "transparent", color: C.ink, border: `1.5px solid ${C.ink}`, display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={15} /> Export CSV
          </button>
        }
      />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <StatCard label="Total requests" value={total} />
        <StatCard label="Approved" value={approved} accent={C.stampGreen} />
        <StatCard label="Rejected" value={rejected} accent={C.stampRed} />
        <StatCard label="Pending" value={pending} accent={C.stampAmber} />
        <StatCard label="Approval rate" value={`${approvalRate}%`} accent={C.brass} />
      </div>

      {total === 0 ? (
        <EmptyState icon={BarChart3} title="Nothing to report yet" sub="Charts will appear once requests are filed." />
      ) : (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div style={{ ...cardStyle, flex: "1 1 320px", height: 300 }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, color: C.inkSoft, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>By category</div>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={byCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.rule} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "Inter, sans-serif" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontFamily: "Inter, sans-serif", fontSize: 12 }} />
                <Bar dataKey="count" fill={C.brass} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...cardStyle, flex: "1 1 320px", height: 300 }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, color: C.inkSoft, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Monthly trend</div>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.rule} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: "Inter, sans-serif" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontFamily: "Inter, sans-serif", fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke={C.ink} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Main App                                                                */
/* ---------------------------------------------------------------------- */

const NAV_FACULTY = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "new", label: "New Request", icon: FilePlus2 },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "reports", label: "My Reports", icon: BarChart3 },
];
const NAV_HOD = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "approvals", label: "Approvals", icon: CheckSquare },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "reports", label: "Reports", icon: BarChart3 },
];

export default function FacultyLeaveTracker() {
  const [profile, setProfile] = useState(undefined); // undefined = loading, null = needs login
  const [requests, setRequests] = useState([]);
  const [loadingReq, setLoadingReq] = useState(true);
  const [view, setView] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [navOpen, setNavOpen] = useState(false);

  const showToast = useCallback((message, type = "ok") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), type === "error" ? 7000 : 2600);
  }, []);

  useEffect(() => {
    (async () => {
      const p = await loadProfile();
      setProfile(p);
    })();
  }, []);

  useEffect(() => {
    if (profile === undefined) return; // still resolving login state
    if (!profile) {
      setRequests([]);
      setLoadingReq(false);
      return;
    }
    (async () => {
      setLoadingReq(true);
      try {
        const r = await fetchAllRequests(profile.accessToken);
        setRequests(r);
      } catch {
        showToast("Couldn't load data from the database -- check your connection.", "error");
      }
      setLoadingReq(false);
    })();
  }, [profile, showToast]);

  async function handleLoginSuccess(p) {
    setProfile(p);
    await persistProfile(p);
  }

  async function handleSubmitRequest(record) {
    try {
      const inserted = await insertRequestDb(record, profile.accessToken);
      setRequests((prev) => [inserted, ...prev]);
      showToast(`Filed ${inserted.requestNo}`, "ok");
    } catch (e) {
      showToast(e.message || "Couldn't save to the database.", "error");
    }
    setView("dashboard");
  }

  async function handleAction(id, status, comment) {
    try {
      const updated = await updateRequestDb(id, status, comment, profile.accessToken);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      showToast(`Marked ${status.toLowerCase()}`, "ok");
    } catch (e) {
      showToast(e.message || "Update failed to sync.", "error");
    }
  }

  async function handleSignOut() {
    await clearProfile();
    setProfile(null);
  }

  if (profile === undefined || loadingReq) {
    return (
      <div style={{ minHeight: "100vh", background: C.paper, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{FONT_IMPORT}</style>
        <Loader2 className="spin" size={26} color={C.ink} />
      </div>
    );
  }
  if (!profile) return <Login onDone={handleLoginSuccess} />;

  const isFaculty = profile.role === "faculty";
  const nav = isFaculty ? NAV_FACULTY : NAV_HOD;

  const myRequests = isFaculty
    ? requests.filter((r) => r.facultyName === profile.name && r.department === profile.department)
    : requests.filter((r) => r.department === profile.department);

  const pendingForHod = !isFaculty ? myRequests.filter((r) => r.status === "Pending") : [];

  return (
    <div style={{ minHeight: "100vh", background: C.paper, fontFamily: "Inter, sans-serif", color: C.ink }}>
      <style>{`
        ${FONT_IMPORT}
        .stamp-el { animation: stampIn 0.5s cubic-bezier(.2,.9,.3,1.2); }
        @keyframes stampIn { 0% { transform: scale(2.4) rotate(var(--r)); opacity:0;} 60%{opacity:1;} 100% { transform: scale(1) rotate(var(--r)); opacity:1;} }
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::selection { background: rgba(166,129,62,0.3); }
      `}</style>

      <Toast toast={toast} />

      {/* Top bar (mobile) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${C.rule}`, background: C.card }} className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setNavOpen((v) => !v)} style={{ ...iconBtnStyle, display: "none" }} className="hamburger">
            <Menu size={16} />
          </button>
          <div style={{ fontFamily: "Lora, serif", fontWeight: 700, fontSize: 18 }}>Faculty Leave Ledger</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{profile.name}</div>
            <div style={{ fontSize: 11, color: C.inkSoft }}>{isFaculty ? "Faculty" : "HOD"} - {profile.department}</div>
          </div>
          <button onClick={handleSignOut} style={iconBtnStyle} title="Sign out"><LogOut size={15} /></button>
        </div>
      </div>

      <div style={{ display: "flex", maxWidth: 1180, margin: "0 auto" }}>
        {/* Sidebar */}
        <div style={{ width: 190, flexShrink: 0, padding: "24px 12px", borderRight: `1px solid ${C.rule}`, display: "flex", flexDirection: "column", gap: 4 }} className="sidebar">
          {nav.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 7,
                border: "none", cursor: "pointer", textAlign: "left",
                background: view === key ? C.ink : "transparent",
                color: view === key ? C.paper : C.inkSoft,
                fontFamily: "Inter, sans-serif", fontSize: 13.5, fontWeight: 600,
              }}
            >
              <Icon size={16} /> {label}
              {key === "approvals" && pendingForHod.length > 0 && (
                <span style={{ marginLeft: "auto", background: C.stampAmber, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10.5 }}>
                  {pendingForHod.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: "26px 22px", minWidth: 0 }}>
          {view === "dashboard" && (
            <DashboardView
              isFaculty={isFaculty}
              profile={profile}
              myRequests={myRequests}
              onGoNew={() => setView(isFaculty ? "new" : "approvals")}
            />
          )}
          {view === "new" && isFaculty && (
            <NewRequestForm profile={profile} requests={requests} onSubmit={handleSubmitRequest} />
          )}
          {view === "approvals" && !isFaculty && (
            <ApprovalsView pending={pendingForHod} onAction={handleAction} history={myRequests.filter((r) => r.status !== "Pending")} />
          )}
          {view === "calendar" && <CalendarView requests={isFaculty ? requests : myRequests} />}
          {view === "reports" && (
            <ReportsView requests={myRequests} scopeLabel={isFaculty ? "Your record" : `${profile.department} record`} />
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .sidebar { display: none !important; }
        }
      `}</style>
      {/* Mobile bottom nav */}
      <div className="mobile-nav" style={{
        display: "none", position: "fixed", bottom: 0, left: 0, right: 0, background: C.card,
        borderTop: `1px solid ${C.rule}`, padding: "8px 4px", justifyContent: "space-around", zIndex: 50,
      }}>
        {nav.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setView(key)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none",
            color: view === key ? C.ink : C.inkSoft, fontFamily: "Inter, sans-serif", fontSize: 10, cursor: "pointer",
          }}>
            <Icon size={17} /> {label}
          </button>
        ))}
      </div>
      <style>{`
        @media (max-width: 760px) {
          .mobile-nav { display: flex !important; }
          body { padding-bottom: 60px; }
        }
      `}</style>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Dashboard view                                                         */
/* ---------------------------------------------------------------------- */

function DashboardView({ isFaculty, profile, myRequests, onGoNew }) {
  const pending = myRequests.filter((r) => r.status === "Pending").length;
  const approved = myRequests.filter((r) => r.status === "Approved").length;
  const rejected = myRequests.filter((r) => r.status === "Rejected").length;
  const uniqueFaculty = new Set(myRequests.map((r) => r.facultyName)).size;

  const recent = [...myRequests]
    .sort((a, b) => new Date(b.appliedOn) - new Date(a.appliedOn))
    .slice(0, 6);

  return (
    <div>
      <SectionHeading
        eyebrow={isFaculty ? "Overview" : `${profile.department} - Overview`}
        title={isFaculty ? `Welcome back, ${profile.name.split(" ")[0]}` : "Department overview"}
        right={
          <button onClick={onGoNew} style={{ ...primaryBtnStyle, display: "flex", alignItems: "center", gap: 6 }}>
            {isFaculty ? <FilePlus2 size={15} /> : <CheckSquare size={15} />}
            {isFaculty ? "New request" : "Go to approvals"}
          </button>
        }
      />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Pending" value={pending} accent={C.stampAmber} />
        <StatCard label="Approved" value={approved} accent={C.stampGreen} />
        <StatCard label="Rejected" value={rejected} accent={C.stampRed} />
        {!isFaculty && <StatCard label="Faculty on record" value={uniqueFaculty} accent={C.brass} />}
      </div>

      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, color: C.inkSoft, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Recent activity
      </div>
      {recent.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No entries yet"
          sub={isFaculty ? "File your first leave or permission request to get started." : "No requests filed for this department yet."}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {recent.map((r) => (
            <RequestCard key={r.id} req={r} showFaculty={!isFaculty} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Approvals view (HOD)                                                   */
/* ---------------------------------------------------------------------- */

function ApprovalsView({ pending, onAction, history }) {
  const [tab, setTab] = useState("pending");
  const sortedHistory = [...history].sort((a, b) => new Date(b.actionedOn || b.appliedOn) - new Date(a.actionedOn || a.appliedOn));

  return (
    <div>
      <SectionHeading eyebrow="Review desk" title="Approvals" />
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[{ k: "pending", l: `Pending (${pending.length})` }, { k: "history", l: "History" }].map(({ k, l }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: "7px 14px", borderRadius: 6, cursor: "pointer",
              border: `1.5px solid ${tab === k ? C.ink : C.rule}`,
              background: tab === k ? C.ink : "transparent",
              color: tab === k ? C.paper : C.inkSoft, fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600,
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "pending" ? (
        pending.length === 0 ? (
          <EmptyState icon={CheckSquare} title="All caught up" sub="No pending requests waiting on your review." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pending.map((r) => (
              <RequestCard key={r.id} req={r} showFaculty actions={<ApprovalActions req={r} onAction={onAction} />} />
            ))}
          </div>
        )
      ) : sortedHistory.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No decisions yet" sub="Approved and rejected requests will be listed here." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sortedHistory.map((r) => (
            <RequestCard key={r.id} req={r} showFaculty />
          ))}
        </div>
      )}
    </div>
  );
}
