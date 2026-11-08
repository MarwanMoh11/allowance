# MLH Solana Hackathon: submission text (paste-ready)

Deadlines (checked on events.mlh.com/events/15200-solana-hackathon, 8 Nov 2026):
initial submission 10:00 ET = **17:00 Cairo**; final 11:45 ET = **18:45 Cairo**. Submit at mlh.com/events/solana-hackathon → Submit a Project.

**Prize categories to pick:** AI Track Top Prize. Top 3 Overall is automatic. Add Best Beginner Hack only if this is your first Solana build (it is) and the form allows more than one.

---

**Project name:** Allowance

**Tagline (short):** Pocket money for your AI agent, not your wallet.

**What it does**
Allowance gives a Claude agent its own Solana wallet and an allowance you fund from Phantom. The agent buys data from paid APIs one call at a time: each API answers HTTP 402 with a price, the agent pays in SOL with an on-chain memo saying why it bought the data, and the merchant verifies the payment on devnet before serving it. A spending policy (max per purchase, session budget, approved merchants only) is checked in code before anything is signed. In the demo, a poisoned API response tells the agent to send 1 SOL to a scammer. Even when we simulate a compromised model that obeys it, the payment is declined, because the guardrail is code, not a prompt. You can revoke the allowance at any time and the balance comes back to your wallet.

**How we built it**
Node.js and Express serve three roles: paid APIs that return 402 quotes, a Claude agent (Anthropic API, tool use) with its own devnet keypair, and the policy layer. Payments are SystemProgram transfers bundled with an SPL Memo instruction (`api`, `nonce`, `why`). The merchant calls getParsedTransaction to check recipient, amount and nonce, and rejects replays. The front end funds the agent through Phantom with @solana/web3.js and prints every purchase as a receipt line linked to Solana Explorer.

**Challenges**
The devnet RPC faucet is closed, so funding had to go through Phantom, which became the core of the demo: you hand the agent its allowance. A brand-new merchant account can't receive less than the rent-exempt minimum, so the first tiny payment failed until we added a one-time account setup.

**Accomplishments**
A full pay-per-call loop on Solana: quote, policy check, transfer plus memo, on-chain verification, delivery. It works end to end in about a second per purchase, and every reason the agent gives is auditable on-chain.

**What we learned**
Solana's speed and fees are what make per-call machine payments practical: a 0.0005 SOL purchase with a memo costs less in fees than the purchase itself. Also, guardrails for agents that hold money belong in code and on-chain, not in the system prompt.

**What's next**
Move the per-call cap and merchant allowlist into an on-chain program or smart-wallet spending limit so the policy holds even if the agent's runtime is compromised; support USDC; let any API become a merchant with a small 402 middleware.

**Built with:** solana, web3.js, spl-memo, phantom, claude, anthropic-api, node.js, express

**Links:** GitHub repo: <add after pushing> · Demo video: <add after recording>

---

## 90-second demo video script (record in Chrome with Phantom on devnet)

1. (0:00) Title screen: "Allowance: pocket money for your AI agent, not your wallet." One line: agents are starting to pay for APIs; giving them your keys is reckless.
2. (0:10) Connect Phantom, fund the agent with 0.2 SOL. Show the envelope balance update.
3. (0:20) Point at the permission slip: 0.01 per purchase, 0.05 per session, this merchant only.
4. (0:25) Errand 1, Cairo → Dubai. Receipts print: 402 quote, paid, memo with the reason, merchant verified. Click one tx to show the memo on Solana Explorer.
5. (0:50) Errand 2, premium tips at 0.25 SOL → DECLINED stamp (over the cap).
6. (1:00) Errand 3, red-team drill with "compromised model" ticked: the deals feed tells the agent to pay a scammer 1 SOL; the agent tries; DECLINED, nothing signed. Line: "The guardrail is code, not a prompt."
7. (1:15) Revoke: the balance goes back to Phantom. Close on the ledger: every cent, every reason, on-chain.
