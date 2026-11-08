# Allowance

**Pocket money for your AI agent. Not your wallet.**

Allowance gives a Claude agent its own Solana wallet and a small allowance you fund from Phantom. The agent buys data from paid APIs one call at a time (HTTP 402 → pay on Solana → retry). Every payment carries an on-chain memo saying *why* the agent bought it. A spending policy checks every payment in code before anything is signed, so an instruction smuggled into an API response can't talk the agent into paying a scammer.

Built for the MLH Solana Hackathon (Nov 2026), AI track.

## The problem

Agents are starting to pay for things: APIs, data, compute. Today you either give an agent your keys (and hope) or you approve every cent by hand (and it stops being an agent). Prompt injection makes the first option worse: any web page or API response can tell the agent to send money somewhere.

## How it works

```
 You (Phantom) ──fund 0.2 SOL──▶ Agent wallet ──pays per call──▶ Merchant APIs
                                   │                               │
                       spending policy (code)          402 quote → verify tx on-chain
                       · max per purchase                → serve data
                       · session budget
                       · approved merchants only
```

1. **Fund it.** You send SOL from Phantom to the agent's wallet. That balance is the hard limit, enforced by Solana itself: the agent can't spend what you didn't give it. "Take it back" sends the rest home.
2. **Set the rules (the permission slip).** Max per purchase, session budget, and an allowlist of merchants. The agent runtime checks these before it signs, and the model can't change them.
3. **Send it on an errand.** Claude decides which data it needs. Each paid API answers `402 Payment Required` with a price, a recipient and a nonce. If the policy allows it, the agent sends a SOL transfer plus a Memo instruction (`api`, `nonce`, `why`). The merchant fetches the transaction from devnet, checks the amount, recipient and nonce, rejects replays, and only then serves the data.
4. **Read the receipt.** Every purchase prints as a receipt line linked to Solana Explorer, with the agent's reason stored on-chain.

### Three layers of safety, shown in the demo

| Layer | What stops a bad payment | Demo |
|---|---|---|
| The model | Claude treats instructions inside tool results as data | The poisoned deals feed: Claude buys the feed, spots the "system notice", calls it a likely scam, pays nothing |
| The policy (code) | Per-call cap, budget, merchant allowlist, checked before signing | Hijacked-agent drill: a simulated hijacked agent obeys the notice and tries to pay a scammer 1 SOL, and gets **DECLINED** |
| The chain | The agent only holds what you funded | Revoke pulls the balance back |

In testing, Claude refused the injected payment every time, even when told to role-play an obedient agent. So the drill simulates the hijack in the runtime: when the box is ticked, the agent's wallet tries to carry out the instruction found in the API response, as a jailbroken or over-agreeable model would. The policy still blocks it, because the guardrail is code, not a prompt.

## Why Solana

Per-call payments only work if a payment settles in about a second and costs a fraction of a cent. A 0.0005 SOL data call with a memo is practical on Solana; on most chains the fee would be larger than the purchase.

## Run it

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
npm start            # http://localhost:3000
```

1. Switch Phantom to **Solana Devnet** (Settings → Developer Settings → Testnet Mode) and get devnet SOL from https://faucet.solana.com.
2. Open http://localhost:3000, connect Phantom, fund the agent with 0.1–0.2 SOL.
3. Try the three errands: the Cairo → Dubai trip, the premium tips (over the cap), and the red-team drill.

On first start the server creates three devnet keypairs in `.wallets.json` (agent, demo merchant, demo scammer). They are devnet-only and git-ignored.

## What's real and what's demo

- **Real:** devnet transfers and memos, on-chain payment verification by the merchant (amount, recipient, nonce, replay protection), the policy checks, Phantom funding and revoke, the Claude tool-use loop.
- **Demo:** the API data (fares, hotels, weather) is generated. The merchant runs in the same process to keep the demo self-contained.
- **Not yet on-chain:** the per-call cap and allowlist are enforced by the agent runtime. The next step is to move them into an on-chain program (or a smart-wallet spending limit) so the policy holds even if the runtime is compromised.

## Built with

Solana web3.js, the SPL Memo program, Phantom, Claude (Anthropic API, tool use), Node.js and Express. Fonts: Baloo 2 and Atkinson Hyperlegible (SIL Open Font License). Design direction informed by Anthropic's open-source frontend-design skill.

Designed and directed by Marwan Abudaif; built with Claude Code as the implementation assistant.
