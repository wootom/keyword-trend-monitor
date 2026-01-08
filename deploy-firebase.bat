@echo off
echo ========================================
echo   Firebase Deployment Helper
echo ========================================
echo.

echo This script will help you deploy to Firebase.
echo.
echo Prerequisites:
echo 1. Firebase CLI installed (npm install -g firebase-tools)
echo 2. Firebase project created
echo 3. Firebase config updated in public/js/firebase-config.js
echo.

echo What would you like to deploy?
echo.
echo [1] Functions only
echo [2] Hosting only
echo [3] Firestore rules only
echo [4] Everything
echo [5] Exit
echo.

set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" (
    echo.
    echo Deploying Functions...
    echo Installing dependencies first...
    cd functions
    call npm install
    cd ..
    firebase deploy --only functions
    echo.
    echo Functions deployed! Check logs:
    echo firebase functions:log
) else if "%choice%"=="2" (
    echo.
    echo Deploying Hosting...
    firebase deploy --only hosting
    echo.
    echo Hosting deployed! Your site is live.
) else if "%choice%"=="3" (
    echo.
    echo Deploying Firestore rules and indexes...
    firebase deploy --only firestore
    echo.
    echo Firestore rules deployed!
) else if "%choice%"=="4" (
    echo.
    echo Deploying everything...
    echo Installing dependencies first...
    cd functions
    call npm install
    cd ..
    firebase deploy
    echo.
    echo Full deployment complete!
) else if "%choice%"=="5" (
    echo Exiting...
    exit /b 0
) else (
    echo Invalid choice. Exiting...
    exit /b 1
)

echo.
echo Done! Press any key to exit...
pause >nul
