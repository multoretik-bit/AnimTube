@echo off
set "repo_url=https://github.com/multoretik-bit/AnimTube.git"
set "commit_msg=PREMIUM UI RESTORED v1.2 - FINAL RELEASE [%date% %time%]"

echo.
echo 🎬 [AnimTube Premium Deployer v1.2]
echo --------------------------------------------------
echo [*] Repository: %repo_url%
echo.

:: 1. Git Installation Check
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed!
    pause
    exit /b
)

:: 2. Repository Initialization
if not exist ".git" (
    echo [*] Initializing new git repository...
    git init
    git branch -M main
)

:: 3. Remote Configuration
echo [*] Configuring remote origin...
git remote set-url origin %repo_url% >nul 2>&1
if %errorlevel% neq 0 (
    git remote add origin %repo_url%
)

:: 4. Force Branch Alignment
git branch -M main

:: 5. Staging and Committing
echo [*] Staging all files...
git add .
git commit -m "%commit_msg%"

:: 6. Pushing to GitHub
echo [*] Pushing to GitHub (main)...
git push -u origin main --force

if %errorlevel% neq 0 (
    echo.
    echo [!!!] FAILED to push. 
    echo Please check if you have permission to push to this repository.
    echo If this is a new repository, make sure you've authorized GitHub.
) else (
    echo.
    echo 🎉 SUCCESS! Premium AnimTube v1.2 is now on GitHub.
)

echo.
timeout /t 10
exit
