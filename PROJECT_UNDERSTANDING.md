# PROJECT_UNDERSTANDING.md: Codebase Contradiction Detector

**BuildSprint 2026 Hackathon Blueprint & Technical Specification**  
**Role:** Lead Architect, Technical Investigator & Product Researcher  
**Status:** Approved for Implementation (Refined Blueprint)

---

## 1. Hackathon Context & Constraints

### 1.1 Event Overview & Rules
* **Event:** BuildSprint 2026 by LatentForce.
* **Harness Constraint:** **LatentCode** is the *only* AI coding harness permitted to generate project code during the implementation phase. No Cursor, Copilot, Claude Code, Windsurf, or Codex may generate application code.
* **Permitted Tech Stack:** Standard languages (TypeScript, Python, Go, Rust, etc.), web frameworks (Next.js, FastAPI, Express), databases (PostgreSQL, SQLite, Redis), Git/GitHub APIs, standard package managers, and standard LLM APIs (OpenAI, Anthropic, Gemini, Ollama).
* **Delivery Objective:** A working, highly persuasive technical demo with realistic execution. Full production hardening is not required, but strict reliability for demo scenarios is mandatory.

### 1.2 Judging Criteria & Strategic Weighting
1. **Idea & Innovation (30%):** Requires a fundamental shift from simple "stale documentation checking" to multi-source semantic and structural claim reasoning across software artifacts.
2. **Execution (30%):** Robust parsing, low false-positive rate, deterministic safety verification layer, clean UI presentation, and AST backing.
3. **Usefulness & Impact (25%):** High ROI for developers, tech leads, and maintainers during PR reviews, refactoring, and onboarding.
4. **Presentation & Demo (10%):** A crisp, 2-minute visual narrative showing multi-source claim disagreement detection with immediate visual proof.
5. **Build in Public (5%):** Clean Git history, documented LatentCode harness development steps, and session logs.

---

## 2. Product Idea & Problem Context

### 2.1 The Core Problem
Modern software codebases maintain state and requirements across disparate, disjointed representations:
* Imperative application logic (Backend/Frontend code)
* Declarative specifications (OpenAPI, AsyncAPI, GraphQL schemas, JSON Schemas)
* Human documentation (READMEs, JSDoc/Docstrings, Architecture Decision Records (ADRs), Wiki pages)
* Operational state configurations (`.env.example`, Dockerfiles, Helm charts, CI/CD workflows)
* Verification artifacts (Unit tests, integration tests, E2E tests, mock fixtures)

Over time, code evolves faster than surrounding artifacts, leading to **software truth fragmentation**. 

### 2.2 Concrete Examples of Truth Disagreement
* **API Route Disagreement:** `README.md` claims `POST /v1/users/cancellation`, OpenAPI spec lists `POST /api/v1/users/cancel`, while Express code implements `POST /v1/account/cancel`.
* **Business Logic Window Disagreement:** README claims *"Users can cancel subscriptions within 24 hours"*, the backend `SubscriptionService.ts` checks `hours <= 48`, the React frontend displays `"Cancel within 72 hours"`, and the Jest test asserts `hours <= 24`.
* **Configuration Drift:** `.env.example` claims `MAX_REDIS_CONNECTIONS=10`, while `config.py` raises an error if `MAX_REDIS_CONNECTIONS > 5`.
* **Schema Requirement Disagreement:** OpenAPI spec claims `phone_number` is optional, whereas backend validation (`zod` schema) throws an unhandled `400 Bad Request` if `phone_number` is omitted.

---

## 3. Challenge Your Own Idea First (Skeptical Analysis)

Before building, we critically evaluate and attempt to disprove the premise of a "Codebase Contradiction Detector".

### 3.1 Critical Questions & Rigorous Answers

#### Q1: What exactly counts as a contradiction vs. a wording difference?
* **Answer:** A contradiction requires **mutually exclusive claims** on the exact same domain entity or parameter.
  * *Wording difference (NOT a contradiction):* "Retrieves user profile" vs. "Fetches profile info for a user".
  * *Contradiction:* Claim "Parameter `timeout` is in milliseconds" (Doc) vs. Claim `setTimeout(fn, timeout * 1000)` (Code treating input as seconds).

