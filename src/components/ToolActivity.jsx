const TOOL_COLORS = {
  Read: 'text-blue',
  Write: 'text-green',
  Edit: 'text-amber',
  Bash: 'text-red',
  Glob: 'text-cyan',
  Grep: 'text-cyan',
  Task: 'text-accent',
  Agent: 'text-accent',
  WebFetch: 'text-amber',
  WebSearch: 'text-amber',
  TodoWrite: 'text-amber',
  ToolSearch: 'text-gray-300',
  AskUserQuestion: 'text-green',
  EnterPlanMode: 'text-accent',
  ExitPlanMode: 'text-accent',
  NotebookEdit: 'text-amber',
};

const TOOL_DESCRIPTIONS = {
  Read: 'Reads file contents from disk',
  Write: 'Creates or overwrites a file',
  Edit: 'Performs exact string replacements in files',
  Bash: 'Executes shell commands (git, npm, docker, etc.)',
  Glob: 'Searches for files by name/pattern',
  Grep: 'Searches file contents by regex',
  Task: 'Spawns a subagent to handle a complex subtask',
  Agent: 'Subagent performing work in parallel',
  WebFetch: 'Fetches and analyzes web page content',
  WebSearch: 'Searches the web for information',
  TodoWrite: 'Writes to the task/todo list',
  ToolSearch: 'Discovers and loads deferred MCP tools',
  AskUserQuestion: 'Asks the user a clarifying question',
  EnterPlanMode: 'Enters planning mode for complex tasks',
  ExitPlanMode: 'Exits planning mode with a plan for approval',
  NotebookEdit: 'Edits Jupyter notebook cells',
  TaskCreate: 'Creates a new task in the task list',
  TaskUpdate: 'Updates an existing task status',
  TaskList: 'Lists all tasks',
  Skill: 'Invokes a user-defined skill/command',
};

// Strip mcp__*__ prefixes → just the action name
function formatToolName(raw) {
  if (!raw) return '?';
  if (raw.startsWith('mcp__')) {
    const parts = raw.split('__');
    // mcp__server__tool_name → tool_name
    const action = parts.length >= 3 ? parts.slice(2).join('__') : parts[parts.length - 1];
    // Shorten common prefixes like "preview_screenshot" → "screenshot"
    return action.replace(/^preview_/, '');
  }
  return raw;
}

// Get color for tool — check native names first, then MCP action
function getToolColor(raw) {
  if (TOOL_COLORS[raw]) return TOOL_COLORS[raw];
  const name = formatToolName(raw);
  if (TOOL_COLORS[name]) return TOOL_COLORS[name];
  // MCP tools get a default color
  if (raw.startsWith('mcp__')) return 'text-gray-300';
  return 'text-gray-300';
}

// Extract parent/filename from full path
function shortenPath(fullPath) {
  if (!fullPath || typeof fullPath !== 'string') return fullPath;
  // Normalize separators
  const normalized = fullPath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (parts.length <= 2) return normalized;
  // Keep last 2 segments: "server/parser.js"
  return parts.slice(-2).join('/');
}

