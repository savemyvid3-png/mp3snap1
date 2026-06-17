@echo off
echo Installing StreamRip YouTube Converter...
echo.

echo [1/2] Installing frontend dependencies...
call npm install

echo.
echo [2/2] Installing backend dependencies...
cd server
call npm install
cd ..

echo.
echo ============================================
echo Setup complete!
echo.
echo To start the application:
echo 1. Run: cd server ^&^& npm start
echo 2. In a new terminal, run: npm run dev
echo 3. Open http://localhost:5173 in your browser
echo ============================================
pause
