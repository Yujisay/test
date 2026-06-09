@echo off
start "esbuild-app" cmd /k "npx esbuild src/main.ts --bundle --outfile=public/js/app.js --platform=browser --watch"
start "esbuild-admin" cmd /k "npx esbuild src/admin-page.ts --bundle --outfile=public/js/admin.js --platform=browser --watch"
start "nodemon" cmd /k "npx nodemon --exec ts-node server.ts --watch server.ts"