#### Q2: What is merely missing or incomplete documentation vs. a true contradiction?
* **Answer:** Missing documentation is silence. A contradiction requires two or more **active claims** that cannot simultaneously be true in the runtime or operational domain.

#### Q3: Which contradictions are actually dangerous?
* **Answer:** High-risk contradictions cause:
  1. Production runtime errors (unhandled nulls, schema parameter mismatches).
  2. Silent business logic errors (wrong grace period applied in code vs. display UI).
  3. Security gaps (docs claim endpoint requires `AdminRole`, code omits auth middleware).

#### Q4: Which contradictions can be detected deterministically?
* **Answer:** Structural and type mismatches: Route string comparisons, env key presence, regex parameter extractions, TypeScript type vs. OpenAPI type discrepancies, and missing exported function arguments.

#### Q5: Which require semantic / LLM reasoning?
* **Answer:** Extracting natural language claims from Markdown/JSDoc and comparing business logic rule assertions against AST-extracted logic representations.

#### Q6: What would create massive false positives?
* **Answer:** 
  * Analyzing deprecated code/docs without lifecycle awareness.
  * Treating test mocks or fixtures as production code truth.
  * Mismatching variable names across contexts.
  * Ignoring environment overlays (`config.dev.json` vs `config.prod.json`).

#### Q7: How do we prevent developer distrust?
* **Answer:** The engine MUST focus exclusively on **substantive claim contradictions** with high impact, backed by direct source code/doc evidence proofs, validated by a deterministic safety layer.

#### Q8: What part of this idea is genuinely novel?
* **Answer:** **Cross-artifact multi-source claim synthesis**. Existing tools check 1:1 relationships (e.g., OpenAPI vs. Route). Our system correlates **N sources simultaneously** using a **Lightweight Context Graph** anchored on extracted **Claims**.

---

## 4. Research Existing Solutions & Competitive Landscape

### 4.1 Detailed Competitor & Related Project Audit

| Tool / Project | Primary Function | Input Sources | Detection Mechanism | Limitations / Gaps | How We Differ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Spectral / Stoplight** | OpenAPI / AsyncAPI linting | OpenAPI specs | Deterministic JSON/YAML rules | Only checks spec formatting/conventions; ignores backend implementation code | We compare OpenAPI specs directly against AST route definitions & Zod validation |
| **DocuGardener / FluentDocs** | Documentation staleness detection | Markdown files + Git history | Git commit timestamp heuristics | Assumes doc age = stale doc; does NOT analyze actual semantic claims | We prove falsehood by extracting explicit claims and verifying against AST via a safety layer |
| **Drift / Drift.dev** | Architecture drift analysis | Code + Spec + DB | Static analysis heuristics | Focuses primarily on DB schema vs ORM; high setup friction | We offer zero-config instant multi-source scanning across code, config, docs, and tests |
| **GenLint / Semantic Linters** | LLM-based code quality linting | Source code files | Prompted LLM review | Analyzes files in isolation; high hallucination rate; no graph context | We construct a Lightweight Context Graph first, using LLM for claim extraction & deterministic validation as safety |

### 4.2 Our Substantive Differentiation Thesis
We are **NOT** a documentation linter. We are a **Codebase Contradiction Engine**.
1. **Central Claim Abstraction:** Every entity is analyzed via explicit, normalized claims extracted from artifacts.
2. **Multi-Source Evidence Matrix:** Alerts show 3-way comparisons (e.g., README vs. OpenAPI vs. Express Controller).
3. **Deterministic Safety Layer:** AST & schema parsing acts as the primary safety layer to validate LLM claim assertions and eliminate hallucinations.
4. **Probabilistic Source of Truth Scoring:** Scores which source is likely correct using probabilistic heuristics (execution path, test coverage, recency).

