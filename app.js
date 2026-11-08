const $ = (id) => document.getElementById(id);
const { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = solanaWeb3;
const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
const txUrl = (sig) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
const addrUrl = (a) => `https://explorer.solana.com/address/${a}?cluster=devnet`;
const short = (s) => `${s.slice(0, 4)}…${s.slice(-4)}`;
const fmt = (x) => Number(Number(x).toFixed(4)).toString();
const sol4 = (x) => Number(x).toFixed(4);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#+\s*/gm, '');

let state = null;
let me = null;
let errandNo = Number(sessionStorage.getItem('errandNo') || 0);
const provider = () => window.phantom?.solana || window.solana;

async function refresh() {
  try { state = await (await fetch('/api/state')).json(); } catch { return; }
  $('agent-addr').textContent = short(state.agent.address);
  $('agent-addr').href = addrUrl(state.agent.address);
  $('agent-bal').textContent = fmt(state.agent.sol);
  $('model-pill').textContent = state.model;
  if (document.activeElement !== $('cap')) $('cap').value = state.policy.perCallCapSol;
  if (document.activeElement !== $('budget')) $('budget').value = state.policy.sessionBudgetSol;
  $('allow').textContent = short(state.merchant.address);
  $('spent').textContent = fmt(state.spentSol);
  $('budget-show').textContent = fmt(state.policy.sessionBudgetSol);
  $('meter-fill').style.width = `${Math.min(100, (state.spentSol / state.policy.sessionBudgetSol) * 100)}%`;
  $('catalog').innerHTML = Object.entries(state.catalog).map(([k, v]) =>
    `<li><span>${k}</span><span class="lead"></span><span class="${v.priceSol > state.policy.perCallCapSol ? 'over' : ''}">${sol4(v.priceSol)} ◎</span></li>`).join('');
  $('receipts').innerHTML = state.receipts.length ? state.receipts.map((r) =>
    `<li><div class="top"><span>${esc(r.api)}</span><a target="_blank" href="${txUrl(r.sig)}">${sol4(r.amountSol)} ◎ ↗</a></div><div class="why">${esc(r.reason)}</div></li>`).join('')
    : '<li class="none">Nothing spent yet.</li>';
  if (me) {
    const bal = await conn.getBalance(me).catch(() => null);
    $('me').textContent = `${short(me.toBase58())}${bal == null ? '' : ` · ${fmt(bal / LAMPORTS_PER_SOL)} ◎`}`;
  }
}

$('connect').onclick = async () => {
  const p = provider();
  if (!p) { window.open('https://phantom.app/', '_blank'); return; }
  try {
    const r = await p.connect();
    me = r.publicKey;
    $('fund').disabled = false; $('revoke').disabled = false;
    $('connect').textContent = 'Phantom connected';
    refresh();
  } catch (e) { print('err', esc(e.message)); }
};

$('fund').onclick = async () => {
  const sol = Number($('fund-amt').value);
  if (!(sol > 0)) return;
  $('fund').disabled = true; $('fund').textContent = 'Approve in Phantom…';
  try {
    const { blockhash } = await conn.getLatestBlockhash();
    const t = new Transaction({ feePayer: me, recentBlockhash: blockhash }).add(SystemProgram.transfer({
      fromPubkey: me, toPubkey: new PublicKey(state.agent.address), lamports: Math.round(sol * LAMPORTS_PER_SOL),
    }));
    const { signature } = await provider().signAndSendTransaction(t);
    $('fund').textContent = 'Confirming…';
    await conn.confirmTransaction(signature, 'confirmed');
    print('funded', `+ ${fmt(sol)} ◎ put in the envelope by you · <a target="_blank" href="${txUrl(signature)}">${short(signature)} ↗</a>`);
  } catch (e) { print('err', esc(e.message)); }
  $('fund').disabled = false; $('fund').textContent = 'Fund the agent';
  refresh();
};

$('revoke').onclick = async () => {
  const r = await (await fetch('/api/withdraw', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: me.toBase58() }) })).json();
  if (r.sig) print('funded', `− ${fmt(r.sol)} ◎ returned to you (allowance revoked) · <a target="_blank" href="${txUrl(r.sig)}">${short(r.sig)} ↗</a>`);
  else print('err', esc(r.error));
  refresh();
};

