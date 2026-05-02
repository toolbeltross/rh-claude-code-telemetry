import { useMemo, useState, useEffect } from 'react';
import InfoIcon from './InfoIcon';
import { getToolColor as getToolToken, IDENTITY, VIZ } from '../lib/style-tokens';

/**
 * Display-window sizing for the live heatmap. Returns a totalMs that:
 *   - is at least 60s (so very short turns don't render as a tiny strip)
 *   - always leaves ~30s of future runway ahead of the playhead so the
 *     cursor visibly moves through the strip instead of snapping back
 *     when the scale extends.
 *
 * Effective cursor position = elapsed / displayMs, asymptotic to 100%
 * but never reaching it — the strip extends gracefully as time passes.
 */
function getDisplayMs(elapsedMs) {
  return Math.max(60_000, elapsedMs + 30_000);
}

/**
 * Tick a `now` state at `intervalMs` while `isActive` so callers can
 * recompute elapsed-based positions on every tick. Cleans up the
 * interval on unmount or when isActive flips false.
 */
function useTickingNow(isActive, intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isActive) return undefined;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [isActive, intervalMs]);
  return now;
}

// Adapter: the existing layout code expects a hex string; the style-tokens
// helper returns a palette entry. Keep this thin so we don't carry tool/color
// knowledge in this file.
function getToolColor(tool) {
  return getToolToken(tool).hex;
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

function LegendRow({ color, label, tools }) {
  return (
    <div className="flex items-start gap-1.5 leading-tight">
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 mt-[3px] ${color}`} />
      <span><span className="text-gray-200 font-medium">{label}</span> <span className="text-gray-500">— {tools}</span></span>
    </div>
  );
}

export default function TurnHeartbeat({ liveSession, toolEvents, sessionId }) {
  const events = liveSession?._currentTurnEvents || [];
  const turnStart = liveSession?._currentTurnStartTs;
  const isActive = !!(liveSession && (events.length > 0 || turnStart));

  const now = useTickingNow(isActive, 250);

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
      agentId: e.agentId,
    }));
  }, [events, filtered]);

  const infoContent = (
    <div className="space-y-2">
      <p>
        Each cell is a time bucket colored by the dominant tool category.
        Brighter = more calls. Dark gaps = LLM thinking.
      </p>
      <div className="space-y-0.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Cell colors</div>
        <LegendRow color={IDENTITY.fileio.bg} label={IDENTITY.fileio.label} tools="Read, Write, Edit, NotebookEdit" />
        <LegendRow color={IDENTITY.runtime.bg} label={IDENTITY.runtime.label} tools="Bash, WebFetch, WebSearch" />
        <LegendRow color={IDENTITY.orchestration.bg} label={IDENTITY.orchestration.label} tools="Grep, Glob, Agent, Task, Skill, Plan" />
        <LegendRow color={IDENTITY.meta.bg} label={IDENTITY.meta.label} tools="ToolSearch, AskUserQuestion" />
        <LegendRow color="bg-gray-950 border border-gray-700" label="Dark / empty" tools="LLM thinking (no tool running)" />
        <LegendRow color={VIZ.activity.bg} label="Green line" tools="Live playhead (current time)" />
      </div>
      <p className="text-gray-500 text-[10px]">
        MCP tools (mcp__*) are mapped by action name. Unknown tools → Meta.
        Hover any cell for per-bucket details.
      </p>
    </div>
  );

  if (!isActive || timelineEvents.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Turn Heartbeat</span>
          <InfoIcon>{infoContent}</InfoIcon>
        </div>
        <span className="text-[10px] text-gray-500 mt-1">Waiting for tool activity...</span>
      </div>
    );
  }

  const start = turnStart || timelineEvents[0].ts;
  const elapsed = Math.max(now - start, 1);
  const displayMs = getDisplayMs(elapsed);
  const totalToolMs = timelineEvents.reduce((s, e) => s + (e.durationMs || 0), 0);
  const modelMs = Math.max(0, elapsed - totalToolMs);
  const ticks = buildScaleTicks(displayMs);
  const lastTool = timelineEvents[timelineEvents.length - 1]?.tool;
  const lastColor = getToolColor(lastTool);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Turn Heartbeat
          </span>
          {lastTool && (
            <span className="inline-flex items-center gap-1 text-[10px] text-gray-500" title={`Last tool: ${lastTool}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lastColor }} />
              <span className="font-mono">{lastTool}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          <span title="Elapsed time this turn">{formatDuration(elapsed)}</span>
          <span className="text-green" title="Total tool execution time">{formatDuration(totalToolMs)} tools</span>
          <span className="text-accent" title="Estimated model thinking time">{formatDuration(modelMs)} model</span>
          <span title="Tool calls this turn">{timelineEvents.length} calls</span>
          <InfoIcon>{infoContent}</InfoIcon>
        </div>
      </div>
      <HeatmapStrip
        events={timelineEvents}
        startTs={start}
        totalMs={displayMs}
        elapsedMs={elapsed}
        ticks={ticks}
      />
      <ScaleLabels ticks={ticks} totalMs={displayMs} />
    </div>
  );
}

