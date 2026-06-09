const http = require('http');

// Start the server by requiring it. It will listen on PORT (default 5000).
process.env.PORT = 5000;
const app = require('./server');

// Helper to make a JSON request
function makeRequest(options, payload = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ statusCode: res.statusCode, body: json });
        } catch (e) {
          resolve({ statusCode: res.statusCode, rawBody: data });
        }
      });
    });
    req.on('error', (err) => reject(err));
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

// Wait 1 second for database connection attempt and server initialization
setTimeout(async () => {
  console.log('\n=============================================');
  console.log('STARTING CHAIN SENTRY FULL SYSTEM TESTING');
  console.log('=============================================\n');

  let testPassed = true;
  let incidentId = '';

  try {
    // ----------------------------------------------------
    // TEST 1: POST /api/telemetry/crash-report
    // ----------------------------------------------------
    console.log('--- TEST 1: Submitting Telemetry Crash Report ---');
    const crashPayload = JSON.stringify({
      rawLogs: 'java.lang.NullPointerException: Cannot invoke "String.length()" because "str" is null\n\tat com.chainsentry.TelemetryManager.process(TelemetryManager.java:42)'
    });

    const postOptions = {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/telemetry/crash-report',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(crashPayload)
      }
    };

    const t1 = await makeRequest(postOptions, crashPayload);
    console.log(`T1 Status: ${t1.statusCode}`);
    console.log('T1 Response:', JSON.stringify(t1.body));

    const t1Ok = t1.statusCode === 200 &&
                 t1.body.success === true &&
                 !!t1.body.incidentId &&
                 !!t1.body.diagnosis &&
                 !!t1.body.blockchainTxHash;

    console.log(`[T1 RESULT] ${t1Ok ? 'PASS' : 'FAIL'}\n`);
    if (!t1Ok) testPassed = false;
    else incidentId = t1.body.incidentId;

    // ----------------------------------------------------
    // TEST 2: GET /api/telemetry/incidents
    // ----------------------------------------------------
    console.log('--- TEST 2: Querying Incidents List ---');
    const getListOptions = {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/telemetry/incidents',
      method: 'GET'
    };

    const t2 = await makeRequest(getListOptions);
    console.log(`T2 Status: ${t2.statusCode}`);
    console.log(`T2 Response List Length: ${t2.body.incidents ? t2.body.incidents.length : 0}`);

    const t2Ok = t2.statusCode === 200 &&
                 t2.body.success === true &&
                 Array.isArray(t2.body.incidents) &&
                 t2.body.incidents.length > 0;

    console.log(`[T2 RESULT] ${t2Ok ? 'PASS' : 'FAIL'}\n`);
    if (!t2Ok) testPassed = false;

    // ----------------------------------------------------
    // TEST 3: GET /api/telemetry/verify/:id
    // ----------------------------------------------------
    console.log(`--- TEST 3: Performing On-Chain Integrity Audit for ID ${incidentId} ---`);
    const verifyOptions = {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/telemetry/verify/${incidentId}`,
      method: 'GET'
    };

    const t3 = await makeRequest(verifyOptions);
    console.log(`T3 Status: ${t3.statusCode}`);
    console.log('T3 Response:', JSON.stringify(t3.body));

    const t3Ok = t3.statusCode === 200 &&
                 t3.body.success === true &&
                 t3.body.isVerified === true &&
                 !!t3.body.localHash &&
                 !!t3.body.onChainHash &&
                 t3.body.localHash === t3.body.onChainHash;

    console.log(`[T3 RESULT] ${t3Ok ? 'PASS' : 'FAIL'}\n`);
    if (!t3Ok) testPassed = false;

    // Final result
    if (testPassed) {
      console.log('=============================================');
      console.log('>>> ALL CHAIN SENTRY INTEGRATION TESTS PASSED! <<<');
      console.log('=============================================\n');
      process.exit(0);
    } else {
      console.error('=============================================');
      console.error('>>> SOME INTEGRATION TESTS FAILED! <<<');
      console.error('=============================================\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('Integration testing threw an exception:', error.message);
    process.exit(1);
  }
}, 1000);
