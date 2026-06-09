# ChainSentry 🛡️

Secure, automated on-chain exception forensics. ChainSentry diagnoses application runtime crash logs using smart analytical engines and permanently anchors cryptographic diagnostic signatures on the blockchain to guarantee absolute log integrity.

ChainSentry is structured as a dual-component project:
1. **Browser Extension (`/new`)**: A self-contained, login-free browser extension (Firefox Manifest V3 compliant) that runs entirely client-side using browser local storage.
2. **Local Web Server (`server.js`)**: An Express Node.js backend providing standard API endpoints for telemetry ingestion, MongoDB storage, and Web3 EVM node communication.

---

## Key Features

* **Smart Diagnostics**: Paste raw stack traces or exceptions to get a plain-English explanation of why the crash occurred and how to fix it.
* **Cryptographic Signatures**: Automatically hashes crash telemetry and diagnosis reports using native SHA-256 logic.
* **Immutability (On-Chain Anchoring)**: Records telemetry signatures to an EVM smart contract, creating a permanent, tamper-proof audit trail of system exceptions.
* **Auditing & Verification**: Compare local database records against the smart contract ledger to detect any post-incident log tampering.
* **Zero-Setup Extension**: The browser extension operates immediately out-of-the-box using built-in diagnostic rule fallbacks and mock blockchain signatures. No configuration or login required.

---

## Why ChainSentry?

### 1. Uniqueness (AI + Blockchain Forensics)
Traditional application performance monitoring (APM) and logging tools (e.g., Sentry, Datadog, LogRocket) collect telemetry data on centralized servers. This model poses two risks:
* **Tamper Risk**: Anyone with administrative database privileges (or an attacker) can alter or delete logs post-incident to hide system failure or developer error.
* **Privacy & Centralization**: Traces are stored in proprietary cloud databases, requiring paid subscriptions and account logins.

**ChainSentry is unique because it combines local smart analysis with a decentralized trust model**:
* **Math-Backed Verification**: It anchors log signatures directly on a public blockchain ledger. The record is immutable, permanent, and cryptographically verifiable.
* **Zero Log Exposure**: The raw logs are never sent to the blockchain (which only stores the cryptographic SHA-256 hash), ensuring strict privacy.
* **Fully Decentralized Popup**: Requires no database setup, no cloud logins, and runs 100% locally in your browser.

### 2. High Stability (Intelligent Fallbacks)
ChainSentry is engineered with multi-layered fallbacks to guarantee high runtime stability under any network condition:
* **Diagnostic Fallback**: If no cloud-based API Access Key is configured (or if the API is offline), the extension automatically falls back to an offline rule-based parser that detects common exceptions (e.g., Null Pointers, Out of Memory, network timeouts) locally.
* **Web3/Blockchain Fallback**: If an EVM RPC URL is not provided, or if the blockchain network is unreachable, ChainSentry automatically operates in **Simulation Mode**—generating simulated cryptographic transaction hashes so you can still log and audit records instantly.
* **Storage Fallback**: Bypasses external servers completely by using native browser storage (`browser.storage.local`), ensuring data is always accessible offline.

### 3. Real-World Use Cases

#### Scenario A: The Fintech Audit Trial (Preventing Log Tampering)
* **The Problem**: A finance platform experiences a connection timeout during a market run, causing a client's transaction to fail. Fearing repercussions, a system administrator manually alters the server database log to show "User Input Error" instead of a system crash.
* **The Solution**: Since the system automatically hashed and anchored the original crash telemetry on the blockchain at the moment of failure, the platform auditor runs a check via ChainSentry. The audit verification fails immediately, triggering a `TAMPER WARNING` because the edited log signature does not match the immutable blockchain ledger.

#### Scenario B: Developer-Client SLA Verification (Proof of Fault)
* **The Problem**: A freelance developer delivers a web application. A few days later, the client complains that the application is broken and demands a refund. The developer has no access to the client's staging environment and cannot prove who is at fault.
* **The Solution**: The client runs the ChainSentry browser extension and imports the logs. The Smart Diagnostic Engine analyzes the stack trace and outputs: *`OutOfMemory: Server ran out of heap space. The server is allocated 512MB RAM but you uploaded a 10GB product video catalog.`* This diagnosis is verified on-chain, proving the issue is due to resource abuse rather than developer code defect, resolving the dispute objectively.

