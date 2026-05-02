import { useMemo, useState, useEffect } from 'react';
import InfoIcon, { Legend } from './InfoIcon';
import { getToolColor as getToolToken, IDENTITY, FONT } from '../lib/style-tokens';

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
    <div className="space-y-1.5">
      <p>
        Heatmap density of the in-flight turn. Each cell is a time bucket;
        cyan intensity = how many tool calls fired in that bucket.
      </p>
      <p>
        The pulsing vertical line is the live playhead, sweeping right as
        the turn elapses. The strip's right edge stays ~30s ahead of "now"
        so the playhead always has runway.
      </p>
      <p>Open the Turns tab and expand a row to see the per-call lollipop view.</p>
      <div className="flex flex-wrap gap-x-1 gap-y-0.5">
        <Legend color={IDENTITY.runtime.bg} label="tool activity" />
      </div>
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

  const buckets = useMemo(() => {
    let bucketMs;
    if (totalMs <= 30_000) bucketMs = 1_000;
    else if (totalMs <= 60_000) bucketMs = 2_000;
    else if (totalMs <= 180_000) bucketMs = 5_000;
    else if (totalMs <= 600_000) bucketMs = 15_000;
    else bucketMs = 30_000;

    const numBuckets = Math.max(1, Math.ceil(totalMs / bucketMs));
    const arr = Array.from({ length: numBuckets }, (_, i) => ({
      startSec: (i * bucketMs) / 1000,
      endSec: Math.min(((i + 1) * bucketMs) / 1000, totalMs / 1000),
      count: 0,
      totalMs: 0,
      tools: {},
    }));
    for (const e of events) {
      const eventStart = e.ts - (e.durationMs || 0);
      const offset = eventStart - startTs;
      const idx = Math.min(numBuckets - 1, Math.max(0, Math.floor(offset / bucketMs)));
      arr[idx].count += 1;
      arr[idx].totalMs += e.durationMs || 0;
      arr[idx].tools[e.tool] = (arr[idx].tools[e.tool] || 0) + 1;
    }
    return arr;
  }, [events, startTs, totalMs]);

  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  return (
    <div className="mt-1.5">
      <div className="relative w-full bg-gray-950/40 rounded-sm overflow-hidden" style={{ height: `${HEIGHT}px` }}>
        {/* Cells */}
        <div className="flex w-full gap-px h-full">
          {buckets.map((b, i) => {
            const intensity = b.count === 0 ? 0.04 : 0.18 + (b.count / maxCount) * 0.82;
            const toolList = Object.entries(b.tools).map(([t, n]) => `${t}×${n}`).join(', ');
            const tip = b.count === 0
              ? `${b.startSec.toFixed(0)}–${b.endSec.toFixed(0)}s: idle`
              : `${b.startSec.toFixed(0)}–${b.endSec.toFixed(0)}s: ${b.count} call${b.count === 1 ? '' : 's'} (${toolList}), ${formatDuration(b.totalMs)} total`;
            return (
              <div
                key={i}
                className="flex-1 transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: `rgba(34, 211, 238, ${intensity})`,
                  minWidth: '2px',
                }}
                title={tip}
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
                background: 'linear-gradient(to bottom, rgba(34,211,238,0.95), rgba(34,211,238,0.55))',
                boxShadow: '0 0 6px rgba(34,211,238,0.65)',
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
                background: '#22d3ee',
                borderRadius: '50%',
                boxShadow: '0 0 4px rgba(34,211,238,0.9)',
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
