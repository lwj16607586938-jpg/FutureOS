module.exports = {
  apps: [
    {
      name: "futureos",
      script: "D:\\QoderWork\\QoderWork\\FutureOS\\node_modules\\next\\dist\\bin\\next",
      args: "dev --turbopack",
      cwd: "D:\\QoderWork\\QoderWork\\FutureOS",
      interpreter: "C:\\Users\\xpeng\\.workbuddy\\binaries\\node\\versions\\22.22.2\\node.exe",
      env: {
        NODE_ENV: "development",
        AI_PROVIDER: "deepseek-hybrid",
      },
      log_file: "D:\\QoderWork\\QoderWork\\FutureOS\\logs\\pm2-combined.log",
      out_file: "D:\\QoderWork\\QoderWork\\FutureOS\\logs\\pm2-out.log",
      error_file: "D:\\QoderWork\\QoderWork\\FutureOS\\logs\\pm2-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
      restart_delay: 3000,
      max_memory_restart: "1G",
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Windows: make sure the process is not attached to the launching console
      windowsHide: true,
    },
  ],
};
