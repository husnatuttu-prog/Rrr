import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
import {
  LayoutDashboard, Settings, Users, FileText, LayoutTemplate, Sun, Moon, Plus, Search,
  Filter, Pencil, Trash2, Copy, Upload, Download, Eye, EyeOff, ChevronUp, ChevronDown,
  GripVertical, X, Check, AlertTriangle, ImageIcon, Table2, Type, BarChart3, LayoutGrid,
  Undo2, Redo2, Save, CloudUpload, ArrowLeft, ArrowRight, Star, Award, TrendingUp,
  CalendarCheck, GraduationCap, Building2, ChevronRight, MoreVertical, FileSpreadsheet,
  CheckCircle2, XCircle, Info, Palette, RotateCcw, FolderOpen, PlusCircle, ClipboardList,
  UserPlus, PenLine, Sparkles
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

/* ============================================================================
   DESIGN TOKENS
   Deep indigo ink + muted academic gold. Serif display (Fraunces) for
   headings and report titles, Inter for UI/body, IBM Plex Mono for data.
   ========================================================================== */
const FONT_LINK =
  "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Playfair+Display:wght@500;600;700;900&family=Libre+Baskerville:wght@400;700&family=Sora:wght@400;600;700;800&display=swap');";

const TOKENS = {
  ink: "#171B2E",
  ink2: "#1B2340",
  gold: "#C89B3C",
  goldSoft: "#E8D6A8",
  bg: "#F5F6FA",
  bgDark: "#0F1220",
  surface: "#FFFFFF",
  surfaceDark: "#171A2C",
  line: "#E6E7F0",
  lineDark: "#2A2E45",
  muted: "#6B7086",
  mutedDark: "#9498B0",
  success: "#2F9E77",
  warn: "#E2634F",
  info: "#3B6FCE",
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* ============================================================================
   STORAGE (persistent, per-user, via window.storage — never localStorage)
   ========================================================================== */
async function storageGet(key, fallback) {
  try {
    const r = await window.storage.get(key, false);
    return r ? JSON.parse(r.value) : fallback;
  } catch {
    return fallback;
  }
}
async function storageSet(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
    return true;
  } catch {
    return false;
  }
}

function useDebouncedAutosave(value, key, deps, delay = 700) {
  const [status, setStatus] = useState("idle"); // idle | saving | saved
  const timer = useRef(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await storageSet(key, value);
      setStatus("saved");
    }, delay);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line
  }, deps);
  return status;
}

/* ============================================================================
   DOMAIN DEFAULTS
   ========================================================================== */
const GRADE_SCALE = [
  { min: 90, grade: "A+", label: "Outstanding" },
  { min: 80, grade: "A", label: "Excellent" },
  { min: 70, grade: "B+", label: "Very Good" },
  { min: 60, grade: "B", label: "Good" },
  { min: 50, grade: "C", label: "Satisfactory" },
  { min: 40, grade: "D", label: "Needs Improvement" },
  { min: 0, grade: "F", label: "Requires Attention" },
];
function gradeFor(pct) {
  return GRADE_SCALE.find((g) => pct >= g.min) || GRADE_SCALE[GRADE_SCALE.length - 1];
}

const DEFAULT_SCHOOL = {
  name: "Riverdale International School",
  address: "123 Education Lane, Springfield",
  academicYear: "2025 – 2026",
  logo: null,
  principalName: "Dr. Anita Rao",
  principalSig: null,
  coordinatorName: "Mr. James Whitfield",
  coordinatorSig: null,
  colors: { primary: "#1B2340", accent: "#C89B3C", bg: "#F5F6FA" },
  fontHeading: "Fraunces",
  fontBody: "Inter",
  subjects: ["English", "Mathematics", "Science", "Social Studies", "Second Language", "Computer Science"],
  activities: ["Sports", "Art & Craft", "Music", "Public Speaking"],
  headings: {
    assessment: "Continuous Assessment",
    activity: "Activity Assessment",
    attendance: "Attendance",
    character: "Character & Classroom Behaviour",
    hostel: "Hostel Behaviour",
    strengths: "Strengths",
    improvement: "Areas for Improvement",
    remarks: "Teacher's Remarks",
  },
  defaultSectionVisibility: {
    studentInfo: true, photo: true, assessmentTable: true, activityTable: true,
    attendance: true, character: true, hostel: false, strengths: true,
    improvement: true, remarks: true, signatures: true,
  },
  defaultThemeId: "executive",
};

const SECTION_LIBRARY = [
  { type: "studentInfo", title: "Student Information", icon: Users },
  { type: "photo", title: "Student Photo", icon: ImageIcon },
  { type: "assessmentTable", title: "Continuous Assessment", icon: Table2 },
  { type: "activityTable", title: "Activity Assessment", icon: Table2 },
  { type: "attendance", title: "Attendance", icon: CalendarCheck },
  { type: "character", title: "Character & Classroom Behaviour", icon: PenLine },
  { type: "hostel", title: "Hostel Behaviour", icon: PenLine },
  { type: "strengths", title: "Strengths", icon: Star },
  { type: "improvement", title: "Areas for Improvement", icon: TrendingUp },
  { type: "remarks", title: "Teacher's Remarks", icon: Type },
  { type: "signatures", title: "Signatures", icon: PenLine },
];
const CUSTOM_LIBRARY = [
  { type: "custom-text", title: "Rich Text Block", icon: Type },
  { type: "custom-table", title: "Custom Table", icon: Table2 },
  { type: "custom-image", title: "Image", icon: ImageIcon },
  { type: "custom-chart", title: "Chart", icon: BarChart3 },
  { type: "custom-cards", title: "Stat Cards", icon: LayoutGrid },
];

function defaultSections(school) {
  const vis = school.defaultSectionVisibility;
  return [
    { id: uid(), type: "studentInfo", title: "Student Information", visible: vis.studentInfo, order: 0, data: {} },
    { id: uid(), type: "photo", title: "Student Photo", visible: vis.photo, order: 1, data: {} },
    { id: uid(), type: "assessmentTable", title: school.headings.assessment, visible: vis.assessmentTable, order: 2,
      data: { rows: school.subjects.map((s) => ({ id: uid(), name: s, obtained: "", total: 100, remarks: "" })) } },
    { id: uid(), type: "activityTable", title: school.headings.activity, visible: vis.activityTable, order: 3,
      data: { rows: school.activities.map((a) => ({ id: uid(), name: a, obtained: "", total: 10, remarks: "" })) } },
    { id: uid(), type: "attendance", title: school.headings.attendance, visible: vis.attendance, order: 4, data: { present: "", total: "" } },
    { id: uid(), type: "character", title: school.headings.character, visible: vis.character, order: 5, data: { html: "" } },
    { id: uid(), type: "hostel", title: school.headings.hostel, visible: vis.hostel, order: 6, data: { html: "" } },
    { id: uid(), type: "strengths", title: school.headings.strengths, visible: vis.strengths, order: 7, data: { html: "" } },
    { id: uid(), type: "improvement", title: school.headings.improvement, visible: vis.improvement, order: 8, data: { html: "" } },
    { id: uid(), type: "remarks", title: school.headings.remarks, visible: vis.remarks, order: 9, data: { html: "" } },
    { id: uid(), type: "signatures", title: "Signatures", visible: vis.signatures, order: 10, data: {} },
  ];
}

const THEMES = [
  { id: "executive", name: "Executive / International", blurb: "Luxury, minimal, certificate-style" },
  { id: "colorful", name: "Modern Colorful", blurb: "Bright, friendly, gradient cards" },
  { id: "editorial", name: "Magazine Editorial", blurb: "Asymmetric grid, bold type" },
  { id: "dashboard", name: "Academic Dashboard", blurb: "KPI cards, rings, analytics" },
  { id: "classic", name: "Classic School Report", blurb: "Formal, tabular, print-first" },
];

/* ============================================================================
   APP CONTEXT
   ========================================================================== */
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

