import React, { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  getDoctorDashboard,
  startOPD,
  nextToken,
  skipToken,
  endOPD,
} from "../services/allApi";

const SESSIONS = ["morning", "evening"];

const STATUS_BG = {
  pending:    "#fef9c3", waiting:    "#ede9fe",
  consulting: "#d1fae5", done:       "#f3f4f6",
  approved:   "#dbeafe", skipped:    "#fee2e2",
};
const STATUS_FG = {
  pending:    "#92400e", waiting:    "#5b21b6",
  consulting: "#065f46", done:       "#6b7280",
  approved:   "#1e40af", skipped:    "#991b1b",
};

export default function DoctorDashboard() {
  const navigate  = useNavigate();
  const today     = new Date().toISOString().split("T")[0];
  const pollRef   = useRef(null);

  const [date,           setDate]           = useState(today);
  const [session,        setSession]        = useState("morning");
  const [dashboard,      setDashboard]      = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [acting,         setActing]         = useState(null);
  const [autoRefresh,    setAutoRefresh]    = useState(true);
  const [lastRefreshed,  setLastRefreshed]  = useState(null);
  const [confirmEnd,     setConfirmEnd]     = useState(false);

  // ── Fetch dashboard ────────────────────────────────
  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getDoctorDashboard(date, session);
      setDashboard(res.data);
      setLastRefreshed(new Date());
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      if (!silent) toast.error("Failed to load dashboard");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [date, session, navigate]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ── Auto-refresh every 15 seconds ─────────────────
  useEffect(() => {
    if (autoRefresh) {
      pollRef.current = setInterval(() => fetchDashboard(true), 15000);
    }
    return () => clearInterval(pollRef.current);
  }, [autoRefresh, fetchDashboard]);

  // ── Actions ────────────────────────────────────────
  const handleStartOPD = async () => {
    setActing("start");
    try {
      const res = await startOPD({ date });
      toast.success(res.data.message || "OPD started!");
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to start OPD");
    } finally { setActing(null); }
  };

  const handleNextToken = async () => {
    setActing("next");
    try {
      const res = await nextToken(date, session);
      toast.success(res.data.message || "Next token called!");
      fetchDashboard(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "No patients in queue");
    } finally { setActing(null); }
  };

  const handleSkip = async (id, tokenNum) => {
    if (!window.confirm(`Skip Token #${tokenNum}?`)) return;
    setActing("skip_" + id);
    try {
      await skipToken(id);
      toast.warning(`Token #${tokenNum} skipped`);
      fetchDashboard(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "Skip failed");
    } finally { setActing(null); }
  };

  const handleEndOPD = async () => {
    setConfirmEnd(false);
    setActing("end");
    try {
      const res = await endOPD({ date });
      toast.success(res.data.message || "OPD ended");
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to end OPD");
    } finally { setActing(null); }
  };

  // ── Derived data ───────────────────────────────────
  const tokens         = dashboard?.tokens || [];
  const sessTokens     = tokens.filter(t => t.session === session);
  const currentToken   = sessTokens.find(t => t.status === "consulting");
  const waitingTokens  = sessTokens.filter(t => t.status === "waiting" && t.is_confirmed);
  const unconfirmed    = sessTokens.filter(t => t.status === "waiting" && !t.is_confirmed);
  const doneTokens     = sessTokens.filter(t => t.status === "done");
  const skippedTokens  = sessTokens.filter(t => t.status === "skipped");
  const opdActive      = dashboard?.opd_started;
  const avgMin         = dashboard?.avg_consult_minutes || 7;

  const walkinTokens   = sessTokens.filter(t => t.patient_type === "walkin");
  const onlineTokens   = sessTokens.filter(t => t.patient_type === "online");

  return (
    <div style={S.page}>

      {/* ── Top Bar ── */}
      <div style={S.topBar}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={S.logoCircle}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div>
            <h1 style={S.topTitle}>Doctor Dashboard</h1>
            <p style={S.topSub}>MedQueue OPD Management</p>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <button
            onClick={() => { setAutoRefresh(r => !r); }}
            style={{ ...S.iconBtn, background: autoRefresh ? "#d1fae5" : "#f1f5f9",
              color: autoRefresh ? "#065f46" : "#64748b" }}
            title={autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}>
            {autoRefresh ? "🔄 Live" : "⏸ Paused"}
          </button>
          {lastRefreshed && (
            <span style={{ fontSize:11, color:"#94a3b8" }}>
              Updated {lastRefreshed.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}
            </span>
          )}
          <button onClick={() => fetchDashboard()} style={S.iconBtn}>↻ Refresh</button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={S.filterBar}>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <div>
            <label style={S.filterLabel}>Date</label>
            <input type="date" value={date}
              onChange={e => setDate(e.target.value)} style={S.input} />
          </div>
          <div>
            <label style={S.filterLabel}>Session</label>
            <div style={{ display:"flex", gap:6 }}>
              {SESSIONS.map(s => (
                <button key={s} onClick={() => setSession(s)} style={{
                  ...S.sessBtn,
                  background: session===s ? "#0f4c75" : "#f1f5f9",
                  color:      session===s ? "#fff"    : "#475569",
                }}>
                  {s === "morning" ? "🌅" : "🌆"} {s.charAt(0).toUpperCase()+s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* OPD controls */}
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          {!opdActive ? (
            <button onClick={handleStartOPD} disabled={acting==="start"} style={S.startBtn}>
              {acting==="start" ? "Starting..." : "▶ Start OPD"}
            </button>
          ) : (
            <>
              <button onClick={handleNextToken} disabled={!!acting} style={S.nextBtn}>
                {acting==="next" ? "Calling..." : "⏭ Next Token"}
              </button>
              <button onClick={() => setConfirmEnd(true)} disabled={!!acting} style={S.endBtn}>
                ⏹ End OPD
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? <Spinner /> : !dashboard ? (
        <Empty text="No data found" />
      ) : (
        <div style={S.content}>

          {/* ── OPD Not Started ── */}
          {!opdActive && (
            <div style={S.notStartedCard}>
              <div style={{ fontSize:48, marginBottom:12 }}>🏥</div>
              <h3 style={{ color:"#0f4c75", margin:"0 0 8px" }}>OPD Not Started</h3>
              <p style={{ color:"#64748b", margin:"0 0 20px" }}>
                Click "Start OPD" to begin the session for {date}
              </p>
              <button onClick={handleStartOPD} disabled={acting==="start"} style={{ ...S.startBtn, padding:"12px 32px", fontSize:15 }}>
                {acting==="start" ? "Starting..." : "▶ Start OPD"}
              </button>
            </div>
          )}

          {opdActive && (
            <>
              {/* ── Stats Row ── */}
              <div style={S.statsRow}>
                {[
                  { label:"Waiting",     val: waitingTokens.length,  color:"#5b21b6", bg:"#ede9fe", icon:"⏳" },
                  { label:"Consulting",  val: currentToken ? 1 : 0,  color:"#065f46", bg:"#d1fae5", icon:"🩺" },
                  { label:"Done",        val: doneTokens.length,     color:"#0f4c75", bg:"#dbeafe", icon:"✅" },
                  { label:"Skipped",     val: skippedTokens.length,  color:"#991b1b", bg:"#fee2e2", icon:"⏭" },
                  { label:"Unconfirmed", val: unconfirmed.length,    color:"#92400e", bg:"#fef9c3", icon:"⚠️" },
                  { label:"Avg Time",    val: `${avgMin}m`,          color:"#0369a1", bg:"#e0f2fe", icon:"⏱" },
                ].map(s => (
                  <div key={s.label} style={{ ...S.statCard, background:s.bg }}>
                    <div style={{ fontSize:20 }}>{s.icon}</div>
                    <div style={{ fontWeight:800, fontSize:22, color:s.color }}>{s.val}</div>
                    <div style={{ fontSize:11, color:s.color, opacity:0.8 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* ── Currently Consulting ── */}
              {currentToken ? (
                <div style={S.currentCard}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                      <div style={S.tokenBig}>#{currentToken.token}</div>
                      <div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)", marginBottom:2 }}>NOW CONSULTING</div>
                        <div style={{ fontSize:20, fontWeight:700, color:"#fff" }}>{currentToken.patient_name}</div>
                        <div style={{ display:"flex", gap:8, marginTop:4 }}>
                          <span style={{
                            fontSize:11, padding:"2px 10px", borderRadius:20, fontWeight:600,
                            background: currentToken.patient_type==="walkin" ? "#dcfce7" : "#dbeafe",
                            color:      currentToken.patient_type==="walkin" ? "#166534" : "#1d4ed8",
                          }}>
                            {currentToken.patient_type==="walkin" ? "🚶 Walk-in" : "🌐 Online"}
                          </span>
                          <span style={{ fontSize:11, padding:"2px 10px", borderRadius:20, background:"rgba(255,255,255,0.2)", color:"#fff", fontWeight:600 }}>
                            {currentToken.session}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:10 }}>
                      <button onClick={handleNextToken} disabled={!!acting} style={S.nextBtnWhite}>
                        {acting==="next" ? "Calling..." : "⏭ Next Patient"}
                      </button>
                      <button onClick={() => handleSkip(currentToken.id, currentToken.token)}
                        disabled={!!acting} style={S.skipBtnWhite}>
                        Skip
                      </button>
                    </div>
                  </div>
                  {waitingTokens.length > 0 && (
                    <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid rgba(255,255,255,0.2)" }}>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.7)" }}>
                        Next up: <b style={{ color:"#fff" }}>#{waitingTokens[0]?.token} — {waitingTokens[0]?.patient_name}</b>
                        {" "}· {waitingTokens.length} patient{waitingTokens.length!==1?"s":""} waiting
                        · Est. wait: ~{waitingTokens.length * avgMin} min
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ ...S.currentCard, background:"linear-gradient(135deg,#475569,#334155)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", marginBottom:4 }}>NO PATIENT CONSULTING</div>
                      <div style={{ fontSize:16, color:"#fff" }}>
                        {waitingTokens.length > 0
                          ? `${waitingTokens.length} patient(s) waiting — press Next Token`
                          : "Queue is empty"}
                      </div>
                    </div>
                    {waitingTokens.length > 0 && (
                      <button onClick={handleNextToken} disabled={!!acting} style={S.nextBtnWhite}>
                        {acting==="next" ? "Calling..." : "⏭ Call Next"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Queue breakdown — walk-in + online split ── */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>

                {/* Walk-in Queue */}
                <div style={S.queueCard}>
                  <div style={S.queueHeader}>
                    <h4 style={{ margin:0, fontSize:14, color:"#0f4c75" }}>🚶 Walk-in Queue</h4>
                    <span style={{ ...S.countBadge, background:"#dcfce7", color:"#166534" }}>
                      {walkinTokens.filter(t=>t.status==="waiting").length} waiting
                    </span>
                  </div>
                  {walkinTokens.length === 0 ? (
                    <EmptyQueue text="No walk-in patients" />
                  ) : (
                    <div style={{ overflowX:"auto" }}>
                      <table style={S.table}>
                        <thead>
                          <tr style={{ background:"#f8fafc" }}>
                            {["Token","Patient","Status","Action"].map(h => (
                              <th key={h} style={S.th}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {walkinTokens.sort((a,b)=>a.token-b.token).map(t => (
                            <tr key={t.id} style={{
                              background: t.status==="consulting" ? "#ecfdf5"
                                        : t.status==="done"       ? "#f8fafc" : "#fff",
                            }}>
                              <td style={S.td}><b style={{ color:"#0f4c75" }}>#{t.token}</b></td>
                              <td style={S.td}>{t.patient_name}</td>
                              <td style={S.td}>
                                <span style={{
                                  fontSize:11, padding:"2px 8px", borderRadius:10, fontWeight:600,
                                  background: STATUS_BG[t.status]||"#f1f5f9",
                                  color:      STATUS_FG[t.status]||"#475569",
                                }}>{t.status}</span>
                              </td>
                              <td style={S.td}>
                                {t.status === "waiting" && (
                                  <button onClick={() => handleSkip(t.id, t.token)}
                                    disabled={!!acting}
                                    style={S.skipSmall}>
                                    {acting==="skip_"+t.id ? "..." : "Skip"}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Online Queue */}
                <div style={S.queueCard}>
                  <div style={S.queueHeader}>
                    <h4 style={{ margin:0, fontSize:14, color:"#0f4c75" }}>🌐 Online Queue</h4>
                    <span style={{ ...S.countBadge, background:"#dbeafe", color:"#1d4ed8" }}>
                      {onlineTokens.filter(t=>t.status==="waiting" && t.is_confirmed).length} confirmed
                    </span>
                  </div>
                  {onlineTokens.length === 0 ? (
                    <EmptyQueue text="No online patients" />
                  ) : (
                    <div style={{ overflowX:"auto" }}>
                      <table style={S.table}>
                        <thead>
                          <tr style={{ background:"#f8fafc" }}>
                            {["Token","Patient","Status","Confirmed","Action"].map(h => (
                              <th key={h} style={S.th}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {onlineTokens.sort((a,b)=>a.token-b.token).map(t => (
                            <tr key={t.id} style={{
                              background: t.status==="consulting" ? "#ecfdf5"
                                        : t.status==="done"       ? "#f8fafc"
                                        : !t.is_confirmed          ? "#fffbeb" : "#fff",
                            }}>
                              <td style={S.td}><b style={{ color:"#0f4c75" }}>#{t.token}</b></td>
                              <td style={S.td}>{t.patient_name}</td>
                              <td style={S.td}>
                                <span style={{
                                  fontSize:11, padding:"2px 8px", borderRadius:10, fontWeight:600,
                                  background: STATUS_BG[t.status]||"#f1f5f9",
                                  color:      STATUS_FG[t.status]||"#475569",
                                }}>{t.status}</span>
                              </td>
                              <td style={S.td}>
                                {t.is_confirmed
                                  ? <span style={{ color:"#10b981", fontWeight:700 }}>✅</span>
                                  : <span style={{ color:"#f59e0b", fontWeight:700 }}>⏳</span>}
                              </td>
                              <td style={S.td}>
                                {t.status === "waiting" && (
                                  <button onClick={() => handleSkip(t.id, t.token)}
                                    disabled={!!acting}
                                    style={S.skipSmall}>
                                    {acting==="skip_"+t.id ? "..." : "Skip"}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Full token list ── */}
              <div style={S.queueCard}>
                <div style={S.queueHeader}>
                  <h4 style={{ margin:0, fontSize:14, color:"#0f4c75" }}>📋 All Tokens — {session} session</h4>
                  <span style={{ ...S.countBadge, background:"#f1f5f9", color:"#475569" }}>
                    {sessTokens.length} total
                  </span>
                </div>
                {sessTokens.length === 0 ? (
                  <EmptyQueue text="No tokens booked for this session" />
                ) : (
                  <div style={{ overflowX:"auto" }}>
                    <table style={S.table}>
                      <thead>
                        <tr style={{ background:"#f8fafc" }}>
                          {["Token","Patient","Type","Status","Confirmed","Queue Time","Action"].map(h => (
                            <th key={h} style={S.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sessTokens.sort((a,b)=>a.token-b.token).map(t => (
                          <tr key={t.id} style={{
                            background: t.status==="consulting" ? "#ecfdf5"
                                      : t.status==="done"       ? "#f8fafc"
                                      : !t.is_confirmed          ? "#fffbeb" : "#fff",
                          }}>
                            <td style={S.td}><b style={{ color:"#0f4c75" }}>#{t.token}</b></td>
                            <td style={S.td}>{t.patient_name}</td>
                            <td style={S.td}>
                              <span style={{
                                fontSize:11, padding:"2px 8px", borderRadius:10, fontWeight:600,
                                background: t.patient_type==="walkin" ? "#dcfce7" : "#dbeafe",
                                color:      t.patient_type==="walkin" ? "#166534" : "#1d4ed8",
                              }}>
                                {t.patient_type==="walkin" ? "🚶 Walk-in" : "🌐 Online"}
                              </span>
                            </td>
                            <td style={S.td}>
                              <span style={{
                                fontSize:11, padding:"2px 8px", borderRadius:10, fontWeight:600,
                                background: STATUS_BG[t.status]||"#f1f5f9",
                                color:      STATUS_FG[t.status]||"#475569",
                              }}>{t.status}</span>
                            </td>
                            <td style={S.td}>
                              {t.is_confirmed
                                ? <span style={{ color:"#10b981", fontWeight:700 }}>✅ Yes</span>
                                : <span style={{ color:"#f59e0b", fontWeight:700 }}>⏳ No</span>}
                            </td>
                            <td style={S.td}>
                              {t.queue_insert_time
                                ? new Date(t.queue_insert_time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})
                                : "—"}
                            </td>
                            <td style={S.td}>
                              {t.status === "waiting" && (
                                <button onClick={() => handleSkip(t.id, t.token)}
                                  disabled={!!acting} style={S.skipSmall}>
                                  {acting==="skip_"+t.id ? "..." : "Skip"}
                                </button>
                              )}
                              {t.status === "consulting" && (
                                <button onClick={handleNextToken}
                                  disabled={!!acting} style={{ ...S.skipSmall, background:"#d1fae5", color:"#065f46" }}>
                                  {acting==="next" ? "..." : "✓ Done"}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── OPD Info ── */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
                <div style={S.infoCard}>
                  <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>Doctor</div>
                  <div style={{ fontWeight:700, color:"#0f4c75" }}>Dr. {dashboard.doctor}</div>
                </div>
                <div style={S.infoCard}>
                  <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>OPD Started</div>
                  <div style={{ fontWeight:700, color:"#0f4c75" }}>
                    {dashboard.started_at
                      ? new Date(dashboard.started_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})
                      : "—"}
                  </div>
                </div>
                <div style={S.infoCard}>
                  <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>Avg Consult Time</div>
                  <div style={{ fontWeight:700, color:"#0f4c75" }}>{avgMin} minutes</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── End OPD Confirm Modal ── */}
      {confirmEnd && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ fontSize:40, marginBottom:12, textAlign:"center" }}>⏹</div>
            <h3 style={{ textAlign:"center", color:"#0f4c75", margin:"0 0 8px" }}>End OPD Session?</h3>
            <p style={{ textAlign:"center", color:"#64748b", fontSize:14, margin:"0 0 24px" }}>
              This will close the OPD for {date}. Remaining patients will not be called.
            </p>
            <div style={{ display:"flex", gap:12 }}>
              <button onClick={handleEndOPD} style={{ ...S.endBtn, flex:1, padding:"12px", fontSize:15 }}>
                Yes, End OPD
              </button>
              <button onClick={() => setConfirmEnd(false)}
                style={{ flex:1, padding:"12px", border:"none", borderRadius:10, background:"#f1f5f9",
                  color:"#475569", fontWeight:600, fontSize:15, cursor:"pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

const Spinner = () => (
  <div style={{ textAlign:"center", padding:80 }}>
    <div style={{ width:40, height:40, borderRadius:"50%", border:"3px solid #e2e8f0",
      borderTopColor:"#0f4c75", animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }} />
    <p style={{ color:"#94a3b8" }}>Loading dashboard...</p>
  </div>
);

const Empty = ({ text }) => (
  <div style={{ textAlign:"center", padding:"80px 40px" }}>
    <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
    <h4 style={{ color:"#1e293b", margin:0 }}>{text}</h4>
  </div>
);

const EmptyQueue = ({ text }) => (
  <div style={{ textAlign:"center", padding:"24px", color:"#94a3b8", fontSize:13,
    background:"#f8fafc", borderRadius:8, border:"1px dashed #e2e8f0" }}>
    {text}
  </div>
);

const S = {
  page:         { minHeight:"100vh", background:"#f0f4f8", display:"flex", flexDirection:"column", gap:0 },
  topBar:       { background:"linear-gradient(90deg,#0f4c75,#1b6ca8)", padding:"16px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 },
  logoCircle:   { width:40, height:40, borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center" },
  topTitle:     { margin:0, fontSize:18, fontWeight:700, color:"#fff" },
  topSub:       { margin:0, fontSize:12, color:"rgba(255,255,255,0.65)" },
  filterBar:    { background:"#fff", padding:"14px 24px", display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:12, borderBottom:"1px solid #e2e8f0", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" },
  filterLabel:  { display:"block", fontSize:11, fontWeight:600, color:"#64748b", marginBottom:4 },
  input:        { border:"1.5px solid #e2e8f0", borderRadius:8, padding:"8px 12px", fontSize:13, background:"#fff", outline:"none" },
  sessBtn:      { border:"none", borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.15s" },
  content:      { padding:"20px 24px", display:"flex", flexDirection:"column", gap:16, maxWidth:1200, width:"100%", margin:"0 auto", boxSizing:"border-box" },
  statsRow:     { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:12 },
  statCard:     { borderRadius:12, padding:"14px", textAlign:"center", display:"flex", flexDirection:"column", gap:4, alignItems:"center" },
  currentCard:  { background:"linear-gradient(135deg,#0f4c75,#1b6ca8)", borderRadius:14, padding:"20px 24px", boxShadow:"0 4px 20px rgba(15,76,117,0.3)" },
  tokenBig:     { fontSize:36, fontWeight:800, color:"#fff", background:"rgba(255,255,255,0.2)", borderRadius:12, padding:"8px 16px", minWidth:80, textAlign:"center" },
  queueCard:    { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", overflow:"hidden", border:"1px solid #e2e8f0" },
  queueHeader:  { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 16px", borderBottom:"1px solid #e2e8f0" },
  countBadge:   { fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:600 },
  infoCard:     { background:"#fff", borderRadius:12, padding:"14px 18px", border:"1px solid #e2e8f0" },
  notStartedCard:{ background:"#fff", borderRadius:16, padding:"60px 40px", textAlign:"center", boxShadow:"0 2px 16px rgba(0,0,0,0.06)" },
  table:        { width:"100%", borderCollapse:"collapse", fontSize:13 },
  th:           { padding:"10px 12px", textAlign:"left", fontSize:11, color:"#94a3b8", fontWeight:600, borderBottom:"1px solid #e2e8f0", whiteSpace:"nowrap" },
  td:           { padding:"10px 12px", borderBottom:"1px solid #f1f5f9", verticalAlign:"middle" },
  startBtn:     { background:"#059669", color:"#fff", border:"none", borderRadius:10, padding:"10px 20px", fontWeight:700, fontSize:14, cursor:"pointer" },
  nextBtn:      { background:"#0f4c75", color:"#fff", border:"none", borderRadius:10, padding:"10px 20px", fontWeight:700, fontSize:14, cursor:"pointer" },
  endBtn:       { background:"#fef2f2", color:"#dc2626", border:"1.5px solid #fca5a5", borderRadius:10, padding:"10px 20px", fontWeight:700, fontSize:14, cursor:"pointer" },
  nextBtnWhite: { background:"#fff", color:"#0f4c75", border:"none", borderRadius:10, padding:"10px 20px", fontWeight:700, fontSize:14, cursor:"pointer" },
  skipBtnWhite: { background:"rgba(255,255,255,0.2)", color:"#fff", border:"1px solid rgba(255,255,255,0.4)", borderRadius:10, padding:"10px 16px", fontWeight:600, fontSize:13, cursor:"pointer" },
  skipSmall:    { background:"#fee2e2", color:"#991b1b", border:"none", borderRadius:6, padding:"4px 10px", fontSize:12, fontWeight:600, cursor:"pointer" },
  iconBtn:      { border:"none", borderRadius:8, padding:"7px 14px", fontSize:13, fontWeight:600, cursor:"pointer" },
  overlay:      { position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 },
  modal:        { background:"#fff", borderRadius:16, padding:"32px", width:"100%", maxWidth:400, boxShadow:"0 20px 60px rgba(0,0,0,0.2)" },
};
