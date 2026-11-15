import { spawnSync } from "node:child_process";

const environment = {
  ...process.env,
  VITE_API_URL:
    process.env.VITE_API_URL ||
    "https://serviprox-backend.onrender.com/api/v1",
};

const run = (script, args = []) => {
  const result = spawnSync(process.execPath, [script, ...args], {
    env: environment,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run("node_modules/typescript/bin/tsc");
run("node_modules/vite/bin/vite.js", ["build"]);
