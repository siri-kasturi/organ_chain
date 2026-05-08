# OrganChain — Blockchain-Based Organ Donation & Transplantation System

A production-grade **Corda CorDapp** for organ donation and transplantation, featuring full AES-256-GCM encryption of all personal and medical data on the ledger, a dedicated MatchingAuthority node for privacy-preserving compatibility analysis, and a Spring Boot REST API with an HTML/CSS/JS frontend.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Corda Network (TLS P2P)                         │
│                                                                      │
│  HospitalA        HospitalB       MatchingAuthority                  │
│  :10005/:8080     :10008/:8081    :10011/:8082                       │
│  ┌─────────┐      ┌─────────┐     ┌──────────────────────┐          │
│  │Register │      │Register │     │ Decrypt (MA key)     │          │
│  │Donor    │──────│Recipient│────▶│ Algorithm 1 (match)  │          │
│  │Encrypt  │      │Encrypt  │     │ Notify hospitals     │          │
│  └─────────┘      └─────────┘     └──────────────────────┘          │
│                                                                      │
│  AdminNode        Government      Transporter                        │
│  :10014/:8083     :10017          :10020                             │
│  Confirm/Reject   Audit only      Dispatch organ                     │
│                                                                      │
│  Notary (non-validating)  :10002  — uniqueness service               │
└──────────────────────────────────────────────────────────────────────┘
```

### Encryption Model

| What is stored on ledger | Encryption  |
|---|---|
| Donor name, contact | AES-256-GCM · PII key (hospital-local) |
| Donor blood type, organ type, age, weight, height, location, deceased flag | AES-256-GCM · **medical key** (MatchingAuthority decrypt authority) |
| Recipient name, contact | AES-256-GCM · PII key |
| Recipient blood type, organ needed, age, weight, height, condition score, serial #, paired donor flag, location | AES-256-GCM · **medical key** |
| Match status, score, organ type, party references | **Plaintext** (operational metadata only) |

Decryption of medical fields occurs **only** inside `OrganMatchingFlow` and `NotifyMatchedPartiesFlow`, running exclusively on the MatchingAuthority node.

---

## Prerequisites

| Tool | Version |
|---|---|
| Java | 17 |
| Kotlin | 1.9 |
| Gradle | 7.x (wrapper included) |
| Corda | 4.x (set in `constants.properties`) |
| Node.js | Not required — frontend is plain HTML/JS |

---

## Quick Start

### 1. Build & deploy the Corda network

```bash
# Build all modules and deploy 7 local nodes
./gradlew deployNodes

# Start all nodes
cd build/nodes
./runnodes
```

Nodes start in separate terminal windows. Wait until you see `Node started up and registered` in each window (may take 2–3 minutes).

### 2. Start Spring Boot servers

Each node that exposes a REST API needs its own server instance.

```bash
# Terminal 1 — HospitalA (port 8080)
cd clients
../gradlew bootRun --args='--config.rpc.host=localhost --config.rpc.port=10006 --config.rpc.username=hospitalA --config.rpc.password=HospA@2024 --server.port=8080'

# Terminal 2 — HospitalB (port 8081)
../gradlew bootRun --args='--config.rpc.host=localhost --config.rpc.port=10009 --config.rpc.username=hospitalB --config.rpc.password=HospB@2024 --server.port=8081'

# Terminal 3 — MatchingAuthority (port 8082) — REQUIRED for matching
../gradlew bootRun --args='--config.rpc.host=localhost --config.rpc.port=10012 --config.rpc.username=matchingAuth --config.rpc.password=MatchAuth@2024 --server.port=8082'

