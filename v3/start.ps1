Set-Location (Join-Path $PSScriptRoot "..")
Write-Host "http://127.0.0.1:8770/v3/"
Start-Process "http://127.0.0.1:8770/v3/"
python -m http.server 8770
