import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDashboardData } from './hooks/useDashboardData';
import { usePictureInPicture } from './hooks/usePictureInPicture';
import OverviewTab from './components/OverviewTab';
import SessionTab from './components/SessionTab';
import SessionList from './components/SessionList';
import SessionMetaStrip from './components/SessionMetaStrip';
import MicroDashboard from './components/MicroDashboard';
import { StatusLineModal } from './components/StatusLineBanner';
import { MODEL_COLORS } from './lib/model-colors';

const MICRO_THRESHOLD = 480;

const isPopout = new URLSearchParams(window.location.search).has('popout');

function TabButton({ active, onClick, dimmed, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-t text-xs font-medium transition-colors ${
        active
          ? 'bg-gray-900 text-gray-100 border border-gray-800 border-b-gray-900'
          : dimmed
            ? 'bg-gray-950 text-gray-600 border border-transparent hover:text-gray-500 opacity-60'
            : 'bg-gray-950 text-gray-400 border border-transparent hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

/** Format relative time like "2m ago", "3h ago", "5d ago" */
function relativeTime(ms) {
  if (!ms) return '';
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ToolBeltIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 61 61" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M30.1388 0C13.4942 0 0 13.6158 0 30.4105C0 42.6353 7.15297 53.1696 17.4644 57.9988L22.789 32.7784C22.9135 32.0486 23.1707 30.824 23.3636 29.9036C23.7132 28.2533 22.2666 27.041 20.8481 27.0491L15.9254 27.1464C15.0815 27.1464 14.0407 28.0384 13.5183 28.6385C12.8552 29.4008 11.9551 29.8996 10.9504 29.9077C8.901 29.9239 7.88432 29.9117 7.88432 29.9117C9.15013 23.5782 17.7417 18.2706 25.7024 18.2138L36.685 18.1652C36.9623 18.1652 37.2355 18.3274 37.3079 18.599C37.6936 20.0912 39.4417 20.4156 42.7652 20.4075L45.61 20.3345L45.8672 19.0734C45.9957 18.449 46.5423 17.9989 47.1735 17.9989H51.067C51.9111 17.9989 52.5459 18.7815 52.3774 19.6127L50.581 28.5534C50.4564 29.1819 49.9058 29.632 49.271 29.632H45.3448C44.4972 29.632 43.866 28.8494 44.0389 28.0141L44.2477 26.9923L40.6153 27.0572C35.6161 27.2113 34.6315 30.0253 34.077 32.7744L28.2502 60.756C28.877 60.7967 29.5079 60.8211 30.1429 60.8211C46.7873 60.8211 60.2818 47.2051 60.2818 30.4105C60.2778 13.6158 46.7833 0 30.1388 0Z" fill="#FCCD0A"/>
    </svg>
  );
}

function LogoModal({ onClose }) {
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl p-8 shadow-2xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors" title="Close">
          <CloseIcon size={16} />
        </button>
        <div className="flex flex-col items-center gap-4">
          <img src="/toolbelt-logo.png" alt="ToolBelt" className="w-64 h-auto" />
          <p className="text-gray-400 text-xs text-center">Claude Code Telemetry Dashboard</p>
          <a href="https://www.toolbelt.work" target="_blank" rel="noopener noreferrer" className="text-accent text-xs hover:underline">www.toolbelt.work</a>
        </div>
      </div>
    </div>
  );
}

function RefreshIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 1v5h5" />
      <path d="M1 6A7 7 0 0 1 13.46 4.46" />
      <path d="M15 15v-5h-5" />
      <path d="M15 10A7 7 0 0 1 2.54 11.54" />
    </svg>
  );
}

function HelpDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <span className="relative inline-flex" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Help — setup guide & dashboard info"
        className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold transition-colors ${
          open ? 'text-accent bg-accent/10' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
        }`}
      >?</button>
      {open && (
        <div className="absolute right-0 top-9 bg-gray-900 border border-gray-700 rounded-lg p-4 text-xs text-gray-300 w-80 z-50 whitespace-normal leading-relaxed shadow-xl space-y-3 max-h-[calc(100vh-80px)] overflow-y-auto">
          <div>
            <h3 className="text-gray-100 font-semibold text-sm mb-1">Quick Start</h3>
            <p>Install globally and set up hooks to enable live telemetry:</p>
            <code className="block mt-1 bg-gray-950 rounded px-2 py-1.5 text-accent font-mono text-[11px]">npm install -g rh-claude-code-telemetry<br/>rh-telemetry setup<br/>rh-telemetry start</code>
          </div>
          <div>
            <h3 className="text-gray-100 font-semibold text-sm mb-1">How It Works</h3>
            <p><span className="text-green">●</span> <strong>Green dot</strong> = session is processing (tools firing)</p>
            <p><span className="text-blue">●</span> <strong>Blue dot</strong> = session is idle (turn ended)</p>
            <p><span className="text-gray-500">●</span> <strong>Gray dot</strong> = file-based session (from .claude.json)</p>
          </div>
          <div>
            <h3 className="text-gray-100 font-semibold text-sm mb-1">Dashboard Sections</h3>
            <p><strong className="text-amber">Context</strong> — runway remaining, velocity, turns left</p>
            <p><strong className="text-cyan">Agents</strong> — active subagents, models, elapsed time</p>
            <p><strong className="text-blue">Tools</strong> — live feed of tool calls, successes/failures</p>
            <p><strong className="text-green">Turns</strong> — cost per turn, velocity, compaction events</p>
          </div>
          <div>
            <h3 className="text-gray-100 font-semibold text-sm mb-1">Tips</h3>
            <p>Click <strong>ⓘ</strong> icons on any section for detailed explanations and color legends.</p>
            <p>Use <strong>↻</strong> to clear stale sessions (not seen in 5 min).</p>
            <p>Click the <strong>↗</strong> icon for an always-on-top floating window.</p>
          </div>
        </div>
      )}
    </span>
  );
}

function PopOutIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2h5v5" />
      <path d="M14 2L8 8" />
      <path d="M12 9v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4" />
    </svg>
  );
}

function DockIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 14H2V9" />
      <path d="M2 14l6-6" />
      <path d="M4 7V3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-4" />
    </svg>
  );
}

function CloseIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l8 8" />
      <path d="M12 4l-8 8" />
    </svg>
  );
}

function CollapseIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 14H2V6" />
      <path d="M2 14L14 2" />
    </svg>
  );
}

export default function App() {
  const data = useDashboardData();
  const pip = usePictureInPicture();
  const session = data.currentSession;
  const stats = data.stats;
  const live = data.activeLiveSession;
  const isLive = !!live;
  const { sessionIds, liveSessions, sessionCostTrack, sessionActivity, selectSession } = data;

  const [activeTab, setActiveTab] = useState(null);
  const [fileSessions, setFileSessions] = useState({});
  const [showOverflow, setShowOverflow] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [statusLineModalOpen, setStatusLineModalOpen] = useState(false);
  const prevSessionIdsRef = useRef([]);
  const overflowRef = useRef(null);
  const sessionListRef = useRef(null);

  // Micro mode: compact HUD for PiP / narrow windows
  const [forceMicroPip, setForceMicroPip] = useState(false);
  const [pipJustOpened, setPipJustOpened] = useState(false);
  const [showPipMenu, setShowPipMenu] = useState(false);
  const pipMenuRef = useRef(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Auto-clear pipJustOpened after 3s (drives green pulse on collapse icon)
  useEffect(() => {
    if (!pipJustOpened) return;
    const t = setTimeout(() => setPipJustOpened(false), 3000);
    return () => clearTimeout(t);
  }, [pipJustOpened]);

  // Close PiP dropdown on click-outside
  useEffect(() => {
    if (!showPipMenu) return;
    function handleClick(e) {
      if (pipMenuRef.current && !pipMenuRef.current.contains(e.target)) setShowPipMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPipMenu]);

  useEffect(() => {
    function onResize() { setWindowWidth(window.innerWidth); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Also listen on PiP window resize when portaled
  useEffect(() => {
    if (!pip.pipWindow) return;
    function onResize() { setWindowWidth(pip.pipWindow.innerWidth); }
    setWindowWidth(pip.pipWindow.innerWidth);
    pip.pipWindow.addEventListener('resize', onResize);
    return () => pip.pipWindow?.removeEventListener('resize', onResize);
  }, [pip.pipWindow]);

  const isMicroMode = windowWidth < MICRO_THRESHOLD;

  // Set PiP window title to active project name
  useEffect(() => {
    if (!pip.pipWindow) return;
    const s = liveSessions[activeTab];
    const cwd = s?.workspace?.current_dir || '';
    const projName = cwd ? cwd.split(/[\\/]/).pop() : (fileSessions[activeTab]?.projectName || activeTab?.slice(0, 8) || 'Telemetry');
    pip.pipWindow.document.title = projName;
  }, [pip.pipWindow, activeTab, liveSessions, fileSessions]);

  function handlePipExpand() {
    pip.resize(900, 600);
    setForceMicroPip(false);
  }

  function handlePipCollapse() {
    pip.resize(380, 220);
    setForceMicroPip(true);
  }

  const IDLE_THRESHOLD = 60_000;
  function isSessionProcessing(id) {
    if (sessionActivity && sessionActivity[id]) {
      return sessionActivity[id] === 'processing';
    }
    const track = sessionCostTrack[id];
    return track && (Date.now() - track.lastChangeAt) < IDLE_THRESHOLD;
  }

  // Auto-populate file session tabs only for sessions with real data (cost > 0).
  // Guard: skip the state update when session IDs haven't actually changed —
  // data.sessions gets a new reference on every chokidar/update cycle even
  // when the underlying data is identical.
  const prevFileSessionIdsRef = useRef('');
  useEffect(() => {
    if (!data.sessions?.length) return;
    const ids = data.sessions.filter(s => s.cost > 0).map(s => s.sessionId);
    const key = ids.join(',');
    if (key === prevFileSessionIdsRef.current) return;
    prevFileSessionIdsRef.current = key;
    const map = {};
    for (const s of data.sessions) {
      if (s.cost > 0) map[s.sessionId] = s;
    }
    setFileSessions(prev => {
      const next = { ...prev };
      for (const [id, s] of Object.entries(map)) {
        next[id] = s;
      }
      return next;
    });
  }, [data.sessions]);

  const fileSessionIds = Object.keys(fileSessions)
    .filter(id => !sessionIds.includes(id));

  // Auto-select on initial load: live session > top file session > overview
  useEffect(() => {
    if (hasAutoSelected) return;
    if (!data.connected) return;
    if (sessionIds.length > 0) {
      setActiveTab(sessionIds[0]);
      selectSession(sessionIds[0]);
    } else if (data.sessions?.length > 0) {
      const topSession = data.sessions.find(s => s.cost > 0);
      setActiveTab(topSession ? topSession.sessionId : 'overview');
    } else {
      setActiveTab('overview');
    }
    setHasAutoSelected(true);
    prevSessionIdsRef.current = [...sessionIds];
  }, [hasAutoSelected, data.connected, sessionIds, data.sessions, selectSession]);

  // Auto-switch when a genuinely NEW live session appears
  useEffect(() => {
    const newIds = sessionIds.filter(id => !prevSessionIdsRef.current.includes(id));
    prevSessionIdsRef.current = [...sessionIds];
    if (newIds.length > 0) {
      setActiveTab(newIds[0]);
      selectSession(newIds[0]);
    }
  }, [sessionIds, selectSession]);

  // Reset to first live or overview if active session disappears
  useEffect(() => {
    if (activeTab && activeTab !== 'overview' && !sessionIds.includes(activeTab) && !fileSessions[activeTab]) {
      setActiveTab(sessionIds.length > 0 ? sessionIds[0] : 'overview');
    }
  }, [activeTab, sessionIds, fileSessions]);

  // Close overflow dropdown on outside click
  useEffect(() => {
    if (!showOverflow) return;
    function handleClick(e) {
      if (overflowRef.current && !overflowRef.current.contains(e.target)) {
        setShowOverflow(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showOverflow]);

  // Close session list dropdown on outside click
  useEffect(() => {
    if (!showSessionList) return;
    function handleClick(e) {
      if (sessionListRef.current && !sessionListRef.current.contains(e.target)) {
        setShowSessionList(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSessionList]);

  function handleSessionTab(id) {
    setActiveTab(id);
    selectSession(id);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch('/api/refresh', { method: 'POST' });
    } catch (e) {
      // API server might be down — ignore
    }
    setTimeout(() => setRefreshing(false), 600);
  }

  function handleFileSessionSelect(session) {
    setFileSessions(prev => ({ ...prev, [session.sessionId]: session }));
    setActiveTab(session.sessionId);
    setShowOverflow(false);
  }

  const activeLiveSession = liveSessions[activeTab] || null;

  const microContent = (
    <div className="bg-gray-950 p-1">
      <MicroDashboard
        liveSession={activeLiveSession}
        session={fileSessions[activeTab] || session}
        toolEvents={data.toolEvents}
        sessionActivity={sessionActivity}
        sessionId={activeTab}
        onExpand={undefined}
        displayMode={data.planInfo?.displayMode || 'cost'}
        windowWidth={windowWidth}
        sessionIds={sessionIds}
        liveSessions={liveSessions}
        onSessionChange={handleSessionTab}
      />
    </div>
  );

  const dashboardContent = (
    <div className="min-h-screen bg-gray-950 p-3">
      {/* Logo modal */}
      {logoModalOpen && <LogoModal onClose={() => setLogoModalOpen(false)} />}
      {/* StatusLine modal — opened from the health dot in icon strip */}
      {statusLineModalOpen && <StatusLineModal statusLineState={data.statusLineState} onClose={() => setStatusLineModalOpen(false)} />}

      {/* Header */}
      <header className="flex items-center justify-between mb-2 px-2">
        {/* Logo + model legend */}
        <div className="flex items-center gap-3">
          <button onClick={() => setLogoModalOpen(true)} title="Claude Code Telemetry — click for info" className="cursor-pointer hover:opacity-80 transition-opacity">
            <ToolBeltIcon size={24} />
          </button>
          {/* Model color legend — hidden below lg (1024px) to prevent collision
              with the right-side icon strip. On narrower windows the same
              color language is still present via ModelBreakdownMini and the
              per-session meta strip. */}
          <div className="hidden lg:flex items-center gap-2.5">
            {Object.entries(MODEL_COLORS).map(([name, mc]) => (
              <span key={name} className={`inline-flex items-center gap-1 text-[11px] ${mc.text}`} title={`${name} model`}>
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: mc.hex }} />
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* Grouped icon strip */}
        <div className="flex items-center border border-gray-700 rounded-lg px-0.5 py-0.5 gap-0">
          {/* LIVE indicator in group */}
          {isLive && (() => {
            const anyProcessing = sessionIds.some(id => isSessionProcessing(id));
            return (
              <>
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded"
                  title={anyProcessing
                    ? `${sessionIds.length} live session${sessionIds.length > 1 ? 's' : ''} — processing`
                    : `${sessionIds.length} live session${sessionIds.length > 1 ? 's' : ''} — idle`
                  }
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    anyProcessing ? 'bg-green animate-pulse-dot' : 'bg-blue'
                  }`} />
                  <span className={`text-[11px] font-bold ${anyProcessing ? 'text-green' : 'text-blue'}`}>
                    {sessionIds.length} LIVE
                  </span>
                </span>
                <span className="w-px h-4 bg-gray-800" />
              </>
            );
          })()}

          {/* StatusLine health dot — shows when degraded or stalled */}
          {(() => {
            const sl = data.statusLineState;
            if (!sl) return null;
            const healthy = (sl.class === 'telemetry' || sl.class === 'telemetry-wrapper') && !sl.stalled;
            if (healthy) return null;
            const isError = sl.stalled || sl.class === 'missing';
            return (
              <>
                <button
                  data-testid="statusline-banner-button"
                  data-stalled={sl.stalled ? 'true' : 'false'}
                  data-class={sl.class || ''}
                  onClick={() => setStatusLineModalOpen(true)}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${isError ? 'hover:bg-red/10' : 'hover:bg-amber/10'}`}
                  title={sl.stalled ? 'statusLine stalled — tool events flowing but no status posts for 2+ min. Click for details.' : `statusLine: ${sl.class} — click for details`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full animate-pulse-dot ${isError ? 'bg-red' : 'bg-amber'}`} />
                  <span className={`text-[10px] font-bold uppercase ${isError ? 'text-red' : 'text-amber'}`}>
                    {sl.stalled ? 'stalled' : 'statusLine'}
                  </span>
                </button>
                <span className="w-px h-4 bg-gray-800" />
              </>
            );
          })()}

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh — clear stale sessions not seen in the last 5 minutes"
            className={`inline-flex items-center justify-center w-7 h-7 rounded transition-colors ${
              refreshing
                ? 'text-green bg-green/10'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            <span className={refreshing ? 'animate-spin' : ''}>
              <RefreshIcon size={14} />
            </span>
          </button>

          <span className="w-px h-4 bg-gray-800" />

          {/* Help */}
          <HelpDropdown />

          <span className="w-px h-4 bg-gray-800" />

          {/* Pop Out / Dock / Close */}
          {pip.isOpen ? (
            <button
              onClick={pip.close}
              title="Dock back to browser"
              className="inline-flex items-center justify-center w-7 h-7 rounded text-accent hover:bg-accent/10 transition-colors"
            >
              <DockIcon />
            </button>
          ) : isPopout ? (
            <button
              onClick={() => window.close()}
              title="Close pop-out window"
              className="inline-flex items-center justify-center w-7 h-7 rounded text-red hover:bg-red/10 transition-colors"
            >
              <CloseIcon />
            </button>
          ) : (
            <div className="relative" ref={pipMenuRef}>
              <button
                onClick={() => setShowPipMenu(v => !v)}
                title="Pop out to floating window"
                className="inline-flex items-center justify-center w-7 h-7 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              >
                <PopOutIcon />
              </button>
              {showPipMenu && (
                <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[160px]">
                  <button
                    onClick={async () => {
                      setShowPipMenu(false);
                      setForceMicroPip(true);       // Start as micro — fits API-capped window
                      await pip.open({ width: 900, height: 600 });
                      setPipJustOpened(true);
                      // Expand to full dashboard after PiP window settles
                      setTimeout(() => {
                        pip.resize(900, 600);
                        setForceMicroPip(false);
                      }, 300);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-gray-100 transition-colors flex items-center gap-2"
                  >
                    <PopOutIcon size={12} />
                    Full Dashboard
                  </button>
                  <button
                    onClick={async () => {
                      setShowPipMenu(false);
                      await pip.open({ width: 380, height: 280 });
                      setForceMicroPip(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-gray-100 transition-colors flex items-center gap-2"
                  >
                    <CollapseIcon size={12} />
                    Micro HUD
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Tab Bar */}
      {(() => {
        const activeFileId = activeTab && activeTab !== 'overview' && !sessionIds.includes(activeTab)
          && fileSessions[activeTab] ? activeTab : null;
        const shownIds = new Set([...sessionIds, activeFileId].filter(Boolean));

        return (
          <div className="flex items-end gap-1 px-2 mb-0">
            {/* Live session tabs */}
            {sessionIds.map((id) => {
              const s = liveSessions[id];
              const model = s?.model?.display_name || '?';
              const cwd = s?.workspace?.current_dir || '';
              const projName = cwd ? cwd.split(/[\\/]/).pop() : id.slice(0, 8);
              const processing = isSessionProcessing(id);
              const slStalled = data.statusLineState?.stalled;
              const dotClass = slStalled
                ? 'bg-amber animate-pulse-dot'
                : processing ? 'bg-green animate-pulse-dot' : 'bg-blue';
              const dotTitle = slStalled
                ? 'statusLine stalled — tool events flowing but status posts stopped'
                : processing ? 'Processing' : 'Idle';
              return (
                <TabButton
                  key={id}
                  active={activeTab === id}
                  onClick={() => handleSessionTab(id)}
                >
                  <span className="inline-flex items-center gap-1.5 max-w-[160px]" title={projName}>
                    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotClass}`} title={dotTitle} />
                    <span className="truncate">{projName}</span>
                  </span>
                </TabButton>
              );
            })}

            {/* Active file tab if selected from overflow */}
            {activeFileId && (() => {
              const s = fileSessions[activeFileId];
              const label = `${s.projectName || activeFileId.slice(0, 8)} (${s.primaryModel})`;
              return (
                <TabButton
                  key={activeFileId}
                  active
                  onClick={() => setActiveTab(activeFileId)}
                >
                  <span className="inline-flex items-center gap-1.5 max-w-[180px]" title={label}>
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-500 shrink-0" />
                    <span className="truncate">{label}</span>
                  </span>
                </TabButton>
              );
            })()}

            {/* Overflow menu — Overview + all file sessions */}
            <div className="relative" ref={overflowRef}>
              <button
                onClick={() => setShowOverflow(v => !v)}
                title="More sessions & overview"
                className={`px-2.5 py-1.5 rounded-t text-xs font-medium transition-colors ${
                  showOverflow || activeTab === 'overview'
                    ? 'bg-gray-900 text-gray-100 border border-gray-800 border-b-gray-900'
                    : 'bg-gray-950 text-gray-500 border border-transparent hover:text-gray-400'
                }`}
              >
                ⋯
              </button>
              {showOverflow && (
                <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-50 min-w-[220px] py-1">
                  {/* Overview */}
                  <button
                    onClick={() => { setActiveTab('overview'); setShowOverflow(false); }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                      activeTab === 'overview' ? 'text-gray-100 bg-gray-800' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="1" width="4" height="4" rx="0.5" />
                      <rect x="7" y="1" width="4" height="4" rx="0.5" />
                      <rect x="1" y="7" width="4" height="4" rx="0.5" />
                      <rect x="7" y="7" width="4" height="4" rx="0.5" />
                    </svg>
                    Overview
                  </button>

                  {/* File sessions */}
                  {fileSessionIds.length > 0 && (
                    <div className="border-t border-gray-800 mt-1 pt-1">
                      {fileSessionIds.map((id) => {
                        const s = fileSessions[id];
                        const isStale = !s.cost || s.primaryModel === 'unknown';
                        const isShown = shownIds.has(id);
                        return (
                          <button
                            key={id}
                            onClick={() => { setActiveTab(id); setShowOverflow(false); }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                              activeTab === id ? 'text-gray-100 bg-gray-800' :
                              isStale ? 'text-gray-600 hover:text-gray-400 hover:bg-gray-800/50' :
                              'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                            }`}
                          >
                            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                              isStale ? 'bg-gray-700' : 'bg-gray-500'
                            }`} />
                            <span className="truncate">{s.projectName || id.slice(0, 8)} ({s.primaryModel})</span>
                            {isShown && <span className="text-[9px] text-gray-600 ml-auto">shown</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Session meta strip — fills the gap between tabs and session-count dropdown.
                Collapses items (lines → id → elapsed → cost) as width shrinks. */}
            <SessionMetaStrip
              sessionId={activeTab}
              liveSession={liveSessions[activeTab] || null}
              session={fileSessions[activeTab] || session}
              displayMode={data.planInfo?.displayMode || 'cost'}
              planInfo={data.planInfo}
            />

            {/* Session count dropdown — far right of tab bar. ml-auto kicks in
                when SessionMetaStrip is null (Overview tab). */}
            {stats && (
              <div className="relative ml-auto self-center" ref={sessionListRef}>
                <button
                  onClick={() => setShowSessionList(v => !v)}
                  className={`text-xs font-medium transition-colors cursor-pointer py-1 ${
                    showSessionList ? 'text-gray-200' : 'text-gray-500 hover:text-gray-300'
                  }`}
                  title="Click to browse all sessions"
                >
                  {stats.totalSessions} sessions
                  <span className="ml-1 text-[10px]">{showSessionList ? '\u25B2' : '\u25BC'}</span>
                </button>
                {showSessionList && (
                  <SessionList
                    sessions={data.sessions}
                    onSelect={(s) => {
                      handleFileSessionSelect(s);
                      setShowSessionList(false);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Tab Content */}
      <div className="mt-0">
        {activeTab === 'overview' ? (
          <OverviewTab stats={stats} sessions={data.sessions} onSelectSession={handleFileSessionSelect} displayMode={data.planInfo?.displayMode || 'cost'} failurePatterns={data.failurePatterns} />
        ) : (
          <SessionTab
            sessionId={activeTab}
            liveSession={liveSessions[activeTab] || null}
            session={fileSessions[activeTab] || session}
            toolEvents={data.toolEvents}
            failureEvents={data.failureEvents}
            failurePatterns={data.failurePatterns}
            failureAlerts={data.failureAlerts}
            planInfo={data.planInfo}
          />
        )}
      </div>

      {/* Status Bar */}
      <footer className="mt-2 px-2 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              data.connected ? 'bg-green animate-pulse-dot' : 'bg-amber animate-pulse-dot'
            }`}
          />
          <span>{data.connected ? 'Connected' : 'Reconnecting...'}</span>
        </div>
        {data.timestamp && (
          <span>
            Last update: {new Date(data.timestamp).toLocaleTimeString()}
          </span>
        )}
      </footer>
    </div>
  );

  // PiP active: portal content into the floating window, show placeholder in main
  if (pip.isOpen && pip.pipWindow) {
    const pipContent = forceMicroPip ? microContent : dashboardContent;
    return (
      <>
        {createPortal(pipContent, pip.pipWindow.document.body)}
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center space-y-4">
            <svg width="48" height="48" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto opacity-30 text-gray-400">
              <path d="M9 2h5v5" />
              <path d="M14 2L8 8" />
              <path d="M12 9v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4" />
            </svg>
            <p className="text-gray-500 text-sm">Dashboard is in floating mode</p>
            <button
              onClick={pip.close}
              className="px-4 py-2 rounded text-sm font-medium text-accent border border-accent/30 bg-accent/10 hover:bg-accent/20 transition-colors"
            >
              Bring Back
            </button>
          </div>
        </div>
      </>
    );
  }

  // Main window: auto-switch to micro at narrow widths
  if (isMicroMode) {
    return (
      <div className="bg-gray-950 p-1 min-h-screen">
        <MicroDashboard
          liveSession={activeLiveSession}
          session={fileSessions[activeTab] || session}
          toolEvents={data.toolEvents}
          sessionActivity={sessionActivity}
          sessionId={activeTab}
          displayMode={data.planInfo?.displayMode || 'cost'}
          windowWidth={windowWidth}
        />
      </div>
    );
  }

  return dashboardContent;
}