---

## 5. Product Definition, Target Persona & Value Proposition

### 5.1 One-Sentence Product Definition
> **Codebase Contradiction Detector is an automated repository intelligence engine that constructs a lightweight context graph around claims to discover, prove, and highlight conflicting truths across source code, documentation, specifications, tests, and configuration files.**

### 5.2 Primary User
* **The Tech Lead / Senior Full-Stack Engineer / Code Reviewer**
  * *Why:* They bear the burden of architecture drift, customer-reported API discrepancies, broken developer onboarding, and risky refactoring.

### 5.3 Core Job to Be Done (JTBD)
> *"When I am reviewing PRs, onboarding to a repository, or auditing an API, I want to instantly identify where docs, tests, frontend code, and backend code make contradictory claims about system behavior, so I can eliminate hidden bugs and prevent developer confusion without manually cross-referencing files."*

### 5.4 Core Value Proposition
* **Low False-Positive Rate via Evidence Proofs & Deterministic Safety:** Every alert presents verbatim quotes and line references from 2+ conflicting sources, validated by AST verification.
* **Rapid Onboarding Audit:** Scans local repositories efficiently and renders an interactive **Truth Disagreement Map**.
* **Probabilistic Truth Scoring:** Provides transparent likelihood scoring for source-of-truth candidates to guide resolution.

---

## 6. Contradiction Taxonomy & Scope Boundaries

We classify codebase contradictions into core categories:

```
                      ┌─────────────────────────────────────────┐
                      │    CODEBASE CONTRADICTION TAXONOMY      │
                      └────────────────────┬────────────────────┘
                                           │
         ┌───────────────────┬─────────────┴───────┬───────────────────┐
         │                   │                     │                   │
┌────────┴────────┐ ┌────────┴────────┐   ┌────────┴────────┐ ┌────────┴────────┐
│  A. Structural  │ │  B. Behavioral  │   │ C. API / Spec   │ │D. Configuration │
└─────────────────┘ └─────────────────┘   └─────────────────┘ └─────────────────┘
         │
┌────────┴────────┐
│   E. Testing    │
└─────────────────┘
```

### 6.1 Taxonomy Detailed Breakdown

| Category | Description & Example | Sources Involved | Detection Method | Status |
| :--- | :--- | :--- | :--- | :--- |
| **A. Structural** | Route path mismatch: OpenAPI `/v1/user` vs Express `/api/users` | OpenAPI, Express AST | Deterministic AST + Regex Matcher | **KEEP (MVP)** |
| **B. Behavioral** | Timeout parameter claim: README claims "seconds", code treats input as "ms" | README, Code AST | Hybrid (LLM Claim Extraction + AST Verification) | **KEEP (MVP)** |
| **C. API / Contract** | Required parameter mismatch: Zod schema `.nonempty()` vs OpenAPI `required: []` | Zod/TS interfaces, OpenAPI YAML | Deterministic Schema Parser | **KEEP (MVP)** |
| **D. Configuration** | Env var drift: `.env.example` lists `PORT=8080`, `config.ts` reads `HTTP_PORT` | `.env.example`, Code AST | Deterministic AST Grep + Parser | **KEEP (MVP)** |
| **E. Testing** | Inverted test assertion: Doc claims "returns 404", test asserts 200 with `null` body | Markdown docs, Test AST, Controller code | Hybrid (AST Assert Extraction + LLM Claim Compare) | **KEEP (MVP)** |
| **F. Architectural** | Layer violation / pattern drift | ADR Markdown, React AST | Rule Graph + AST | **DEFER** |
| **G. Historical** | Commit log intent conflict | Git log, Code AST | Git archaeology | **DEFER** |

---

## 7. Central Abstraction: The Claim & Contradiction Model

To eliminate noise, our engine models all software artifacts as sets of explicit **Claims** over domain **Subjects**.

### 7.1 Formal Claim Abstraction
A **Claim** $K$ is a tuple representing an explicit assertion extracted from an artifact:
$$K = \langle \mathcal{A}, S, P, E \rangle$$

