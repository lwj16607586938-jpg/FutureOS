@echo off
REM FutureOS 本地常驻启动器（PM2 托管，崩溃自动重启，开机自启）
REM 用法：双击即可；或放入「启动」文件夹实现开机自启。
cd /d D:\QoderWork\QoderWork\FutureOS

REM 关键：清掉 NODE_OPTIONS，否则 Turbopack 构建/运行会被 --use-system-ca 之类参数拖垮
set NODE_OPTIONS=
set AI_PROVIDER=deepseek-hybrid

REM 检查是否已在 PM2 中注册；未注册则启动并持久化
pm2 describe futureos >nul 2>&1
if %errorlevel% neq 0 (
  echo [%date% %time%] 正在用 PM2 启动 FutureOS (http://localhost:3000) ...
  pm2 start ecosystem.config.js
  pm2 save --force
  echo [%date% %time%] 已启动并保存到 PM2 进程列表。
) else (
  echo [%date% %time%] FutureOS 已在 PM2 中运行（pm2 status 查看）。
)