function getToolSummary(event) {
  const input = event.input;
  if (!input) return '';

  if (typeof input === 'string') {
    // Could be a file path or a command
    if (input.includes('/') || input.includes('\\')) return shortenPath(input);
    return input.slice(0, 80);
  }

  if (typeof input === 'object') {
    // Agent: show description
    if (input.description) return input.description;
    // Bash: show command
    if (input.command) return input.command.slice(0, 80);
    // File operations: show shortened path
    if (input.file_path) return shortenPath(input.file_path);
    // Search tools
    if (input.pattern) return input.pattern;
    if (input.query) return input.query.slice(0, 80);
    // Web
    if (input.url) return input.url.replace(/^https?:\/\//, '').slice(0, 60);
    // Fallback: try to find any string value
    const vals = Object.values(input);
    const first = vals.find(v => typeof v === 'string' && v.length > 0);
    if (first) return first.slice(0, 60);
    return '';
  }

  return '';
}

function formatTime(ts) {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

import { useState } from 'react';
import InfoIcon, { Legend } from './InfoIcon';

export default function ToolActivity({ events, expanded }) {
  const [showFailuresOnly, setShowFailuresOnly] = useState(false);
  const failureCount = events.filter(e => e.success === false || e.type === 'validation_block').length;
  const displayed = showFailuresOnly
    ? events.filter(e => e.success === false || e.type === 'validation_block')
    : events;

  return (
    <div className={`${expanded ? '' : 'bg-gray-900 border border-gray-800 rounded-lg'} px-4 py-2 h-full flex flex-col`}>
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 shrink-0 inline-flex items-center gap-1.5" title="Live feed of tool calls made by Claude — requires hooks (rh-telemetry setup or npm run setup-hooks)">
          Tools
          {failureCount > 0 && (
            <button
              onClick={() => setShowFailuresOnly(!showFailuresOnly)}
              className={`ml-1 px-1.5 py-0.5 text-[10px] rounded-full font-mono transition-colors ${
                showFailuresOnly ? 'bg-red/30 text-red' : 'bg-red/10 text-red/60 hover:bg-red/20'
              }`}
              title={showFailuresOnly ? 'Showing failures only — click to show all' : `${failureCount} failures — click to filter`}
            >
              {failureCount} fail
            </button>
          )}
          <InfoIcon>
            <div className="space-y-1.5">
              <p>Live feed of Claude's tool calls from PostToolUse hooks.</p>
              <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                <Legend color="bg-green" label="success" />
                <Legend color="bg-red" label="failure" />
                <Legend color="bg-amber" label="blocked" />
              </div>
              <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                <Legend color="bg-blue" label="Read" />
                <Legend color="bg-green" label="Write" />
                <Legend color="bg-amber" label="Edit/Web" />
                <Legend color="bg-red" label="Bash" />
                <Legend color="bg-cyan" label="Search" />
                <Legend color="bg-accent" label="Agent" />
              </div>
            </div>
          </InfoIcon>
        </h2>
      </div>

      {displayed.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">
            {showFailuresOnly ? 'No failures in this session' : (
              <>No tool events yet. Run{' '}
              <code className="text-accent">rh-telemetry setup</code>{' '}
              or <code className="text-accent">npm run setup-hooks</code>{' '}
              to enable.</>
            )}
          </p>
        </div>
      ) : (
        <div className={`flex-1 overflow-auto space-y-1 ${expanded ? 'max-h-[calc(100vh-320px)]' : 'max-h-64'}`}>
          {displayed.map((event) => {
            const toolName = formatToolName(event.tool);
            const color = getToolColor(event.tool);
            const failed = event.success === false;
            const isBlocked = event.type === 'validation_block';
            const toolTip = TOOL_DESCRIPTIONS[toolName] || TOOL_DESCRIPTIONS[event.tool] || toolName;

            return (
              <div
                key={event.id}
                className={`flex items-center gap-2 text-xs py-0.5 rounded hover:bg-gray-800/50 transition-colors whitespace-nowrap ${isBlocked ? 'bg-amber/10' : ''}`}
              >
                <span className="text-gray-500 font-mono shrink-0 text-[11px]" title="Time this tool call was made">
                  {formatTime(event.timestamp)}
                </span>
                <span
                  className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                    isBlocked ? 'bg-amber' : failed ? 'bg-red' : 'bg-green'
                  }`}
                  title={isBlocked ? 'Blocked by validation' : failed ? 'Tool call failed' : 'Tool call succeeded'}
                />
                <span className={`font-semibold shrink-0 ${color}`} title={toolTip}>
                  {toolName}
                </span>
                <span className={`${isBlocked ? 'text-amber' : failed ? 'text-red' : 'text-gray-500'}`}>
                  {isBlocked ? `Blocked: ${event.error || 'validation'}` : failed ? event.error || 'Failed' : getToolSummary(event)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}