Where:
* $\mathcal{A}$ is the **Artifact Source** (e.g., `README.md`, `checkout.ts`, `openapi.yaml`).
* $S$ is the **Subject / Domain Entity** (e.g., `POST /api/v1/checkout`, `cancellation_grace_period`, `MAX_REDIS_CONNECTIONS`).
* $P$ is the **Normalized Assertion Predicate** (e.g., `grace_period_hours == 24`).
* $E$ is the **Evidence Anchor** (exact file path, line numbers, and raw snippet).

A **Contradiction** $C$ exists when two or more Claims $K_\mathcal{A}$ and $K_\mathcal{B}$ address the same Subject $S$ with mutually exclusive predicates:
$$\phi(P_\mathcal{A}, P_\mathcal{B}) = \text{True} \quad \implies \quad K_\mathcal{A} \text{ conflicts with } K_\mathcal{B}$$

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CENTRAL CLAIM & CONTRADICTION MODEL                   │
│                                                                        │
│   Subject (S): "user_cancellation_period"                              │
│                                                                        │
│   Claim A [README.md: L42-43]:                                         │
│     Predicate: cancellation_grace_period == 24 hours                   │
│                                                                        │
│   Claim B [CancelController.ts: L105-108]:                             │
│     Predicate: cancellation_grace_period == 48 hours                   │
│                                                                        │
│   Deterministic Safety Check: AST lines match code & line numbers.     │
│   Probabilistic Truth Inference: Controller (0.75), README (0.25)     │
│   ==> CONTRADICTION CONFIRMED                                          │
└────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Classification Rules
* **True Contradiction:** Claims are mutually exclusive on subject $S$.
* **Missing Information:** Source A makes Claim $K_\mathcal{A}(S)$; Source B makes no claim on $S$.
* **Harmless Wording Difference:** $K_\mathcal{A}(S)$ and $K_\mathcal{B}(S)$ map to equivalent logical predicates despite differing phraseology.

---

## 8. Evidence-First Finding Schema

Every finding returned by the engine is centered on conflicting **Claims** backed by structured evidence proofs.

### 8.1 TypeScript Schema (`ContradictionFinding.ts`)

```typescript
export type ContradictionCategory = 
  | 'STRUCTURAL' 
  | 'BEHAVIORAL' 
  | 'API_CONTRACT' 
  | 'CONFIGURATION' 
  | 'TESTING';

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ExtractedClaim {
  id: string;
  artifactId: string;        // e.g., "file:src/controllers/user.ts"
  filePath: string;          // e.g., "src/controllers/user.ts"
  startLine: number;
  endLine: number;
  sourceType: 'CODE' | 'DOCS' | 'SPEC' | 'CONFIG' | 'TEST';
  rawSnippet: string;        // Exact lines extracted
  assertion: string;         // Normalized statement or parsed rule
  symbolName?: string;       // e.g., "cancelSubscription"
}

export interface ContradictionFinding {
  id: string;                         // Unique finding identifier
  subject: string;                    // Domain entity / symbol under inspection
  category: ContradictionCategory;
  title: string;                      // Short summary
  summary: string;                    // Narrative explanation of contradiction
  conflictingClaims: ExtractedClaim[];// 2 or more conflicting claims
  incompatibilityReason: string;      // Formal statement of claim conflict
  confidenceScore: number;            // Probabilistic score (0.00 to 1.00)
  severity: SeverityLevel;
  probabilisticSourceOfTruth: {
    filePath: string;
    probability: number;              // Estimated likelihood (0.00 to 1.00)
    reasoning: string;                // Probabilistic heuristic explanation
  };
  status: 'OPEN' | 'RESOLVED' | 'IGNORED';
}
```

---

## 9. Deterministic Safety Layer & False Positive Mitigation

To guarantee high signal-to-noise quality, deterministic validation acts as the **mandatory safety layer** around all LLM claim extractions and semantic comparisons.

