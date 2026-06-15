@echo off
echo ========================================
echo  Synthetic Face Detector - Backend Startup
echo  (with Virtual Environment)
echo ========================================
echo.

:: Check if venv exists
if not exist "venv" (
    echo Virtual environment not found!
    echo Creating new virtual environment...
    echo.
    python -m venv venv
    if %errorlevel% neq 0 (
        echo ERROR: Failed to create virtual environment!
        echo Make sure Python is installed and added to PATH.
        pause
        exit /b 1
    )
    echo Virtual environment created successfully!
    echo.
)

:: Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

:: Check if activation was successful
if "%VIRTUAL_ENV%"=="" (
    echo ERROR: Failed to activate virtual environment!
    pause
    exit /b 1
)

echo Virtual environment activated: %VIRTUAL_ENV%
echo.

:: Check if dependencies are installed
echo Checking dependencies...
cd backend
pip show fastapi >nul 2>&1
if %errorlevel% neq 0 (
    echo Dependencies not found. Installing...
    echo.
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
    echo Dependencies installed successfully!
    echo.
) else (
    echo Dependencies already installed.
    echo.
)

:: Start the server
echo ========================================
echo Starting FastAPI server...
echo ========================================
echo.
echo Backend URL: http://localhost:9000
echo API Docs: http://localhost:9000/docs
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

uvicorn app:app --reload --port 9000

:: Deactivate venv on exit
echo.
echo Deactivating virtual environment...
deactivate

pause
