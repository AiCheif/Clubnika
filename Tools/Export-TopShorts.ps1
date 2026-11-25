[CmdletBinding()]
param(
    [ValidateRange(1, 1000)] [int]$Count = 15,
    [string]$OutputDirectory = (Join-Path $env:USERPROFILE ("Downloads\Clubnika-TopShorts-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))),
    [string]$YtDlp = 'yt-dlp',
    [string]$Browser = ''
)

$ErrorActionPreference = 'Stop'
$catalogPath = Join-Path $PSScriptRoot '..\shorts-data.js'

# Catalog items are JSON objects, one per line inside shortsCatalog.items.
$items = @(Get-Content -LiteralPath $catalogPath -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim().TrimEnd(',')
    if ($line -match '^\{"id"\s*:') {
        $line | ConvertFrom-Json
    }
})
$top = @($items | Where-Object { $null -ne $_.views -and $_.id -match '^[A-Za-z0-9_-]{11}$' } |
    Sort-Object views -Descending | Group-Object id | ForEach-Object { $_.Group[0] } |
    Sort-Object views -Descending | Select-Object -First $Count)
if ($top.Count -eq 0) { throw 'No shorts with view counts found in shorts-data.js.' }

$command = Get-Command $YtDlp -ErrorAction SilentlyContinue
if (-not $command) { throw 'yt-dlp not found. Install it or pass -YtDlp "C:\path\to\yt-dlp.exe".' }
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { throw 'ffmpeg is required for JPEG thumbnail conversion.' }

$null = New-Item -ItemType Directory -Path $OutputDirectory -Force
$OutputDirectory = (Resolve-Path -LiteralPath $OutputDirectory).Path
$summary = @()
$rank = 0

function Save-Json($Value, [string]$Path) {
    ConvertTo-Json -InputObject $Value -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
}

foreach ($item in $top) {
    $rank++
    $folder = Join-Path $OutputDirectory ('{0:D2}_{1}' -f $rank, $item.id)
    $null = New-Item -ItemType Directory -Path $folder -Force
    $url = 'https://www.youtube.com/shorts/' + $item.id
    $infoPath = Join-Path $folder 'info.json'
    $commentsPath = Join-Path $folder 'comments.json'
    $coverPath = Join-Path $folder 'cover.jpg'
    $rawPath = Join-Path $folder 'thumbnail.info.json'
    $thumbnailPath = Join-Path $folder 'thumbnail.jpg'
    Write-Host "[$rank/$($top.Count)] $($item.title) ($($item.views) catalog views)"
$argsList = @('--ignore-no-formats-error', '--no-playlist', '--skip-download',
    '--write-info-json', '--no-clean-info-json',
    '--write-comments', '--extractor-args',
    'youtube:comment_sort=top;max_comments=all,all,0,0',
    '--write-thumbnail', '--convert-thumbnails', 'jpg',
    '--no-progress', '-o', (Join-Path $folder 'thumbnail.%(ext)s'))
    if ($Browser) { $argsList += @('--cookies-from-browser', $Browser) }
    $argsList += $url

    $row = [ordered]@{ rank = $rank; id = $item.id; title = $item.title; url = $url;
        channel = $null; upload_date = $null; catalog_views = $item.views; views = $null;
        likes = $null; comment_count = $null; comments_downloaded = $null;
        cover = $null; status = 'error'; collected_at = (Get-Date).ToString('o') }

    try {
        & $command.Source @argsList
        $exitCode = $LASTEXITCODE
        if (-not (Test-Path -LiteralPath $rawPath)) { throw "yt-dlp did not produce metadata (exit $exitCode)." }
        $video = Get-Content -LiteralPath $rawPath -Raw -Encoding UTF8 | ConvertFrom-Json

        # Keep top-level comments only, even if an extractor returns replies.
        $comments = @($video.comments | Where-Object { $_ -and $_.parent -eq 'root' } | ForEach-Object {
            [ordered]@{ id = $_.id; author = $_.author; text = $_.text; likes = $_.like_count;
                timestamp = $_.timestamp; is_pinned = $_.is_pinned }
        })
        Save-Json $comments $commentsPath

        # Prefer the exact vertical Shorts cover shown in our catalog.
        # thumbnail.jpg separately retains the best thumbnail selected by yt-dlp.
        if ($item.thumbnail) {
            try { Invoke-WebRequest -Uri $item.thumbnail -OutFile $coverPath -UseBasicParsing -TimeoutSec 30 }
            catch { Write-Warning "Catalog cover unavailable: $($_.Exception.Message)" }
        }
        if (-not (Test-Path -LiteralPath $coverPath) -and (Test-Path -LiteralPath $thumbnailPath)) {
            Copy-Item -LiteralPath $thumbnailPath -Destination $coverPath
        }

        $row.title = $video.title
        $row.channel = $video.channel
        $row.upload_date = $video.upload_date
        $row.views = $video.view_count
        $row.likes = $video.like_count
        $row.comment_count = $video.comment_count
        $row.comments_downloaded = $comments.Count
        if (Test-Path -LiteralPath $coverPath) { $row.cover = "$([IO.Path]::GetFileName($folder))/cover.jpg" }
        $hasComments = $null -ne $video.comments -or $video.comment_count -eq 0
        if ($exitCode -eq 0 -and $hasComments -and $row.cover) { $row.status = 'ok' }
        else { $row.status = 'partial' }
        Save-Json $row $infoPath
        Write-Host "    Views: $($row.views); likes: $($row.likes); comments saved: $($comments.Count); $($row.status)"
    }
    catch {
        Write-Warning "Failed for $($item.id): $($_.Exception.Message)"
        Save-Json $row $infoPath
    }
    $summary += [pscustomobject]$row
    $summary | Export-Csv -LiteralPath (Join-Path $OutputDirectory 'summary.csv') -NoTypeInformation -Encoding UTF8
    Save-Json @($summary) (Join-Path $OutputDirectory 'summary.json')
}

Write-Host "Done: $OutputDirectory"
