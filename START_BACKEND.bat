@echo off
echo ========================================
echo  Starting Synthetic Face Detector Backend
echo ========================================
echo.

cd backend

echo Checking Python installation...
python --version
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed!
    pause
    exit /b 1
)

echo.
echo Checking for virtual environment...
if exist "..\venv\Scripts\activate.bat" (
    echo Virtual environment found. Activating...
    call ..\venv\Scripts\activate.bat
    echo Virtual environment activated!
) else (
    echo WARNING: Virtual environment not found at ..\venv\
    echo Creating virtual environment...
    python -m venv ..\venv
    if %errorlevel% neq 0 (
        echo ERROR: Failed to create virtual environment!
        echo Continuing without virtual environment...
    ) else (
        echo Virtual environment created successfully!
        call ..\venv\Scripts\activate.bat
        echo Installing dependencies...
        pip install -r requirements.txt
    )
)

echo.
echo Starting FastAPI server on port 9000...
echo Backend will be available at: http://localhost:9000
echo API Documentation: http://localhost:9000/docs
echo.
echo Press Ctrl+C to stop the server
echo.

uvicorn app:app --reload --port 9000

pause