const savePolicy = async () => {
  await fetch('/api/policy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ perCallCapSol: Number($('cap').value), sessionBudgetSol: Number($('budget').value) }) });
  refresh();
};
$('cap').onchange = savePolicy; $('budget').onchange = savePolicy;
$('reset').onclick = async () => { await fetch('/api/reset', { method: 'POST' }); $('feed').innerHTML = '<p class="idle">Waiting for an errand…</p>'; refresh(); };

document.querySelectorAll('.chip').forEach((c) => c.onclick = () => {
  $('q').value = c.dataset.q;
  $('compromised').checked = c.dataset.mode === 'compromised';
});

function print(cls, html) {
  const idle = $('feed').querySelector('.idle'); if (idle) idle.remove();
  const d = document.createElement('div'); d.className = cls; d.innerHTML = html;
  $('feed').appendChild(d);
  d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  return d;
}

let runSpent = 0; let runCalls = 0;
const itemLine = (label, amount) => `<div class="ln"><span>${esc(label).toUpperCase()}</span><span class="lead"></span><span class="amt-r">${sol4(amount)} ◎</span></div>`;

function render(ev) {
  switch (ev.type) {
    case 'thought': return print('note', esc(ev.text));
    case 'quote': return print('item quoted', `<div class="ln"><span class="tag402">402</span><span>${esc(ev.api)} quotes</span><span class="lead"></span><span>${sol4(ev.amountSol)} ◎</span></div>`);
    case 'paid':
      runSpent += ev.amountSol; runCalls += 1;
      return print('item', `${itemLine(ev.api, ev.amountSol)}<div class="meta">why: ${esc(ev.reason)}</div><div class="meta">tx <a target="_blank" href="${txUrl(ev.sig)}">${short(ev.sig)} ↗</a> · memo on-chain</div>`);
    case 'delivered': return print('verified', '✓ merchant verified it on-chain, data delivered');
    case 'blocked':
      return print('declined', `${itemLine(ev.api === 'send_payment' ? `pay ${short(ev.recipient || '????????')}` : ev.api, ev.amountSol)}<div class="why">${esc(ev.why)}. Nothing was signed.</div><div class="stamp">DECLINED</div>`);
    case 'hijack': return print('hijack', esc(ev.text));
    case 'answer': return print('answer', md(ev.text));
    case 'error': return print('err', `ERR ${esc(ev.message)}`);
    case 'done':
      print('total', `<div class="ln"><span>TOTAL · ${runCalls} PURCHASE${runCalls === 1 ? '' : 'S'}</span><span class="lead"></span><span>${sol4(runSpent)} ◎</span></div>`);
      print('barcode', '');
      return print('thanks', 'THANK YOU FOR SPENDING RESPONSIBLY');
    default: return null;
  }
}

$('go').onclick = async () => {
  const question = $('q').value.trim() || $('q').placeholder;
  const mode = $('compromised').checked ? 'compromised' : 'normal';
  $('go').disabled = true; $('go').textContent = 'Agent on the errand…';
  $('feed').innerHTML = '';
  runSpent = 0; runCalls = 0; errandNo += 1; sessionStorage.setItem('errandNo', errandNo);
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  print('errand-line', `<div class="no"><span>ERRAND #${String(errandNo).padStart(4, '0')}${mode === 'compromised' ? ' · <b style="color:var(--stamp)">HIJACKED-AGENT DRILL</b>' : ''}</span><span>${time}</span></div><div class="q">“${esc(question)}”</div>`);
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
  } catch (e) { print('err', esc(e.message)); }
  $('go').disabled = false; $('go').textContent = 'Send the agent';
  refresh();
};

refresh();
setInterval(refresh, 15000);
