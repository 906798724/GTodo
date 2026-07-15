# ============================================================
# prepare-build.ps1
# 打包前的准备脚本：从国内镜像下载 electron-builder 所需的二进制缓存
# 解决 GitHub 下载慢/超时问题
#
# 使用方法：
#   .\scripts\prepare-build.ps1
#   npm run pack
# ============================================================

$ErrorActionPreference = "Stop"

$cacheRoot = Join-Path $env:LOCALAPPDATA "electron-builder\Cache"
$sevenZip = Join-Path $PSScriptRoot "..\node_modules\7zip-bin\win\x64\7za.exe"

if (-not (Test-Path $sevenZip)) {
  Write-Error "7za.exe not found at $sevenZip"
  exit 1
}

function Download-And-Extract {
  param(
    [string]$Name,
    [string]$Version,
    [string]$MirrorBase,
    [string]$CacheDir,
    [string]$ExcludeDir = ""
  )

  $fileName = "$Name-$Version.7z"
  $targetFile = Join-Path $CacheDir $fileName
  $targetDir = Join-Path $CacheDir "$Name-$Version"

  # 已存在则跳过
  if (Test-Path $targetDir) {
    Write-Host "[SKIP] $Name-$Version 已缓存"
    return
  }

  if (-not (Test-Path $CacheDir)) {
    New-Item -ItemType Directory -Path $CacheDir -Force | Out-Null
  }

  $urls = @(
    "$MirrorBase/$Name-$Version/$fileName",
    "https://github.com/electron-userland/electron-builder-binaries/releases/download/$Name-$Version/$fileName"
  )

  $downloaded = $false
  foreach ($url in $urls) {
    Write-Host "[DOWNLOAD] $fileName from $url"
    try {
      $ProgressPreference = "SilentlyContinue"
      Invoke-WebRequest -Uri $url -OutFile $targetFile -TimeoutSec 120
      if ((Get-Item $targetFile).Length -gt 0) {
        Write-Host "[OK] 下载完成: $([math]::Round((Get-Item $targetFile).Length / 1KB, 2)) KB"
        $downloaded = $true
        break
      }
    } catch {
      Write-Host "[FAIL] $($_.Exception.Message)"
    }
  }

  if (-not $downloaded) {
    Write-Error "所有下载源均失败: $fileName"
    exit 1
  }

  # 解压
  New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  if ($ExcludeDir) {
    & $sevenZip x $targetFile ("-o" + $targetDir) "-x!$ExcludeDir" -y | Out-Null
  } else {
    & $sevenZip x $targetFile ("-o" + $targetDir) -y | Out-Null
  }

  if ($LASTEXITCODE -ne 0) {
    Write-Error "解压失败: $fileName"
    exit 1
  }

  Write-Host "[OK] 解压完成 -> $targetDir"
}

Write-Host "========================================"
Write-Host "  GTodo 打包环境准备"
Write-Host "========================================"
Write-Host ""

# 1. winCodeSign (代码签名工具，即使不签名也需要解压)
Download-And-Extract `
  -Name "winCodeSign" `
  -Version "2.6.0" `
  -MirrorBase "https://registry.npmmirror.com/-/binary/electron-builder-binaries" `
  -CacheDir (Join-Path $cacheRoot "winCodeSign") `
  -ExcludeDir "darwin"

# 2. nsis (NSIS 安装包制作工具)
Download-And-Extract `
  -Name "nsis" `
  -Version "3.0.4.1" `
  -MirrorBase "https://registry.npmmirror.com/-/binary/electron-builder-binaries" `
  -CacheDir (Join-Path $cacheRoot "nsis")

# 3. nsis-resources (NSIS 资源文件)
Download-And-Extract `
  -Name "nsis-resources" `
  -Version "3.4.1" `
  -MirrorBase "https://registry.npmmirror.com/-/binary/electron-builder-binaries" `
  -CacheDir (Join-Path $cacheRoot "nsis")

Write-Host ""
Write-Host "========================================"
Write-Host "  全部准备完成！"
Write-Host "  现在可以执行: npm run pack"
Write-Host "========================================"
