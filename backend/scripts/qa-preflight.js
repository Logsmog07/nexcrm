const http = require("http");

function requestStatus(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const status = res.statusCode || 0;
      res.resume();
      res.on("end", () => resolve(status));
    });

    req.on("error", reject);
    req.setTimeout(4000, () => {
      req.destroy(new Error(`Timeout while reaching ${url}`));
    });
  });
}

async function assertReachable(url, expectedStatus, hint) {
  try {
    const status = await requestStatus(url);
    if (status !== expectedStatus) {
      throw new Error(`Expected ${expectedStatus}, got ${status}`);
    }
    console.log(`PASS ${url} -> ${status}`);
  } catch (error) {
    console.error(`FAIL ${url} -> ${error.message}`);
    console.error(hint);
    process.exit(1);
  }
}

async function main() {
  await assertReachable(
    "http://localhost:3001/health",
    200,
    "Start backend first: npm run server:dev"
  );

  await assertReachable(
    "http://localhost:5174/login",
    200,
    "Start frontend on 5174: cd frontend && npm run dev"
  );

  console.log("Preflight checks passed");
}

main();
