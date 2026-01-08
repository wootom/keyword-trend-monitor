@echo off
echo ========================================
echo   Keyword Trend Monitoring System
echo   Local Development Server
echo ========================================
echo.

echo Checking Python installation...
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Python found! Starting server on port 8080...
    echo.
    echo Open browser: http://localhost:8080/public/
    echo Press Ctrl+C to stop the server
    echo.
    cd public
    python -m http.server 8080
) else (
    echo Python not found. Trying Node.js...
    node --version >nul 2>&1
    if %errorlevel% == 0 (
        echo Node.js found! Installing http-server...
        call npm install -g http-server
        echo Starting server on port 8080...
        echo.
        echo Open browser: http://localhost:8080/
        echo Press Ctrl+C to stop the server
        echo.
        cd public
        http-server -p 8080 -o
    ) else (
        echo.
        echo ERROR: Neither Python nor Node.js found!
        echo Please install one of them:
        echo - Python: https://www.python.org/downloads/
        echo - Node.js: https://nodejs.org/
        echo.
        pause
    )
)
