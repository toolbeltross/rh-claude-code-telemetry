/**
 * Single source of truth for color and typography tokens used across components.
 *
 * The whole design rationale lives in this file. Do not scatter inline color
 * choices in components — import from here so future changes propagate.
 *
 * =============================================================================
 * COLOR PALETTES
 * =============================================================================
 * Two distinct palettes coexist, and the rule for separating them is
 * non-negotiable.
 *
 * STATUS PALETTE — communicates STATE, never identity.
 *   green:  success, processing, low-utilization (good)
 *   red:    failure, blocked, high-utilization (bad)
 *   amber:  warning, medium-utilization, stalled
 *   blue:   idle (specifically the session activity dot, "turn ended")
 *
 *   Status colors must NEVER be applied as identity for tools, agents, models,
 *   or any other category. A red Bash tool in a list reads as "Bash failed"
 *   to anyone glancing at the dashboard. That's the bug class this rule
 *   exists to prevent.
 *
 * IDENTITY PALETTE — distinguishes CATEGORIES.
 *   blue:     data / file I/O / analysis
 *   cyan:     runtime / shell / network / exploration
 *   accent:   orchestration / oversight / planning / search
 *   gray-300: meta / utility / undefined
 *
 * Models (Opus/Sonnet/Haiku) have a third dedicated palette in
 * `model-colors.js` — also identity-only, kept separate so model identity
 * stays distinguishable from tool / agent identity at a glance.
 *
 * Underlying hex values are defined in `src/index.css` as Tailwind theme
 * tokens (`--color-blue`, `--color-cyan`, `--color-accent`, etc.). Keep this
 * file aligned with that theme.
 */

// ─── Status palette ─────────────────────────────────────────────────────────
// RESERVED for state. Do not use these for identity.
export const STATUS = {
  success: { text: 'text-green', bg: 'bg-green', border: 'border-green', hex: '#34d399' },
  failure: { text: 'text-red',   bg: 'bg-red',   border: 'border-red',   hex: '#f87171' },
  warning: { text: 'text-amber', bg: 'bg-amber', border: 'border-amber', hex: '#fbbf24' },
  idle:    { text: 'text-blue',  bg: 'bg-blue',  border: 'border-blue',  hex: '#60a5fa' },
  neutral: { text: 'text-gray-400', bg: 'bg-gray-700', border: 'border-gray-700', hex: '#8888a0' },
};

// ─── Identity palette ───────────────────────────────────────────────────────
// Used to distinguish CATEGORIES (tools, agents, etc.). Each entry includes
// a human-readable label for use in legends.
export const IDENTITY = {
  fileio:        { text: 'text-blue',     bg: 'bg-blue',     hex: '#60a5fa', label: 'File I/O' },
  runtime:       { text: 'text-cyan',     bg: 'bg-cyan',     hex: '#22d3ee', label: 'Shell/Network' },
  orchestration: { text: 'text-accent',   bg: 'bg-accent',   hex: '#8b5cf6', label: 'Orchestration' },
  meta:          { text: 'text-gray-300', bg: 'bg-gray-300', hex: '#aaaabb', label: 'Meta' },
};

// ─── Tool → category map ────────────────────────────────────────────────────
// Source: recovered from canonical's pre-merge working tree as a STARTING
// POINT. Categorization is open to revision; the rule (no status colors) is
// not. MCP-server-prefixed tools (mcp__server__name) resolve via prefix-strip.
const TOOL_CATEGORY = {
  // File I/O
  Read:            'fileio',
  Write:           'fileio',
  Edit:            'fileio',
  NotebookEdit:    'fileio',
  // Shell / network
  Bash:            'runtime',
  WebFetch:        'runtime',
  WebSearch:       'runtime',
  // Search & orchestration
  Glob:            'orchestration',
  Grep:            'orchestration',
  Task:            'orchestration',
  Agent:           'orchestration',
  TodoWrite:       'orchestration',
  TaskCreate:      'orchestration',
  TaskUpdate:      'orchestration',
  TaskList:        'orchestration',
  EnterPlanMode:   'orchestration',
  ExitPlanMode:    'orchestration',
  Skill:           'orchestration',
  // Meta
  ToolSearch:      'meta',
  AskUserQuestion: 'meta',
};

