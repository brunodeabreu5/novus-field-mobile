@echo off
REM Workaround for Windows CMake long path issues
REM This script modifies the system to allow long paths

echo Setting long path support...

REM Enable long path support in Windows
reg add "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f >nul 2>&1

REM Enable long path support in registry for current user
reg add "HKCU\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f >nul 2>&1

echo Long path support enabled.

REM Build the project
"C:\Users\Bruno'\Documents\GitHub\novus-field-geral\novus-field-mobile\android\gradlew.bat" app:assembleDebug -x lint -x test --configure-on-demand --build-cache -PreactNativeDevServerPort=8081 -PreactNativeArchitectures=x86_64,arm64-v8a

exit /b %errorlevel%
