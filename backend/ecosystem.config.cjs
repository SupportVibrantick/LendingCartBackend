const path = require("path");

module.exports = {
  apps: [
    {
      name: "lendingcart-backend",
      script: path.join(__dirname, "bin/www"),
      exec_mode: "fork",
      instances: 1,
      cwd: __dirname,
      autorestart: true,
      max_memory_restart: "768M",
      env: {
        NODE_ENV: "production",
        ENABLE_CRONS: "false",
      },
    },
    {
      name: "lendingcart-worker",
      script: path.join(__dirname, "bin/worker.js"),
      exec_mode: "fork",
      instances: 1,
      cwd: __dirname,
      autorestart: true,
      max_memory_restart: "768M",
      env: {
        NODE_ENV: "production",
        ENABLE_CRONS: "true",
      },
    },
  ],
};