```
Raw Extracted Claims
          │
          ▼
┌─────────────────────────────────────────┐
│ Tier 1: Scope & Pattern Filtering       │ --> Exclude /node_modules, /dist, build artifacts
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ Tier 2: Deterministic AST & Regex Proof │ --> Safety Layer: Validate raw snippets & line numbers against disk
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ Tier 3: Environmental / Overlay Check   │ --> Identify intentional dev vs prod env differences
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ Tier 4: Hybrid Semantic Claim Compare   │ --> Validate mutual exclusion on normalized predicates
└─────────────────┬───────────────────────┘
                  │
                  ▼
Validated High-Confidence Contradiction Finding
```

### 9.1 Confidence Scoring Formulation
Confidence is computed via a probabilistic scoring heuristic:
$$\text{Confidence} = (W_{det} \cdot S_{det}) + (W_{ast} \cdot S_{ast}) + (W_{llm} \cdot S_{llm}) - P_{env}$$

Where:
* $S_{det} \in \{0,1\}$: Deterministic parsing match verification.
* $S_{ast} \in \{0,1\}$: AST symbol resolution score.
* $S_{llm} \in [0,1]$: Semantic claim incompatibility score.
* $P_{env}$: Penalty for test fixture or intentional environment overlay differences.

---

## 10. Lightweight Repository Context Graph (RCG)

To correlate claims across disparate files without heavy infrastructure, we build an **in-memory Lightweight Context Graph**.

```
       ┌───────────────────┐
       │   README.md       │
       └─────────┬─────────┘
                 │ (contains)
                 ▼
       ┌───────────────────┐       (addresses)       ┌───────────────────┐
       │   Doc Claim A     │ ──────────────────────> │ Domain Subject S  │
       └───────────────────┘                         └─────────▲─────────┘
                                                               │ (addresses)
       ┌───────────────────┐       (contains)        ┌─────────┴─────────┐
       │ Express Route AST │ ──────────────────────> │   Code Claim B    │
       └───────────────────┘                         └───────────────────┘
```

### 10.1 Key Graph Entities & Edges
1. **Nodes**: `Artifact` (File), `Claim` (Extracted assertion), `Subject` (Domain symbol/route/key).
2. **Edges**:
   * `Artifact` $\rightarrow \text{CONTAINS} \rightarrow$ `Claim`
   * `Claim` $\rightarrow \text{ADDRESSES} \rightarrow$ `Subject`
   * `Claim A` $\rightarrow \text{CONFLICTS\_WITH} \rightarrow$ `Claim B`

---

## 11. MVP Scope & Prioritization Matrix (KEEP / CHANGE / DEFER)

### 11.1 Priority Categorization

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MVP SCOPE MATRIX                                │
├───────────────────────────────────┬────────────────────────────────────┤
│ KEEP (Core Scope)                 │ CHANGE (Refined Focus)             │
│ • Multi-source contradiction check│ • Make "Claim" central abstraction │
│ • Evidence-first findings         │ • Probabilistic source-of-truth    │
│ • AST-backed verification         │ • Remove unverified performance %s │
│ • Lightweight in-memory graph     │ • Keep graph lightweight           │
│ • Deterministic + semantic hybrid │ • Deterministic safety layer       │
│ • Synthetic demo repository       │                                    │
│ • 3-way hero contradiction demo   │                                    │
├───────────────────────────────────┴────────────────────────────────────┤
│ DEFER (Explicitly Out of MVP Scope)                                    │
│ • Automated Patch / PR Generation (Suggested diff fixes)              │
│ • Git Archaeology & Commit History Parsing                             │
│ • Architectural Layer / Pattern Drift Analysis                         │
│ • Multi-Language Support (Focus strictly on JS/TS, YAML, Markdown, .env)│
│ • Enterprise Graph DBs & Distributed Multi-Repo Infrastructure         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Recommended Technical Architecture