---

## Repository Structure

```
├── contracts/          # Solidity smart contracts (ChainSentry.sol)
├── models/             # MongoDB schema definitions
├── services/           # Web3 blockchain integration scripts
├── new/                # Firefox Browser Extension bundle (Manifest V3)
│   ├── manifest.json   # Extension configuration
│   ├── popup.html      # Popup dashboard & settings layout
│   ├── popup.css       # Visual styles
│   ├── popup.js        # Hashing, local storage, API and Ethers logic
│   ├── ethers.umd.min.js # Localized Web3 ethers library
│   └── icon.svg        # Custom vector logo asset
├── public/             # Web application static folder (matches extension)
├── server.js           # Node.js backend server
├── package.json        # Dependencies and scripts
└── README.md           # This document
```

---

## How to Install and Use (Beginner-Friendly 🚀)

You do NOT need to be a programmer to run the ChainSentry browser extension. Select the option below that fits your background.

---

### Option A: Use the Browser Extension (No Coding Required)

This is the easiest way to use ChainSentry. It runs completely inside your browser and doesn't require setting up any servers or databases.

#### Prerequisites:
* You only need the **Firefox** web browser installed on your computer.

#### Easy 3-Step Setup:
1. **Load the Extension into Firefox**:
   * Open your Firefox browser.
   * Type **`about:debugging`** in the address bar at the top and press Enter.
   * Click **"This Firefox"** in the left-hand menu.
   * Click the **"Load Temporary Add-on..."** button.
   * Navigate to the project folder, open the **`new/`** directory, and select the **`manifest.json`** file.
2. **Open the Dashboard**:
   * You will see a glowing blue shield icon in your Firefox toolbar (top-right). Click it to open your dashboard!
3. **Run a Test Ingestion**:
   * Paste any crash error (e.g. `Uncaught TypeError: Cannot read properties of null`) into the box and click **Analyze & Anchor Telemetry**.
   * It will instantly diagnose the issue and create a simulated audit receipt.
   * *(Optional: If you want to use live blockchain anchoring or deep cloud models, click the **Configuration** tab in the popup and add your custom API Keys/wallet credentials).*

---

### Option B: Run the Developer Web Server (For Coders)

If you want to run the centralized web application and Express server on your local machine, use this path.

#### Prerequisites:
* **Node.js** (v16+) installed.
* **MongoDB** database (Optional: the server automatically falls back to memory mode if MongoDB is offline).

#### Setup Steps:
1. **Open your Terminal** (or Command Prompt) in the project folder directory.
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables (Optional)**:
   * Create a file named `.env` in the root folder of the project.
   * Paste these lines and replace with your actual keys if desired:
     ```env
     PORT=5000
     MONGODB_URI=mongodb://127.0.0.1:27017/chainsentry
     
     # Web3 Config (Optional)
     RPC_URL=https://rpc.ankr.com/eth_sepolia
     WALLET_PRIVATE_KEY=0x...
     CONTRACT_ADDRESS=0x...
     
     # API Config (Optional)
     GEMINI_API_KEY=your_key_here
     ```
4. **Start the server**:
   ```bash
   npm start
   ```
5. **Open the dashboard**:
   * Open your web browser and go to [http://localhost:5000](http://localhost:5000) to view the live dashboard.

---

## Smart Contract

The core smart contract logic is defined in `contracts/ChainSentry.sol`. It ensures that once a forensic signature is registered on-chain for a unique incident ID, it cannot be edited or overwritten.

```solidity
function recordIncident(string calldata incidentId, string calldata forensicHash) external returns (bool);
function getIncidentHash(string calldata incidentId) external view returns (string memory);
```

---

## License

This project is licensed under the [MIT License](LICENSE).
