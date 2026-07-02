const path = require("path");

module.exports = {
  apps: [
    {
      name: "lendingcart-backend",
      script: path.join(__dirname, "bin/www"),
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