### 12.1 Selected Architecture: Next.js + Node.js Engine
We select a unified Next.js App Router & Node.js Engine stack for crisp presentation and direct AST access.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SYSTEM ARCHITECTURE                             │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                 Frontend (Next.js 14 + Tailwind)               │   │
│   │   • Health Score Dial        • Contradiction List & Filters    │   │
│   │   • Split Evidence Viewer    • Lightweight Context Graph View  │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ REST / Server Actions              │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │                 Core Engine (Node.js/TypeScript)               │   │
│   │                                                                │   │
│   │   ┌───────────────────┐    ┌───────────────────────────────┐   │   │
│   │   │ Artifact Parsers  │    │ Lightweight Context Graph     │   │   │
│   │   │ (ts-morph, yaml)  │ ──>│ (In-Memory Claims & Subjects) │   │   │
│   │   └───────────────────┘    └───────────────┬───────────────┘   │   │
│   │                                            │                   │   │
│   │   ┌────────────────────────────────────────▼───────────────┐   │   │
│   │   │ Deterministic Safety & Hybrid Claim Engine             │   │   │
│   │   │ • Route Path Matcher    • Env Key Parser               │   │   │
│   │   │ • Schema Validator      • LLM Claim Extraction & Compare│   │   │
│   │   └────────────────────────────────┬───────────────────────┘   │   │
│   └────────────────────────────────────┼───────────────────────────┘   │
│                                        │ API Calls                     │
│   ┌────────────────────────────────────▼───────────────────────────┐   │
│   │               LLM Layer (Gemini 3.7 / OpenAI)                  │   │
│   │   • Structured Claim Extraction & Comparison Prompts           │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 13. End-to-End Analysis Pipeline Specification

```
   [1. Repo Ingestion]  ──> Index files, discover target artifacts
            │
            ▼
  [2. Claim Extraction] ──> Extract AST definitions, OpenAPI schemas, .env keys, Markdown claims
            │
            ▼
   [3. Graph Linking]   ──> Connect Artifacts -> Claims -> Domain Subjects in lightweight graph
            │
            ▼
[4. Safety & Matcher]   ──> Run deterministic matchers (routes, env keys, schema types)
            │
            ▼
 [5. Semantic Compare]  ──> Run hybrid LLM comparison on extracted claims over identical subjects
            │
            ▼
 [6. Probabilistic Scoring]─> Compute confidence & probabilistic source-of-truth score
            │
            ▼
  [7. Finding UI Render]──> Present findings with split evidence view in Web Dashboard
```

---

## 14. Deterministic vs. LLM Engine Matrix

| Analysis Task | Deterministic | LLM | Hybrid Approach | Deterministic Safety Role |
| :--- | :---: | :---: | :---: | :--- |
| **API Endpoint Path Matching** | **X** | | | String parsing/regex on AST routes vs YAML specs is 100% exact. |
| **Env Variable Key Audit** | **X** | | | Comparing `.env.example` keys to `process.env` AST nodes is exact. |
| **OpenAPI Parameter Required Check** | **X** | | | Comparing OpenAPI `required` array with Zod schema properties is exact. |
| **Doc Natural Language Claim Extraction** | | **X** | | LLM extracts structured claim statements from free-form Markdown text. |
| **Behavioral Claim Comparison** | | | **X** | AST extracts function logic; LLM compares logic claim against doc claim. |
| **Probabilistic Source of Truth** | | | **X** | Deterministic test coverage + AST execution path feed probabilistic scorer. |

---

## 15. User Experience & Hero Demo Script

### 15.1 Hero Demo Narrative (2-Minute Script)
* **0:00 - 0:15 (The Hook):** *"Every codebase lies to itself. Docs claim one thing, OpenAPI specs declare another, and code does a third. Today we launch Codebase Contradiction Detector."*
* **0:15 - 0:30 (The Trigger):** Click **"Scan Repository"**. The lightweight claims graph builds live in seconds.
* **0:30 - 1:15 (The Hero 3-Way Disagreement):** Open **"Cancellation Window Mismatch"**. Display the 3-pane split evidence viewer:
  * Pane 1 (Doc): `README.md` claims *"24 hours refund window"*.
  * Pane 2 (Spec): `openapi.yaml` defines `cancelGracePeriodHours: 24`.
  * Pane 3 (Backend Code): Express controller executes `if (hours > 48) return res.status(400)`.
