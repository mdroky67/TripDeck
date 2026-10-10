import { L, N, NF, tx, fmtTime, fmtMins } from '../i18n.js';
import { haversine, etaMins } from '../geo/distance.js';

export const TRANSPORT_ICON = {
  flight: '✈️', car: '🚗', train: '🚂', speedboat: '🚤', ferry: '⛴️', walk: '🚶', bus: '🚌',
};

/** One step of the chain */
function Node({ n, i, selected, onSelect, atStart }) {
  const acts = n.acts.filter((a) => a.title || a.title_en);
  return (
    <button class={`node ${n.state}${selected ? ' sel' : ''}`} type="button" onClick={() => onSelect(i)}>
      <span class="rail"><span class="dot" /><span class="wire" /></span>
      <span class="body">
        <span class="ttl">{n.icon ? n.icon + ' ' : ''}{tx(n, 'label')}</span>
        <span class="muted" style="display:block;font-size:11.5px">
          {L('দিন', 'Day')} {N(n.day)}
          {n.time ? ' · ' + fmtTime(n.time) : ''}
          {acts.length
            ? ` · ${N(acts.length)} ${acts.length === 1 ? L('টা কাজ', 'activity') : L('টা কাজ', 'activities')}`
            : ''}
          {n.state === 'now'
            ? ' · ' + (atStart ? L('এখান থেকে শুরু', 'start here') : L('এখন এখানে যাচ্ছি', 'heading here now'))
            : ''}
        </span>
      </span>
    </button>
  );
}

export default function Chain({ chain, live, selNode, onSelect }) {
  const { nodes, target } = chain;
  if (!nodes.length) return null;
  return (
    <div class="chain">
      {nodes.map((n, i) => (
        <>
          <Node key={n.label + i} n={n} i={i} selected={selNode === i} onSelect={onSelect}
            atStart={target === 0} />
          {i < nodes.length - 1 && (
            <span class={`leg ${i === target - 1 ? 'now' : ''}`}>
              <span class="sp">{TRANSPORT_ICON[n.legMode] || '🚗'}</span>
              <span>
                {NF(n.kmNext || 0)} km
                {n.kmNext > 0 ? ' · ~' + fmtMins(etaMins(n.kmNext, n.legMode)) : ''}
                {i === target - 1 && live?.hasFix
                  ? ` · ${NF(live.remaining)} km ${L('বাকি', 'to go')}`
                  : ''}
              </span>
            </span>
          )}
        </>
      ))}
    </div>
  );
}

/** The selected-stop card sits BELOW the map, never over the pins (docs/DESIGN.md §7) */
export function NodeDetail({ chain, live, selNode, onClear, onShowMap }) {
  if (selNode == null || !chain.nodes[selNode]) {
    return (
      <div class="callout blank">
        {L('চেইন বা ম্যাপে যেকোনো বিন্দুতে ট্যাপ করো — তুমি সেখান থেকে কত দূরে দেখাবে।',
           'Tap any node or pin — this card shows how far you are from it.')}
      </div>
    );
  }
  const n = chain.nodes[selNode];
  return (
    <div class="callout">
      <div class="between" style="margin-bottom:6px">
        <div class="eyebrow">{L('বাছা জায়গা', 'Selected stop')}</div>
        <button class="copy" type="button" onClick={onClear}>{L('বন্ধ', 'Close')} ✕</button>
      </div>
      <div style="font-weight:700;font-family:var(--display);font-size:17px;margin-bottom:6px">
        {n.icon ? n.icon + ' ' : ''}{tx(n, 'label')}
      </div>
      {live?.hasFix ? (
        <div class="between">
          <span class="muted">{L('তোমার অবস্থান থেকে', 'From where you are')}</span>
          <span class="num" style="color:var(--coral)">{NF(haversine(live.pos, n))} km</span>
        </div>
      ) : (
        <div class="between">
          <span class="muted">{L('তোমার অবস্থান', 'Your position')}</span>
          <span class="chip amber">{L('GPS বন্ধ', 'GPS off')}</span>
        </div>
      )}
      <div class="between">
        <span class="muted">{L('শুরুর জায়গা থেকে', 'From the start')}</span>
        <span class="num">{NF(haversine(chain.nodes[0], n))} km</span>
      </div>
      {n.kmNext > 0 && (
        <div class="between">
          <span class="muted">{L('পরের জায়গা', 'Next stop')}</span>
          <span class="num">{NF(n.kmNext)} km</span>
        </div>
      )}
      {onShowMap && (
        <button class="btn sm block" type="button" style="margin-top:10px" onClick={onShowMap}>
          {L('ম্যাপে দেখাও', 'Show on map')}
        </button>
      )}
    </div>
  );
}
