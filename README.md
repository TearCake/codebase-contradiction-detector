# Codebase Contradiction Detector 🔍⚡

[![BuildSprint 2026](https://img.shields.io/badge/BuildSprint-2026-0070f3?style=for-the-badge&logo=github&logoColor=white)](https://latentstack.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Tests](https://img.shields.io/badge/Tests-24%20Passing-10B981?style=for-the-badge&logo=githubactions&logoColor=white)](#-testing--verification)
[![Safety Layer](https://img.shields.io/badge/Safety_Layer-100%25_Verified-0EA5E9?style=for-the-badge&logo=shield&logoColor=white)](#-security--safety-enforcements)
[![License](https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge)](#-license)

> **BuildSprint 2026 Hackathon Project**  
> An automated repository intelligence engine that constructs a lightweight context graph around claims to discover, prove, and highlight conflicting truths across source code, documentation, specifications, tests, and configuration files.

---

## 🌟 Overview

Modern software codebases maintain state and requirements across disjointed representations:
* **Imperative Logic:** Backend controllers, frontend components, and routing.
* **Declarative Specifications:** OpenAPI / Swagger YAML & JSON schemas.
* **Human Documentation:** `README.md`, JSDoc, ADRs, and wiki guides.
* **Operational State:** `.env.example`, Dockerfiles, and app configs.
* **Verification Artifacts:** Unit tests, integration tests, and test assertions.

Over time, code evolves faster than surrounding artifacts, leading to **software truth fragmentation**. 

**Codebase Contradiction Detector** continuously ingests software repositories, extracts explicit normalized **Claims**, links them in an in-memory **Repository Context Graph**, and flags high-confidence, evidence-backed contradictions before they reach production.

---

## ✨ Key Features

- 🐙 **Public GitHub Repository Analysis:** Paste any public GitHub URL (`https://github.com/owner/repository`) to download, extract, and scan real-world codebases.
- 🧪 **Bundled 5-Scenario Demo Mode:** Instant zero-config demo showcasing 5 distinct contradiction categories across synthetic code, docs, spec, env, and test artifacts.
- 📊 **Multi-Source Evidence Matrix:** Displays 2-way, 3-way, and 4-way split-pane evidence proofs with verbatim code snippets and exact line anchors on disk.
- 🛡️ **100% Deterministic Safety Layer:** Every semantic claim is verified against raw files on disk to eliminate LLM hallucinations.
- 🤖 **Hybrid Semantic & Deterministic Pipeline:** Combines deterministic AST/regex parsers with LLM reasoning (Groq / Gemini / OpenAI compatible) for behavioral claim comparisons.
- ⚡ **Fault Tolerant & Resilient:** Automatically falls back to deterministic analysis if LLM credentials are missing, rate-limited, or unavailable.
- 🕸️ **Repository Context Graph Explorer:** Interactive visual graph mapping `Artifacts ➔ Claims ➔ Domain Subjects ➔ Conflicts`.

---

## 🚀 Quick Start

### Prerequisites
* **Node.js:** v18.0.0 or higher
* **npm:** v9.0.0 or higher

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/codebase-contradiction-detector.git
   cd codebase-contradiction-detector
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Configure environment variables:
   Copy `.env.example` to `.env.local` to enable LLM semantic analysis:
   ```bash
   cp .env.example .env.local
   ```
   Add your Groq, Gemini, or OpenAI API key:
   ```env
   GROQ_API_KEY=gsk_your_groq_api_key_here
   # OR
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   *Note: If no API key is provided, the application runs in deterministic mode without error.*

4. Launch the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Usage

1. **Option A: Public GitHub Repository**
   - Enter a public GitHub repository link in the search bar (e.g. `https://github.com/expressjs/cors`).
   - Click **Analyze Repository**.
   - Watch the multi-stage progress indicator (*Downloading repository... ➔ Scanning artifacts... ➔ Detecting contradictions...*).

2. **Option B: Bundled Demo Repository**
   - Click **Try Demo Repository** or **Run 5-Scenario Demo**.
   - Inspect the pre-built 5-contradiction demo suite showcasing route drift, environment mismatches, schema conflicts, and test status discrepancies.

---

## 📐 Pipeline Architecture

```text
               ┌──────────────────────────────────────────────┐
               │    GitHub URL OR Local Demo Repository       │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │      1. File Discovery & Ingestion           │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │      2. AST & Artifact Claim Extraction      │
               │      (ts-morph, yaml parser, regex match)   │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │      3. Lightweight Context Graph Linking    │
               │      (Artifacts ➔ Claims ➔ Subjects)         │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │      4. Candidate Pair Matching Engine       │
               │      (Jaccard Token Sim & Subject Match)     │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │      5. Deterministic & LLM Evaluation       │
               │      (Route, Env, Schema, Status, Logic)     │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │      6. Disk Evidence Anchor Verification    │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │      7. Clustering & Health Score (0-100)    │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │      8. Interactive Web Dashboard UI         │
               └──────────────────────────────────────────────┘
```

---

## 🏷️ Contradiction Taxonomy

| Category | Description | Example |
| :--- | :--- | :--- |
| **STRUCTURAL** | API Route Endpoint Drift | Doc claims `POST /api/v1/auth/login` vs Code implements `POST /api/v1/auth/token` |
| **CONFIGURATION** | Environment Key Mismatch | `.env.example` defines `ENABLE_RATE_LIMITING` vs Code reads `RATE_LIMIT_ENABLED` |
| **API_CONTRACT** | Required Payload Schema Conflict | OpenAPI marks `taxId` as optional vs Zod schema strictly requires `taxId` |
| **BEHAVIORAL** | Logic Rule / Threshold Mismatch | README / OpenAPI specifies 24h grace period vs Controller enforces 48h |
| **TESTING** | Test Assertion vs Doc Mismatch | Doc claims expired token returns 401 vs Jest test asserts status 403 |

---

## 🧪 Testing & Verification

Run the test and evaluation suites using npm scripts:

```bash
# Run unit & integration test suite (24 tests)
npm run test

# Run benchmark evaluation script against demo-repo
npm run eval

# Verify Next.js production build
npm run build
```

---

## 🔒 Security & Safety Enforcements

- **Execution Isolation:** Downloaded repository code is **never executed**. Files are parsed strictly as read-only text and AST structures.
- **Zip Slip Protection:** Archives are extracted with path traversal validation to prevent files from writing outside the temporary directory.
- **Automatic Cleanup:** Temporary repository directories are created in system temp space (`os.tmpdir()`) and purged in `finally` blocks upon completion or failure.
- **Server-Side Secret Hygiene:** API keys are processed server-side only and never exposed in client bundles or API responses. Local filesystem temp paths are sanitized before sending JSON to the browser.
- **Resource Limits:** Enforces a 25 MB max archive download limit, a 1,000 file count limit, and a 50 MB total uncompressed size cap per scan.

---

## 📄 License

MIT License. Developed for **BuildSprint 2026**.
