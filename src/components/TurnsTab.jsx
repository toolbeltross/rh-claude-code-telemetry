import { useState } from 'react';
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
  if (ms == null || ms === 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toISOString().slice(11, 19);
}

function formatCost(usd) {
  if (usd == null) return '$0.00';
  return `$${usd.toFixed(2)}`;
}

export default function TurnsTab({ liveSession }) {
  const [expandedTurn, setExpandedTurn] = useState(null);
  const history = liveSession?._turnHistory || [];
  const turns = history.filter(t => !t.compact);

  if (turns.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-gray-500">
        No turns recorded yet
      </div>
    );
  }

  const infoContent = (
    <div className="space-y-1.5">
      <p>Per-turn breakdown: wall-clock duration, tool execution time, model thinking time, and cost. Click a turn to see its full tool timeline.</p>
      <div className="flex flex-wrap gap-x-1 gap-y-0.5">
        <Legend color="bg-green" label="Tool time" />
        <Legend color="bg-accent" label="Model time" />
        <Legend color="bg-blue" label="Read" />
        <Legend color="bg-amber" label="Write/Edit" />
      </div>
    </div>
  );

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Turn History
        </span>
        <InfoIcon>{infoContent}</InfoIcon>
      </div>

      <div className="space-y-0.5">
        {/* Header */}
        <div className="grid grid-cols-12 gap-1 px-2 py-1 text-[10px] text-gray-500 uppercase tracking-wider">
          <div className="col-span-1">Turn</div>
          <div className="col-span-1">Time</div>
          <div className="col-span-2">Duration</div>
          <div className="col-span-2">Tool / Model</div>
          <div className="col-span-1">Tools</div>
          <div className="col-span-1">Cost</div>
          <div className="col-span-4">Timeline</div>
        </div>

        {/* Rows — newest first */}
        {[...turns].reverse().map((turn) => {
          const modelMs = Math.max(0, (turn.durationMs || 0) - (turn.toolTimeMs || 0));
          const isExpanded = expandedTurn === turn.turn;
          const toolPct = turn.durationMs > 0 ? Math.round((turn.toolTimeMs || 0) / turn.durationMs * 100) : 0;

          return (
            <div key={turn.turn}>
              <div
                className={`grid grid-cols-12 gap-1 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                  isExpanded ? 'bg-gray-800' : 'hover:bg-gray-800/50'
                }`}
                onClick={() => setExpandedTurn(isExpanded ? null : turn.turn)}
                title={`Click to ${isExpanded ? 'collapse' : 'expand'} turn ${turn.turn} timeline`}
              >
                <div className="col-span-1 font-mono text-gray-300">{turn.turn}</div>
                <div className="col-span-1 text-gray-400 font-mono">{formatTime(turn.startTs || turn.ts)}</div>
                <div className="col-span-2 text-gray-300">{formatDuration(turn.durationMs)}</div>
                <div className="col-span-2">
                  <span className="text-green">{formatDuration(turn.toolTimeMs)}</span>
                  <span className="text-gray-600 mx-0.5">/</span>
                  <span className="text-accent">{formatDuration(modelMs)}</span>
                </div>
                <div className="col-span-1 font-mono text-gray-400">{turn.toolCount || 0}</div>
                <div className="col-span-1 text-gray-300">{formatCost(turn.cost)}</div>
                <div className="col-span-4">
                  <MiniTimeline turn={turn} />
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && turn.events && (
                <TurnDetail turn={turn} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniTimeline({ turn }) {
  if (!turn.events || turn.events.length === 0 || !turn.durationMs) {
    return <div className="h-3 rounded bg-gray-950/50" />;
  }

  const startTs = turn.startTs || turn.events[0].ts;
  const totalMs = turn.durationMs || 1;

  return (
    <div className="relative h-3 rounded overflow-hidden bg-gray-950/50">
      {turn.events.map((e, i) => {
        const eventStart = e.ts - (e.durationMs || 0);
        const offsetPct = ((eventStart - startTs) / totalMs) * 100;
        const widthPct = ((e.durationMs || Math.max(totalMs * 0.005, 50)) / totalMs) * 100;
        return (
          <div
            key={i}
            className="absolute top-0 h-full rounded-sm opacity-70"
            style={{
              left: `${Math.max(0, Math.min(offsetPct, 100))}%`,
              width: `${Math.max(0.5, Math.min(widthPct, 100))}%`,
              backgroundColor: getToolColor(e.tool),
              minWidth: '1px',
            }}
            title={`${e.tool}: ${e.durationMs ? formatDuration(e.durationMs) : '?'}`}
          />
        );
      })}
    </div>
  );
}

function TurnDetail({ turn }) {
  const events = turn.events || [];
  if (events.length === 0) {
    return (
      <div className="px-4 py-2 text-[10px] text-gray-500 bg-gray-850">
        No tool events recorded for this turn
      </div>
    );
  }

  const startTs = turn.startTs || events[0].ts;

  return (
    <div className="bg-gray-800/30 border-l-2 border-accent/30 ml-2 mb-1 rounded-b">
      <div className="px-3 py-1.5 space-y-0">
        {events.map((e, i) => {
          const offsetSec = ((e.ts - startTs) / 1000).toFixed(1);
          const gap = i > 0 ? e.ts - (events[i - 1].durationMs || 0) - events[i - 1].ts : e.ts - startTs;

          return (
            <div key={i} className="flex items-center gap-2 text-[10px] py-0.5">
              <span className="text-gray-500 font-mono w-12 text-right" title="Seconds since turn start">
                +{offsetSec}s
              </span>
              {gap > 1000 && (
                <span className="text-accent/60 font-mono text-[9px]" title="Model thinking gap">
                  ↕{formatDuration(gap)}
                </span>
              )}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: getToolColor(e.tool) }}
              />
              <span className="text-gray-300 font-mono whitespace-nowrap">{e.tool}</span>
              {e.durationMs != null && (
                <span className="text-gray-500">{formatDuration(e.durationMs)}</span>
              )}
              {e.agentId && (
                <span className="px-1 py-0 rounded-full bg-accent/10 text-accent border border-accent/30 text-[9px]">
                  agent
                </span>
              )}
              {e.success === false && (
                <span className="px-1 py-0 rounded-full bg-red/10 text-red border border-red/40 text-[9px]">
                  fail
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
