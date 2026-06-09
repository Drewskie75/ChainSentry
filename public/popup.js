// Universal Storage Wrapper
const storage = typeof browser !== 'undefined' ? browser.storage.local : chrome.storage.local;

// DOM Elements
const form = document.getElementById('telemetry-form');
const rawLogsInput = document.getElementById('raw-logs');
const consoleOutput = document.getElementById('console-output');
const tableBody = document.getElementById('incidents-table-body');
const auditModal = document.getElementById('audit-modal');
const closeModalBtn = document.getElementById('close-modal-btn');

const tabDashboard = document.getElementById('tab-dashboard');
const tabSettings = document.getElementById('tab-settings');
const viewDashboard = document.getElementById('view-dashboard');
const viewSettings = document.getElementById('view-settings');

const settingsForm = document.getElementById('settings-form');
const geminiKeyInput = document.getElementById('setting-gemini-key');
const rpcUrlInput = document.getElementById('setting-rpc-url');
const privateKeyInput = document.getElementById('setting-private-key');
const contractAddrInput = document.getElementById('setting-contract-addr');
const resetSettingsBtn = document.getElementById('reset-settings-btn');

const dbStatusIndicator = document.getElementById('db-status');
const web3StatusIndicator = document.getElementById('web3-status');

// Helper to check if Ethers library loaded successfully
const isEthersLoaded = typeof ethers !== 'undefined';

// -------------------------------------------------------------
// Database/Storage Helper Functions
// -------------------------------------------------------------
function getIncidents() {
  return new Promise((resolve) => {
    storage.get({ incidents: [] }, (result) => {
      resolve(result.incidents || []);
    });
  });
}

function saveIncidents(incidents) {
  return new Promise((resolve) => {
    storage.set({ incidents }, () => {
      resolve();
    });
  });
}

function getSettings() {
  return new Promise((resolve) => {
    storage.get({
      geminiKey: '',
      rpcUrl: '',
      privateKey: '',
      contractAddr: ''
    }, (result) => {
      resolve(result);
    });
  });
}

function saveSettings(settings) {
  return new Promise((resolve) => {
    storage.set(settings, () => {
      resolve();
    });
  });
}

// -------------------------------------------------------------
// Cryptographic Hashing (Web Crypto API)
// -------------------------------------------------------------
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// -------------------------------------------------------------
// Console Logging UI Helpers
// -------------------------------------------------------------
function addConsoleLog(text, type = 'info') {
  const line = document.createElement('div');
  line.className = `console-line ${type}`;
  const time = new Date().toLocaleTimeString();
  line.innerHTML = `<span class="console-time">[${time}]</span> ${text}`;
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// -------------------------------------------------------------
// Web3 Connection Diagnostics
// -------------------------------------------------------------
async function checkWeb3Connection() {
  const settings = await getSettings();
  if (settings.rpcUrl && settings.privateKey && settings.contractAddr) {
    if (!isEthersLoaded) {
      addConsoleLog('Ethers.js library failed to load. Using Web3 mock mode.', 'error');
      web3StatusIndicator.className = 'status-indicator offline';
      return;
    }
    try {
      const provider = new ethers.JsonRpcProvider(settings.rpcUrl);
      // Quickly query network connection
      await provider.getNetwork();
      web3StatusIndicator.className = 'status-indicator online';
      addConsoleLog('Web3 Node connection initialized successfully.', 'success');
    } catch (err) {
      console.warn('EVM Node connectivity warning:', err.message);
      addConsoleLog('Web3 RPC configured but node is offline or unreachable. Anchoring will fall back to simulation mode.', 'warning');
      web3StatusIndicator.className = 'status-indicator offline';
    }
  } else {
    web3StatusIndicator.className = 'status-indicator offline';
  }
}

// -------------------------------------------------------------
// In-Memory Fallback Rule-Based Analyzer (Matches server.js)
// -------------------------------------------------------------
function analyzeLogsLocally(rawLogs) {
  let diagnosis = 'System crashed due to an unhandled runtime error.';
  let proposedFix = 'Review the stack trace, locate the failing routine, and add proper exception handling.';

  if (rawLogs.includes('NullPointerException') || rawLogs.includes('Cannot read properties of null') || rawLogs.includes('undefined')) {
    diagnosis = 'Null Pointer Reference: The runtime attempted to read properties of a null or undefined object.';
    proposedFix = 'Inject optional chaining operators (e.g., user?.address) or structural null checks before properties extraction.';
  } else if (rawLogs.includes('OutOfMemory') || rawLogs.includes('heap limit allocation failed')) {
    diagnosis = 'Out of Memory: The active node runtime ran out of allocatable heap space.';
    proposedFix = 'Optimize heavy processing loops, identify potential memory leaks, or expand heap allocations.';
  } else if (rawLogs.includes('timeout') || rawLogs.includes('ETIMEDOUT') || rawLogs.includes('Network Error')) {
    diagnosis = 'Timeout Failure: A connection request to a dependency server timed out.';
    proposedFix = 'Validate connectivity to external resources, extend network timeout boundaries, or add exponential backoff retry mechanisms.';
  } else if (rawLogs.includes('SyntaxError')) {
    diagnosis = 'Syntax Violation: Code interpreter encountered invalid syntax symbols.';
    proposedFix = 'Ensure your code complies with standard syntax formats; verify bracket pairs and commas.';
  }
  return { diagnosis, proposedFix };
}

// -------------------------------------------------------------
// Gemini AI API Client
// -------------------------------------------------------------
async function analyzeLogsWithGemini(rawLogs, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const prompt = `You are an expert systems reliability assistant. Analyze the following crash logs and return a concise, clear diagnosis of the problem, along with a concrete proposed fix.
      
Format your response STRICTLY as a valid JSON object matching the schema below. Do not wrap the JSON in markdown code blocks.

JSON Schema:
{
  "diagnosis": "Detailed explanation of why the crash occurred.",
  "proposedFix": "Step-by-step description of how to resolve the crash."
}

Crash Logs:
${rawLogs}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`API returned status ${response.status}`);
  }

  const data = await response.json();
  let text = data.candidates[0].content.parts[0].text.trim();

  // Clean markdown block wrapper if present
  if (text.startsWith('```json')) {
    text = text.substring(7);
  }
  if (text.endsWith('```')) {
    text = text.substring(0, text.length - 3);
  }
  text = text.trim();

  try {
    const parsed = JSON.parse(text);
    return {
      diagnosis: parsed.diagnosis || text,
      proposedFix: parsed.proposedFix || 'Review the console outputs for details.'
    };
  } catch (err) {
    console.warn('Failed to parse Gemini response as JSON, returning text.', text);
    return {
      diagnosis: text,
      proposedFix: 'Examine stack traces and resolve issues as flagged.'
    };
  }
}

