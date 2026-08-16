# Blind Cap — demo video narration script

Timed to `20260816-1005-34.8760870.mp4` (2:39.68, 1918×1088, 30fps).

Read each line starting at its cue. Durations below are the measured TTS
lengths, so there is slack at every cue — you do not need to rush.

| # | Cue | On screen | Narration |
|:--|:--|:--|:--|
| 1 | **0:01** | Landing page — *"Prove you can afford it. Reveal nothing."* | AI agents can already spend money on their own. But every spend limit built so far is written on-chain, in plain text. So anyone can read your budget. Blind Cap hides it. |
| 2 | **0:16** | Launch App → `/app`, wallet connected, contract `0x0693…57d9F` | This is the live app, running on Monad Testnet. The wallet is connected, and the contract address is right there. |
| 3 | **0:25** | Step 2 — registering identity, MetaMask prompts, policy hash committed | Now the important part. We set a spending limit of one thousand. But watch what actually goes on-chain. Not the number. Only a Poseidon hash of it. Two transactions. The first registers the agent's identity. The second commits the policy. And the log says it plainly. The real limit never left this browser. |
| 4 | **0:48** | Step 3 — *"Try 500 MON (within limit)"* clicked | Now the agent asks to spend five hundred, which is inside the hidden limit. It requests validation on-chain. |
| 5 | **0:57** | *"Generating Groth16 proof in this browser…"* | And here is the zero-knowledge part. The proof is generated right here, in the browser, on this machine. It proves five hundred is within the committed limit, without revealing what that limit actually is. |
| 6 | **1:12** | *"Proof generated in 421ms"* → submitting on-chain | Four hundred and twenty-one milliseconds. That proof now goes on-chain for the contract to verify. |
| 7 | **1:19** | ✅ *"PASSED — spend authorized on-chain, limit never revealed."* | Passed. The spend is authorized on-chain, and the limit was never revealed. |
| 8 | **1:25** | Step 4 — autonomous agent: API access $350 ✓, audit $800 ✓, marketing $300 skipped, server $550 ✓ | Now a fully autonomous agent takes over. It evaluates opportunities and decides for itself. Approving what fits, skipping low value, proving every time. |
| 9 | **1:36** | MonadVision explorer — `full_match/10143/0x0693…` | Every contract is live on Monad Testnet, and fully verified on Sourcify. A full source match. |
| 10 | **1:45** | `#how-it-works` — WHAT'S INCLUDED list | Hidden spend limits. Live in-browser proving. Instant revocation if a key leaks. And an autonomous agent demo. |
| 11 | **1:54** | GitHub repo — file tree + README hero | The whole thing is open source. A Circom circuit, Solidity contracts, and a static front end with no build step. Anyone can clone it and run it in about a minute. |
| 12 | **2:08** | README Mermaid diagram — the two branches | Here is the model in one picture. The owner picks a secret limit. Only the hash goes on-chain. Ask for five hundred, and a proof exists. Ask for five thousand, and no satisfying witness exists at all. So the request cannot even be attempted. |
| 13 | **2:26** | README — results table, *"Break it if you can"* | That is the core idea. An over-limit spend is not rejected by a rule that someone could change. It is blocked by mathematics. Blind Cap. Built at Monad Blitz Bangalore V5. |

## Rebuilding the voiceover

Segment audio and the ffmpeg mux command live in the session scratchpad.
To regenerate after editing this script, the pipeline is:

1. Synthesize one WAV per cue (Windows SAPI via `System.Speech.Synthesis`).
2. `adelay` each WAV to its cue time, `amix` them together.
3. `loudnorm=I=-16:TP=-1.5` to hit broadcast speech level without clipping.
4. `apad` + `-shortest` so audio runs the full video length rather than
   truncating the video at the last word.
5. `-c:v copy` — the video is never re-encoded, so there is no quality loss.
