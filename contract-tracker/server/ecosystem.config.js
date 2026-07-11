/**
 * PM2 进程管理配置
 * 开机自启动 + 崩溃自动重启 + 日志管理
 */
module.exports = {
  apps: [
    {
      name: 'contract-tracker',
      script: './dist/index.js',
      cwd: __dirname,
      // 重启策略：内存超过 200M 或崩溃时自动重启
      max_memory_restart: '200M',
      // 崩溃后延迟 3 秒重启
      restart_delay: 3000,
      // 最多连续重启 10 次，之后停止（防止无限重启）
      max_restarts: 10,
      // 加载 .env 文件中的环境变量（PM2 默认不加载 .env）
      env_file: './.env',
      // 默认环境变量（.env 中的值优先）
      env: {
        NODE_ENV: 'production',
      },
      // 日志配置
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      // 优雅关闭（等待当前请求完成）
      kill_timeout: 5000,
      // 等待应用 ready 信号
      wait_ready: false,
      // 监听文件变化自动重启（仅开发用，生产注释掉）
      // watch: false,
    },
  ],
};
