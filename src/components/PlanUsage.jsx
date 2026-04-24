import InfoIcon, { Legend } from './InfoIcon';

/** Convert API credit values (cents) to dollars */
function creditsToDollars(cents) {
  if (cents == null) return null;
  return cents / 100;
}

export default function PlanUsage({ planInfo }) {
  if (!planInfo || planInfo.displayMode !== 'tokens') return null;

  const { usage, tierName, usageSource, usageTimestamp } = planInfo;

  const hasUsage = usage && (usage.fiveHour || usage.sevenDay || usage.sevenDaySonnet || usage.extraUsage);

  const anyAtLimit = usage && [
    usage.fiveHour?.utilization,
    usage.sevenDay?.utilization,
    usage.sevenDayOpus?.utilization,
    usage.sevenDaySonnet?.utilization,
  ].some(u => u != null && u >= 100);

  const anyApproaching = usage && [
    usage.fiveHour?.utilization,
    usage.sevenDay?.utilization,
    usage.sevenDayOpus?.utilization,
    usage.sevenDaySonnet?.utilization,
  ].some(u => u != null && u >= 80);

  const extra = usage?.extraUsage;
  const extraActive = extra?.is_enabled && anyAtLimit;
  const extraUsedDollars = creditsToDollars(extra?.used_credits);
  const extraLimitDollars = creditsToDollars(extra?.monthly_limit);
  const extraPct = extraLimitDollars && extraLimitDollars > 0 && extraUsedDollars != null
    ? Math.round((extraUsedDollars / extraLimitDollars) * 100)
    : null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2">
      <div className="flex items-center gap-5 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 inline-flex items-center gap-1.5" title={`Plan usage for ${tierName || 'Max'} — rolling windows reset automatically`}>
          Plan <InfoIcon>
            <div className="space-y-1.5">
              <p>{tierName || 'Max'} plan usage. 5hr = rolling message limit. 7-day = weekly cap. At 100% you're blocked until reset (or Extra Usage kicks in).</p>
              <p>When any gauge hits 100% and Extra Usage is enabled, subsequent API calls are metered at standard API rates until the window resets.</p>
              <div className="flex flex-wrap gap-x-1 gap-y-0.5"><Legend color="bg-green" label="low" /><Legend color="bg-amber" label="medium" /><Legend color="bg-red" label="high" /></div>
            </div>
          </InfoIcon>
          {tierName && <span className="text-[10px] text-accent font-mono ml-1">{tierName}</span>}
        </span>

        {hasUsage ? (
          <>
            {usage.fiveHour && (
              <UsageGauge
                label="5hr"
                utilization={usage.fiveHour.utilization}
                resetsAt={usage.fiveHour.resets_at}
                tooltip="Rolling 5-hour message window — resets continuously"
              />
            )}

            {usage.sevenDay && (
              <UsageGauge
                label="7day"
                utilization={usage.sevenDay.utilization}
                resetsAt={usage.sevenDay.resets_at}
                tooltip="Rolling 7-day overall usage limit"
              />
            )}

            {usage.sevenDaySonnet && (
              <UsageGauge
                label="Sonnet 7d"
                utilization={usage.sevenDaySonnet.utilization}
                resetsAt={usage.sevenDaySonnet.resets_at}
                tooltip="Separate 7-day limit for Sonnet models (independent of Opus limit)"
              />
            )}

            {extra && <ExtraUsageSection extra={extra} extraActive={extraActive} anyApproaching={anyApproaching} extraUsedDollars={extraUsedDollars} extraLimitDollars={extraLimitDollars} extraPct={extraPct} />}

            {usageSource === 'cached' && (
              <span className="text-[9px] text-amber/60 font-mono" title="Usage data may be stale — API rate limited, serving cached values">
                cached
              </span>
            )}
            {usageTimestamp && formatAge(usageTimestamp) && (
              <span className="text-[9px] text-gray-600 font-mono" title={`Last updated: ${new Date(usageTimestamp).toLocaleTimeString()}`}>
                {formatAge(usageTimestamp)}
              </span>
            )}
          </>
        ) : (
          <span className="text-[10px] text-gray-500 font-mono" title="Waiting for usage data from Anthropic API — may take a moment after server start">
            fetching usage…
          </span>
        )}
      </div>
    </div>
  );
}