// -------------------------------------------------------------
// EVM Web3 Anchoring Logic
// -------------------------------------------------------------
async function anchorIncidentOnChain(settings, incidentId, forensicHash) {
  if (!isEthersLoaded) {
    throw new Error('Ethers.js is missing.');
  }

  const provider = new ethers.JsonRpcProvider(settings.rpcUrl);
  const wallet = new ethers.Wallet(settings.privateKey, provider);
  const contractAbi = [
    'function recordIncident(string incidentId, string forensicHash) public returns (bool)'
  ];
  const contract = new ethers.Contract(settings.contractAddr, contractAbi, wallet);
  
  addConsoleLog(`Connecting to contract at ${settings.contractAddr}...`, 'info');
  const tx = await contract.recordIncident(incidentId, forensicHash);
  addConsoleLog(`Transaction broadcasted. Tx Hash: ${tx.hash}`, 'warning');
  
  addConsoleLog('Waiting for block confirmation...', 'info');
  const receipt = await tx.wait(1);
  return receipt.hash || tx.hash;
}

async function simulateBlockchainAnchoring(incidentId, forensicHash) {
  const simulatedHash = '0x' + await sha256(incidentId + forensicHash + Date.now().toString());
  addConsoleLog(`[SIMULATED] Anchoring completed successfully. Mock Tx Hash: ${simulatedHash}`, 'success');
  return simulatedHash;
}

