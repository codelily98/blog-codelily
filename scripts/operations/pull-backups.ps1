param(
    [string]$Server = 'iwinv-cloud',
    [string]$Destination,
    [string]$IdentityFile
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (!$Destination) { $Destination = Join-Path $repoRoot '.local/backups' }
if (!$IdentityFile) { $IdentityFile = Join-Path $repoRoot '.local/secrets/backup-export' }
$destinationPath = [IO.Path]::GetFullPath($Destination)
New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null
if ((Get-Item -LiteralPath $destinationPath).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Backup destination must not be a link.' }
$archivePath = Join-Path $destinationPath ('.download-' + [guid]::NewGuid().ToString('N') + '.tar')
$process = [Diagnostics.Process]::new()
$process.StartInfo.FileName = (Get-Command ssh -ErrorAction Stop).Source
$process.StartInfo.UseShellExecute = $false
$process.StartInfo.RedirectStandardOutput = $true
$process.StartInfo.RedirectStandardError = $true
foreach ($argument in @('-i', $IdentityFile, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'User=codelily-backup', $Server, 'export')) { $process.StartInfo.ArgumentList.Add($argument) }
try {
    [void]$process.Start()
    $errors = $process.StandardError.ReadToEndAsync()
    $stream = [IO.File]::Open($archivePath, [IO.FileMode]::CreateNew)
    try {
        $buffer = [byte[]]::new(81920)
        $total = 0L
        while (($read = $process.StandardOutput.BaseStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $total += $read
            if ($total -gt 536870912) { throw 'Ciphertext export exceeds the 512 MiB transfer limit.' }
            $stream.Write($buffer, 0, $read)
        }
    } finally { $stream.Dispose() }
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw 'Backup-only SSH export failed; check host access and the dedicated key.' }
    $entries = @(& tar -tf $archivePath)
    if ($LASTEXITCODE -ne 0 -or !$entries.Count) { throw 'Invalid or empty backup export.' }
    $allowed = '^(\d{8}T\d{6}Z)/(database\.dump\.age|roles\.sql\.age|configuration\.tar\.gz\.age|caddy-data\.tar\.gz\.age|manifest\.json)$'
    foreach ($entry in $entries) {
        if ($entry -notmatch $allowed) { throw 'Unexpected archive member; refusing extraction.' }
        $target = Join-Path $destinationPath $entry
        foreach ($candidate in @((Split-Path $target -Parent), $target)) {
            if ((Test-Path -LiteralPath $candidate) -and ((Get-Item -LiteralPath $candidate).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Archive target must not be a link.' }
        }
    }
    & tar -xf $archivePath -C $destinationPath
    if ($LASTEXITCODE -ne 0) { throw 'Ciphertext extraction failed.' }
    $snapshots = @($entries | ForEach-Object { ($_ -split '/')[0] } | Sort-Object -Unique)
    foreach ($snapshot in $snapshots) {
        $folder = Join-Path $destinationPath $snapshot
        $manifest = Get-Content -Raw -LiteralPath (Join-Path $folder 'manifest.json') | ConvertFrom-Json
        if ($manifest.created_at -ne $snapshot) { throw 'Snapshot timestamp mismatch.' }
        if (@($manifest.files.PSObject.Properties).Count -ne 4) { throw 'Unexpected encrypted file count.' }
        foreach ($filename in @('database.dump.age', 'roles.sql.age', 'configuration.tar.gz.age', 'caddy-data.tar.gz.age')) {
            $expected = $manifest.files.$filename
            if (!$expected) { throw 'Missing encrypted backup manifest entry.' }
            $file = Join-Path $folder $filename
            if ((Get-Item -LiteralPath $file).Length -ne $expected.bytes) { throw 'Ciphertext size mismatch.' }
            if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected.sha256) { throw 'Ciphertext SHA256 mismatch.' }
        }
    }
    @{ completedAt = (Get-Date).ToUniversalTime().ToString('o'); snapshots = $snapshots.Count } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destinationPath 'last-success.json') -Encoding utf8
    $cutoff = (Get-Date).ToUniversalTime().AddDays(-7)
    foreach ($folder in Get-ChildItem -LiteralPath $destinationPath -Directory) {
        if ($folder.Name -match '^\d{8}T\d{6}Z$' -and !($folder.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            $created = [datetime]::ParseExact($folder.Name, "yyyyMMdd'T'HHmmss'Z'", [Globalization.CultureInfo]::InvariantCulture)
            $resolved = [IO.Path]::GetFullPath($folder.FullName)
            if ($created -lt $cutoff -and [IO.Path]::GetDirectoryName($resolved) -eq $destinationPath) { Remove-Item -LiteralPath $resolved -Recurse -Force }
        }
    }
    Write-Output ('Verified encrypted off-host snapshots: ' + $snapshots.Count)
} finally {
    if ($process.Id -and !$process.HasExited) { $process.Kill() }
    $process.Dispose()
    if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }
}
