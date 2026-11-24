param(
    [string]$Source = 'D:\Downloads\Telegram Desktop\Сигны',
    [string]$Site = (Split-Path -Parent $PSScriptRoot)
)
$ErrorActionPreference = 'Stop'
$Source = (Resolve-Path -LiteralPath $Source).Path
$Site = [IO.Path]::GetFullPath($Site)
$Media = Join-Path $Site 'signs'
foreach ($folder in @('originals','previews','posters')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $Media $folder) | Out-Null
}
$scale = "scale=w='min(iw,640)':h='min(ih,640)':force_original_aspect_ratio=decrease:force_divisible_by=2"
$albumFile = Join-Path $Media 'albums.js'
$legacyFile = Join-Path $Media 'data.js'
$albums = @{}
if (Test-Path -LiteralPath $albumFile) {
    $existing = Get-Content -LiteralPath $albumFile -Raw -Encoding UTF8
    if ($existing -match '(?s)window\.SIGN_ALBUMS\s*=\s*(\[.*\])\s*;\s*$') {
        try {
            $oldAlbums = ConvertFrom-Json -InputObject $Matches[1] -ErrorAction Stop
            foreach ($old in $oldAlbums) { $albums[$old.date] = $old }
        } catch {
            # Migrate the original single-album catalog without changing its date.
            if ($existing -notmatch "date:\s*'2026-11-20'" -or $existing -notmatch 'items:\s*window\.SIGN_ITEMS' -or !(Test-Path -LiteralPath $legacyFile)) { throw 'Unknown albums.js format. Existing albums were not changed.' }
            $legacy = Get-Content -LiteralPath $legacyFile -Raw -Encoding UTF8
            if ($legacy -notmatch '(?s)window\.SIGN_ITEMS\s*=\s*(\[.*\])\s*;\s*$') { throw 'Invalid legacy data.js.' }
            $oldItems = @(ConvertFrom-Json -InputObject $Matches[1] -ErrorAction Stop)
            $cover = $oldItems | Where-Object { $_.type -eq 'photo' } | Select-Object -First 1
            if (!$cover) { $cover = $oldItems | Select-Object -First 1 }
            $albums['2026-11-20'] = [ordered]@{date='2026-11-20';items=$oldItems;cover=$cover.poster}
        }
    } else { throw 'Unknown albums.js format. Existing albums were not changed.' }
} elseif (Test-Path -LiteralPath $legacyFile) { throw 'Existing data.js found without albums.js. Restore albums.js before updating.' }

$folders = @(Get-ChildItem -LiteralPath $Source -Directory | Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}$' } | Sort-Object Name)
if (!$folders.Count) { throw 'No album folders found. Create a folder named YYYY-MM-DD in the source directory.' }
function Invoke-Encode([string[]]$Arguments, [string]$Output) {
    $temporary = Join-Path (Split-Path -Parent $Output) (([IO.Path]::GetFileNameWithoutExtension($Output)) + '.tmp' + [IO.Path]::GetExtension($Output))
    & ffmpeg -nostdin -hide_banner -loglevel error -y @Arguments $temporary
    if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $temporary)) { throw "ffmpeg failed: $Output" }
    Move-Item -LiteralPath $temporary -Destination $Output -Force
}
foreach ($folder in $folders) {
    $date = [datetime]::ParseExact($folder.Name, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture).ToString('yyyy-MM-dd')
    $items = @()
    $files = @(Get-ChildItem -LiteralPath $folder.FullName -File | Where-Object { $_.Extension.ToLowerInvariant() -in @('.jpg','.jpeg','.png','.webp','.mov','.mp4','.m4v','.webm') } | Sort-Object Name)
    if (!$files.Count) { Write-Warning "Empty album skipped: $date"; continue }
    foreach ($f in $files) {
        $ext = $f.Extension.ToLowerInvariant()
        $isVideo = $ext -in @('.mov','.mp4','.m4v','.webm')
        $id = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash.ToLowerInvariant().Substring(0,24)
        $original = "originals/$id$ext"
        $preview = if ($isVideo) { "previews/$id.mp4" } else { "previews/$id.jpg" }
        $poster = if ($isVideo) { "posters/$id.jpg" } else { $preview }
        $op = Join-Path $Media $original; $pp = Join-Path $Media $preview; $tp = Join-Path $Media $poster
        if (!(Test-Path -LiteralPath $op)) { Copy-Item -LiteralPath $f.FullName -Destination $op }
        if (!(Test-Path -LiteralPath $pp)) {
            if ($isVideo) { Invoke-Encode @('-i',$f.FullName,'-map','0:v:0','-map','0:a:0?','-vf',$scale,'-c:v','libx264','-preset','medium','-crf','30','-pix_fmt','yuv420p','-c:a','aac','-b:a','48k','-movflags','+faststart') $pp }
            else { Invoke-Encode @('-i',$f.FullName,'-vf',$scale,'-frames:v','1','-q:v','5') $pp }
        }
        if ($isVideo -and !(Test-Path -LiteralPath $tp)) { Invoke-Encode @('-i',$pp,'-frames:v','1','-q:v','5') $tp }
        $items += [ordered]@{id=$id;type=$(if($isVideo){'video'}else{'photo'});name=$f.Name;original="signs/$original";preview="signs/$preview";poster="signs/$poster";bytes=$f.Length}
        Write-Host "$($f.Name): $((Get-Item -LiteralPath $pp).Length) bytes"
    }
    $cover = $items | Where-Object { $_.type -eq 'photo' } | Select-Object -First 1
    if (!$cover) { $cover = $items | Select-Object -First 1 }
    $albums[$date] = [ordered]@{date=$date;items=@($items);cover=$cover.poster}
    Write-Host "Album $date : $($items.Count) files"
}
if (!$albums.Count) { throw 'No albums to publish.' }
$json = ConvertTo-Json -InputObject @($albums.Values | Sort-Object { $_.date } -Descending) -Depth 8
$temporaryCatalog = Join-Path $Media 'albums.js.tmp'
[IO.File]::WriteAllText($temporaryCatalog,"window.SIGN_ALBUMS = $json;`n",[Text.UTF8Encoding]::new($false))
Move-Item -LiteralPath $temporaryCatalog -Destination $albumFile -Force
Write-Host "Ready: $($albums.Count) albums. Originals are unchanged."
