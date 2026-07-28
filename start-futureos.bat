@echo off
REM FutureOS 本地常驻启动器（自带崩溃重启 + 开机自启）
REM 用法：双击即可；或放入「启动」文件夹实现开机自启。
cd /d D:\QoderWork\QoderWork\FutureOS

REM 关键：清掉 NODE_OPTIONS，否则 Turbopack 构建/运行会被 --use-system-ca 之类参数拖垮
set NODE_OPTIONS=
set AI_PROVIDER=deepseek-hybrid

:loop
echo [%date% %time%] 启动 FutureOS 开发服务器 (http://localhost:3000) ...
"C:\Users\xpeng\.workbuddy\binaries\node\versions\22.22.2\node.exe" "C:\Users\xpeng\.workbuddy\binaries\node\versions\22.22.2\node_modules\npm\bin\npm-cli.js" run dev
echo [%date% %time%] 服务器已退出（退出码 %errorlevel%），3 秒后自动重启 ...
timeout /t 3 >nul
goto loop