function AppProvider({ children }) {
  const [loaded, setLoaded] = useState(false);
  const [dark, setDark] = useState(false);
  const [school, setSchool] = useState(DEFAULT_SCHOOL);
  const [students, setStudents] = useState([]);
  const [reports, setReports] = useState([]);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    (async () => {
      const [s, st, rp, tp, dk] = await Promise.all([
        storageGet("school-config", DEFAULT_SCHOOL),
        storageGet("students", []),
        storageGet("reports", []),
        storageGet("templates", []),
        storageGet("dark-mode", false),
      ]);
      setSchool(s); setStudents(st); setReports(rp); setTemplates(tp); setDark(dk);
      setLoaded(true);
    })();
  }, []);

  const schoolSave = useDebouncedAutosave(school, "school-config", [school]);
  const studentsSave = useDebouncedAutosave(students, "students", [students]);
  const reportsSave = useDebouncedAutosave(reports, "reports", [reports]);
  const templatesSave = useDebouncedAutosave(templates, "templates", [templates]);
  useEffect(() => { if (loaded) storageSet("dark-mode", dark); }, [dark, loaded]);

  const savingAny = [schoolSave, studentsSave, reportsSave, templatesSave].includes("saving");

  const value = {
    dark, setDark, school, setSchool, students, setStudents, reports, setReports,
    templates, setTemplates, saving: savingAny, loaded,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

/* ============================================================================
   PRIMITIVES
   ========================================================================== */
function Card({ children, className = "", pad = true, style }) {
  const { dark } = useApp();
  return (
    <div
      className={`rounded-2xl border ${className}`}
      style={{
        background: dark ? TOKENS.surfaceDark : TOKENS.surface,
        borderColor: dark ? TOKENS.lineDark : TOKENS.line,
        padding: pad ? 20 : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
function Btn({ children, variant = "primary", size = "md", className = "", icon: Icon, ...props }) {
  const { dark } = useApp();
  const sizes = { sm: "text-[12px] px-2.5 py-1.5 gap-1.5", md: "text-[13px] px-3.5 py-2 gap-2", lg: "text-[14px] px-5 py-2.5 gap-2" };
  const variants = {
    primary: { background: TOKENS.ink2, color: "#fff", border: "1px solid transparent" },
    gold: { background: TOKENS.gold, color: "#211603", border: "1px solid transparent" },
    ghost: { background: "transparent", color: dark ? "#EDEEF6" : TOKENS.ink2, border: `1px solid ${dark ? TOKENS.lineDark : TOKENS.line}` },
    subtle: { background: dark ? "#1F2340" : "#F0F1F8", color: dark ? "#EDEEF6" : TOKENS.ink2, border: "1px solid transparent" },
    danger: { background: "transparent", color: TOKENS.warn, border: `1px solid ${TOKENS.warn}55` },
  };
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none ${sizes[size]} ${className}`}
      style={{ fontFamily: "Inter", ...variants[variant] }}
      {...props}
    >
      {Icon && <Icon size={size === "lg" ? 16 : 14} />}
      {children}
    </button>
  );
}
function IconBtn({ icon: Icon, className = "", active, title, ...props }) {
  const { dark } = useApp();
  return (
    <button
      title={title}
      className={`inline-flex items-center justify-center rounded-lg w-8 h-8 transition-colors ${className}`}
      style={{
        background: active ? (dark ? "#2A2F52" : "#EFF1FA") : "transparent",
        color: active ? TOKENS.gold : dark ? "#B8BCD6" : TOKENS.muted,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = dark ? "#242847" : "#F2F3F9")}
      onMouseLeave={(e) => (e.currentTarget.style.background = active ? (dark ? "#2A2F52" : "#EFF1FA") : "transparent")}
      {...props}
    >
      <Icon size={15} />
    </button>
  );
}
function Field({ label, hint, children }) {
  const { dark } = useApp();
  return (
    <label className="block mb-3.5">
      {label && (
        <div className="text-[12px] font-semibold mb-1.5" style={{ color: dark ? "#B8BCD6" : TOKENS.muted }}>
          {label}
        </div>
      )}
      {children}
      {hint && <div className="text-[11px] mt-1" style={{ color: dark ? "#7A7F9C" : "#9498AA" }}>{hint}</div>}
    </label>
  );
}
function TextInput(props) {
  const { dark } = useApp();
  return (
    <input
      {...props}
      className={`w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-shadow focus:ring-2 ${props.className || ""}`}
      style={{
        background: dark ? "#12142380" : "#FAFAFD",
        border: `1px solid ${dark ? TOKENS.lineDark : TOKENS.line}`,
        color: dark ? "#EDEEF6" : TOKENS.ink,
        fontFamily: "Inter",
      }}
    />
  );
}
function TextArea(props) {
  const { dark } = useApp();
  return (
    <textarea
      {...props}
      className="w-full rounded-lg px-3 py-2 text-[13px] outline-none resize-none"
      style={{
        background: dark ? "#12142380" : "#FAFAFD",
        border: `1px solid ${dark ? TOKENS.lineDark : TOKENS.line}`,
        color: dark ? "#EDEEF6" : TOKENS.ink,
        fontFamily: "Inter",
      }}
    />
  );
}
function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-9 h-5 rounded-full relative transition-colors flex-shrink-0"
      style={{ background: checked ? TOKENS.gold : "#D7D9E6" }}
    >
      <span
        className="absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all shadow"
        style={{ left: checked ? 18 : 2 }}
      />
    </button>
  );
}
function Badge({ children, tone = "neutral" }) {
  const tones = {
    neutral: { bg: "#EFF0F7", fg: TOKENS.muted },
    gold: { bg: "#FBF2DD", fg: "#8A6412" },
    success: { bg: "#E4F5EE", fg: TOKENS.success },
    warn: { bg: "#FBEAE6", fg: TOKENS.warn },
    info: { bg: "#E9F0FC", fg: TOKENS.info },
  };
  const t = tones[tone];
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: t.bg, color: t.fg }}>
      {children}
    </span>
  );
}
function Modal({ open, onClose, title, children, width = 640 }) {
  const { dark } = useApp();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#0A0C1AAA" }} onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full rounded-2xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden"
        style={{ maxWidth: width, background: dark ? TOKENS.surfaceDark : TOKENS.surface }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>
          <h3 className="text-[15px] font-semibold" style={{ color: dark ? "#fff" : TOKENS.ink }}>{title}</h3>
          <IconBtn icon={X} onClick={onClose} />
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
function EmptyState({ icon: Icon, title, body, action }) {
  const { dark } = useApp();
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: dark ? "#1F2340" : "#F0F1F8" }}>
        <Icon size={22} style={{ color: TOKENS.gold }} />
      </div>
      <div className="text-[15px] font-semibold mb-1" style={{ color: dark ? "#fff" : TOKENS.ink }}>{title}</div>
      <div className="text-[13px] max-w-sm mb-5" style={{ color: dark ? "#9498B0" : TOKENS.muted }}>{body}</div>
      {action}
    </div>
  );
}
function RingProgress({ value, size = 56, stroke = 6, color }) {
  const { dark } = useApp();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(value, 100) / 100) * c;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={dark ? "#2A2E45" : "#EEF0F7"} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color || TOKENS.gold} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .5s ease" }}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.26} fontWeight={700} fill={dark ? "#fff" : TOKENS.ink} fontFamily="Inter">
        {Math.round(value)}
      </text>
    </svg>
  );
}
function RichEditor({ html, onChange, placeholder }) {
  const ref = useRef(null);
  const { dark } = useApp();
  const exec = (cmd) => { document.execCommand(cmd); ref.current?.focus(); };
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>
      <div className="flex items-center gap-1 px-2 py-1.5 border-b" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line, background: dark ? "#12142380" : "#FAFAFD" }}>
        {[["bold", "B"], ["italic", "I"], ["underline", "U"], ["insertUnorderedList", "•"]].map(([cmd, label]) => (
          <button key={cmd} onMouseDown={(e) => { e.preventDefault(); exec(cmd); }}
            className="w-6 h-6 text-[11px] font-bold rounded hover:opacity-70" style={{ color: dark ? "#EDEEF6" : TOKENS.ink }}>
            {label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="px-3 py-2.5 text-[13px] min-h-[70px] outline-none"
        style={{ color: dark ? "#EDEEF6" : TOKENS.ink, fontFamily: "Inter" }}
        onBlur={(e) => onChange(e.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: html || "" }}
        data-placeholder={placeholder}
      />
    </div>
  );
}
function FileDrop({ onFile, accept, label, sub, icon: Icon = Upload }) {
  const [over, setOver] = useState(false);
  const { dark } = useApp();
  const inputRef = useRef(null);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
      onClick={() => inputRef.current.click()}
      className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-8 px-4 cursor-pointer transition-colors text-center"
      style={{ borderColor: over ? TOKENS.gold : dark ? TOKENS.lineDark : "#D7D9E6", background: over ? (dark ? "#1F234055" : "#FBF6EA") : "transparent" }}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
      <Icon size={20} style={{ color: TOKENS.gold }} className="mb-2" />
      <div className="text-[13px] font-medium" style={{ color: dark ? "#EDEEF6" : TOKENS.ink }}>{label}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: dark ? "#9498B0" : TOKENS.muted }}>{sub}</div>}
    </div>
  );
}
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ============================================================================
   SHELL / NAV
   ========================================================================== */
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "setup", label: "School Setup", icon: Settings },
  { id: "students", label: "Students", icon: Users },
  { id: "builder", label: "Report Builder", icon: FileText },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
];

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { dark, setDark, saving, loaded, school } = useApp();
  const [page, setPage] = useState("dashboard");
  const [builderStudentId, setBuilderStudentId] = useState(null);

  const goBuilder = (studentId) => { setBuilderStudentId(studentId); setPage("builder"); };

  if (!loaded) {
    return (
      <div className="h-screen w-full flex items-center justify-center" style={{ background: TOKENS.bg, fontFamily: "Inter" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: `${TOKENS.gold}33`, borderTopColor: TOKENS.gold }} />
          <div className="text-[13px]" style={{ color: TOKENS.muted }}>Loading your workspace…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter", background: dark ? TOKENS.bgDark : TOKENS.bg, minHeight: "100vh", color: dark ? "#EDEEF6" : TOKENS.ink }}>
      <style>{`
        ${FONT_LINK}
        * { box-sizing: border-box; }
        ::selection { background: ${TOKENS.gold}55; }
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #9498AA; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: ${dark ? "#333858" : "#D7D9E6"}; border-radius: 10px; }
      `}</style>

      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[220px] flex-shrink-0 border-r flex flex-col" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line, background: dark ? TOKENS.surfaceDark : TOKENS.surface }}>
          <div className="px-5 py-5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: TOKENS.ink2 }}>
              <GraduationCap size={17} color={TOKENS.gold} />
            </div>
            <div>
              <div className="text-[13.5px] font-bold leading-tight" style={{ fontFamily: "Fraunces" }}>ReportCraft</div>
              <div className="text-[10px]" style={{ color: dark ? "#7A7F9C" : TOKENS.muted }}>for {school.name.split(" ")[0]}</div>
            </div>
          </div>
          <nav className="flex-1 px-3 py-2 space-y-0.5">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors"
                style={{
                  background: page === n.id ? (dark ? "#242847" : "#F0F1F8") : "transparent",
                  color: page === n.id ? TOKENS.gold : dark ? "#B8BCD6" : "#3A3F55",
                }}
              >
                <n.icon size={16} /> {n.label}
              </button>
            ))}
          </nav>
          <div className="px-3 py-4 border-t" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: dark ? "#7A7F9C" : TOKENS.muted }}>
                {saving ? <><CloudUpload size={13} className="animate-pulse" /> Saving…</> : <><CheckCircle2 size={13} style={{ color: TOKENS.success }} /> Saved</>}
              </div>
              <IconBtn icon={dark ? Sun : Moon} onClick={() => setDark(!dark)} title="Toggle theme" />
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {page === "dashboard" && <Dashboard onOpenBuilder={goBuilder} onNav={setPage} />}
          {page === "setup" && <SchoolSetup />}
          {page === "students" && <StudentManagement onOpenBuilder={goBuilder} />}
          {page === "builder" && <ReportBuilder initialStudentId={builderStudentId} />}
          {page === "templates" && <TemplateManager />}
        </main>
      </div>
    </div>
  );
}

function PageHeader({ eyebrow, title, sub, right }) {
  const { dark } = useApp();
  return (
    <div className="flex items-start justify-between px-8 pt-8 pb-6 flex-wrap gap-4">
      <div>
        {eyebrow && <div className="text-[11px] font-bold tracking-widest uppercase mb-1.5" style={{ color: TOKENS.gold }}>{eyebrow}</div>}
        <h1 className="text-[24px] font-bold" style={{ fontFamily: "Fraunces", color: dark ? "#fff" : TOKENS.ink }}>{title}</h1>
        {sub && <div className="text-[13.5px] mt-1" style={{ color: dark ? "#9498B0" : TOKENS.muted }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* ============================================================================
   DASHBOARD
   ========================================================================== */
function Dashboard({ onOpenBuilder, onNav }) {
  const { dark, students, reports, school } = useApp();

  const avgPct = useMemo(() => {
    if (!reports.length) return 0;
    const vals = reports.map((r) => computeReportStats(r).overallPct).filter((v) => !isNaN(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [reports]);

  const stats = [
    { label: "Students", value: students.length, icon: Users, tone: TOKENS.info },
    { label: "Reports Generated", value: reports.length, icon: FileText, tone: TOKENS.success },
    { label: "Avg. Performance", value: `${avgPct.toFixed(0)}%`, icon: TrendingUp, tone: TOKENS.gold },
    { label: "Academic Year", value: school.academicYear, icon: CalendarCheck, tone: TOKENS.warn, small: true },
  ];

  const recent = [...reports].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 6);

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        sub="A snapshot of your reporting activity this term."
        right={
          <div className="flex gap-2">
            <Btn variant="ghost" icon={UserPlus} onClick={() => onNav("students")}>Add Student</Btn>
            <Btn variant="gold" icon={Sparkles} onClick={() => onOpenBuilder(null)}>New Report</Btn>
          </div>
        }
      />
      <div className="px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11.5px] font-semibold mb-1.5" style={{ color: dark ? "#9498B0" : TOKENS.muted }}>{s.label}</div>
                <div className={s.small ? "text-[16px] font-bold" : "text-[26px] font-bold"} style={{ fontFamily: "Fraunces", color: dark ? "#fff" : TOKENS.ink }}>{s.value}</div>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.tone}18` }}>
                <s.icon size={16} style={{ color: s.tone }} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="px-8 grid grid-cols-1 lg:grid-cols-3 gap-6 pb-10">
        <Card className="lg:col-span-2" pad={false}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>
            <div className="text-[14px] font-semibold">Recent Reports</div>
            <Badge tone="neutral">{reports.length} total</Badge>
          </div>
          {recent.length === 0 ? (
            <EmptyState icon={FileText} title="No reports yet" body="Once you generate reports for students, they'll show up here for quick access." action={<Btn variant="gold" icon={Plus} onClick={() => onOpenBuilder(null)}>Create First Report</Btn>} />
          ) : (
            <div>
              {recent.map((r) => {
                const st = students.find((s) => s.id === r.studentId);
                const stat = computeReportStats(r);
                return (
                  <button key={r.id} onClick={() => onOpenBuilder(r.studentId)}
                    className="w-full flex items-center justify-between px-5 py-3.5 border-b last:border-0 hover:bg-black/[0.02] text-left"
                    style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: `${TOKENS.gold}22`, color: "#8A6412" }}>
                        {(st?.name || "?").slice(0, 1)}
                      </div>
                      <div>
                        <div className="text-[13px] font-medium">{st?.name || "Unknown Student"}</div>
                        <div className="text-[11.5px]" style={{ color: dark ? "#9498B0" : TOKENS.muted }}>{r.month} {r.year} · {THEMES.find(t=>t.id===r.themeId)?.name}</div>
                      </div>
                    </div>
                    <Badge tone={stat.overallPct >= 75 ? "success" : stat.overallPct >= 50 ? "gold" : "warn"}>{stat.grade.grade} · {stat.overallPct.toFixed(0)}%</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="text-[14px] font-semibold mb-4">Quick Start</div>
          <div className="space-y-2.5">
            {[
              { label: "Configure school branding", icon: Building2, page: "setup" },
              { label: "Import students via CSV", icon: FileSpreadsheet, page: "students" },
              { label: "Design a report template", icon: LayoutTemplate, page: "templates" },
            ].map((a) => (
              <button key={a.label} onClick={() => onNav(a.page)}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl border text-left transition-colors hover:border-opacity-60"
                style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>
                <div className="flex items-center gap-2.5">
                  <a.icon size={15} style={{ color: TOKENS.gold }} />
                  <span className="text-[12.5px] font-medium">{a.label}</span>
                </div>
                <ChevronRight size={14} style={{ color: dark ? "#7A7F9C" : "#B4B7C8" }} />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================================
   SCHOOL SETUP
   ========================================================================== */
function SchoolSetup() {
  const { school, setSchool, dark } = useApp();
  const [tab, setTab] = useState("identity");
  const [local, setLocal] = useState(school);
  useEffect(() => setLocal(school), [school]);
  const commit = (patch) => { const next = { ...local, ...patch }; setLocal(next); setSchool(next); };
  const commitDeep = (key, patch) => { const next = { ...local, [key]: { ...local[key], ...patch } }; setLocal(next); setSchool(next); };

  const tabs = [
    { id: "identity", label: "Identity" },
    { id: "branding", label: "Branding & Theme" },
    { id: "academics", label: "Subjects & Activities" },
    { id: "headings", label: "Headings & Sections" },
  ];

  return (
    <div>
      <PageHeader eyebrow="One-Time Setup" title="School Setup" sub="These settings automatically apply to every report you generate." />
      <div className="px-8">
        <div className="flex gap-1 mb-6 border-b" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className="px-4 py-2.5 text-[13px] font-medium relative -mb-px"
              style={{ color: tab === t.id ? TOKENS.gold : dark ? "#9498B0" : TOKENS.muted, borderBottom: tab === t.id ? `2px solid ${TOKENS.gold}` : "2px solid transparent" }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "identity" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
            <Card>
              <div className="text-[13px] font-semibold mb-4">School Details</div>
              <Field label="School Name"><TextInput value={local.name} onChange={(e) => commit({ name: e.target.value })} /></Field>
              <Field label="Address"><TextArea rows={2} value={local.address} onChange={(e) => commit({ address: e.target.value })} /></Field>
              <Field label="Academic Year"><TextInput value={local.academicYear} onChange={(e) => commit({ academicYear: e.target.value })} /></Field>
            </Card>
            <Card>
              <div className="text-[13px] font-semibold mb-4">School Logo</div>
              {local.logo ? (
                <div className="flex items-center gap-4 mb-3">
                  <img src={local.logo} className="w-16 h-16 rounded-xl object-contain border" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }} />
                  <Btn variant="ghost" size="sm" icon={Trash2} onClick={() => commit({ logo: null })}>Remove</Btn>
                </div>
              ) : (
                <FileDrop icon={ImageIcon} accept="image/*" label="Drop logo or click to upload" sub="PNG or SVG, transparent background recommended"
                  onFile={async (f) => commit({ logo: await fileToBase64(f) })} />
              )}
              <div className="grid grid-cols-2 gap-4 mt-5">
                <div>
                  <div className="text-[12px] font-semibold mb-1.5" style={{ color: dark ? "#B8BCD6" : TOKENS.muted }}>Principal</div>
                  <TextInput value={local.principalName} onChange={(e) => commit({ principalName: e.target.value })} className="mb-2" />
                  {local.principalSig ? (
                    <div className="flex items-center gap-2"><img src={local.principalSig} className="h-10 object-contain" /><IconBtn icon={Trash2} onClick={() => commit({ principalSig: null })} /></div>
                  ) : (
                    <FileDrop icon={PenLine} accept="image/*" label="Upload signature" onFile={async (f) => commit({ principalSig: await fileToBase64(f) })} />
                  )}
                </div>
                <div>
                  <div className="text-[12px] font-semibold mb-1.5" style={{ color: dark ? "#B8BCD6" : TOKENS.muted }}>Coordinator</div>
                  <TextInput value={local.coordinatorName} onChange={(e) => commit({ coordinatorName: e.target.value })} className="mb-2" />
                  {local.coordinatorSig ? (
                    <div className="flex items-center gap-2"><img src={local.coordinatorSig} className="h-10 object-contain" /><IconBtn icon={Trash2} onClick={() => commit({ coordinatorSig: null })} /></div>
                  ) : (
                    <FileDrop icon={PenLine} accept="image/*" label="Upload signature" onFile={async (f) => commit({ coordinatorSig: await fileToBase64(f) })} />
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {tab === "branding" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
            <Card>
              <div className="text-[13px] font-semibold mb-4">Theme Colors</div>
              {[["primary", "Primary"], ["accent", "Accent"], ["bg", "Background"]].map(([k, label]) => (
                <div key={k} className="flex items-center justify-between mb-3">
                  <span className="text-[12.5px] font-medium">{label}</span>
                  <div className="flex items-center gap-2">
                    <input type="color" value={local.colors[k]} onChange={(e) => commitDeep("colors", { [k]: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <span className="text-[11.5px] font-mono" style={{ color: dark ? "#9498B0" : TOKENS.muted }}>{local.colors[k]}</span>
                  </div>
                </div>
              ))}
            </Card>
            <Card>
              <div className="text-[13px] font-semibold mb-4">Typography</div>
              <Field label="Heading Font">
                <select value={local.fontHeading} onChange={(e) => commit({ fontHeading: e.target.value })} className="w-full rounded-lg px-3 py-2 text-[13px] border" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line, background: dark ? "#12142380" : "#FAFAFD", color: "inherit" }}>
                  {["Fraunces", "Playfair Display", "Libre Baskerville", "Sora"].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Body Font">
                <select value={local.fontBody} onChange={(e) => commit({ fontBody: e.target.value })} className="w-full rounded-lg px-3 py-2 text-[13px] border" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line, background: dark ? "#12142380" : "#FAFAFD", color: "inherit" }}>
                  {["Inter", "Sora"].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <div className="rounded-lg p-3 mt-2" style={{ background: dark ? "#12142380" : "#FAFAFD", border: `1px solid ${dark ? TOKENS.lineDark : TOKENS.line}` }}>
                <div style={{ fontFamily: local.fontHeading, fontSize: 18, fontWeight: 700 }}>{local.name}</div>
                <div style={{ fontFamily: local.fontBody, fontSize: 12.5, color: TOKENS.muted }}>Sample body text for report content.</div>
              </div>
            </Card>
          </div>
        )}

        {tab === "academics" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
            <ListEditor title="Subjects" items={local.subjects} onChange={(v) => commit({ subjects: v })} placeholder="e.g. Mathematics" />
            <ListEditor title="Activities" items={local.activities} onChange={(v) => commit({ activities: v })} placeholder="e.g. Sports" />
          </div>
        )}

        {tab === "headings" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
            <Card>
              <div className="text-[13px] font-semibold mb-4">Editable Report Headings</div>
              {Object.entries(local.headings).map(([k, v]) => (
                <Field key={k} label={k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}>
                  <TextInput value={v} onChange={(e) => commitDeep("headings", { [k]: e.target.value })} />
                </Field>
              ))}
            </Card>
            <Card>
              <div className="text-[13px] font-semibold mb-4">Default Section Visibility</div>
              <div className="text-[11.5px] mb-3" style={{ color: dark ? "#9498B0" : TOKENS.muted }}>New reports will start with these sections shown or hidden. Each report can still be customized individually.</div>
              {Object.entries(local.defaultSectionVisibility).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>
                  <span className="text-[12.5px] font-medium capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                  <Toggle checked={v} onChange={(val) => commitDeep("defaultSectionVisibility", { [k]: val })} />
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function ListEditor({ title, items, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  const { dark } = useApp();
  const add = () => { if (!draft.trim()) return; onChange([...items, draft.trim()]); setDraft(""); };
  return (
    <Card>
      <div className="text-[13px] font-semibold mb-4">{title}</div>
      <div className="flex gap-2 mb-4">
        <TextInput value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <Btn variant="gold" icon={Plus} onClick={add}>Add</Btn>
      </div>
      <div className="space-y-1.5 max-h-72 overflow-y-auto scrollbar-thin">
        {items.map((it, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: dark ? "#12142380" : "#FAFAFD" }}>
            <input value={it} onChange={(e) => { const next = [...items]; next[i] = e.target.value; onChange(next); }}
              className="bg-transparent outline-none text-[12.5px] flex-1" />
            <IconBtn icon={Trash2} onClick={() => onChange(items.filter((_, idx) => idx !== i))} />
          </div>
        ))}
        {items.length === 0 && <div className="text-[12px] text-center py-4" style={{ color: TOKENS.muted }}>None added yet.</div>}
      </div>
    </Card>
  );
}

/* ============================================================================
   STUDENT MANAGEMENT
   ========================================================================== */
function StudentManagement({ onOpenBuilder }) {
  const { students, setStudents, reports, dark, school } = useApp();
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [editing, setEditing] = useState(null); // student obj or "new"
  const [importOpen, setImportOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const classes = useMemo(() => ["all", ...new Set(students.map((s) => s.class).filter(Boolean))], [students]);
  const filtered = students.filter((s) =>
    (classFilter === "all" || s.class === classFilter) &&
    (s.name.toLowerCase().includes(query.toLowerCase()) || (s.roll || "").toLowerCase().includes(query.toLowerCase()))
  );

  const saveStudent = (data) => {
    if (data.id) setStudents(students.map((s) => (s.id === data.id ? data : s)));
    else setStudents([...students, { ...data, id: uid() }]);
    setEditing(null);
  };
  const duplicate = (s) => setStudents([...students, { ...s, id: uid(), name: s.name + " (Copy)" }]);
  const remove = (id) => setStudents(students.filter((s) => s.id !== id));

  return (
    <div>
      <PageHeader eyebrow={`${students.length} Students`} title="Student Management" sub="Add students manually or import an entire class in seconds."
        right={<div className="flex gap-2">
          <Btn variant="ghost" icon={Upload} onClick={() => setImportOpen(true)}>Import</Btn>
          <Btn variant="gold" icon={Plus} onClick={() => setEditing("new")}>Add Student</Btn>
        </div>} />

      <div className="px-8 flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: TOKENS.muted }} />
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or roll no." className="pl-8" />
        </div>
        <div className="flex items-center gap-1.5 text-[12.5px]" style={{ color: dark ? "#9498B0" : TOKENS.muted }}>
          <Filter size={13} /> Class
        </div>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-[12.5px] border" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line, background: dark ? "#171A2C" : "#fff", color: "inherit" }}>
          {classes.map((c) => <option key={c} value={c}>{c === "all" ? "All Classes" : c}</option>)}
        </select>
      </div>

      <div className="px-8 pb-10">
        {filtered.length === 0 ? (
          <Card><EmptyState icon={Users} title={students.length ? "No matches" : "No students yet"} body={students.length ? "Try a different search or filter." : "Add your first student manually, or import a class list via CSV or Excel."}
            action={!students.length && <div className="flex gap-2"><Btn variant="ghost" icon={Upload} onClick={() => setImportOpen(true)}>Import CSV/XLSX</Btn><Btn variant="gold" icon={Plus} onClick={() => setEditing("new")}>Add Student</Btn></div>} /></Card>
        ) : (
          <Card pad={false}>
            {filtered.map((s) => {
              const hist = reports.filter((r) => r.studentId === s.id).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
              const open = expandedId === s.id;
              return (
                <div key={s.id} className="border-b last:border-0" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    {s.photo ? <img src={s.photo} className="w-9 h-9 rounded-full object-cover" /> :
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: `${TOKENS.gold}22`, color: "#8A6412" }}>{s.name.slice(0,1)}</div>}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{s.name}</div>
                      <div className="text-[11.5px]" style={{ color: dark ? "#9498B0" : TOKENS.muted }}>{s.class || "—"} {s.section ? `· ${s.section}` : ""} {s.roll ? `· Roll ${s.roll}` : ""}</div>
                    </div>
                    <button onClick={() => setExpandedId(open ? null : s.id)} className="text-[11.5px] font-medium mr-2 flex items-center gap-1" style={{ color: TOKENS.gold }}>
                      {hist.length} reports {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    <IconBtn icon={FileText} title="Open in Report Builder" onClick={() => onOpenBuilder(s.id)} />
                    <IconBtn icon={Pencil} title="Edit" onClick={() => setEditing(s)} />
                    <IconBtn icon={Copy} title="Duplicate" onClick={() => duplicate(s)} />
                    <IconBtn icon={Trash2} title="Delete" onClick={() => remove(s.id)} />
                  </div>
                  {open && (
                    <div className="px-5 pb-4 pl-[68px]">
                      {hist.length === 0 ? <div className="text-[12px]" style={{ color: TOKENS.muted }}>No monthly reports yet.</div> : (
                        <div className="flex flex-wrap gap-2">
                          {hist.map((r) => {
                            const st = computeReportStats(r);
                            return (
                              <button key={r.id} onClick={() => onOpenBuilder(s.id)} className="px-3 py-1.5 rounded-lg border text-[11.5px] flex items-center gap-2" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>
                                {r.month} {r.year} <Badge tone={st.overallPct >= 75 ? "success" : st.overallPct >= 50 ? "gold" : "warn"}>{st.grade.grade}</Badge>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        )}
      </div>

      {editing && <StudentEditModal student={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSave={saveStudent} />}
      {importOpen && <ImportWizard onClose={() => setImportOpen(false)} school={school} existing={students}
        onImport={(rows) => { setStudents([...students, ...rows]); setImportOpen(false); }} />}
    </div>
  );
}

function StudentEditModal({ student, onClose, onSave }) {
  const [form, setForm] = useState(student || { name: "", roll: "", class: "", section: "", dob: "", guardian: "", phone: "", photo: null });
  return (
    <Modal open onClose={onClose} title={student ? "Edit Student" : "Add Student"} width={520}>
      <div className="flex gap-4 mb-2">
        <div className="flex-shrink-0">
          {form.photo ? <img src={form.photo} className="w-20 h-20 rounded-xl object-cover" /> : (
            <div className="w-20 h-20 rounded-xl flex items-center justify-center" style={{ background: "#F0F1F8" }}><ImageIcon size={20} style={{ color: TOKENS.muted }} /></div>
          )}
          <label className="block mt-2 text-center">
            <span className="text-[11px] font-semibold cursor-pointer" style={{ color: TOKENS.gold }}>Upload photo</span>
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => e.target.files[0] && setForm({ ...form, photo: await fileToBase64(e.target.files[0]) })} />
          </label>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-x-3">
          <Field label="Full Name"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Roll No."><TextInput value={form.roll} onChange={(e) => setForm({ ...form, roll: e.target.value })} /></Field>
          <Field label="Class"><TextInput value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} /></Field>
          <Field label="Section"><TextInput value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></Field>
          <Field label="Date of Birth"><TextInput type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></Field>
          <Field label="Guardian Name"><TextInput value={form.guardian} onChange={(e) => setForm({ ...form, guardian: e.target.value })} /></Field>
        </div>
      </div>
      <Field label="Contact Phone"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="gold" icon={Check} disabled={!form.name.trim()} onClick={() => onSave(form)}>Save Student</Btn>
      </div>
    </Modal>
  );
}

/* --- Import Wizard: upload -> map columns -> preview/validate -> import --- */
const IMPORT_FIELDS = [
  { key: "name", label: "Full Name", required: true },
  { key: "roll", label: "Roll No.", required: false },
  { key: "class", label: "Class", required: false },
  { key: "section", label: "Section", required: false },
  { key: "dob", label: "Date of Birth", required: false },
  { key: "guardian", label: "Guardian Name", required: false },
  { key: "phone", label: "Contact Phone", required: false },
];
function guessMapping(headers) {
  const map = {};
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
  const synonyms = {
    name: ["name", "studentname", "fullname", "student"],
    roll: ["roll", "rollno", "rollnumber", "id", "admissionno", "regno"],
    class: ["class", "grade", "std", "standard"],
    section: ["section", "sec", "division"],
    dob: ["dob", "dateofbirth", "birthdate"],
    guardian: ["guardian", "parent", "father", "mother", "guardianname"],
    phone: ["phone", "contact", "mobile", "phonenumber"],
  };
  headers.forEach((h) => {
    const n = norm(h);
    for (const [field, syns] of Object.entries(synonyms)) {
      if (syns.some((s) => n === s || n.includes(s))) { map[field] = h; break; }
    }
  });
  return map;
}
function ImportWizard({ onClose, onImport, existing }) {
  const { dark } = useApp();
  const [step, setStep] = useState(1);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [fileName, setFileName] = useState("");

  const parseFile = (file) => {
    setFileName(file.name);
    const isExcel = /\.xlsx?$/i.test(file.name);
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!json.length) return;
        const hdrs = Object.keys(json[0]);
        setHeaders(hdrs); setRows(json); setMapping(guessMapping(hdrs)); setStep(2);
      };
      reader.readAsBinaryString(file);
    } else {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (res) => {
          const hdrs = res.meta.fields || [];
          setHeaders(hdrs); setRows(res.data); setMapping(guessMapping(hdrs)); setStep(2);
        },
      });
    }
  };

  const mapped = rows.map((r) => {
    const obj = {};
    IMPORT_FIELDS.forEach((f) => { obj[f.key] = mapping[f.key] ? String(r[mapping[f.key]] ?? "").trim() : ""; });
    return obj;
  });
  const errors = mapped.map((m, i) => {
    const e = [];
    if (!m.name) e.push("Missing name");
    const dupe = existing.some((s) => s.name.toLowerCase() === m.name.toLowerCase() && s.roll === m.roll) ||
      mapped.some((o, j) => j < i && o.name.toLowerCase() === m.name.toLowerCase() && o.roll === m.roll);
    if (dupe && m.name) e.push("Possible duplicate");
    return e;
  });
  const validCount = errors.filter((e) => !e.includes("Missing name")).length;

  const downloadTemplate = () => {
    const csv = Papa.unparse({ fields: IMPORT_FIELDS.map((f) => f.label), data: [] });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "student-import-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = () => {
    const good = mapped.filter((m, i) => m.name && !errors[i].includes("Possible duplicate"))
      .map((m) => ({ ...m, id: uid(), photo: null }));
    onImport(good);
  };

  return (
    <Modal open onClose={onClose} title="Import Students" width={760}>
      <div className="flex items-center gap-2 mb-5">
        {["Upload", "Map Columns", "Preview & Validate"].map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: step >= i + 1 ? TOKENS.gold : "#EEF0F7", color: step >= i + 1 ? "#211603" : TOKENS.muted }}>{i + 1}</div>
              <span className="text-[12px] font-medium" style={{ color: step === i + 1 ? "inherit" : TOKENS.muted }}>{s}</span>
            </div>
            {i < 2 && <div className="flex-1 h-px" style={{ background: dark ? TOKENS.lineDark : TOKENS.line }} />}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <div>
          <FileDrop icon={CloudUpload} label="Drag & drop a CSV or XLSX file here" sub="or click to browse" accept=".csv,.xlsx,.xls" onFile={parseFile} />
          <div className="flex items-center justify-between mt-4">
            <div className="text-[12px]" style={{ color: TOKENS.muted }}>Not sure of the format? Start from our template — column names don't need to match exactly.</div>
            <Btn variant="ghost" size="sm" icon={Download} onClick={downloadTemplate}>Download Template</Btn>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="text-[12.5px] mb-3" style={{ color: TOKENS.muted }}>
            We matched columns from <b>{fileName}</b> automatically. Adjust any that look wrong — import never fails due to differing column names.
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin pr-1">
            {IMPORT_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: dark ? "#12142380" : "#FAFAFD" }}>
                <div className="w-36 text-[12.5px] font-medium flex items-center gap-1">{f.label}{f.required && <span style={{ color: TOKENS.warn }}>*</span>}</div>
                <ArrowRight size={13} style={{ color: TOKENS.muted }} />
                <select value={mapping[f.key] || ""} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                  className="flex-1 rounded-lg px-2.5 py-1.5 text-[12.5px] border" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line, background: dark ? "#171A2C" : "#fff", color: "inherit" }}>
                  <option value="">— Not mapped —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-5">
            <Btn variant="ghost" onClick={() => setStep(1)}>Back</Btn>
            <Btn variant="gold" onClick={() => setStep(3)} disabled={!mapping.name}>Continue to Preview</Btn>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="flex items-center gap-4 mb-3 text-[12.5px]">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} style={{ color: TOKENS.success }} />{validCount} ready to import</span>
            <span className="flex items-center gap-1.5"><AlertTriangle size={14} style={{ color: TOKENS.warn }} />{errors.filter(e => e.length).length} with issues</span>
          </div>
          <div className="border rounded-xl overflow-hidden max-h-80 overflow-y-auto scrollbar-thin" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>
            <table className="w-full text-[12px]">
              <thead className="sticky top-0" style={{ background: dark ? "#171A2C" : "#FAFAFD" }}>
                <tr>
                  {IMPORT_FIELDS.map((f) => <th key={f.key} className="text-left px-3 py-2 font-semibold" style={{ color: TOKENS.muted }}>{f.label}</th>)}
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: TOKENS.muted }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {mapped.map((m, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>
                    {IMPORT_FIELDS.map((f) => <td key={f.key} className="px-3 py-1.5">{m[f.key] || "—"}</td>)}
                    <td className="px-3 py-1.5">
                      {errors[i].length ? <Badge tone="warn">{errors[i].join(", ")}</Badge> : <Badge tone="success">Ready</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between mt-5">
            <Btn variant="ghost" onClick={() => setStep(2)}>Back</Btn>
            <Btn variant="gold" icon={Check} onClick={doImport} disabled={!validCount}>Import {validCount} Students</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ============================================================================
   CALCULATIONS
   ========================================================================== */
function computeReportStats(report) {
  const rows = report.sections.find((s) => s.type === "assessmentTable")?.data.rows || [];
  const valid = rows.filter((r) => r.obtained !== "" && r.total);
  const totalObtained = valid.reduce((a, r) => a + Number(r.obtained || 0), 0);
  const totalMax = valid.reduce((a, r) => a + Number(r.total || 0), 0);
  const overallPct = totalMax ? (totalObtained / totalMax) * 100 : 0;
  const grade = gradeFor(overallPct);
  const actRows = report.sections.find((s) => s.type === "activityTable")?.data.rows || [];
  const actValid = actRows.filter((r) => r.obtained !== "" && r.total);
  const actPct = actValid.length ? (actValid.reduce((a, r) => a + Number(r.obtained || 0), 0) / actValid.reduce((a, r) => a + Number(r.total || 0), 0)) * 100 : 0;
  const att = report.sections.find((s) => s.type === "attendance")?.data || {};
  const attPct = att.total ? (Number(att.present || 0) / Number(att.total)) * 100 : 0;
  return { totalObtained, totalMax, overallPct, grade, actPct, attPct, subjectRows: valid.map((r) => ({ ...r, pct: r.total ? (Number(r.obtained) / r.total) * 100 : 0, grade: gradeFor(r.total ? (Number(r.obtained) / r.total) * 100 : 0) })) };
}

/* ============================================================================
   REPORT BUILDER — the core feature. Split-screen: editor / live preview.
   ========================================================================== */
function ReportBuilder({ initialStudentId }) {
  const { students, reports, setReports, school, templates, dark } = useApp();
  const [studentId, setStudentId] = useState(initialStudentId || students[0]?.id || null);
  const [month, setMonth] = useState(new Date().toLocaleString("default", { month: "long" }));
  const [year, setYear] = useState(new Date().getFullYear());

  const existing = reports.find((r) => r.studentId === studentId && r.month === month && r.year === year);
  const [themeId, setThemeId] = useState(existing?.themeId || school.defaultThemeId);
  const [sections, setSections] = useState(existing?.sections || defaultSections(school));
  const [dirty, setDirty] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [showThemeGallery, setShowThemeGallery] = useState(false);

  const history = useRef([{ sections: defaultSections(school), themeId: school.defaultThemeId }]);
  const historyPointer = useRef(0);

  useEffect(() => {
    const r = reports.find((rp) => rp.studentId === studentId && rp.month === month && rp.year === year);
    const initSections = r?.sections || defaultSections(school);
    const initTheme = r?.themeId || school.defaultThemeId;
    setSections(initSections); setThemeId(initTheme); setDirty(false);
    history.current = [{ sections: initSections, themeId: initTheme }];
    historyPointer.current = 0;
    // eslint-disable-next-line
  }, [studentId, month, year]);

  const pushHistory = useCallback((newSections, newTheme) => {
    history.current = history.current.slice(0, historyPointer.current + 1);
    history.current.push({ sections: newSections, themeId: newTheme });
    historyPointer.current = history.current.length - 1;
  }, []);

  const updateSections = (next, opts = {}) => {
    setSections(next); setDirty(true);
    if (!opts.skipHistory) pushHistory(next, themeId);
  };
  const changeTheme = (id) => { setThemeId(id); setDirty(true); pushHistory(sections, id); setShowThemeGallery(false); };

  const undo = () => { if (historyPointer.current > 0) { historyPointer.current -= 1; const h = history.current[historyPointer.current]; setSections(h.sections); setThemeId(h.themeId); setDirty(true); } };
  const redo = () => { if (historyPointer.current < history.current.length - 1) { historyPointer.current += 1; const h = history.current[historyPointer.current]; setSections(h.sections); setThemeId(h.themeId); setDirty(true); } };

  const saveReport = () => {
    const payload = { id: existing?.id || uid(), studentId, month, year, themeId, sections, updatedAt: Date.now() };
    if (existing) setReports(reports.map((r) => (r.id === existing.id ? payload : r)));
    else setReports([...reports, payload]);
    setDirty(false);
  };
  useEffect(() => { // autosave draft after edits settle
    if (!dirty || !studentId) return;
    const t = setTimeout(saveReport, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [sections, themeId, dirty]);

  const student = students.find((s) => s.id === studentId);
  const stats = useMemo(() => computeReportStats({ sections }), [sections]);

  if (!students.length) {
    return (
      <div>
        <PageHeader eyebrow="Report Builder" title="Report Builder" sub="The core of ReportCraft — build stunning, data-driven reports." />
        <div className="px-8"><Card><EmptyState icon={Users} title="Add a student first" body="You'll need at least one student on file before building a report." /></Card></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="px-6 py-3.5 border-b flex items-center gap-3 flex-wrap" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line, background: dark ? TOKENS.surfaceDark : TOKENS.surface }}>
        <select value={studentId || ""} onChange={(e) => setStudentId(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium border" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line, background: dark ? "#171A2C" : "#fff", color: "inherit" }}>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-[12.5px] border" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line, background: dark ? "#171A2C" : "#fff", color: "inherit" }}>
          {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m) => <option key={m}>{m}</option>)}
        </select>
        <TextInput type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="!w-20" />

        <div className="h-5 w-px mx-1" style={{ background: dark ? TOKENS.lineDark : TOKENS.line }} />
        <button onClick={() => setShowThemeGallery(true)} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[12.5px] font-medium" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>
          <Palette size={13} style={{ color: TOKENS.gold }} /> {THEMES.find((t) => t.id === themeId)?.name}
        </button>

        <div className="flex-1" />
        <IconBtn icon={Undo2} onClick={undo} title="Undo" />
        <IconBtn icon={Redo2} onClick={redo} title="Redo" />
        <Badge tone={dirty ? "warn" : "success"}>{dirty ? "Unsaved changes" : "All changes saved"}</Badge>
        <Btn variant="gold" icon={Save} onClick={saveReport}>Save Report</Btn>
      </div>

      {showThemeGallery && <ThemeGallery current={themeId} onSelect={changeTheme} onClose={() => setShowThemeGallery(false)} templates={templates} />}

      {/* Split screen */}
      <div className="flex-1 flex overflow-hidden">
        <div className="w-[400px] flex-shrink-0 border-r overflow-y-auto scrollbar-thin p-4" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line, background: dark ? TOKENS.surfaceDark : TOKENS.surface }}>
          <SectionEditorPanel sections={sections} onChange={updateSections} school={school}
            activeSectionId={activeSectionId} setActiveSectionId={setActiveSectionId} student={student} />
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ background: dark ? "#0B0D18" : "#EDEEF6" }}>
          <div className="py-8 flex justify-center">
            <ReportPreview themeId={themeId} sections={sections} school={school} student={student} month={month} year={year} stats={stats} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeGallery({ current, onSelect, onClose, templates }) {
  const { dark } = useApp();
  return (
    <Modal open onClose={onClose} title="Choose a Report Theme" width={780}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {THEMES.map((t) => (
          <button key={t.id} onClick={() => onSelect(t.id)} className="text-left rounded-xl border p-4 transition-all hover:-translate-y-0.5"
            style={{ borderColor: current === t.id ? TOKENS.gold : dark ? TOKENS.lineDark : TOKENS.line, background: current === t.id ? (dark ? "#1F234055" : "#FBF6EA") : "transparent" }}>
            <ThemeSwatch id={t.id} />
            <div className="text-[13px] font-semibold mt-3">{t.name}</div>
            <div className="text-[11.5px]" style={{ color: dark ? "#9498B0" : TOKENS.muted }}>{t.blurb}</div>
          </button>
        ))}
      </div>
      {templates.length > 0 && (
        <div className="mt-5 pt-4 border-t" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>
          <div className="text-[12px] font-semibold mb-2">Or start from a saved template</div>
          <div className="flex flex-wrap gap-2">
            {templates.map((tp) => <button key={tp.id} onClick={() => onSelect(tp.themeId)} className="px-3 py-1.5 rounded-lg border text-[12px]" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>{tp.name}</button>)}
          </div>
        </div>
      )}
    </Modal>
  );
}
function ThemeSwatch({ id }) {
  const swatches = {
    executive: <svg viewBox="0 0 220 120" className="w-full h-24"><rect width="220" height="120" fill="#FBF9F3"/><rect x="90" y="14" width="40" height="4" fill="#C89B3C"/><rect x="70" y="26" width="80" height="8" fill="#1B2340"/><line x1="20" y1="50" x2="200" y2="50" stroke="#C89B3C" strokeWidth="1"/><rect x="20" y="64" width="180" height="1" fill="#E6E7F0"/><rect x="20" y="76" width="180" height="1" fill="#E6E7F0"/><rect x="20" y="88" width="180" height="1" fill="#E6E7F0"/></svg>,
    colorful: <svg viewBox="0 0 220 120" className="w-full h-24"><rect width="220" height="120" fill="#fff"/><rect width="220" height="34" fill="#5B6FE8"/><rect x="16" y="46" width="56" height="56" rx="10" fill="#FFF1DA"/><rect x="82" y="46" width="56" height="56" rx="10" fill="#DAF3EA"/><rect x="148" y="46" width="56" height="56" rx="10" fill="#FDE2E2"/></svg>,
    editorial: <svg viewBox="0 0 220 120" className="w-full h-24"><rect width="220" height="120" fill="#fff"/><rect x="0" y="0" width="80" height="120" fill="#171B2E"/><rect x="16" y="20" width="48" height="30" fill="#C89B3C"/><rect x="96" y="18" width="108" height="6" fill="#171B2E"/><rect x="96" y="34" width="108" height="1" fill="#ddd"/><rect x="96" y="46" width="60" height="1" fill="#ddd"/><rect x="96" y="56" width="80" height="1" fill="#ddd"/></svg>,
    dashboard: <svg viewBox="0 0 220 120" className="w-full h-24"><rect width="220" height="120" fill="#F5F6FA"/><rect x="14" y="14" width="90" height="46" rx="8" fill="#fff" stroke="#E6E7F0"/><circle cx="35" cy="37" r="14" fill="none" stroke="#C89B3C" strokeWidth="4"/><rect x="116" y="14" width="90" height="46" rx="8" fill="#fff" stroke="#E6E7F0"/><rect x="14" y="68" width="192" height="38" rx="8" fill="#fff" stroke="#E6E7F0"/></svg>,
    classic: <svg viewBox="0 0 220 120" className="w-full h-24"><rect width="220" height="120" fill="#fff" stroke="#171B2E" strokeWidth="2"/><rect x="60" y="12" width="100" height="6" fill="#171B2E"/><line x1="10" y1="30" x2="210" y2="30" stroke="#171B2E"/><rect x="10" y="42" width="200" height="60" fill="none" stroke="#171B2E"/><line x1="10" y1="58" x2="210" y2="58" stroke="#171B2E" strokeWidth="0.5"/><line x1="10" y1="74" x2="210" y2="74" stroke="#171B2E" strokeWidth="0.5"/><line x1="110" y1="42" x2="110" y2="102" stroke="#171B2E" strokeWidth="0.5"/></svg>,
  };
  return <div className="rounded-lg overflow-hidden border" style={{ borderColor: TOKENS.line }}>{swatches[id]}</div>;
}

/* --- Left panel: section list with full controls --- */
function SectionEditorPanel({ sections, onChange, school, activeSectionId, setActiveSectionId, student }) {
  const { dark } = useApp();
  const [dragId, setDragId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const ordered = [...sections].sort((a, b) => a.order - b.order);

  const patch = (id, patchObj) => onChange(sections.map((s) => (s.id === id ? { ...s, ...patchObj } : s)));
  const patchData = (id, dataPatch) => onChange(sections.map((s) => (s.id === id ? { ...s, data: { ...s.data, ...dataPatch } } : s)));
  const remove = (id) => onChange(sections.filter((s) => s.id !== id));
  const duplicateSec = (s) => {
    const copy = { ...s, id: uid(), title: s.title + " (Copy)", order: sections.length };
    onChange([...sections, copy]);
  };
  const move = (id, dir) => {
    const idx = ordered.findIndex((s) => s.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;
    const next = [...ordered];
    [next[idx].order, next[swapIdx].order] = [next[swapIdx].order, next[idx].order];
    onChange(sections.map((s) => next.find((n) => n.id === s.id) || s));
  };
  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId) return;
    const from = ordered.findIndex((s) => s.id === dragId);
    const to = ordered.findIndex((s) => s.id === targetId);
    const next = [...ordered];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(sections.map((s) => ({ ...s, order: next.findIndex((n) => n.id === s.id) })));
    setDragId(null);
  };
  const addSection = (lib) => {
    onChange([...sections, { id: uid(), type: lib.type, title: lib.title, visible: true, order: sections.length,
      data: lib.type === "custom-table" ? { rows: [{ id: uid(), c1: "", c2: "", c3: "" }], cols: ["Column A","Column B","Column C"] } :
            lib.type === "custom-cards" ? { cards: [{ id: uid(), label: "Metric", value: "—" }] } :
            lib.type === "assessmentTable" || lib.type === "activityTable" ? { rows: [] } : {} }]);
    setAddOpen(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] font-semibold">Report Sections</div>
        <div className="relative">
          <Btn size="sm" variant="gold" icon={PlusCircle} onClick={() => setAddOpen(!addOpen)}>Add Section</Btn>
          {addOpen && (
            <div className="absolute right-0 top-9 z-20 w-56 rounded-xl border shadow-xl p-2" style={{ background: dark ? TOKENS.surfaceDark : "#fff", borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>
              <div className="text-[10px] font-bold uppercase px-2 py-1" style={{ color: TOKENS.muted }}>Custom Blocks</div>
              {CUSTOM_LIBRARY.map((l) => (
                <button key={l.type} onClick={() => addSection(l)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12.5px] hover:bg-black/5">
                  <l.icon size={14} style={{ color: TOKENS.gold }} /> {l.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {ordered.map((s, i) => (
          <div key={s.id}
            draggable onDragStart={() => setDragId(s.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(s.id)}
            className="rounded-xl border overflow-hidden" style={{ borderColor: activeSectionId === s.id ? TOKENS.gold : dark ? TOKENS.lineDark : TOKENS.line, opacity: s.visible ? 1 : 0.55 }}>
            <div className="flex items-center gap-1.5 px-2.5 py-2" style={{ background: dark ? "#12142380" : "#FAFAFD" }}>
              <GripVertical size={13} className="cursor-grab flex-shrink-0" style={{ color: TOKENS.muted }} />
              <button className="flex-1 text-left text-[12.5px] font-medium truncate" onClick={() => setActiveSectionId(activeSectionId === s.id ? null : s.id)}>{s.title}</button>
              <IconBtn icon={ChevronUp} onClick={() => move(s.id, -1)} title="Move up" />
              <IconBtn icon={ChevronDown} onClick={() => move(s.id, 1)} title="Move down" />
              <IconBtn icon={s.visible ? Eye : EyeOff} active={s.visible} onClick={() => patch(s.id, { visible: !s.visible })} title="Show/Hide" />
              <IconBtn icon={Copy} onClick={() => duplicateSec(s)} title="Duplicate" />
              <IconBtn icon={Trash2} onClick={() => remove(s.id)} title="Delete" />
            </div>
            {activeSectionId === s.id && (
              <div className="p-3 border-t" style={{ borderColor: dark ? TOKENS.lineDark : TOKENS.line }}>
                <Field label="Section Heading"><TextInput value={s.title} onChange={(e) => patch(s.id, { title: e.target.value })} /></Field>
                <SectionDataEditor section={s} onDataChange={(d) => patchData(s.id, d)} school={school} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionDataEditor({ section, onDataChange, school }) {
  const { dark } = useApp();
  const { type, data } = section;

  if (type === "assessmentTable" || type === "activityTable") {
    const rows = data.rows || [];
    const setRows = (r) => onDataChange({ rows: r });
    return (
      <div>
        {rows.map((row, i) => (
          <div key={row.id} className="grid grid-cols-[1fr_54px_54px_auto] gap-1.5 items-center mb-1.5">
            <TextInput value={row.name} placeholder="Subject" onChange={(e) => setRows(rows.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r))} />
            <TextInput type="number" value={row.obtained} placeholder="Marks" onChange={(e) => setRows(rows.map((r, idx) => idx === i ? { ...r, obtained: e.target.value } : r))} />
            <TextInput type="number" value={row.total} placeholder="Max" onChange={(e) => setRows(rows.map((r, idx) => idx === i ? { ...r, total: e.target.value } : r))} />
            <IconBtn icon={Trash2} onClick={() => setRows(rows.filter((_, idx) => idx !== i))} />
          </div>
        ))}
        <Btn size="sm" variant="ghost" icon={Plus} onClick={() => setRows([...rows, { id: uid(), name: "", obtained: "", total: 100, remarks: "" }])}>Add Row</Btn>
      </div>
    );
  }
  if (type === "attendance") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Field label="Days Present"><TextInput type="number" value={data.present} onChange={(e) => onDataChange({ present: e.target.value })} /></Field>
        <Field label="Total Days"><TextInput type="number" value={data.total} onChange={(e) => onDataChange({ total: e.target.value })} /></Field>
      </div>
    );
  }
  if (["character", "hostel", "strengths", "improvement", "remarks"].includes(type) || type === "custom-text") {
    return <RichEditor html={data.html} onChange={(html) => onDataChange({ html })} placeholder="Type here…" />;
  }
  if (type === "photo") {
    return <div className="text-[11.5px]" style={{ color: TOKENS.muted }}>Uses the student's profile photo automatically. Update it from Student Management.</div>;
  }
  if (type === "studentInfo" || type === "signatures") {
    return <div className="text-[11.5px]" style={{ color: TOKENS.muted }}>Populated automatically from student and school profile data.</div>;
  }
  if (type === "custom-image") {
    return (
      <div>
        {data.src ? <img src={data.src} className="w-full rounded-lg mb-2" /> : <FileDrop icon={ImageIcon} label="Upload image" onFile={async (f) => onDataChange({ src: await fileToBase64(f) })} />}
        <TextInput placeholder="Caption" value={data.caption || ""} onChange={(e) => onDataChange({ caption: e.target.value })} />
      </div>
    );
  }
  if (type === "custom-cards") {
    const cards = data.cards || [];
    const setCards = (c) => onDataChange({ cards: c });
    return (
      <div>
        {cards.map((c, i) => (
          <div key={c.id} className="grid grid-cols-[1fr_1fr_auto] gap-1.5 mb-1.5">
            <TextInput value={c.label} placeholder="Label" onChange={(e) => setCards(cards.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} />
            <TextInput value={c.value} placeholder="Value" onChange={(e) => setCards(cards.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} />
            <IconBtn icon={Trash2} onClick={() => setCards(cards.filter((_, idx) => idx !== i))} />
          </div>
        ))}
        <Btn size="sm" variant="ghost" icon={Plus} onClick={() => setCards([...cards, { id: uid(), label: "", value: "" }])}>Add Card</Btn>
      </div>
    );
  }
  if (type === "custom-table") {
    const rows = data.rows || []; const cols = data.cols || ["A", "B", "C"];
    const setRows = (r) => onDataChange({ rows: r });
    return (
      <div>
        <div className="grid grid-cols-3 gap-1.5 mb-1.5">
          {cols.map((c, i) => <TextInput key={i} value={c} onChange={(e) => onDataChange({ cols: cols.map((x, idx) => idx === i ? e.target.value : x) })} />)}
        </div>
        {rows.map((row, i) => (
          <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5 mb-1.5">
            <TextInput value={row.c1} onChange={(e) => setRows(rows.map((r, idx) => idx === i ? { ...r, c1: e.target.value } : r))} />
            <TextInput value={row.c2} onChange={(e) => setRows(rows.map((r, idx) => idx === i ? { ...r, c2: e.target.value } : r))} />
            <TextInput value={row.c3} onChange={(e) => setRows(rows.map((r, idx) => idx === i ? { ...r, c3: e.target.value } : r))} />
            <IconBtn icon={Trash2} onClick={() => setRows(rows.filter((_, idx) => idx !== i))} />
          </div>
        ))}
        <Btn size="sm" variant="ghost" icon={Plus} onClick={() => setRows([...rows, { id: uid(), c1: "", c2: "", c3: "" }])}>Add Row</Btn>
      </div>
    );
  }
  if (type === "custom-chart") {
    return <div className="text-[11.5px]" style={{ color: TOKENS.muted }}>Automatically visualizes subject performance from Continuous Assessment.</div>;
  }
  return null;
}

/* ============================================================================
   REPORT PREVIEW — dispatches to 5 structurally distinct theme renderers
   ========================================================================== */
function ReportPreview({ themeId, sections, school, student, month, year, stats }) {
  const visible = [...sections].filter((s) => s.visible).sort((a, b) => a.order - b.order);
  const props = { sections: visible, school, student, month, year, stats };
  if (!student) return <Card className="w-[800px]"><EmptyState icon={Users} title="Select a student" body="Choose a student above to preview their report." /></Card>;
  switch (themeId) {
    case "colorful": return <ThemeColorful {...props} />;
    case "editorial": return <ThemeEditorial {...props} />;
    case "dashboard": return <ThemeDashboard {...props} />;
    case "classic": return <ThemeClassic {...props} />;
    default: return <ThemeExecutive {...props} />;
  }
}

function SectionSwitch({ s, school, student, stats, render }) {
  return render(s);
}

/* ---------- THEME 1 — Executive / International: certificate-style, minimal ---------- */
function ThemeExecutive({ sections, school, student, month, year, stats }) {
  const c = school.colors;
  return (
    <div className="w-[800px] shadow-2xl" style={{ background: "#FEFDFA", fontFamily: school.fontBody, color: "#22242E" }}>
      <div className="px-16 pt-14 pb-10 text-center border-b" style={{ borderColor: c.accent }}>
        {school.logo && <img src={school.logo} className="h-14 mx-auto mb-4 object-contain" />}
        <div className="text-[11px] tracking-[4px] uppercase font-semibold" style={{ color: c.accent }}>{school.academicYear}</div>
        <div className="text-[30px] mt-2" style={{ fontFamily: school.fontHeading, fontWeight: 600, color: c.primary }}>{school.name}</div>
        <div className="text-[11.5px] mt-1 text-neutral-500">{school.address}</div>
        <div className="mt-6 inline-block px-5 py-1.5 rounded-full text-[11px] font-semibold tracking-wide" style={{ border: `1px solid ${c.accent}`, color: c.accent }}>
          MONTHLY PERFORMANCE REPORT · {month.toUpperCase()} {year}
        </div>
      </div>

      <div className="px-16 py-10">
        {sections.map((s) => (
          <div key={s.id} className="mb-9">
            {s.type === "studentInfo" && (
              <div className="flex items-center gap-8 pb-8 mb-8 border-b border-neutral-100">
                {student.photo && <img src={student.photo} className="w-24 h-24 rounded-full object-cover border-4" style={{ borderColor: c.accent + "40" }} />}
                <div className="grid grid-cols-2 gap-x-10 gap-y-2 flex-1">
                  {[["Student", student.name], ["Class", `${student.class || "—"} ${student.section || ""}`], ["Roll No.", student.roll || "—"], ["Guardian", student.guardian || "—"]].map(([l, v]) => (
                    <div key={l}><div className="text-[10px] uppercase tracking-wider text-neutral-400">{l}</div><div className="text-[14px] font-medium" style={{ fontFamily: school.fontHeading }}>{v}</div></div>
                  ))}
                </div>
                <RingProgress value={stats.overallPct} size={64} color={c.accent} />
              </div>
            )}
            {(s.type === "assessmentTable" || s.type === "activityTable") && (
              <div>
                <SectionTitle text={s.title} color={c.primary} font={school.fontHeading} accent={c.accent} />
                <table className="w-full mt-4 text-[12.5px]">
                  <thead><tr className="text-[10px] uppercase tracking-wider text-neutral-400"><th className="text-left pb-2 font-medium">Subject</th><th className="text-right pb-2 font-medium">Marks</th><th className="text-right pb-2 font-medium">%</th><th className="text-right pb-2 font-medium">Grade</th></tr></thead>
                  <tbody>
                    {(s.data.rows || []).map((r) => { const pct = r.total ? (Number(r.obtained || 0) / r.total) * 100 : 0; return (
                      <tr key={r.id} className="border-t border-neutral-100"><td className="py-2.5">{r.name}</td><td className="py-2.5 text-right font-mono text-[11.5px]">{r.obtained || "—"}/{r.total}</td><td className="py-2.5 text-right font-mono text-[11.5px]">{pct.toFixed(0)}%</td><td className="py-2.5 text-right font-semibold" style={{ color: c.accent }}>{gradeFor(pct).grade}</td></tr>
                    );})}
                  </tbody>
                </table>
              </div>
            )}
            {s.type === "attendance" && (
              <div>
                <SectionTitle text={s.title} color={c.primary} font={school.fontHeading} accent={c.accent} />
                <div className="flex items-center gap-6 mt-4">
                  <RingProgress value={stats.attPct} size={70} color={c.accent} />
                  <div className="text-[13px] text-neutral-600">{s.data.present || 0} of {s.data.total || 0} school days attended</div>
                </div>
              </div>
            )}
            {["character","hostel","strengths","improvement","remarks","custom-text"].includes(s.type) && (
              <div>
                <SectionTitle text={s.title} color={c.primary} font={school.fontHeading} accent={c.accent} />
                <div className="text-[13px] leading-relaxed text-neutral-700 mt-3" dangerouslySetInnerHTML={{ __html: s.data.html || "<span class='text-neutral-300'>Not yet written.</span>" }} />
              </div>
            )}
            {s.type === "photo" && student.photo && <img src={student.photo} className="w-28 h-28 rounded-xl object-cover mx-auto" />}
            {s.type === "custom-cards" && (
              <div className="grid grid-cols-3 gap-4">
                {(s.data.cards || []).map((cd) => <div key={cd.id} className="text-center border rounded-xl py-4" style={{ borderColor: c.accent + "40" }}><div className="text-[20px] font-semibold" style={{ fontFamily: school.fontHeading, color: c.primary }}>{cd.value}</div><div className="text-[10.5px] uppercase tracking-wide text-neutral-400 mt-1">{cd.label}</div></div>)}
              </div>
            )}
            {s.type === "custom-image" && s.data.src && <div><img src={s.data.src} className="w-full rounded-xl" />{s.data.caption && <div className="text-[11px] text-center text-neutral-400 mt-2">{s.data.caption}</div>}</div>}
            {s.type === "custom-table" && <CustomTablePlain s={s} accent={c.accent} />}
            {s.type === "custom-chart" && <MiniBarChart stats={stats} accent={c.accent} />}
            {s.type === "signatures" && <SignatureRow school={school} font={school.fontHeading} />}
          </div>
        ))}
      </div>
      <div className="px-16 py-5 text-center text-[10px] tracking-wide text-neutral-400 border-t" style={{ borderColor: "#F0EEE4" }}>Generated by ReportCraft · {school.name}</div>
    </div>
  );
}
function SectionTitle({ text, color, font, accent }) {
  return <div className="flex items-center gap-3"><div className="text-[15px] font-semibold" style={{ fontFamily: font, color }}>{text}</div><div className="flex-1 h-px" style={{ background: `${accent}30` }} /></div>;
}
function SignatureRow({ school, font }) {
  return (
    <div className="grid grid-cols-2 gap-10 pt-6 mt-4">
      {[["Principal", school.principalName, school.principalSig], ["Coordinator", school.coordinatorName, school.coordinatorSig]].map(([role, name, sig]) => (
        <div key={role} className="text-center">
          {sig ? <img src={sig} className="h-10 mx-auto mb-1 object-contain" /> : <div className="h-10" />}
          <div className="border-t border-neutral-300 pt-2"><div className="text-[12px] font-medium" style={{ fontFamily: font }}>{name}</div><div className="text-[10px] text-neutral-400 uppercase tracking-wide">{role}</div></div>
        </div>
      ))}
    </div>
  );
}
function CustomTablePlain({ s, accent }) {
  return (
    <table className="w-full text-[12px] mt-3">
      <thead><tr>{(s.data.cols || []).map((c, i) => <th key={i} className="text-left pb-2 border-b" style={{ borderColor: accent + "30" }}>{c}</th>)}</tr></thead>
      <tbody>{(s.data.rows || []).map((r) => <tr key={r.id} className="border-b border-neutral-100"><td className="py-2">{r.c1}</td><td className="py-2">{r.c2}</td><td className="py-2">{r.c3}</td></tr>)}</tbody>
    </table>
  );
}
function MiniBarChart({ stats, accent }) {
  const rows = stats.subjectRows || [];
  if (!rows.length) return <div className="text-[12px] text-neutral-400">Add subject marks to see a chart.</div>;
  return (
    <div className="space-y-2 mt-3">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3">
          <div className="w-28 text-[11.5px] truncate">{r.name}</div>
          <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: accent }} /></div>
          <div className="w-9 text-[11px] text-right font-mono">{r.pct.toFixed(0)}%</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- THEME 2 — Modern Colorful: gradient header, rounded cards ---------- */
function ThemeColorful({ sections, school, student, month, year, stats }) {
  const c = school.colors;
  return (
    <div className="w-[800px] rounded-3xl overflow-hidden shadow-2xl" style={{ background: "#fff", fontFamily: school.fontBody }}>
      <div className="px-10 pt-9 pb-16 relative" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.accent})` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {school.logo && <img src={school.logo} className="h-10 object-contain bg-white/90 rounded-lg p-1" />}
            <div className="text-white"><div className="text-[15px] font-bold" style={{ fontFamily: school.fontHeading }}>{school.name}</div><div className="text-[11px] opacity-80">{school.academicYear}</div></div>
          </div>
          <div className="text-white text-right"><div className="text-[10px] opacity-80 uppercase tracking-wide">Report Card</div><div className="text-[13px] font-semibold">{month} {year}</div></div>
        </div>
      </div>

      <div className="px-10 -mt-10 pb-10">
        <div className="bg-white rounded-2xl shadow-lg p-5 flex items-center gap-4 mb-7">
          {student.photo ? <img src={student.photo} className="w-16 h-16 rounded-2xl object-cover" /> : <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white" style={{ background: c.accent }}>{student.name[0]}</div>}
          <div className="flex-1"><div className="text-[16px] font-bold" style={{ fontFamily: school.fontHeading }}>{student.name}</div><div className="text-[12px] text-neutral-500">{student.class} {student.section} · Roll {student.roll || "—"}</div></div>
          <div className="text-center px-4 py-2 rounded-xl" style={{ background: `${c.accent}18` }}><div className="text-[18px] font-extrabold" style={{ color: c.primary }}>{stats.grade.grade}</div><div className="text-[9px] uppercase text-neutral-400">Overall</div></div>
        </div>

        {sections.map((s) => (
          <div key={s.id} className="mb-6">
            {(s.type === "assessmentTable" || s.type === "activityTable") && (
              <div>
                <ColorfulLabel text={s.title} c={c} />
                <div className="grid grid-cols-2 gap-2.5 mt-3">
                  {(s.data.rows || []).map((r, i) => { const pct = r.total ? (Number(r.obtained || 0) / r.total) * 100 : 0; const palette=["#5B6FE8","#E8956B","#3FBF8F","#E85B9E","#8B6FE8","#4FB8D4"]; const col = palette[i % palette.length]; return (
                    <div key={r.id} className="rounded-xl p-3" style={{ background: `${col}10` }}>
                      <div className="flex justify-between items-center mb-1.5"><span className="text-[12px] font-semibold">{r.name}</span><span className="text-[11px] font-mono font-semibold" style={{ color: col }}>{r.obtained || 0}/{r.total}</span></div>
                      <div className="h-1.5 rounded-full bg-white overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} /></div>
                    </div>
                  );})}
                </div>
              </div>
            )}
            {s.type === "attendance" && (
              <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: `${c.primary}08` }}>
                <RingProgress value={stats.attPct} size={54} color={c.primary} />
                <div><div className="text-[13px] font-semibold">{s.title}</div><div className="text-[11.5px] text-neutral-500">{s.data.present || 0}/{s.data.total || 0} days present</div></div>
              </div>
            )}
            {["character","hostel","strengths","improvement","remarks","custom-text"].includes(s.type) && (
              <div className="rounded-2xl p-4" style={{ background: "#F7F8FC" }}>
                <ColorfulLabel text={s.title} c={c} />
                <div className="text-[12.5px] leading-relaxed text-neutral-700 mt-2" dangerouslySetInnerHTML={{ __html: s.data.html || "<span class='text-neutral-300'>Not yet written.</span>" }} />
              </div>
            )}
            {s.type === "custom-cards" && (
              <div className="grid grid-cols-3 gap-3">
                {(s.data.cards || []).map((cd, i) => { const palette=["#5B6FE8","#E8956B","#3FBF8F"]; return <div key={cd.id} className="rounded-2xl p-4 text-center text-white" style={{ background: palette[i%3] }}><div className="text-[18px] font-bold">{cd.value}</div><div className="text-[10px] opacity-90">{cd.label}</div></div>; })}
              </div>
            )}
            {s.type === "custom-image" && s.data.src && <img src={s.data.src} className="w-full rounded-2xl" />}
            {s.type === "custom-table" && <div className="rounded-2xl p-4" style={{ background: "#F7F8FC" }}><CustomTablePlain s={s} accent={c.accent} /></div>}
            {s.type === "custom-chart" && <div className="rounded-2xl p-4" style={{ background: "#F7F8FC" }}><MiniBarChart stats={stats} accent={c.primary} /></div>}
            {s.type === "signatures" && <SignatureRow school={school} font={school.fontHeading} />}
          </div>
        ))}
      </div>
    </div>
  );
}
function ColorfulLabel({ text, c }) {
  return <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full" style={{ background: c.accent }} /><span className="text-[12.5px] font-bold uppercase tracking-wide" style={{ color: c.primary }}>{text}</span></div>;
}

/* ---------- THEME 3 — Magazine Editorial: asymmetric grid, bold type ---------- */
function ThemeEditorial({ sections, school, student, month, year, stats }) {
  const c = school.colors;
  const infoSec = sections.find(s=>s.type==="studentInfo");
  const rest = sections.filter(s=>s.type!=="studentInfo" && s.type!=="photo");
  return (
    <div className="w-[800px] shadow-2xl flex" style={{ background: "#fff", fontFamily: school.fontBody, minHeight: 600 }}>
      <div className="w-[220px] flex-shrink-0 p-8 text-white flex flex-col" style={{ background: c.primary }}>
        {school.logo && <img src={school.logo} className="h-9 object-contain bg-white/95 rounded p-1 mb-6 self-start" />}
        <div className="text-[10px] tracking-[3px] uppercase opacity-70 mb-2">{month} {year} Issue</div>
        <div className="text-[26px] leading-tight font-black mb-6" style={{ fontFamily: school.fontHeading }}>{student.name}</div>
        {student.photo && <img src={student.photo} className="w-full aspect-square object-cover rounded mb-6" style={{ border: `3px solid ${c.accent}` }} />}
        <div className="space-y-2.5 text-[11px] opacity-90">
          <div><div className="opacity-50 uppercase text-[9px]">Class</div>{student.class} {student.section}</div>
          <div><div className="opacity-50 uppercase text-[9px]">Roll No.</div>{student.roll || "—"}</div>
          <div><div className="opacity-50 uppercase text-[9px]">Guardian</div>{student.guardian || "—"}</div>
        </div>
        <div className="flex-1" />
        <div className="pt-4" style={{ borderTop: `1px solid ${c.accent}44` }}>
          <div className="text-[9px] uppercase opacity-50 mb-1">Overall Grade</div>
          <div className="text-[34px] font-black" style={{ color: c.accent, fontFamily: school.fontHeading }}>{stats.grade.grade}</div>
        </div>
      </div>

      <div className="flex-1 p-9">
        <div className="text-[10px] tracking-[3px] uppercase mb-1" style={{ color: c.accent }}>{school.name}</div>
        <div className="text-[28px] font-black mb-6 leading-tight" style={{ fontFamily: school.fontHeading, color: c.primary }}>Performance Digest</div>
        {rest.map((s, idx) => (
          <div key={s.id} className={idx>0 ? "mt-7 pt-7" : ""} style={idx>0?{ borderTop: "1px solid #EEE" }:{}}>
            {(s.type === "assessmentTable" || s.type === "activityTable") && (
              <div>
                <EditorialHeading n={idx+1} text={s.title} c={c} font={school.fontHeading} />
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4">
                  {(s.data.rows || []).map((r) => { const pct = r.total ? (Number(r.obtained||0)/r.total)*100 : 0; return (
                    <div key={r.id} className="flex items-baseline justify-between border-b border-dotted border-neutral-300 pb-1.5">
                      <span className="text-[12.5px] font-medium">{r.name}</span>
                      <span className="text-[12px] font-mono" style={{ color: c.accent }}>{r.obtained||0}<span className="text-neutral-400">/{r.total}</span></span>
                    </div>
                  );})}
                </div>
              </div>
            )}
            {s.type === "attendance" && (
              <div><EditorialHeading n={idx+1} text={s.title} c={c} font={school.fontHeading} />
                <div className="text-[42px] font-black mt-2" style={{ fontFamily: school.fontHeading, color: c.primary }}>{stats.attPct.toFixed(0)}<span className="text-[16px]">%</span></div>
                <div className="text-[11.5px] text-neutral-500">{s.data.present||0} of {s.data.total||0} days attended</div>
              </div>
            )}
            {["character","hostel","strengths","improvement","remarks","custom-text"].includes(s.type) && (
              <div><EditorialHeading n={idx+1} text={s.title} c={c} font={school.fontHeading} />
                <div className="text-[13px] leading-relaxed mt-2 italic text-neutral-700" style={{ borderLeft: `3px solid ${c.accent}`, paddingLeft: 14 }} dangerouslySetInnerHTML={{ __html: s.data.html || "<span class='text-neutral-300'>Not yet written.</span>" }} />
              </div>
            )}
            {s.type === "custom-cards" && (
              <div><EditorialHeading n={idx+1} text={s.title} c={c} font={school.fontHeading} />
                <div className="grid grid-cols-3 gap-3 mt-3">{(s.data.cards||[]).map(cd=><div key={cd.id}><div className="text-[22px] font-black" style={{ fontFamily: school.fontHeading, color: c.accent }}>{cd.value}</div><div className="text-[10px] uppercase text-neutral-400">{cd.label}</div></div>)}</div>
              </div>
            )}
            {s.type === "custom-image" && s.data.src && <div><EditorialHeading n={idx+1} text={s.title} c={c} font={school.fontHeading} /><img src={s.data.src} className="w-full mt-3" /></div>}
            {s.type === "custom-table" && <div><EditorialHeading n={idx+1} text={s.title} c={c} font={school.fontHeading} /><CustomTablePlain s={s} accent={c.accent} /></div>}
            {s.type === "custom-chart" && <div><EditorialHeading n={idx+1} text={s.title} c={c} font={school.fontHeading} /><MiniBarChart stats={stats} accent={c.accent} /></div>}
            {s.type === "signatures" && <SignatureRow school={school} font={school.fontHeading} />}
          </div>
        ))}
      </div>
    </div>
  );
}
function EditorialHeading({ n, text, c, font }) {
  return <div className="flex items-baseline gap-2"><span className="text-[11px] font-mono" style={{ color: c.accent }}>{String(n).padStart(2,"0")}</span><span className="text-[15px] font-bold" style={{ fontFamily: font, color: c.primary }}>{text}</span></div>;
}

/* ---------- THEME 4 — Academic Dashboard: KPI cards, rings, badges ---------- */
function ThemeDashboard({ sections, school, student, month, year, stats }) {
  const c = school.colors;
  return (
    <div className="w-[800px] shadow-2xl p-9" style={{ background: "#F7F8FC", fontFamily: school.fontBody }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">{school.logo && <img src={school.logo} className="h-9 object-contain" />}<div><div className="text-[14px] font-bold" style={{ fontFamily: school.fontHeading }}>{school.name}</div><div className="text-[10.5px] text-neutral-400">Academic Performance · {month} {year}</div></div></div>
        <Badge tone="gold">{school.academicYear}</Badge>
      </div>

      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center bg-white rounded-2xl p-5 mb-6 shadow-sm">
        {student.photo ? <img src={student.photo} className="w-14 h-14 rounded-xl object-cover" /> : <div className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-white" style={{ background: c.primary }}>{student.name[0]}</div>}
        <div><div className="text-[15px] font-bold">{student.name}</div><div className="text-[11px] text-neutral-400">{student.class} {student.section} · Roll {student.roll||"—"}</div></div>
        <div className="text-center"><RingProgress value={stats.overallPct} size={50} color={c.primary} /><div className="text-[9px] text-neutral-400 mt-0.5">Overall</div></div>
        <div className="text-center px-3 py-2 rounded-xl" style={{ background: `${c.accent}18`, color: "#8A6412" }}><Award size={16} className="mx-auto mb-0.5" /><div className="text-[10px] font-bold">{stats.grade.label}</div></div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <KPI label="Assessment Avg" value={`${stats.overallPct.toFixed(0)}%`} icon={TrendingUp} c={c} />
        <KPI label="Activity Score" value={`${stats.actPct.toFixed(0)}%`} icon={Star} c={c} />
        <KPI label="Attendance" value={`${stats.attPct.toFixed(0)}%`} icon={CalendarCheck} c={c} />
      </div>

      {sections.filter(s=>!["studentInfo","photo"].includes(s.type)).map((s) => (
        <div key={s.id} className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
          {(s.type === "assessmentTable" || s.type === "activityTable") && (
            <div>
              <div className="text-[12.5px] font-bold mb-3 flex items-center gap-2"><BarChart3 size={14} style={{ color: c.primary }} />{s.title}</div>
              <div className="space-y-2.5">
                {(s.data.rows || []).map((r) => { const pct = r.total ? (Number(r.obtained||0)/r.total)*100 : 0; return (
                  <div key={r.id} className="flex items-center gap-3">
                    <div className="w-32 text-[11.5px] font-medium truncate">{r.name}</div>
                    <div className="flex-1 h-2.5 rounded-full bg-neutral-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct>=75?TOKENS.success:pct>=50?c.accent:TOKENS.warn }} /></div>
                    <Badge tone={pct>=75?"success":pct>=50?"gold":"warn"}>{gradeFor(pct).grade}</Badge>
                  </div>
                );})}
              </div>
            </div>
          )}
          {s.type === "attendance" && (
            <div className="flex items-center gap-5">
              <RingProgress value={stats.attPct} size={60} color={c.primary} />
              <div><div className="text-[12.5px] font-bold">{s.title}</div><div className="text-[11.5px] text-neutral-400">{s.data.present||0} / {s.data.total||0} school days</div></div>
            </div>
          )}
          {["character","hostel","strengths","improvement","remarks","custom-text"].includes(s.type) && (
            <div><div className="text-[12.5px] font-bold mb-2">{s.title}</div><div className="text-[12.5px] text-neutral-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: s.data.html || "<span class='text-neutral-300'>Not yet written.</span>" }} /></div>
          )}
          {s.type === "custom-cards" && <div className="grid grid-cols-3 gap-3">{(s.data.cards||[]).map(cd=><div key={cd.id} className="text-center rounded-xl p-3" style={{ background: "#F7F8FC" }}><div className="text-[16px] font-bold" style={{ color: c.primary }}>{cd.value}</div><div className="text-[10px] text-neutral-400">{cd.label}</div></div>)}</div>}
          {s.type === "custom-image" && s.data.src && <img src={s.data.src} className="w-full rounded-xl" />}
          {s.type === "custom-table" && <CustomTablePlain s={s} accent={c.primary} />}
          {s.type === "custom-chart" && <MiniBarChart stats={stats} accent={c.primary} />}
          {s.type === "signatures" && <SignatureRow school={school} font={school.fontHeading} />}
        </div>
      ))}
    </div>
  );
}
function KPI({ label, value, icon: Icon, c }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-1.5"><Icon size={14} style={{ color: c.accent }} /><TrendingUp size={11} className="text-neutral-300" /></div>
      <div className="text-[19px] font-bold" style={{ fontFamily: "Sora" }}>{value}</div>
      <div className="text-[10.5px] text-neutral-400">{label}</div>
    </div>
  );
}

/* ---------- THEME 5 — Classic School Report: formal, bordered, print-first ---------- */
function ThemeClassic({ sections, school, student, month, year, stats }) {
  return (
    <div className="w-[800px] shadow-2xl p-10" style={{ background: "#fff", fontFamily: "'Libre Baskerville', serif", color: "#1A1A1A", border: "1px solid #000" }}>
      <div className="text-center border-b-2 border-black pb-4 mb-4">
        {school.logo && <img src={school.logo} className="h-12 mx-auto mb-2 object-contain" />}
        <div className="text-[20px] font-bold uppercase tracking-wide">{school.name}</div>
        <div className="text-[11px]">{school.address}</div>
        <div className="text-[12px] font-bold mt-2 uppercase">Monthly Progress Report — {month} {year} ({school.academicYear})</div>
      </div>

      <table className="w-full text-[12px] mb-4 border border-black">
        <tbody>
          <tr><td className="border border-black px-2 py-1 font-bold w-1/4">Student Name</td><td className="border border-black px-2 py-1">{student.name}</td><td className="border border-black px-2 py-1 font-bold w-1/6">Roll No.</td><td className="border border-black px-2 py-1">{student.roll||"—"}</td></tr>
          <tr><td className="border border-black px-2 py-1 font-bold">Class / Section</td><td className="border border-black px-2 py-1">{student.class} {student.section}</td><td className="border border-black px-2 py-1 font-bold">Guardian</td><td className="border border-black px-2 py-1">{student.guardian||"—"}</td></tr>
        </tbody>
      </table>

      {sections.filter(s=>!["studentInfo","photo"].includes(s.type)).map((s) => (
        <div key={s.id} className="mb-4">
          {(s.type === "assessmentTable" || s.type === "activityTable") && (
            <div>
              <div className="text-[12.5px] font-bold uppercase mb-1.5 bg-black text-white inline-block px-2 py-0.5">{s.title}</div>
              <table className="w-full text-[12px] border border-black">
                <thead><tr>{["Subject","Marks Obtained","Total Marks","Percentage","Grade"].map(h=><th key={h} className="border border-black px-2 py-1 font-bold">{h}</th>)}</tr></thead>
                <tbody>
                  {(s.data.rows||[]).map(r=>{ const pct = r.total ? (Number(r.obtained||0)/r.total)*100 : 0; return (
                    <tr key={r.id}><td className="border border-black px-2 py-1">{r.name}</td><td className="border border-black px-2 py-1 text-center">{r.obtained||"—"}</td><td className="border border-black px-2 py-1 text-center">{r.total}</td><td className="border border-black px-2 py-1 text-center">{pct.toFixed(0)}%</td><td className="border border-black px-2 py-1 text-center font-bold">{gradeFor(pct).grade}</td></tr>
                  );})}
                  <tr className="font-bold"><td className="border border-black px-2 py-1">Total</td><td className="border border-black px-2 py-1 text-center">{stats.totalObtained}</td><td className="border border-black px-2 py-1 text-center">{stats.totalMax}</td><td className="border border-black px-2 py-1 text-center" colSpan={2}>{stats.overallPct.toFixed(1)}% — {stats.grade.grade}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          {s.type === "attendance" && (
            <table className="w-full text-[12px] border border-black">
              <tbody><tr><td className="border border-black px-2 py-1 font-bold w-1/3">{s.title}</td><td className="border border-black px-2 py-1">{s.data.present||0} / {s.data.total||0} days present ({stats.attPct.toFixed(0)}%)</td></tr></tbody>
            </table>
          )}
          {["character","hostel","strengths","improvement","remarks","custom-text"].includes(s.type) && (
            <div><div className="text-[12.5px] font-bold uppercase mb-1 bg-black text-white inline-block px-2 py-0.5">{s.title}</div>
              <div className="text-[12.5px] border border-black px-2 py-2 min-h-[36px]" dangerouslySetInnerHTML={{ __html: s.data.html || "&nbsp;" }} />
            </div>
          )}
          {s.type === "custom-cards" && <div className="grid grid-cols-3 gap-0 border border-black">{(s.data.cards||[]).map((cd,i)=><div key={cd.id} className={`px-2 py-2 text-center ${i>0?"border-l border-black":""}`}><div className="font-bold text-[14px]">{cd.value}</div><div className="text-[10px]">{cd.label}</div></div>)}</div>}
          {s.type === "custom-image" && s.data.src && <img src={s.data.src} className="w-full" />}
          {s.type === "custom-table" && <CustomTablePlain s={s} accent="#000" />}
          {s.type === "custom-chart" && <MiniBarChart stats={stats} accent="#000" />}
          {s.type === "signatures" && (
            <div className="grid grid-cols-2 gap-10 pt-8 mt-2">
              {[["Principal", school.principalName, school.principalSig], ["Class Coordinator", school.coordinatorName, school.coordinatorSig]].map(([role,name,sig])=>(
                <div key={role} className="text-center">{sig && <img src={sig} className="h-9 mx-auto object-contain" />}<div className="border-t border-black pt-1 mt-1 text-[11.5px]">{name}<div className="text-[10px]">{role}</div></div></div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   TEMPLATE MANAGER
   ========================================================================== */
function TemplateManager() {
  const { templates, setTemplates, school, setSchool, dark } = useApp();
  const [nameDraft, setNameDraft] = useState("");
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const saveCurrent = () => {
    if (!nameDraft.trim()) return;
    const tpl = {
      id: uid(), name: nameDraft.trim(), themeId: school.defaultThemeId,
      colors: school.colors, fontHeading: school.fontHeading, fontBody: school.fontBody,
      headings: school.headings, defaultSectionVisibility: school.defaultSectionVisibility,
      logo: school.logo, isDefault: templates.length === 0, createdAt: Date.now(),
    };
    setTemplates([...templates, tpl]); setNameDraft("");
  };
  const applyTemplate = (t) => setSchool({ ...school, colors: t.colors, fontHeading: t.fontHeading, fontBody: t.fontBody, headings: t.headings, defaultSectionVisibility: t.defaultSectionVisibility, defaultThemeId: t.themeId, logo: t.logo ?? school.logo });
  const duplicate = (t) => setTemplates([...templates, { ...t, id: uid(), name: t.name + " (Copy)", isDefault: false }]);
  const remove = (id) => setTemplates(templates.filter((t) => t.id !== id));
  const rename = (id, name) => setTemplates(templates.map((t) => (t.id === id ? { ...t, name } : t)));
  const setDefault = (id) => setTemplates(templates.map((t) => ({ ...t, isDefault: t.id === id })));
  const exportTpl = (t) => {
    const blob = new Blob([JSON.stringify(t, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `${t.name.replace(/\s+/g, "-").toLowerCase()}.json`; a.click(); URL.revokeObjectURL(url);
  };
  const importTpl = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => { try { const t = JSON.parse(e.target.result); setTemplates([...templates, { ...t, id: uid(), isDefault: false }]); } catch {} };
    reader.readAsText(file);
  };

  return (
    <div>
      <PageHeader eyebrow="Design Library" title="Template Manager" sub="Save your theme, branding, and layout choices to reuse across every report."
        right={<div className="flex gap-2"><input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files[0] && importTpl(e.target.files[0])} /><Btn variant="ghost" icon={Upload} onClick={() => fileRef.current.click()}>Import</Btn></div>} />

      <div className="px-8 mb-6">
        <Card>
          <div className="text-[13px] font-semibold mb-3">Save Current Design as Template</div>
          <div className="flex gap-2">
            <TextInput value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="e.g. Spring Term — Executive Gold" />
            <Btn variant="gold" icon={Save} onClick={saveCurrent} disabled={!nameDraft.trim()}>Save Template</Btn>
          </div>
          <div className="text-[11.5px] mt-2" style={{ color: dark ? "#9498B0" : TOKENS.muted }}>Captures theme, colors, fonts, branding, headings, and section visibility from School Setup.</div>
        </Card>
      </div>

      <div className="px-8 pb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.length === 0 ? (
          <div className="col-span-full"><Card><EmptyState icon={LayoutTemplate} title="No templates saved yet" body="Configure your branding in School Setup, then save it here as a reusable template." /></Card></div>
        ) : templates.map((t) => (
          <Card key={t.id} pad={false}>
            <div className="h-20 rounded-t-2xl" style={{ background: `linear-gradient(135deg, ${t.colors?.primary}, ${t.colors?.accent})` }} />
            <div className="p-4">
              <div className="flex items-center justify-between mb-1">
                <input value={t.name} onChange={(e) => rename(t.id, e.target.value)} className="text-[13px] font-semibold bg-transparent outline-none flex-1" />
                {t.isDefault && <Badge tone="gold">Default</Badge>}
              </div>
              <div className="text-[11px] mb-3" style={{ color: dark ? "#9498B0" : TOKENS.muted }}>{THEMES.find((th) => th.id === t.themeId)?.name}</div>
              <div className="flex flex-wrap gap-1.5">
                <IconBtn icon={Eye} title="Preview" onClick={() => setPreview(t)} />
                <IconBtn icon={FolderOpen} title="Apply" onClick={() => applyTemplate(t)} />
                <IconBtn icon={Copy} title="Duplicate" onClick={() => duplicate(t)} />
                <IconBtn icon={Star} title="Set Default" active={t.isDefault} onClick={() => setDefault(t.id)} />
                <IconBtn icon={Download} title="Export" onClick={() => exportTpl(t)} />
                <IconBtn icon={Trash2} title="Delete" onClick={() => remove(t.id)} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {preview && (
        <Modal open onClose={() => setPreview(null)} title={`Preview — ${preview.name}`} width={420}>
          <div className="rounded-xl p-6 text-center text-white" style={{ background: `linear-gradient(135deg, ${preview.colors.primary}, ${preview.colors.accent})` }}>
            <div className="text-[18px] font-bold" style={{ fontFamily: preview.fontHeading }}>{school.name}</div>
            <div className="text-[11px] opacity-80 mt-1">{THEMES.find((t) => t.id === preview.themeId)?.name}</div>
          </div>
          <div className="mt-4 flex justify-end"><Btn variant="gold" onClick={() => { applyTemplate(preview); setPreview(null); }}>Apply This Template</Btn></div>
        </Modal>
      )}
    </div>
  );
}
