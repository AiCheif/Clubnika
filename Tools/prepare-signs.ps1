param(
    [string]$Source = 'D:\Downloads\Telegram Desktop\Сигны',
    [string]$Site = '',
    [switch]$RerollFruits
)
$ErrorActionPreference = 'Stop'
if (!$Site) {
    $Site = if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'signs.html')) { $PSScriptRoot } else { Split-Path -Parent $PSScriptRoot }
}
$Source = (Resolve-Path -LiteralPath $Source).Path
$Site = [IO.Path]::GetFullPath($Site)
if (!(Test-Path -LiteralPath (Join-Path $Site 'signs.html'))) { throw "Site directory does not contain signs.html: $Site" }
$Media = Join-Path $Site 'signs'
foreach ($folder in @('originals','previews','posters')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $Media $folder) | Out-Null
}
$scale = "scale=w='min(iw,640)':h='min(ih,640)':force_original_aspect_ratio=decrease:force_divisible_by=2"
$albumFile = Join-Path $Media 'albums.js'
$legacyFile = Join-Path $Media 'data.js'

# Набор фруктов для мини-игры (через Unicode-коды, чтобы не зависеть от кодировки PowerShell 5.1)
$WinFruit = [char]::ConvertFromUtf32(0x1F353) # 🍓 выигрышная сигна
$RegularFruits = @(
    [char]::ConvertFromUtf32(0x1F352), # 🍒
    [char]::ConvertFromUtf32(0x1F34B), # 🍋
    [char]::ConvertFromUtf32(0x1F351), # 🍑
    [char]::ConvertFromUtf32(0x1F347), # 🍇
    [char]::ConvertFromUtf32(0x1F34F), # 🍏
    [char]::ConvertFromUtf32(0x1F34A), # 🍊
    [char]::ConvertFromUtf32(0x1F349), # 🍉
    [char]::ConvertFromUtf32(0x1F34D)  # 🍍
)
$AllFruits = @($WinFruit) + $RegularFruits

function Get-RandomDistinct([string[]]$Pool, [int]$Count) {
    if ($Count -le 0) { return [string[]]@() }
    return [string[]]@($Pool | Get-Random -Count ([Math]::Min($Count, $Pool.Count)))
}

function Set-AlbumFruits($records, [switch]$ForceReroll) {
    if (!$records -or $records.Count -eq 0) { return $records }

    # Проверяем, корректно ли уже назначены фрукты:
    # фото -> 1 фрукт, видео -> 3 разных фрукта, и ровно одна 🍓 на весь альбом
    if (!$ForceReroll) {
        $allValid = $true
        $winCount = 0
        foreach ($item in $records) {
            $expectedCount = if ($item.type -eq 'video') { 3 } else { 1 }
            $arr = @($item['fruits'])
            if ($arr.Count -ne $expectedCount) {
                $allValid = $false
                break
            }
            $unique = @($arr | Select-Object -Unique)
            if ($unique.Count -ne $expectedCount) {
                $allValid = $false
                break
            }
            foreach ($f in $arr) {
                if ([string]::IsNullOrWhiteSpace($f) -or ($AllFruits -notcontains $f)) {
                    $allValid = $false
                    break
                }
                if ($f -eq $WinFruit) { $winCount++ }
            }
            if (!$allValid) { break }
        }
        if ($allValid -and $winCount -eq 1) {
            return $records
        }
    }

    # Строим пул билетов: у фото 1 билет, у видео 3 билета (шанс победы в 3 раза выше)
    $tickets = New-Object 'System.Collections.Generic.List[int]'
    for ($i = 0; $i -lt $records.Count; $i++) {
        $weight = if ($records[$i].type -eq 'video') { 3 } else { 1 }
        for ($w = 0; $w -lt $weight; $w++) {
            $tickets.Add($i)
        }
    }

    $winnerIndex = $tickets[(Get-Random -Minimum 0 -Maximum $tickets.Count)]

    for ($i = 0; $i -lt $records.Count; $i++) {
        $isVideo = ($records[$i].type -eq 'video')
        $isWinner = ($i -eq $winnerIndex)
        if ($isVideo) {
            if ($isWinner) {
                $others = Get-RandomDistinct $RegularFruits 2
                $combo = @($WinFruit) + $others
                # Перемешиваем порядок 3 фруктов, чтобы клубничка была на случайной позиции
                $records[$i]['fruits'] = [string[]]@($combo | Get-Random -Count 3)
            } else {
                $records[$i]['fruits'] = Get-RandomDistinct $RegularFruits 3
            }
        } else {
            if ($isWinner) {
                $records[$i]['fruits'] = [string[]]@($WinFruit)
            } else {
                $records[$i]['fruits'] = Get-RandomDistinct $RegularFruits 1
            }
        }
    }

    return $records
}