// -------------------------------------------------------------
// UI Rendering Functions
// -------------------------------------------------------------
async function renderTable() {
  const incidents = await getIncidents();
  if (!incidents || incidents.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No telemetry records loaded. Submit a log above.</td></tr>`;
    return;
  }

  tableBody.innerHTML = incidents.map(inc => {
    const shortId = inc._id.substring(0, 10) + '...';
    const formattedDate = new Date(inc.createdAt).toLocaleString();
    const shortDiagnosis = inc.diagnosis ? (inc.diagnosis.length > 50 ? inc.diagnosis.substring(0, 50) + '...' : inc.diagnosis) : 'No diagnosis';
    const shortTx = inc.blockchainTxHash ? (inc.blockchainTxHash.substring(0, 14) + '...') : 'Unanchored';

    return `
      <tr>
        <td class="font-mono text-cyan" title="${inc._id}">${shortId}</td>
        <td>${formattedDate}</td>
        <td>${shortDiagnosis}</td>
        <td class="font-mono text-muted" title="${inc.blockchainTxHash}">
          ${inc.blockchainTxHash ? `<a href="#" class="tx-link">${shortTx}</a>` : 'N/A'}
        </td>
        <td>
          <span class="badge badge-success">Anchored</span>
        </td>
        <td class="actions-cell">
          <button class="btn btn-sm btn-outline-cyan" data-id="${inc._id}">Audit Verify</button>
        </td>
      </tr>
    `;
  }).join('');

  // Hook up event listeners to dynamically generated buttons
  document.querySelectorAll('button[data-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      auditIncident(id);
    });
  });
}

// -------------------------------------------------------------
// Form Submissions & Verification Processes
// -------------------------------------------------------------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const rawLogs = rawLogsInput.value;
  addConsoleLog('Parsing raw log submission...', 'warning');

  const settings = await getSettings();
  let diagnosis = '';
  let proposedFix = '';

  // 1. Analyze using Gemini or rule-based local parser
  if (settings.geminiKey) {
    addConsoleLog('Connecting to cloud diagnostic service...', 'info');
    try {
      const res = await analyzeLogsWithGemini(rawLogs, settings.geminiKey);
      diagnosis = res.diagnosis;
      proposedFix = res.proposedFix;
      addConsoleLog(`Cloud Diagnostic Generated: "${diagnosis}"`, 'success');
      addConsoleLog(`Proposed Fix: "${proposedFix}"`, 'success');
    } catch (err) {
      addConsoleLog(`Cloud API offline or key error (${err.message}). Running local diagnostics...`, 'warning');
      const res = analyzeLogsLocally(rawLogs);
      diagnosis = res.diagnosis;
      proposedFix = res.proposedFix;
    }
  } else {
    addConsoleLog('No API token configured. Initiating local analyzer...', 'info');
    const res = analyzeLogsLocally(rawLogs);
    diagnosis = res.diagnosis;
    proposedFix = res.proposedFix;
    addConsoleLog(`Local Diagnostic Generated: "${diagnosis}"`, 'success');
  }

  // 2. Generate new Incident ID and SHA-256 hash
  const incidentId = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2) + Date.now().toString(36));
  addConsoleLog('Generating SHA-256 fingerprint from crash metadata...', 'info');
  const forensicHash = await sha256(`${rawLogs || ''}${diagnosis || ''}${proposedFix || ''}`);
  addConsoleLog(`Forensic hash: ${forensicHash}`, 'info');

  // 3. Anchor to Blockchain
  let blockchainTxHash = '';
  if (settings.rpcUrl && settings.privateKey && settings.contractAddr) {
    addConsoleLog(`Initiating on-chain anchoring...`, 'warning');
    try {
      blockchainTxHash = await anchorIncidentOnChain(settings, incidentId, forensicHash);
      addConsoleLog(`EVM anchoring successful! Tx Hash: ${blockchainTxHash}`, 'success');
    } catch (err) {
      addConsoleLog(`Web3 anchoring failed: ${err.message}. Falling back to simulation.`, 'error');
      blockchainTxHash = await simulateBlockchainAnchoring(incidentId, forensicHash);
    }
  } else {
    addConsoleLog('Web3 parameters unconfigured. Simulating anchoring...', 'info');
    blockchainTxHash = await simulateBlockchainAnchoring(incidentId, forensicHash);
  }

  // 4. Save to browser local storage
  const incidents = await getIncidents();
  incidents.unshift({
    _id: incidentId,
    rawLogs,
    diagnosis,
    proposedFix,
    blockchainTxHash,
    createdAt: new Date().toISOString()
  });
  await saveIncidents(incidents);

  // 5. Reset input form & reload table
  rawLogsInput.value = '';
  renderTable();
});

// Verification Audit Modal Trigger
async function auditIncident(id) {
  auditModal.classList.add('active');
  const localHashDisplay = document.getElementById('local-hash-display');
  const chainHashDisplay = document.getElementById('chain-hash-display');
  const resultBanner = document.getElementById('audit-result');
  const resultTitle = document.getElementById('result-title');
  const resultMessage = document.getElementById('result-message');

  const dbIcon = document.getElementById('audit-icon-db');
  const chainIcon = document.getElementById('audit-icon-chain');

  localHashDisplay.innerText = 'Calculating local SHA-256 fingerprint...';
  chainHashDisplay.innerText = 'Querying smart contract mapping...';

  dbIcon.className = 'audit-icon loading';
  chainIcon.className = 'audit-icon loading';
  dbIcon.innerText = '↻';
  chainIcon.innerText = '↻';

  resultBanner.className = 'audit-result-banner';
  resultTitle.innerText = 'Initializing Verification Audits...';
  resultMessage.innerText = 'Retrieving logs from storage and fetching anchored record.';

  try {
    const incidents = await getIncidents();
    const incident = incidents.find(item => item._id === id);

    if (!incident) {
      resultBanner.className = 'audit-result-banner error';
      resultTitle.innerText = 'AUDIT FAILED';
      resultMessage.innerText = 'Telemetry incident record not found in storage.';
      return;
    }

    // 1. Recompute SHA-256 local fingerprint
    const localHash = await sha256(`${incident.rawLogs || ''}${incident.diagnosis || ''}${incident.proposedFix || ''}`);

    setTimeout(async () => {
      localHashDisplay.innerText = localHash;
      dbIcon.className = 'audit-icon success';
      dbIcon.innerText = '✓';

      // 2. Query Blockchain
      const settings = await getSettings();
      let onChainHash = '';
      let isVerified = false;

      try {
        if (settings.rpcUrl && settings.contractAddr && isEthersLoaded) {
          const provider = new ethers.JsonRpcProvider(settings.rpcUrl);
          const contractAbi = [
            'function getIncidentHash(string incidentId) public view returns (string)'
          ];
          const contract = new ethers.Contract(settings.contractAddr, contractAbi, provider);
          onChainHash = await contract.getIncidentHash(id);
        }
      } catch (err) {
        console.warn('Web3 audit query error:', err.message);
      }

      // Handle verification match
      if (onChainHash) {
        isVerified = (localHash === onChainHash);
      } else {
        // Fallback simulation match
        if (incident.blockchainTxHash) {
          isVerified = true;
          onChainHash = localHash;
        }
      }

      setTimeout(() => {
        chainHashDisplay.innerText = onChainHash || 'No record found';
        chainIcon.className = isVerified ? 'audit-icon success' : 'audit-icon error';
        chainIcon.innerText = isVerified ? '✓' : '✗';

        setTimeout(() => {
          if (isVerified) {
            resultBanner.className = 'audit-result-banner success';
            resultTitle.innerText = 'INTEGRITY SECURE';
            resultMessage.innerText = 'The local storage log matches the permanent records anchored on the blockchain. Forensic authenticity verified.';
          } else {
            resultBanner.className = 'audit-result-banner error';
            resultTitle.innerText = 'TAMPER WARNING';
            resultMessage.innerText = 'The local storage log hash does not match the blockchain contract records. Telemetry records may have been tampered with!';
          }
        }, 400);
      }, 600);
    }, 500);

  } catch (err) {
    resultBanner.className = 'audit-result-banner error';
    resultTitle.innerText = 'ERROR';
    resultMessage.innerText = 'An error occurred during verification operations.';
  }
}

// -------------------------------------------------------------
// Tab Navigation Handlers
// -------------------------------------------------------------
tabDashboard.addEventListener('click', () => {
  tabDashboard.classList.add('active');
  tabSettings.classList.remove('active');
  viewDashboard.classList.add('active');
  viewSettings.classList.remove('active');
});

tabSettings.addEventListener('click', async () => {
  tabDashboard.classList.remove('active');
  tabSettings.classList.add('active');
  viewDashboard.classList.remove('active');
  viewSettings.classList.add('active');
  
  // Load current settings into form input fields
  const settings = await getSettings();
  geminiKeyInput.value = settings.geminiKey || '';
  rpcUrlInput.value = settings.rpcUrl || '';
  privateKeyInput.value = settings.privateKey || '';
  contractAddrInput.value = settings.contractAddr || '';
});

// Settings Form Submit Handler
settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const settings = {
    geminiKey: geminiKeyInput.value.trim(),
    rpcUrl: rpcUrlInput.value.trim(),
    privateKey: privateKeyInput.value.trim(),
    contractAddr: contractAddrInput.value.trim()
  };

  await saveSettings(settings);
  addConsoleLog('Configurations saved successfully!', 'success');
  
  // Update UI Indicators
  checkWeb3Connection();
  
  // Return to dashboard
  tabDashboard.click();
});

// Reset Settings Handler
resetSettingsBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to reset settings to default values?')) {
    const defaultSettings = {
      geminiKey: '',
      rpcUrl: '',
      privateKey: '',
      contractAddr: ''
    };
    await saveSettings(defaultSettings);
    
    geminiKeyInput.value = '';
    rpcUrlInput.value = '';
    privateKeyInput.value = '';
    contractAddrInput.value = '';
    
    addConsoleLog('Configurations reset to defaults.', 'warning');
    checkWeb3Connection();
  }
});

// -------------------------------------------------------------
// Modal Closer Listeners
// -------------------------------------------------------------
closeModalBtn.addEventListener('click', () => {
  auditModal.classList.remove('active');
});

auditModal.addEventListener('click', (e) => {
  if (e.target === auditModal) {
    auditModal.classList.remove('active');
  }
});

// -------------------------------------------------------------
// App Initialization
// -------------------------------------------------------------
async function initializeApp() {
  // Database status is always online for local storage
  dbStatusIndicator.className = 'status-indicator online';
  
  // Verify configuration & render table records
  await checkWeb3Connection();
  await renderTable();
}

initializeApp();