# Terminal 4 — AdminNode (port 8083)
../gradlew bootRun --args='--config.rpc.host=localhost --config.rpc.port=10015 --config.rpc.username=admin --config.rpc.password=Admin@2024 --server.port=8083'
```
# Govt Node(port 8084)
../gradlew bootRun --args='--config.rpc.host=localhost --config.rpc.port=10018 --config.rpc.username=govt --config.rpc.password=Govt@2024 --server.port=8084'

cd clients
../gradlew bootRun --args='--config.rpc.host=localhost --config.rpc.port=10021 --config.rpc.username=transporter --config.rpc.password=Trans@2024 --server.port=8085'
### 3. Open the frontend

Open `index.html` in a browser. Select a node, enter credentials, and start using the system.

---

## Node Credentials

| Node | Username | Password | Spring Boot Port |
|---|---|---|------------------|
| HospitalA | `hospitalA` | `HospA@2024` | 8080             |
| HospitalB | `hospitalB` | `HospB@2024` | 8081             |
| MatchingAuthority | `matchingAuth` | `MatchAuth@2024` | 8082             |
| AdminNode | `admin` | `Admin@2024` | 8083             |
| Government | `govt` | `Govt@2024` | 8084             |
| Transporter | `transporter` | `Trans@2024` | 8085             |

---

## Typical Workflow

```
1. HospitalA: POST /api/donor/register        (all fields encrypted before ledger write)
2. HospitalB: POST /api/recipient/register    (all fields encrypted before ledger write)
3. MatchingAuthority: POST /api/match/trigger/{donorId}
   └── MA decrypts both states
   └── Runs Algorithm 1 (blood type filter → score → cross-match)
   └── Creates MatchState (PENDING_CONFIRMATION)
4. AdminNode: POST /api/match/confirm/{matchId}
   └── MatchState → CONFIRMED
   └── MatchingAuthority sends MatchSummary to both hospitals via Corda P2P (TLS)
5. MatchingAuthority: GET /api/match/summary/{matchId}   (returns decrypted details)
6. AdminNode: POST /api/transport/dispatch/{matchId}
7. Transporter: POST /api/transport/update/{transportId}  (IN_TRANSIT → DELIVERED)
```

---

## API Reference

### Base URLs

| Node | Base URL |
|---|---|
| HospitalA | `http://localhost:8080` |
| HospitalB | `http://localhost:8081` |
| MatchingAuthority | `http://localhost:8082` |
| AdminNode | `http://localhost:8083` |

### Donor Endpoints

| Method | Path | Node | Description |
|---|---|---|---|
| POST | `/api/donor/register` | Hospital | Register donor (encrypts all fields) |
| GET | `/api/donor/list` | Any | List all DonorStates |
| GET | `/api/donor/available` | Any | List AVAILABLE donors |
| GET | `/api/donor/{linearId}` | Any | Get single donor by ID |

### Recipient Endpoints

| Method | Path | Node | Description |
|---|---|---|---|
| POST | `/api/recipient/register` | Hospital | Register patient (encrypts all fields) |
| GET | `/api/recipient/list` | Any | List all RecipientStates |
| GET | `/api/recipient/waiting` | Any | List WAITING recipients |
| GET | `/api/recipient/{linearId}` | Any | Get single recipient by ID |

### Matching Endpoints

| Method | Path | Node | Description |
|---|---|---|---|
| POST | `/api/match/trigger/{donorLinearId}` | **MatchingAuthority** | Decrypt + run Algorithm 1 |
| POST | `/api/match/confirm/{matchLinearId}` | AdminNode | Confirm + notify hospitals |
| POST | `/api/match/reject/{matchLinearId}` | AdminNode | Reject + reason |
| GET | `/api/match/list` | Any | All MatchStates |
| GET | `/api/match/pending` | Any | PENDING_CONFIRMATION only |
| GET | `/api/match/{linearId}` | Any | Single MatchState |
| GET | `/api/match/summary/{matchLinearId}` | **MatchingAuthority** | Decrypted match details |

### Transport Endpoints

| Method | Path | Node | Description |
|---|---|---|---|
| POST | `/api/transport/dispatch/{matchLinearId}` | AdminNode | Dispatch transport |
| POST | `/api/transport/update/{transportLinearId}` | Transporter | Update status |
| GET | `/api/transport/list` | Any | All TransportStates |
| GET | `/api/transport/{linearId}` | Any | Single TransportState |