function ExtraUsageSection({ extra, extraActive, anyApproaching, extraUsedDollars, extraLimitDollars, extraPct }) {
  if (!extra.is_enabled) {
    return (
      <div className="flex items-center gap-1.5" title="Extra Usage disabled — blocked when plan limits hit">
        <span className="text-[10px] uppercase text-gray-400">Extra</span>
        <span className="text-[11px] font-mono text-gray-500">OFF</span>
      </div>
    );
  }

  const barColor = extraPct != null
    ? (extraPct >= 90 ? 'bg-red' : extraPct >= 70 ? 'bg-amber' : 'bg-accent')
    : 'bg-accent';
  const textColor = extraActive ? 'text-amber' : anyApproaching ? 'text-amber/70' : 'text-gray-400';
  const statusLabel = extraActive ? 'ACTIVE' : 'ON';
  const statusClass = extraActive ? 'text-amber font-bold' : 'text-green';

  return (
    <div className="flex items-center gap-2">
      {/* Separator dot */}
      <span className="text-gray-700">·</span>

      {/* Status badge */}
      <div className="flex items-center gap-1.5" title={extraActive
        ? 'Extra Usage ACTIVE — plan limits reached, metered at API rates'
        : `Extra Usage enabled — kicks in when plan limits reached${extraLimitDollars ? `, monthly cap: $${extraLimitDollars.toFixed(0)}` : ''}`
      }>
        {extraActive && <span className="inline-block w-2 h-2 rounded-full bg-amber animate-pulse-dot" />}
        <span className="text-[10px] uppercase text-gray-400">Extra</span>
        <span className={`text-[11px] font-mono ${statusClass}`}>{statusLabel}</span>
      </div>

      {/* Dollar counter */}
      {extraUsedDollars != null && (
        <span className={`text-[11px] font-mono ${textColor}`} title={`Extra Usage spend this month: $${extraUsedDollars.toFixed(2)}`}>
          ${extraUsedDollars.toFixed(2)}
        </span>
      )}

      {/* Progress bar toward monthly limit */}
      {extraPct != null && extraLimitDollars != null && (
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden" title={`$${extraUsedDollars?.toFixed(2) || '0'} of $${extraLimitDollars.toFixed(0)} monthly cap (${Math.min(extraPct, 100)}%)`}>
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, extraPct)}%` }} />
          </div>
          <span className={`text-[10px] font-mono ${extraPct >= 90 ? 'text-red' : extraPct >= 70 ? 'text-amber' : 'text-gray-400'}`}>
            ${extraLimitDollars.toFixed(0)}
          </span>
        </div>
      )}
    </div>
  );
}

function UsageGauge({ label, utilization, resetsAt, tooltip }) {
  const pct = Math.round(utilization ?? 0);
  const color = pct >= 80 ? 'text-red' : pct >= 50 ? 'text-amber' : 'text-green';
  const barColor = pct >= 80 ? 'bg-red' : pct >= 50 ? 'bg-amber' : 'bg-green';
  const resetStr = resetsAt ? formatReset(resetsAt) : '';

  return (
    <div className="flex items-center gap-2" title={tooltip}>
      <span className="text-[10px] uppercase text-gray-400">{label}</span>
      <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden" title={`${pct}% of ${label} window used`}>
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-[11px] font-mono ${color}`}>{pct}%</span>
      {resetStr && <span className="text-[10px] text-gray-500" title={`Resets in ${resetStr}`}>{resetStr}</span>}
    </div>
  );
}

function formatReset(isoStr) {
  try {
    const resetDate = new Date(isoStr);
    const now = new Date();
    const diffMs = resetDate - now;
    if (diffMs <= 0) return 'resetting';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  } catch {
    return '';
  }
}

function formatAge(timestamp) {
  if (!timestamp) return '';
  const ago = Date.now() - timestamp;
  if (ago < 60000) return '';
  const mins = Math.floor(ago / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

/** Exported for use in SessionMetaStrip and other surfaces */
export { creditsToDollars };