function HeatmapStrip({ events, startTs, totalMs, elapsedMs, ticks }) {
  const HEIGHT = 28;
  const playheadPct = elapsedMs != null
    ? Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100))
    : null;

  const segments = useMemo(() => {
    if (events.length === 0) return [];

    const intervals = events
      .map(e => ({
        startMs: (e.ts - (e.durationMs || 0)) - startTs,
        endMs: e.ts - startTs,
        tool: e.tool,
        durationMs: e.durationMs || 0,
      }))
      .sort((a, b) => a.startMs - b.startMs);

    const segs = [];
    let cursor = 0;

    for (const iv of intervals) {
      const toolStart = Math.max(0, iv.startMs);
      if (toolStart > cursor) {
        segs.push({ type: 'gap', startMs: cursor, endMs: toolStart, durationMs: toolStart - cursor });
      }
      segs.push({ type: 'tool', startMs: toolStart, endMs: Math.max(toolStart + 1, iv.endMs), tool: iv.tool, durationMs: iv.durationMs });
      cursor = Math.max(cursor, iv.endMs);
    }

    const displayEnd = Math.max(elapsedMs || 0, totalMs);
    if (cursor < displayEnd) {
      segs.push({ type: 'gap', startMs: cursor, endMs: displayEnd, durationMs: displayEnd - cursor });
    }

    return segs;
  }, [events, startTs, totalMs, elapsedMs]);

  return (
    <div className="mt-1.5">
      <div className="relative w-full bg-gray-950/40 rounded-sm overflow-hidden" style={{ height: `${HEIGHT}px` }}>
        {/* Segments — width proportional to duration */}
        <div className="flex w-full h-full">
          {segments.map((seg, i) => {
            const widthPct = ((seg.endMs - seg.startMs) / totalMs) * 100;
            if (seg.type === 'gap') {
              const startSec = (seg.startMs / 1000).toFixed(0);
              const endSec = (seg.endMs / 1000).toFixed(0);
              return (
                <div
                  key={i}
                  className="h-full transition-opacity hover:opacity-80"
                  style={{ width: `${widthPct}%`, backgroundColor: 'rgba(30, 30, 40, 0.5)', minWidth: widthPct > 0.3 ? '1px' : '0' }}
                  title={`${startSec}–${endSec}s: model thinking (${formatDuration(seg.durationMs)})`}
                />
              );
            }
            const catColor = getToolToken(seg.tool);
            const startSec = (seg.startMs / 1000).toFixed(1);
            const endSec = (seg.endMs / 1000).toFixed(1);
            return (
              <div
                key={i}
                className="h-full transition-opacity hover:opacity-80"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: `${catColor.hex}cc`,
                  minWidth: '2px',
                }}
                title={`${startSec}–${endSec}s: ${seg.tool} (${formatDuration(seg.durationMs)})`}
              />
            );
          })}
        </div>
        {/* Tick overlay */}
        {ticks.slice(1).map((t, i) => (
          <div
            key={`tick-${i}`}
            className="absolute top-0 w-px bg-gray-700/40 pointer-events-none"
            style={{ left: `${t.pct}%`, height: `${HEIGHT}px` }}
          />
        ))}
        {/* Playhead — vertical cursor tracking elapsed time. Smooth-transitioned
            on left% so the 250ms tick rate doesn't show as visible jumps. */}
        {playheadPct != null && (
          <>
            <div
              className="absolute top-0 pointer-events-none"
              style={{
                left: `${playheadPct}%`,
                height: `${HEIGHT}px`,
                width: '2px',
                marginLeft: '-1px',
                background: `linear-gradient(to bottom, ${VIZ.activity.rgba(0.95)}, ${VIZ.activity.rgba(0.55)})`,
                boxShadow: `0 0 6px ${VIZ.activity.rgba(0.65)}`,
                transition: 'left 240ms linear',
                zIndex: 2,
              }}
              title={`Now · t = ${Math.round((elapsedMs ?? 0) / 1000)}s`}
            />
            <div
              className="absolute pointer-events-none animate-pulse-dot"
              style={{
                left: `${playheadPct}%`,
                top: '-2px',
                width: '6px',
                height: '6px',
                marginLeft: '-3px',
                background: VIZ.activity.hex,
                borderRadius: '50%',
                boxShadow: `0 0 4px ${VIZ.activity.rgba(0.9)}`,
                transition: 'left 240ms linear',
                zIndex: 3,
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ScaleLabels({ ticks, totalMs }) {
  return (
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
  );
}
