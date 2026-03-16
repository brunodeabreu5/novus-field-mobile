@echo off
set CMAKE_OBJECT_PATH_MAX=10000
"C:\Users\Bruno'\Documents\GitHub\novus-field-geral\novus-field-mobile\android\gradlew.bat" app:assembleDebug -x lint -x test --configure-on-demand --build-cache -PreactNativeDevServerPort=8081 -PreactNativeArchitectures=x86_64,arm64-v8a
