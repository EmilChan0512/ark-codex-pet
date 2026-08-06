@echo off
setlocal

if "%~1"=="" (
  echo Usage: %~nx0 ^<角色名^> [skin] [view] [output]
  echo Example: %~nx0 佩佩 默认 基建 dist\pepe
  exit /b 1
)

set "ROLE_NAME=%~1"
set "SKIN=%~2"
set "VIEW=%~3"
set "OUTPUT_DIR=%~4"

if "%SKIN%"=="" set "SKIN=默认"
if "%VIEW%"=="" set "VIEW=基建"

set CMD=set "ARK_PET_BROWSER=chrome" ^&^& pnpm exec tsx src/cli.ts generate "%ROLE_NAME%" --skin "%SKIN%" --view "%VIEW%"

if not "%OUTPUT_DIR%"=="" (
  set CMD=%CMD% --output "%OUTPUT_DIR%"
)

call %CMD%
exit /b %errorlevel%
