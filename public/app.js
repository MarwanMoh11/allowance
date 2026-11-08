const $ = (id) => document.getElementById(id);
const { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = solanaWeb3;
const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
const txUrl = (sig) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
const addrUrl = (a) => `https://explorer.solana.com/address/${a}?cluster=devnet`;
const short = (s) => `${s.slice(0, 4)}…${s.slice(-4)}`;
const fmt = (x) => Number(Number(x).toFixed(4)).toString();
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#+\s*/gm, '');
const STAR = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l5.9 12.6 13.8 1.7-10.2 9.5 2.7 13.7L24 34.8l-12.2 6.7 2.7-13.7L4.3 18.3l13.8-1.7z" fill="#ffc531" stroke="#22305a" stroke-width="3" stroke-linejoin="round"/></svg>';

let state = null;
let me = null;
const provider = () => window.phantom?.solana || window.solana;

// Replay mode: on a static host (GitHub Pages) there is no server or API key, so the page
// plays back real devnet runs recorded on 8 Nov 2026. Every link still points at the real transaction.
const REPLAY = !['localhost', '127.0.0.1'].includes(location.hostname) || new URLSearchParams(location.search).has('replay');
let replayBase = null; let replaySpent = 0; let replayReceipts = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getState() {
  if (!REPLAY) return (await fetch('/api/state')).json();
  if (!replayBase) replayBase = await (await fetch('replay/state.json')).json();
  return { ...replayBase, spentSol: replaySpent, receipts: replayReceipts, policy: { ...replayBase.policy, sessionBudgetSol: 0.05 } };
}

const REPLAY_EMPTY = 'Press an errand above to play it. Start with the red drill: the deals feed hides an order to pay a scammer 1 ◎, and the wallet has to say no.';

if (REPLAY) {
  document.body.classList.add('replay');
  const banner = document.createElement('div');
  banner.className = 'replay-banner';
  banner.innerHTML = 'A replay of real Solana devnet runs, recorded 8 Nov 2026. <b>Press any errand to play it</b>, and try the red drill first. Every gold star links to the real payment. To run the agent live, <a href="https://github.com/MarwanMoh11/allowance" target="_blank">clone the repo</a>.';
  document.body.prepend(banner);
  $('feed').innerHTML = `<p class="empty">${REPLAY_EMPTY}</p>`;
  document.querySelectorAll('.idea').forEach((c) => { c.textContent = `▶ ${c.textContent}`; });
  for (const id of ['connect', 'fund', 'revoke']) { $(id).disabled = true; }
  $('connect').textContent = 'Phantom works when you run it locally';
  $('cap').disabled = true; $('budget').disabled = true;
}

async function refresh() {
  try { state = await getState(); } catch { return; }
  const left = Math.max(0, state.policy.sessionBudgetSol - state.spentSol);
  $('left').textContent = fmt(left);
  $('budget-show').textContent = fmt(state.policy.sessionBudgetSol);
  $('jar-fill').style.height = `${Math.round((left / state.policy.sessionBudgetSol) * 100)}%`;
  $('agent-bal').textContent = fmt(state.agent.sol);
  $('agent-addr').href = addrUrl(state.agent.address);
  $('model-pill').textContent = state.model;
  if (document.activeElement !== $('cap')) $('cap').value = state.policy.perCallCapSol;
  if (document.activeElement !== $('budget')) $('budget').value = state.policy.sessionBudgetSol;
  $('allow').textContent = short(state.merchant.address);
  $('spent').textContent = fmt(state.spentSol);
  $('catalog').innerHTML = Object.entries(state.catalog).map(([k, v]) =>
    `<li><span>${k}</span><span class="price ${v.priceSol > state.policy.perCallCapSol ? 'over' : ''}">${fmt(v.priceSol)} ◎</span></li>`).join('');
  $('receipts').innerHTML = state.receipts.length ? state.receipts.map((r) =>
    `<li><div class="top-line"><span>${esc(r.api)}</span><a target="_blank" href="${txUrl(r.sig)}">${fmt(r.amountSol)} ◎</a></div><div class="reason">${esc(r.reason)}</div></li>`).join('')
    : '<li class="none">Nothing spent yet today.</li>';
  if (me) {
    const bal = await conn.getBalance(me).catch(() => null);
    $('me').textContent = `${short(me.toBase58())}${bal == null ? '' : `, ${fmt(bal / LAMPORTS_PER_SOL)} ◎`}`;
  }
}

$('connect').onclick = async () => {
  const p = provider();
  if (!p) { window.open('https://phantom.com/download', '_blank'); return; }
  try {
    const r = await p.connect();
    me = r.publicKey;
    $('fund').disabled = false; $('revoke').disabled = false;
    $('connect').textContent = 'Phantom connected';
    refresh();
  } catch (e) { add('err', `Phantom didn't connect: ${esc(e.message)}`); }
};

$('fund').onclick = async () => {
  const sol = Number($('fund-amt').value);
  if (!(sol > 0)) { add('err', 'Enter how much SOL to put in the jar.'); return; }
  $('fund').disabled = true; $('fund').textContent = 'Approve in Phantom…';
  try {
    const { blockhash } = await conn.getLatestBlockhash();
    const t = new Transaction({ feePayer: me, recentBlockhash: blockhash }).add(SystemProgram.transfer({
      fromPubkey: me, toPubkey: new PublicKey(state.agent.address), lamports: Math.round(sol * LAMPORTS_PER_SOL),
    }));
    const { signature } = await provider().signAndSendTransaction(t);
    $('fund').textContent = 'Confirming…';
    await conn.confirmTransaction(signature, 'confirmed');
    add('funded', `You put ${fmt(sol)} ◎ in the jar. <a target="_blank" href="${txUrl(signature)}">See it on Solana</a>`);
  } catch (e) { add('err', `The jar wasn't filled: ${esc(e.message)}`); }
  $('fund').disabled = false; $('fund').textContent = 'Fill the jar';
  refresh();
};

$('revoke').onclick = async () => {
  const r = await (await fetch('/api/withdraw', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: me.toBase58() }) })).json();
  if (r.sig) add('funded', `${fmt(r.sol)} ◎ came back to your wallet. <a target="_blank" href="${txUrl(r.sig)}">See it on Solana</a>`);
  else add('err', `Nothing came back: ${esc(r.error)}`);
  refresh();
};

