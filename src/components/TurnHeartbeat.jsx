import { useMemo } from 'react';
import InfoIcon, { Legend } from './InfoIcon';

const TOOL_COLORS = {
  Read: '#60a5fa',
  Write: '#fbbf24',
  Edit: '#fbbf24',
  Bash: '#34d399',
  Glob: '#34d399',
  Grep: '#34d399',
  Agent: '#8b5cf6',
  ToolSearch: '#6b7280',
};
const DEFAULT_COLOR = '#6b7280';

function getToolColor(tool) {
  if (!tool) return DEFAULT_COLOR;
  for (const [key, color] of Object.entries(TOOL_COLORS)) {
    if (tool.startsWith(key) || tool.includes(key)) return color;
  }
  return DEFAULT_COLOR;
}

function formatDuration(ms) {
  if (ms == null) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatScaleLabel(ms) {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `${totalSec}s`;
}

export default function TurnHeartbeat({ liveSession, toolEvents, sessionId }) {
  const events = liveSession?._currentTurnEvents || [];
  const turnStart = liveSession?._currentTurnStartTs;
  const isActive = liveSession && (events.length > 0 || turnStart);

  const filtered = useMemo(() => {
    if (!sessionId) return [];
    return (toolEvents || []).filter(e => e.session === sessionId && e.timestamp >= (turnStart || 0));
  }, [toolEvents, sessionId, turnStart]);

  const timelineEvents = useMemo(() => {
    if (events.length > 0) return events;
    return filtered.map(e => ({
      ts: e.timestamp,
      tool: e.tool,
      durationMs: e.durationMs,
      type: e.type,
      success: e.success,
    }));
  }, [events, filtered]);

  if (!isActive || timelineEvents.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Turn Timeline</span>
          <InfoIcon>
            <div className="space-y-1.5">
              <p>Live heartbeat of the current turn. Each block is a tool execution.</p>
              <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                <Legend color="bg-blue" label="Read" />
                <Legend color="bg-green" label="Bash/Glob/Grep" />
                <Legend color="bg-amber" label="Write/Edit" />
                <Legend color="bg-accent" label="Agent" />
              </div>
            </div>
          </InfoIcon>
        </div>
        <span className="text-[10px] text-gray-500 mt-1">Waiting for tool activity...</span>
      </div>
    );
  }

  const now = Date.now();
  const start = turnStart || timelineEvents[0].ts;
  const elapsed = now - start;
  const totalToolMs = timelineEvents.reduce((s, e) => s + (e.durationMs || 0), 0);
  const modelMs = Math.max(0, elapsed - totalToolMs);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Turn Timeline
        </span>
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          <span title="Elapsed time this turn">{formatDuration(elapsed)}</span>
          <span className="text-green" title="Total tool execution time">{formatDuration(totalToolMs)} tools</span>
          <span className="text-accent" title="Estimated model thinking time">{formatDuration(modelMs)} model</span>
          <span title="Tool calls this turn">{timelineEvents.length} calls</span>
          <InfoIcon>
            <div className="space-y-1.5">
              <p>Live heartbeat of the current turn. Each block is a tool execution, width proportional to duration.</p>
              <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                <Legend color="bg-blue" label="Read" />
                <Legend color="bg-green" label="Bash/Glob/Grep" />
                <Legend color="bg-amber" label="Write/Edit" />
                <Legend color="bg-accent" label="Agent" />
                <Legend color="bg-gray-800" label="Model thinking" />
              </div>
            </div>
          </InfoIcon>
        </div>
      </div>
      <TimelineStrip events={timelineEvents} startTs={start} nowTs={now} />
    </div>
  );
}

function buildScaleTicks(totalMs) {
  if (totalMs <= 0) return [];
  let interval;
  if (totalMs <= 30_000) interval = 5_000;
  else if (totalMs <= 60_000) interval = 10_000;
  else if (totalMs <= 180_000) interval = 30_000;
  else if (totalMs <= 600_000) interval = 60_000;
  else interval = 120_000;

  const ticks = [];
  for (let t = 0; t <= totalMs; t += interval) {
    ticks.push({ ms: t, pct: (t / totalMs) * 100 });
  }
  return ticks;
}

function TimelineStrip({ events, startTs, nowTs }) {
  const totalMs = Math.max(nowTs - startTs, 1);

  const blocks = useMemo(() => {
    const result = [];
    for (const e of events) {
      const toolEnd = e.ts;
      const toolStart = toolEnd - (e.durationMs || 0);
      const offsetPct = ((toolStart - startTs) / totalMs) * 100;
      const widthPct = ((e.durationMs || Math.max(totalMs * 0.005, 50)) / totalMs) * 100;
      result.push({
        left: Math.max(0, Math.min(offsetPct, 100)),
        width: Math.max(0.4, Math.min(widthPct, 100 - Math.max(0, offsetPct))),
        color: getToolColor(e.tool),
        tool: e.tool,
        durationMs: e.durationMs,
        ts: e.ts,
        success: e.success,
      });
    }
    return result;
  }, [events, startTs, totalMs]);

  const ticks = useMemo(() => buildScaleTicks(totalMs), [totalMs]);

  return (
    <div className="mt-1.5">
      {/* Timeline bar */}
      <div className="relative w-full rounded overflow-hidden bg-gray-950/50" style={{ height: '28px' }}>
        {blocks.map((b, i) => (
          <div
            key={i}
            className="absolute top-0 rounded-sm opacity-80 hover:opacity-100 transition-opacity"
            style={{
              left: `${b.left}%`,
              width: `${b.width}%`,
              height: '28px',
              backgroundColor: b.color,
              minWidth: '2px',
            }}
            title={`${b.tool}: ${b.durationMs ? formatDuration(b.durationMs) : 'no duration'} at ${new Date(b.ts).toISOString().slice(11, 19)}`}
          />
        ))}
        {/* Tick marks inside the bar */}
        {ticks.map((t, i) => (
          <div
            key={`tick-${i}`}
            className="absolute top-0 w-px bg-gray-700/40"
            style={{ left: `${t.pct}%`, height: '28px' }}
          />
        ))}
      </div>
      {/* Scale labels below */}
      <div className="relative w-full" style={{ height: '14px' }}>
        {ticks.map((t, i) => (
          <span
            key={`label-${i}`}
            className="absolute text-[9px] text-gray-500 font-mono"
            style={{ left: `${t.pct}%`, transform: i === 0 ? 'none' : 'translateX(-50%)' }}
          >
            {formatScaleLabel(t.ms)}
          </span>
        ))}
        <span
          className="absolute text-[9px] text-gray-400 font-mono"
          style={{ right: 0 }}
        >
          {formatScaleLabel(totalMs)}
        </span>
      </div>
    </div>
  );
}
