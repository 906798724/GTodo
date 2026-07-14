# GTodo Portable Package Script
# Creates a portable/green version of GTodo without electron-builder

$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot | Split-Path -Parent
Set-Location $ProjectRoot

# Configuration
$AppName = "GTodo"
$Version = "1.0.0"
$OutputDir = Join-Path $ProjectRoot "dist-pkg"
$AppDir = Join-Path $OutputDir "$AppName-portable"
$ZipPath = Join-Path $OutputDir "$AppName-$Version-portable.zip"

Write-Host "==> Building portable version" -ForegroundColor Cyan
Write-Host "    Project: $ProjectRoot"
Write-Host "    Output: $OutputDir"

# 1. Clean previous output
if (Test-Path $AppDir) { Remove-Item -Recurse -Force $AppDir }
if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null

# 2. Copy Electron runtime
Write-Host "==> Copying Electron runtime..." -ForegroundColor Yellow
$ElectronDist = Join-Path $ProjectRoot "node_modules\electron\dist"
Get-ChildItem -Path $ElectronDist -Force | Copy-Item -Destination $AppDir -Recurse -Force

# 3. Rename electron.exe to GTodo.exe
$ElectronExe = Join-Path $AppDir "electron.exe"
$AppExe = Join-Path $AppDir "$AppName.exe"
if (Test-Path $ElectronExe) {
    Move-Item $ElectronExe $AppExe -Force
    Write-Host "    Renamed: electron.exe -> $AppName.exe"
}

# 4. Create resources/app directory (Electron standard layout)
$ResourcesDir = Join-Path $AppDir "resources"
$AppAsarDir = Join-Path $ResourcesDir "app"
New-Item -ItemType Directory -Force -Path $AppAsarDir | Out-Null

# 5. Copy app code to resources/app
Write-Host "==> Copying app code..." -ForegroundColor Yellow
Copy-Item -Path (Join-Path $ProjectRoot "package.json") -Destination $AppAsarDir -Force
Copy-Item -Path (Join-Path $ProjectRoot "dist") -Destination $AppAsarDir -Recurse -Force

# 6. Copy node_modules that the app needs
Write-Host "==> Copying required node_modules..." -ForegroundColor Yellow
$RequiredModules = @("sql.js", "buffer", "events", "util", "stream-browserify", "process")
$DestNodeModules = Join-Path $AppAsarDir "node_modules"
New-Item -ItemType Directory -Force -Path $DestNodeModules | Out-Null
foreach ($mod in $RequiredModules) {
    $modPath = Join-Path $ProjectRoot "node_modules\$mod"
    if (Test-Path $modPath) {
        Copy-Item -Path $modPath -Destination (Join-Path $DestNodeModules $mod) -Recurse -Force
        Write-Host "    Copied: $mod"
    }
}

# 7. Copy sql.js wasm to resources (used by asarUnpack equivalent)
Write-Host "==> Copying sql.js wasm..." -ForegroundColor Yellow
$WasmSource = Join-Path $ProjectRoot "node_modules\sql.js\dist\sql-wasm.wasm"
if (Test-Path $WasmSource) {
    Copy-Item -Path $WasmSource -Destination $ResourcesDir -Force
    Write-Host "    wasm copied to resources/"
}

# 8. Create zip
Write-Host "==> Creating ZIP archive..." -ForegroundColor Yellow
Compress-Archive -Path $AppDir -DestinationPath $ZipPath -CompressionLevel Optimal

$Size = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "==> Portable build complete!" -ForegroundColor Green
Write-Host "    Path: $ZipPath"
Write-Host "    Size: $Size MB"
Write-Host ""
Write-Host "    Usage:" -ForegroundColor Cyan
Write-Host "    1. Extract to any directory"
Write-Host "    2. Double-click $AppName.exe to run"
Write-Host ""