const savePolicy = async () => {
  await fetch('/api/policy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ perCallCapSol: Number($('cap').value), sessionBudgetSol: Number($('budget').value) }) });
  refresh();
};
$('cap').onchange = savePolicy; $('budget').onchange = savePolicy;
$('reset').onclick = async () => {
  $('feed').innerHTML = '<p class="empty">A new day. Send the agent on an errand and its purchases show up here, one sticker per payment.</p>';
  await fetch('/api/reset', { method: 'POST' });
  refresh();
};

document.querySelectorAll('.idea').forEach((c) => c.onclick = () => {
  $('q').value = c.dataset.q;
  $('compromised').checked = c.dataset.mode === 'compromised';
  if (REPLAY && !$('go').disabled) $('go').click(); // one click plays a recorded errand
});

function add(cls, html) {
  const empty = $('feed').querySelector('.empty'); if (empty) empty.remove();
  const d = document.createElement('div'); d.className = cls; d.innerHTML = html;
  $('feed').appendChild(d);
  d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  return d;
}

let runSpent = 0; let runCalls = 0;

function render(ev) {
  switch (ev.type) {
    case 'thought': return add('bubble', esc(ev.text));
    case 'quote':
      return add('row asked', `<div class="dot"></div><div class="what">${ev.api === 'send_payment' ? `Someone wants ${fmt(ev.amountSol)} ◎ sent to ${short(ev.recipient)}` : `The shop asks ${fmt(ev.amountSol)} ◎ for ${esc(ev.api)}`}</div>`);
    case 'paid':
      runSpent += ev.amountSol; runCalls += 1;
      return add('row', `<div class="star">${STAR}</div><div><div class="what">Bought <b>${esc(ev.api)}</b> for <b>${fmt(ev.amountSol)} ◎</b></div><div class="why">Because: ${esc(ev.reason)}. <a target="_blank" href="${txUrl(ev.sig)}">Payment on Solana</a></div>${ev.memo ? `<div class="memo"><span>Memo stored on-chain with the payment</span><code>${esc(ev.memo)}</code></div>` : ''}</div>`);
    case 'delivered': return add('checked', 'The shop checked the payment on Solana and handed over the data.');
    case 'hijack': return add('hijack', esc(ev.text));
    case 'blocked': {
      const what = ev.api === 'send_payment' ? `Tried to send ${fmt(ev.amountSol)} ◎ to ${short(ev.recipient || '')}` : `Tried to buy ${esc(ev.api)} for ${fmt(ev.amountSol)} ◎`;
      return add('row nope-row', `<div class="x">✕</div><div><div class="what">${what}</div><div class="why">Against the house rules: ${esc(ev.why)}. Nothing was signed.</div></div><div class="nope">Nope.</div>`);
    }
    case 'answer': return add('answer', md(ev.text));
    case 'error': return add('err', `Something went wrong: ${esc(ev.message)}`);
    case 'done':
      return add('tally', `<span class="stars">${'★'.repeat(runCalls) || '☆'}</span> ${runCalls} ${runCalls === 1 ? 'thing' : 'things'} bought for ${fmt(runSpent)} ◎`);
    default: return null;
  }
}

$('go').onclick = async () => {
  const question = $('q').value.trim() || $('q').placeholder;
  const mode = $('compromised').checked ? 'compromised' : 'normal';
  $('go').disabled = true; $('go').textContent = 'Out on the errand…';
  $('feed').innerHTML = '';
  runSpent = 0; runCalls = 0;
  add('you-asked', `${esc(question)}<small>${mode === 'compromised' ? 'Drill: the agent is pretending to be hijacked' : 'Your errand'}</small>`);
  if (REPLAY) {
    await playReplay(question, mode);
    $('go').disabled = false; $('go').textContent = 'Send the agent';
    return;
  }
  try {
    const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, mode }) });
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        const ev = JSON.parse(line);
        render(ev);
        if (ev.type === 'paid' || ev.type === 'done') refresh();
      }
    }
  } catch (e) { add('err', `The errand stopped: ${esc(e.message)}`); }
  $('go').disabled = false; $('go').textContent = 'Send the agent';
  refresh();
};