function Get-NormalizedAlbum($date, $records, $cover, [switch]$ForceReroll) {
    if ($records -and $records.PSObject.Properties['value']) { $records = $records.value }
    $clean = New-Object 'System.Collections.Generic.List[object]'
    foreach ($record in $records) {
        if (!$record.id -or !$record.preview -or !$record.poster) { throw "Invalid media record in album $date" }
        $entry = [ordered]@{
            id       = $record.id
            type     = $record.type
            name     = $record.name
            original = $record.original
            preview  = $record.preview
            poster   = $record.poster
            bytes    = $record.bytes
        }
        $rawFruits = $null
        if ($record -is [System.Collections.IDictionary] -and $record.Contains('fruits')) {
            $rawFruits = $record['fruits']
        } elseif ($record.PSObject.Properties['fruits']) {
            $rawFruits = $record.fruits
        }
        if ($rawFruits) {
            $validList = @($rawFruits | Where-Object { ![string]::IsNullOrWhiteSpace($_) -and ($AllFruits -contains $_) } | ForEach-Object { [string]$_ })
            if ($validList.Count -gt 0) {
                $entry['fruits'] = [string[]]$validList
            }
        }
        $clean.Add($entry)
    }
    if ($clean.Count -eq 0) { throw "Empty album: $date" }
    $itemsArray = Set-AlbumFruits $clean.ToArray() -ForceReroll:$ForceReroll
    if ($cover -isnot [string] -or !$cover) {
        $firstPhoto = $itemsArray | Where-Object { $_.type -eq 'photo' } | Select-Object -First 1
        if (!$firstPhoto) { $firstPhoto = $itemsArray[0] }
        $cover = $firstPhoto.poster
    }
    return [ordered]@{date=$date;items=$itemsArray;cover=$cover}
}

$albums = @{}
if (Test-Path -LiteralPath $albumFile) {
    $existing = Get-Content -LiteralPath $albumFile -Raw -Encoding UTF8
    if ($existing -match '(?s)window\.SIGN_ALBUMS\s*=\s*(\[.*\]|\{.*\})\s*;\s*$') {
        try {
            $oldAlbums = ConvertFrom-Json -InputObject $Matches[1] -ErrorAction Stop
            if ($oldAlbums.PSObject.Properties['value']) { $oldAlbums = $oldAlbums.value }
            foreach ($old in $oldAlbums) {
                $albums[$old.date] = Get-NormalizedAlbum $old.date $old.items $old.cover -ForceReroll:$RerollFruits
            }
        } catch {
            # Migrate the original single-album catalog without changing its date.
            if ($existing -notmatch "date:\s*'2026-11-20'" -or $existing -notmatch 'items:\s*window\.SIGN_ITEMS' -or !(Test-Path -LiteralPath $legacyFile)) { throw 'Unknown albums.js format. Existing albums were not changed.' }
            $legacy = Get-Content -LiteralPath $legacyFile -Raw -Encoding UTF8
            if ($legacy -notmatch '(?s)window\.SIGN_ITEMS\s*=\s*(\[.*\])\s*;\s*$') { throw 'Invalid legacy data.js.' }
            $oldItems = ConvertFrom-Json -InputObject $Matches[1] -ErrorAction Stop
            $albums['2026-11-20'] = Get-NormalizedAlbum '2026-11-20' $oldItems $null -ForceReroll:$RerollFruits
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
    $prevFruitsById = @{}
    if (!$RerollFruits -and $albums.ContainsKey($date)) {
        foreach ($prevItem in $albums[$date].items) {
            if ($prevItem.id -and $prevItem['fruits']) {
                $prevFruitsById[$prevItem.id] = [string[]]@($prevItem['fruits'])
            }
        }
    }

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
        $rec = [ordered]@{
            id       = $id
            type     = $(if($isVideo){'video'}else{'photo'})
            name     = $f.Name
            original = "signs/$original"
            preview  = "signs/$preview"
            poster   = "signs/$poster"
            bytes    = $f.Length
        }
        if ($prevFruitsById.ContainsKey($id)) {
            $rec['fruits'] = $prevFruitsById[$id]
        }
        $items += $rec
        Write-Host "$($f.Name): $((Get-Item -LiteralPath $pp).Length) bytes"
    }
    $cover = $items | Where-Object { $_.type -eq 'photo' } | Select-Object -First 1
    if (!$cover) { $cover = $items | Select-Object -First 1 }
    $albums[$date] = Get-NormalizedAlbum $date $items $cover.poster -ForceReroll:$RerollFruits
    $winner = $albums[$date].items | Where-Object { @($_['fruits']) -contains $WinFruit } | Select-Object -First 1
    Write-Host "Album $date : $($items.Count) files (winner: $($winner.name) -> $(@($winner['fruits']) -join ' '))"
}
if (!$albums.Count) { throw 'No albums to publish.' }
$jsonParts = foreach ($entry in ($albums.Values | Sort-Object { $_.date } -Descending)) {
    $recordParts = foreach ($record in $entry.items) { ConvertTo-Json -InputObject $record -Depth 5 -Compress }
    $dateJson = ConvertTo-Json -InputObject ([string]$entry.date) -Compress
    $coverJson = ConvertTo-Json -InputObject ([string]$entry.cover) -Compress
    '{"date":' + $dateJson + ',"items":[' + ($recordParts -join ',') + '],"cover":' + $coverJson + '}'
}
$json = '[' + ($jsonParts -join ",`n") + ']'
$temporaryCatalog = Join-Path $Media 'albums.js.tmp'
[IO.File]::WriteAllText($temporaryCatalog,"window.SIGN_ALBUMS = $json;`n",[Text.UTF8Encoding]::new($false))
Move-Item -LiteralPath $temporaryCatalog -Destination $albumFile -Force
Write-Host "Ready: $($albums.Count) albums. Originals are unchanged."