// Strip `mcp__<server>__` prefix to the bare action name so MCP-prefixed
// tool names resolve through the same category map.
export function stripMcpPrefix(raw) {
  if (!raw) return raw;
  const m = String(raw).match(/^mcp__[^_]+__(.+)$/);
  return m ? m[1] : raw;
}

/**
 * Resolve a tool name (raw, possibly MCP-prefixed) to an IDENTITY palette
 * entry. Unknown tools resolve to IDENTITY.meta.
 */
export function getToolColor(toolName) {
  if (!toolName) return IDENTITY.meta;
  const name = stripMcpPrefix(toolName);
  return IDENTITY[TOOL_CATEGORY[name]] || IDENTITY.meta;
}

/** Resolve a tool name to its category key string ('fileio'|'runtime'|...). */
export function getToolCategory(toolName) {
  if (!toolName) return 'meta';
  return TOOL_CATEGORY[stripMcpPrefix(toolName)] || 'meta';
}

// ─── Agent type → category map ──────────────────────────────────────────────
// Agents are categorized by ROLE, distinct from tool categorization. Source:
// recovered from canonical's pre-merge working tree as a starting point.
const AGENT_CATEGORY = {
  Explore:                 'runtime',
  Plan:                    'orchestration',
  Bash:                    'runtime',
  'general-purpose':       'fileio',
  'statusline-setup':      'meta',
  'claude-code-guide':     'fileio',
  'research-analyst':      'runtime',
  'security-specialist':   'orchestration',
  'performance-analyst':   'runtime',
  'compatibility-analyst': 'fileio',
  'pdf-extractor':         'fileio',
  'excel-writer':          'fileio',
  facilitator:             'orchestration',
  supervisor:              'orchestration',
};

/** Resolve an agent type to an IDENTITY palette entry. */
export function getAgentTypeColor(agentType) {
  if (!agentType) return IDENTITY.meta;
  return IDENTITY[AGENT_CATEGORY[agentType]] || IDENTITY.meta;
}

// ─── Tool descriptions ──────────────────────────────────────────────────────
// Used in tooltips and the Tools panel. Each is prefixed with its category
// label so the prefix doubles as a quick-reference legend.
export const TOOL_DESCRIPTIONS = {
  Read:            'File I/O · Reads file contents from disk',
  Write:           'File I/O · Creates or overwrites a file',
  Edit:            'File I/O · Performs exact string replacements in files',
  NotebookEdit:    'File I/O · Edits Jupyter notebook cells',
  Bash:            'Shell · Executes shell commands (git, npm, docker, etc.)',
  WebFetch:        'Network · Fetches and analyzes web page content',
  WebSearch:       'Network · Searches the web for information',
  Glob:            'Search · Finds files by name/pattern',
  Grep:            'Search · Finds file contents by regex',
  Task:            'Orchestration · Spawns a subagent for a complex subtask',
  Agent:           'Orchestration · Subagent performing work in parallel',
  TodoWrite:       'Orchestration · Writes to the task/todo list',
  TaskCreate:      'Orchestration · Creates a new task in the task list',
  TaskUpdate:      'Orchestration · Updates an existing task status',
  TaskList:        'Orchestration · Lists all tasks',
  EnterPlanMode:   'Orchestration · Enters planning mode for complex tasks',
  ExitPlanMode:    'Orchestration · Exits planning mode with a plan',
  Skill:           'Orchestration · Invokes a user-defined skill/command',
  ToolSearch:      'Meta · Discovers and loads deferred MCP tools',
  AskUserQuestion: 'Meta · Asks the user a clarifying question',
};

// =============================================================================
// TYPOGRAPHY
// =============================================================================
// Component-internal text sizes. These tokens are not abstractions over Tailwind
// — they're named pointers to specific Tailwind utility classes so a future
// "scale up the dashboard" effort can ripple through one file.
//
// Use semantic tokens; don't sprinkle bespoke `text-[Npx]` classes in components.

export const FONT = {
  body:    'text-xs',                                          // 12px — default panel content, table rows
  label:   'text-[11px]',                                      // 11px — meta strip values, secondary stats
  meta:    'text-[10px]',                                      // 10px — small uppercase labels
  micro:   'text-[9px]',                                       // 9px  — timeline ticks, badge text
  heading: 'text-xs font-semibold uppercase tracking-wider',   // panel titles
  display: 'text-base font-bold font-mono leading-tight',      // header stats (numbers)
};