* **1:15 - 1:45 (The Proof & Deterministic Safety):** Show exact line anchors backed by AST line verification. Engine displays probabilistic source-of-truth ranking (`CancelController.ts`: 75% likelihood due to active execution & test coverage).
* **1:45 - 2:00 (The Takeaway):** Highlight instant multi-source claim cross-referencing and zero-guesswork evidence proofs.

---

## 16. Realistic Synthetic Demo Repository (`demo-repo/`)

We construct a target synthetic repository (`demo-repo/`) containing 5 realistic contradiction scenarios:

1. **Scenario 1 (API Route Drift):** `README.md` claims `POST /api/v1/auth/login`, while `routes/auth.ts` exposes `POST /api/v1/auth/token`.
2. **Scenario 2 (3-Way Grace Period Discrepancy - HERO DEMO):** `README.md` claims 24-hour cancellation; `openapi.yaml` specifies 24 hours; `controllers/subscription.ts` enforces 48 hours.
3. **Scenario 3 (Environment Config Drift):** `.env.example` defines `ENABLE_RATE_LIMITING=true`, but `config/app.ts` reads `RATE_LIMIT_ENABLED`.
4. **Scenario 4 (Required Parameter Schema Conflict):** `openapi.yaml` marks `taxId` as optional; `controllers/billing.ts` Zod schema requires `taxId`.
5. **Scenario 5 (Test Assertion Conflict):** Doc claims *"Returns 401 Unauthorized for expired tokens"*, but `auth.test.ts` asserts `403 Forbidden`.

---

## 17. Internal Evaluation Suite (`npm run eval`)

We maintain an evaluation script to verify engine performance against `demo-repo/`:

* **Contradiction Recall:** High detection rate across all target demo scenarios.
* **Safety Verification:** 100% of reported claims verified against exact line numbers on disk.
* **Scan Speed:** Fast local execution.

---

## 18. Implementation Coding Plan

Execute implementation steps in sequence using **LatentCode**:

```text
STEP 1: Initialize Workspace & Project Scaffold
        - Setup Next.js 14 project with Tailwind CSS & App Router.
        - Create directory structure: /src/engine, /src/components, /demo-repo.

STEP 2: Construct Synthetic Target Repository (/demo-repo)
        - Scaffold 5 contradiction scenarios across code, docs, spec, env, tests.

STEP 3: Implement Engine Core & Parsers
        - Build file discovery module & artifact classifiers.
        - Implement TS/JS AST parser using ts-morph / babel.
        - Implement OpenAPI YAML parser & .env parser.

STEP 4: Implement Central Claim Model & Lightweight Graph
        - Build in-memory graph connecting Artifacts, Extracted Claims, and Subjects.

STEP 5: Build Deterministic Matchers & Safety Layer
        - Route Path Matcher (OpenAPI vs Code AST).
        - Config Key Matcher (.env.example vs process.env AST).
        - Schema Parameter Matcher.
        - AST Line Anchor Verifier (Safety layer).

STEP 6: Build LLM Hybrid Claim Asserter
        - Claim extraction prompts with structured JSON outputs.
        - Semantic claim incompatibility comparator.

STEP 7: Build Evidence & Probabilistic Truth Synthesizer
        - Combine deterministic & LLM claim results.
        - Compute probabilistic source-of-truth score.

STEP 8: Build Frontend Dashboard UI
        - Header & Health Score Dial component.
        - Contradiction List & Category Filter tabs.
        - Interactive Split-Pane Evidence Viewer (3-way hero proof).
        - Lightweight Context Graph Explorer.

STEP 9: Verification & Benchmark Run
        - Execute `npm run eval` against /demo-repo.
        - Ensure robust execution on demo scenarios.
```
