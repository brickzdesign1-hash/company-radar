$destination = "Company_Radar_Final.zip"
if (Test-Path $destination) { Remove-Item $destination }

# Wir erstellen eine Liste aller Dateien, die wir wirklich wollen
$filesToPack = New-Object System.Collections.Generic.List[string]

# 1. Alle Python-Dateien im Backend
Get-ChildItem -Path "backend" -Recurse -Include *.py, Dockerfile, requirements.txt | ForEach-Object { $filesToPack.Add($_.FullName) }

# 2. Alle Frontend-Dateien (App, Components, Libs und Configs)
Get-ChildItem -Path "frontend" -Recurse -Include *.tsx, *.ts, *.json, *.css, *.mjs | Where-Object { $_.FullName -notmatch "node_modules" -and $_.FullName -notmatch ".next" } | ForEach-Object { $filesToPack.Add($_.FullName) }

# 3. Dateien auf der Hauptebene
Get-ChildItem -Path "." -Include docker-compose.yml, README.md, .env | ForEach-Object { $filesToPack.Add($_.FullName) }

# Jetzt packen wir diese spezifische Liste
if ($filesToPack.Count -gt 0) {
    Compress-Archive -Path $filesToPack -DestinationPath $destination
    Write-Host "Erfolg! $($filesToPack.Count) Dateien wurden in $destination gepackt." -ForegroundColor Green
} else {
    Write-Host "Fehler: Keine Dateien gefunden!" -ForegroundColor Red
}
pause