---

## Matching Algorithm (Algorithm 1)

The `MatchingEngine` applies a weighted scoring system to rank compatible recipients:

| Criterion | Points | Notes |
|---|---|---|
| Location match (deceased donor) | +15 | city-level string equality |
| Confirmed paired donor (KPE) | +20 | Kidney Paired Exchange |
| BMI compatibility (diff ≤ 5 kg/m²) | +15 | weight/height² comparison |
| Age compatibility (diff ≤ 15 yrs) | +10 | |
| Clinical urgency (conditionScore × 5) | +5–50 | 10 = critical = 50 pts |
| Waitlist serial number tie-break | −0.001 × serial | earlier = slight bonus |

**Hard filters** applied before scoring:
1. Blood-type compatibility (ABO rules from companion object map)
2. Same organ type needed vs. available (filtered after decryption)

**Cross-match** (simulated ~10% negative rate in dev, replace with lab API in prod) is applied after scoring — the highest-scoring blood-compatible recipient with a positive cross-match wins.

---

## Security Notes

- **Production key ceremony**: run `openssl rand -base64 32` once, store in all nodes' `node.conf` under `custom.odat_medical_field_key`. Never commit the key to version control.
- **MatchingAuthority isolation**: in production, this node should be physically or network-isolated. Only its Spring Boot server (port 8082) should be accessible to the admin team.
- **Future upgrade path**: replace the symmetric medical key with an RSA/ECDH hybrid. Hospitals encrypt with the MA's public key; only the MA's private key can decrypt. This eliminates the key-distribution risk entirely.
- **TLS between nodes**: all Corda P2P communication uses mutual TLS (node identity certificates). The `MatchSummary` is transmitted over this channel — it is not written to the ledger.

---

## Project Structure

```
├── contracts/src/main/kotlin/com/odat/
│   ├── contracts/        DonorContract, RecipientContract, OrganMatchContract
│   ├── states/           DonorState, RecipientState, MatchState, TransportState, DecryptedData
│   └── enums/            BloodType, OrganType, DonorStatus, RecipientStatus, MatchStatus…
│
├── workflows/src/main/kotlin/com/odat/
│   ├── flows/            RegisterDonorFlow, RegisterRecipientFlow,
│   │                     OrganMatchingFlow, NotifyPartiesFlow,
│   │                     MatchConfirmationFlow, TransportFlow, FlowUtils
│   └── services/         AESUtils, KeyVaultService, MatchingEngine
│
├── clients/src/main/kotlin/com/odat/webserver/
│   ├── ODaTServer.kt
│   ├── config/           NodeRPCConnection, CorsConfig, JacksonConfig
│   ├── controllers/      DonorController, RecipientController,
│   │                     MatchingController, TransportController
│   └── models/           ApiModels (request/response DTOs)
│
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js
```

---

## Research Traceability

| Design Decision | Source |
|---|---|
| Corda over Ethereum | Privacy model + notary-based double-allocation prevention |
| AES-256-GCM full-field encryption | ODaT paper §3.2 — "sensitive data encrypted before ledger storage" |
| MatchingAuthority as sole decryption authority | ODaT paper §4.1 — "decryption key provided only to matching authority" |
| Blood-type compatibility matrix | ABO compatibility rules (transfusion medicine standard) |
| Weighted scoring algorithm (Algorithm 1) | BOMS paper §4 — six-criterion weighted matching |
| KPE (Kidney Paired Exchange) +20 pts bonus | BOMS paper §4.3 |
| conditionScore × 5 urgency weighting | ODaT paper §3.4 |
| Post-confirmation P2P notification | ODaT paper §4.2 — "decrypted details securely passed to parties" |
| Indriya role separation (Hospital vs Admin) | Indriya (Hyperledger Fabric) paper §5 |
