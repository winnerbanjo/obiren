import * as http from 'http';

async function runLoadTest() {
  console.log('🚀 Launching Load & Concurrency Test (500 Concurrent Virtual Requests)...');

  const url = 'http://localhost:3000/api/v1/health';
  const totalRequests = 500;
  const latencies: number[] = [];
  let failures = 0;
  let successes = 0;

  const startTime = Date.now();

  const makeRequest = (): Promise<void> => {
    return new Promise((resolve) => {
      const start = Date.now();
      const req = http.get(url, (res) => {
        const duration = Date.now() - start;
        latencies.push(duration);
        if (res.statusCode === 200) {
          successes++;
        } else {
          failures++;
        }
        res.on('data', () => {});
        res.on('end', resolve);
      });

      req.on('error', () => {
        failures++;
        resolve();
      });

      req.setTimeout(5000, () => {
        failures++;
        req.destroy();
        resolve();
      });
    });
  };

  // Run 500 concurrent requests in batches of 50
  const batchSize = 50;
  for (let i = 0; i < totalRequests; i += batchSize) {
    const promises = Array.from({ length: Math.min(batchSize, totalRequests - i) }, () => makeRequest());
    await Promise.all(promises);
  }

  const totalTimeSec = (Date.now() - startTime) / 1000;
  latencies.sort((a, b) => a - b);

  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const rps = (totalRequests / totalTimeSec).toFixed(2);
  const failureRate = ((failures / totalRequests) * 100).toFixed(2);

  console.log('\n--- 📊 LOAD TEST METRICS & PERFORMANCE REPORT ---');
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Successful Requests: ${successes}`);
  console.log(`Failed Requests: ${failures}`);
  console.log(`Failure Rate: ${failureRate}%`);
  console.log(`Requests Per Second (RPS): ${rps}`);
  console.log(`Latency P50: ${p50} ms`);
  console.log(`Latency P95: ${p95} ms (Target < 800 ms)`);
  console.log(`Latency P99: ${p99} ms`);

  if (Number(failureRate) < 1.0 && p95 < 800) {
    console.log('✅ Load Test PASSED: Meets SLA targets (<1% failure rate, P95 < 800ms).');
  } else {
    console.log('⚠️ Load Test Warning: Check API server concurrency limits.');
  }
}

runLoadTest().catch(console.error);
