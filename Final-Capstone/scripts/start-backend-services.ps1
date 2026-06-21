$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root ".backend-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$services = @(
  @{ Name = "api-gateway"; Path = "services/api-gateway"; Port = 8000 },
  @{ Name = "ingest-service"; Path = "services/ingest-service"; Port = 8001 },
  @{ Name = "telemetry-store"; Path = "services/telemetry-store"; Port = 8002 },
  @{ Name = "analysis-service"; Path = "services/analysis-service"; Port = 8003 },
  @{ Name = "incidents-service"; Path = "services/incidents-service"; Port = 8004 },
  @{ Name = "dependency-service"; Path = "services/dependency-service"; Port = 8005 }
)

foreach ($service in $services) {
  $existing = Get-NetTCPConnection -LocalPort $service.Port -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "$($service.Name) already has a process on port $($service.Port)."
    continue
  }

  $servicePath = Join-Path $root $service.Path
  $stdout = Join-Path $logDir "$($service.Name).out.log"
  $stderr = Join-Path $logDir "$($service.Name).err.log"

  Start-Process `
    -FilePath "C:\Users\Admin\AppData\Local\Programs\Python\Python311\python.exe" `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "$($service.Port)" `
    -WorkingDirectory $servicePath `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -WindowStyle Hidden

  Write-Host "Started $($service.Name) on port $($service.Port)."
}

Write-Host "Backend service logs: $logDir"
