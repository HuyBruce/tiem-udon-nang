param(
    [string]$SourceDirectory = 'dist',
    [string]$SourceZip = '',
    [Parameter(Mandatory = $true)][string]$OutputZip
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$outputPath = [IO.Path]::GetFullPath($OutputZip)
if (Test-Path -LiteralPath $outputPath) { throw "Output already exists: $outputPath" }
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($outputPath)) | Out-Null
$inputArchive = $null
$outputArchive = $null
try {
    if ($SourceZip) {
        $inputArchive = [IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($SourceZip))
    } else {
        $sourcePath = (Resolve-Path -LiteralPath $SourceDirectory).Path.TrimEnd([char[]]'\/')
        if (!(Test-Path -LiteralPath (Join-Path $sourcePath 'index.html'))) { throw 'Missing root index.html' }
    }
    $outputArchive = [IO.Compression.ZipFile]::Open($outputPath, [IO.Compression.ZipArchiveMode]::Create)
    if ($inputArchive) {
        foreach ($entry in $inputArchive.Entries) {
            $webPath = $entry.FullName.Replace('\', '/')
            if ($webPath.EndsWith('/')) { continue }
            if ($webPath.StartsWith('/') -or $webPath.Split('/') -contains '..') { throw "Invalid path: $webPath" }
            $target = $outputArchive.CreateEntry($webPath, [IO.Compression.CompressionLevel]::Optimal)
            $target.LastWriteTime = $entry.LastWriteTime
            $inputStream = $entry.Open()
            $outputStream = $target.Open()
            try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose(); $inputStream.Dispose() }
        }
    } else {
        foreach ($file in Get-ChildItem -LiteralPath $sourcePath -Recurse -File) {
            $webPath = $file.FullName.Substring($sourcePath.Length + 1).Replace('\', '/')
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($outputArchive, $file.FullName, $webPath, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    }
} finally {
    if ($outputArchive) { $outputArchive.Dispose() }
    if ($inputArchive) { $inputArchive.Dispose() }
}
$check = [IO.Compression.ZipFile]::OpenRead($outputPath)
try {
    $names = @($check.Entries | ForEach-Object FullName)
    if ($names -notcontains 'index.html' -or $names -notcontains 'sw.js') { throw 'Missing root index.html/sw.js' }
    if (@($names | Where-Object { $_.Contains('\') }).Count) { throw 'Backslash found in ZIP entry paths' }
    if (@($names | Select-Object -Unique).Count -ne $names.Count) { throw 'Duplicate ZIP entry paths' }
    if ($names.Count -gt 1000 -or @($check.Entries | Where-Object Length -GT 26214400).Count) { throw 'Cloudflare dashboard upload limit exceeded' }
    Write-Output "ZIP verified: $($names.Count) files, all web paths use /"
} finally { $check.Dispose() }
Get-FileHash -LiteralPath $outputPath -Algorithm SHA256
