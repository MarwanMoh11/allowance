# Allowance

**Pocket money for your AI agent. Not your wallet.**

A Claude agent gets its own Solana wallet and a small allowance. It pays for data one API call at a time (HTTP 402 → pay on Solana → retry) and writes *why* it paid into an on-chain memo. A spending policy in code checks every payment before it is signed, so a scammer's address smuggled into an API response gets a "Nope.", not your SOL.

**[▶ Watch the 2-minute demo](https://youtu.be/Mcyts4OAp5I)** · **[Play the replay in your browser](https://marwanmoh11.github.io/allowance/)** · **[Jump straight to the hijack drill](https://marwanmoh11.github.io/allowance/?play=drill)**

[![The hijacked-agent drill: the agent pays 0.001 SOL for a deals feed, the feed tells it to send 1 SOL to a scammer, and the wallet's rules refuse with a Nope sticker](.github/media/hero.png)](https://marwanmoh11.github.io/allowance/?play=drill)

*The hijacked-agent drill, replayed from a real devnet run. The gold star is a real 0.001 SOL payment with the agent's reason in its memo. The 1 SOL to the scammer is refused before anything is signed.*

**Why Solana:** each purchase is a 0.0005–0.002 SOL transfer plus a memo. Solana confirms it in about a second for a 0.000005 SOL fee; on most chains the fee would be bigger than the purchase.

Built for the MLH Solana Hackathon (Nov 2026). The replay plays back real devnet runs recorded on 8 Nov 2026, and every gold star links to the real transaction. To run the agent live, follow [Run it](#run-it) below.

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
- **Not yet on-chain:** the per-call cap, budget and allowlist are enforced by the agent runtime, before signing. That stops a misbehaving model, not a compromised server. See [Path to on-chain enforcement](#path-to-on-chain-enforcement).

## Path to on-chain enforcement

The 402 handshake, the memo and the merchant's on-chain check stay as they are. What moves is the policy, to a place the agent's key can't get around:

1. **Budget, with no new program:** pay in USDC and give the agent an SPL Token delegate approval (`approve`) for the session budget instead of a funded wallet. The Token program refuses anything past the approved amount, even if the agent's key leaks.
2. **Cap and allowlist, with a small program:** hold the allowance in a program-owned vault (a PDA). The agent's key can only call `pay(amount, recipient, memo)`, and the program checks the per-call cap, the remaining budget and the merchant allowlist before moving funds. The owner can change the limits or close the vault at any time.
3. **Or a smart wallet:** Squads spending limits let a delegated key spend up to an amount per period, optionally only to listed destinations, without a custom program.

Separately, the handshake could follow the x402 spec (an open standard for HTTP 402 payments) so standard clients and merchants can use it.

## Built with

Solana web3.js, the SPL Memo program, Phantom, Claude (Anthropic API, tool use), Node.js and Express. Fonts: Baloo 2 and Atkinson Hyperlegible (SIL Open Font License).

Designed and directed by Marwan Abudaif.