async function playReplay(question, mode) {
  const q = question.toLowerCase();
  const name = mode === 'compromised' || q.includes('deal') ? 'drill' : q.includes('insider') ? 'insider' : 'trip';
  const known = [...document.querySelectorAll('.idea')].some((c) => c.dataset.q === question);
  if (!known) add('bubble', 'This replay only has the three example errands, so here is the closest one. Run it locally to ask anything.');
  const lines = (await (await fetch(`replay/${name}.ndjson`)).text()).split('\n').filter((l) => l.trim());
  const pause = { thought: 900, quote: 700, signing: 900, paid: 500, delivered: 600, hijack: 1100, blocked: 900, answer: 700, done: 300 };
  for (const line of lines) {
    const ev = JSON.parse(line);
    await sleep(pause[ev.type] ?? 400);
    if (ev.type === 'paid') { replaySpent += ev.amountSol; replayReceipts = [ev, ...replayReceipts]; }
    render(ev);
    if (ev.type === 'paid' || ev.type === 'done') refresh();
  }
}

if (REPLAY) {
  $('reset').onclick = () => {
    replaySpent = 0; replayReceipts = [];
    $('feed').innerHTML = `<p class="empty">A new day. ${REPLAY_EMPTY}</p>`;
    refresh();
  };
  // Deep link: ?play=drill (or trip, insider) starts that errand on load.
  const play = new URLSearchParams(location.search).get('play');
  const chip = { trip: '.idea:not(.drill)', insider: '.idea:nth-of-type(2)', drill: '.idea.drill' }[play];
  if (chip) setTimeout(() => document.querySelector(chip)?.click(), 1200);
}

refresh();
setInterval(refresh, 15000);
