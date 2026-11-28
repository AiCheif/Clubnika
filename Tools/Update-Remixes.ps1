[CmdletBinding(DefaultParameterSetName = 'Song')]
param(
    [Parameter(Mandatory = $true, ParameterSetName = 'Song')][string] $Song,
    [Parameter(Mandatory = $true, ParameterSetName = 'All')][switch] $All,
    [string] $DataRoot = 'D:\ClubnikaData\remixes',
    [string] $YtDlp = (Join-Path $PSScriptRoot 'yt-dlp.exe'),
    [string] $ArtistChannelId = 'UCaNHjv1EbDNg0jyWDuH5Thw',
    [switch] $SkipDownload,
    [switch] $SkipChannelScan,
    [Parameter(ParameterSetName = 'Song')][switch] $AcceptAllCandidates,
    [Parameter(ParameterSetName = 'Song')][string[]] $MatchTerm,
    [ValidateRange(1,100)][int] $MaxChannelPages = 5,
    [switch] $Plan
)

$ErrorActionPreference = 'Stop'
if ($AcceptAllCandidates) {
    $SkipDownload = $true
    $SkipChannelScan = $true
}
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dataPath = [IO.Path]::GetFullPath($DataRoot)
$repoPrefix = $repo.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if ($dataPath -eq $repo -or $dataPath.StartsWith($repoPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'DataRoot must be outside the repository.'
}
$utf8 = [Text.UTF8Encoding]::new($false)
$supportsDateKind = (Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')

function Read-Json([string] $Path) {
    $json = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if ($supportsDateKind) { $json | ConvertFrom-Json -DateKind String }
    else { $json | ConvertFrom-Json }
}

function Resolve-ProjectPath([string] $Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { throw 'A project file path is missing.' }
    $full = [IO.Path]::GetFullPath((Join-Path $repo $Path))
    $prefix = (Join-Path $repo 'remixes') + [IO.Path]::DirectorySeparatorChar
    if (!$full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Project file must be within remixes/: $Path"
    }
    $full
}

function Write-Json([string] $Path, $Value) {
    $json = $Value | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, $utf8)
}

function Read-Count($Value) {
    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) { return $null }
    $number = 0L
    if ([long]::TryParse([string]$Value, [ref]$number) -and $number -ge 0) { return $number }
    return $null
}

function Get-YouTubeItems {
    param([ValidateSet('videos', 'channels')][string] $Resource, [string] $Part, [string[]] $Ids)
    for ($start = 0; $start -lt $Ids.Count; $start += 50) {
        $last = [Math]::Min($start + 49, $Ids.Count - 1)
        $batch = $Ids[$start..$last] -join ','
        $uri = 'https://www.googleapis.com/youtube/v3/{0}?part={1}&id={2}' -f $Resource, $Part, [Uri]::EscapeDataString($batch)
        Write-Host ('{0}: {1}-{2} of {3}' -f $Resource, ($start + 1), ($last + 1), $Ids.Count)
        try {
            $response = Invoke-RestMethod -Uri $uri -Headers @{'x-goog-api-key' = $apiKey} -Method Get -TimeoutSec 45
        } catch {
            throw ('YouTube API request failed. Check API enablement, key restrictions, quota and connection.')
        }
        if ($null -eq $response.PSObject.Properties['items']) { throw 'Invalid YouTube API response.' }
        foreach ($item in $response.items) { if ($null -ne $item) { $item } }
    }
}

function Convert-ToUtc($Value) {
    if ($Value -is [DateTime]) { return $Value.ToUniversalTime() }
    return [DateTimeOffset]::Parse([string]$Value, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal).UtcDateTime
}

function Normalize-MatchText([string] $Text) {
    # Treat hashtags and ordinary song titles identically, ignoring punctuation.
    return ($Text.ToLowerInvariant() -replace '[^\p{L}\p{Nd}]', '')
}

function Get-MatchTerms($Project, $Config) {
    $terms = @($Config.matchTerms) + @($MatchTerm)
    if ($Project.id -ne 'new-song') { $terms += $Project.title }
    @($terms | Where-Object { $_ -and (Normalize-MatchText $_).Length -ge 5 } | Sort-Object -Unique)
}

function Get-ChannelUploads([string] $PlaylistId, [DateTime] $Since) {
    $token = ''
    for ($page = 0; $page -lt $MaxChannelPages; $page++) {
        $uri = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=' + [Uri]::EscapeDataString($PlaylistId)
        if ($token) { $uri += '&pageToken=' + [Uri]::EscapeDataString($token) }
        try {
            $response = Invoke-RestMethod -Uri $uri -Headers @{'x-goog-api-key' = $apiKey} -Method Get -TimeoutSec 45
        } catch { throw "YouTube uploads request failed for playlist $PlaylistId." }
        if ($null -eq $response.PSObject.Properties['items']) { throw "Invalid uploads response for $PlaylistId." }
        $older = $false
        foreach ($item in $response.items) {
            # The uploads playlist is normally newest first. Never use the
            # playlist insertion date as a video's publication date.
            $date = $item.contentDetails.videoPublishedAt
            if ($date -and (Convert-ToUtc $date) -lt $Since) { $older = $true; continue }
            $id = $item.contentDetails.videoId
            if ($id -cmatch '^[A-Za-z0-9_-]{11}$') { $id }
        }
        $token = [string]$response.nextPageToken
        if (!$token -or $older) { return }
    }
    if ($token) { Write-Warning "Scan limit reached for $PlaylistId; increase -MaxChannelPages to inspect older uploads." }
}

function Find-ChannelRemixes($Project, $Config, [string[]] $SourceIds, [string[]] $ChannelIds, $AlreadyKnown) {
    $terms = @(Get-MatchTerms $Project $Config)
    $sourceDates = @()
    if ($Config.scanSince) {
        $since = Convert-ToUtc $Config.scanSince
    } else {
        foreach ($source in @(Get-YouTubeItems -Resource videos -Part 'snippet' -Ids $SourceIds)) {
            if ($source.snippet.publishedAt) { $sourceDates += Convert-ToUtc $source.snippet.publishedAt }
        }
        if (!$sourceDates.Count) {
            Write-Warning 'No source publication date available; set scanSince in sources.json to enable channel scanning.'
            return
        }
        $since = ($sourceDates | Sort-Object | Select-Object -First 1)
    }
    if (!$terms.Count) { Write-Warning 'No song match terms; only explicit source links can match automatically. Other recent short videos will be listed for review.' }
    Write-Host ("Scanning {0} known channels since {1:yyyy-MM-dd}" -f $ChannelIds.Count, $since)
    $candidateIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($channel in @(Get-YouTubeItems -Resource channels -Part 'contentDetails' -Ids $ChannelIds)) {
        $playlist = $channel.contentDetails.relatedPlaylists.uploads
        if (!$playlist) { Write-Warning "No uploads playlist for $($channel.id)."; continue }
        foreach ($id in @(Get-ChannelUploads $playlist $since)) {
            if (!$AlreadyKnown.Contains($id)) { [void]$candidateIds.Add($id) }
        }
    }
    $candidateList = @($candidateIds | Sort-Object -CaseSensitive)
    foreach ($video in @(Get-YouTubeItems -Resource videos -Part 'snippet,contentDetails' -Ids $candidateList)) {
        if (!$video.snippet.publishedAt -or (Convert-ToUtc $video.snippet.publishedAt) -lt $since) { continue }
        if ($video.snippet.channelId -ceq $ArtistChannelId -or $SourceIds -ccontains $video.id) { continue }
        # Duration is a screening criterion, not proof that a video is a Short.
        try { $duration = [Xml.XmlConvert]::ToTimeSpan([string]$video.contentDetails.duration).TotalSeconds }
        catch { continue }
        if ($duration -le 0 -or $duration -gt 180) { continue }
        $description = [string]$video.snippet.description
        $fields = @($video.snippet.title, $description) + @($video.snippet.tags)
        $evidence = $null
        foreach ($sourceId in $SourceIds) {
            if ($description -cmatch ('(?:youtu\.be/|youtube\.com/(?:shorts/|watch\?v=|source/))' + [regex]::Escape($sourceId) + '(?![A-Za-z0-9_-])')) {
                $evidence = "source-link:$sourceId"; break
            }
        }
        if (!$evidence) {
            foreach ($term in $terms) {
                $needle = Normalize-MatchText $term
                if (@($fields | Where-Object { (Normalize-MatchText $_).Contains($needle) }).Count) {
                    $evidence = "song-term:$term"; break
                }
            }
        }
        [pscustomobject]@{
            id = [string]$video.id
            url = 'https://www.youtube.com/shorts/' + $video.id
            title = $video.snippet.title
            channelId = $video.snippet.channelId
            channelTitle = $video.snippet.channelTitle
            publishedAt = $video.snippet.publishedAt
            durationSeconds = $duration
            evidence = $evidence
            status = if ($evidence) { 'matched' } else { 'review' }
        }
    }
}

function Read-Export([string] $Path, [string] $SourceId) {
    $doc = Read-Json $Path
    if ($null -eq $doc.entries -or $doc.entries -isnot [array]) { throw "Invalid playlist export: $Path" }
    if ($doc.original_url -cnotmatch ('^https://(?:www\.)?youtube\.com/source/' + [regex]::Escape($SourceId) + '/shorts(?:[/?#]|$)')) {
        throw "Export source does not match $SourceId : $Path"
    }
    return $doc
}

function Get-Export([string] $Path, [string] $SourceId) {
    if ($SkipDownload) { return (Read-Export $Path $SourceId) }
    Write-Host "Downloading source $SourceId"
    $previousEncoding = [Console]::OutputEncoding
    $previousOutput = $OutputEncoding
    try {
        [Console]::OutputEncoding = $utf8
        $OutputEncoding = $utf8
        $lines = & $YtDlp --cookies-from-browser firefox --flat-playlist --dump-single-json "https://www.youtube.com/source/$SourceId/shorts"
        if ($LASTEXITCODE -ne 0) { throw "yt-dlp failed for $SourceId (exit $LASTEXITCODE)." }
    } finally {
        [Console]::OutputEncoding = $previousEncoding
        $OutputEncoding = $previousOutput
    }
    $temp = "$Path.$([guid]::NewGuid().ToString('N')).tmp"
    try {
        [IO.File]::WriteAllText($temp, ($lines -join "`n"), $utf8)
        $doc = Read-Export $temp $SourceId
        Move-Item -LiteralPath $temp -Destination $Path -Force
        return $doc
    } finally {
        if ([IO.File]::Exists($temp)) { [IO.File]::Delete($temp) }
    }
}

function Get-SourceIds($Project) {
    $config = Read-Json (Resolve-ProjectPath $Project.sources)
    $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($id in $config.sourceVideoIds) {
        if ($id -cnotmatch '^[A-Za-z0-9_-]{11}$') { throw "Invalid source ID: $id" }
        [void] $ids.Add([string]$id)
    }
    if (!$ids.Count) { throw "No sources configured for $($Project.id)." }
    @($ids | Sort-Object -CaseSensitive)
}

function Get-AcceptedCandidateIds($Project, $Config, [string] $ReportPath) {
    if (!(Test-Path -LiteralPath $ReportPath -PathType Leaf)) { throw "Candidate report not found: $ReportPath" }
    $report = Read-Json $ReportPath
    if ($report.projectId -cne $Project.id -or $null -eq $report.PSObject.Properties['candidates']) {
        throw "Invalid candidate report for $($Project.id): $ReportPath"
    }
    $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($id in @($Config.manualVideoIds) + @($report.candidates | ForEach-Object { $_.id })) {
        if ($id -cmatch '^[A-Za-z0-9_-]{11}$' -and @($Config.excludeVideoIds) -cnotcontains $id) {
            [void]$ids.Add([string]$id)
        }
    }
    @($ids | Sort-Object -CaseSensitive)
}

function Save-ProjectFiles($Files) {
    # Stage all JSON first. If a replacement fails, restore the files already changed.
    $staged = @()
    try {
        foreach ($file in $Files) {
            $temp = "$($file.Path).$([guid]::NewGuid().ToString('N')).tmp"
            $backup = "$($file.Path).$([guid]::NewGuid().ToString('N')).bak"
            $item = [pscustomobject]@{ Path = $file.Path; Temp = $temp; Backup = $backup; Existed = [IO.File]::Exists($file.Path); Done = $false }
            $staged += $item
            Write-Json $temp $file.Value
        }
        foreach ($item in $staged) {
            if ($item.Existed) { [IO.File]::Copy($item.Path, $item.Backup) }
            Move-Item -LiteralPath $item.Temp -Destination $item.Path -Force
            $item.Done = $true
        }
    } catch {
        for ($i = $staged.Count - 1; $i -ge 0; $i--) {
            $item = $staged[$i]
            if (!$item.Done) { continue }
            if ($item.Existed) { Move-Item -LiteralPath $item.Backup -Destination $item.Path -Force }
            else { [IO.File]::Delete($item.Path) }
        }
        throw
    } finally {
        foreach ($item in $staged) {
            if ([IO.File]::Exists($item.Temp)) { [IO.File]::Delete($item.Temp) }
        }
    }
    foreach ($item in $staged) {
        if ([IO.File]::Exists($item.Backup)) { [IO.File]::Delete($item.Backup) }
    }
}

$registry = Read-Json (Join-Path $repo 'remixes/projects.json')
$authorsPath = Join-Path $repo 'remixes/authors.json'
$projects = @($registry.projects)
$configuredPaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
[void]$configuredPaths.Add($authorsPath)
[void]$configuredPaths.Add((Join-Path $repo 'remixes/projects.json'))
foreach ($project in $projects) {
    if ($project.id -cnotmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') { throw "Invalid project ID: $($project.id)" }
    foreach ($property in @('sources', 'ranking', 'history')) {
        $path = Resolve-ProjectPath $project.$property
        if (!$configuredPaths.Add($path)) { throw "Duplicate project file path: $path" }
    }
}
if (@($projects | Group-Object id | Where-Object Count -gt 1).Count) { throw 'Duplicate project IDs.' }
$selected = if ($All) { $projects } else { @($projects | Where-Object { $_.id -ceq $Song }) }
if (!$selected) { throw "Unknown project: $Song" }

if ($Plan) {
    $directory = Read-Json $authorsPath
    $scanChannels = @($directory.authors.channelIds | Where-Object { $_ -cne $ArtistChannelId -and $_ -cmatch '^UC[A-Za-z0-9_-]{22}$' } | Sort-Object -Unique -CaseSensitive)
    foreach ($project in $selected) {
        $sourceIds = @(Get-SourceIds $project)
        $config = Read-Json (Resolve-ProjectPath $project.sources)
        $raw = Join-Path (Join-Path $dataPath $project.id) 'raw'
        Write-Host ("Project: {0} ({1}); sources: {2}" -f $project.id, $project.title, ($sourceIds -join ', '))
        Write-Host "Raw directory: $raw"
        Write-Host "Ranking: $($project.ranking); history: $($project.history)"
        if ($AcceptAllCandidates) {
            $reportPath = Join-Path (Split-Path $raw -Parent) 'channel-candidates.json'
            $accepted = @(Get-AcceptedCandidateIds $project $config $reportPath)
            Write-Host ("Manual IDs after acceptance: {0}; no source or channel downloads." -f $accepted.Count)
        }
        if (!$SkipChannelScan) {
            Write-Host ("Channel scan: {0} known channels; match terms: {1}" -f $scanChannels.Count, ((Get-MatchTerms $project $config) -join ', '))
        }
        $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        $complete = $true
        foreach ($id in $sourceIds) {
            $path = Join-Path $raw "$id.json"
            if (!(Test-Path -LiteralPath $path -PathType Leaf)) { $complete = $false; continue }
            $doc = Read-Export $path $id
            foreach ($entry in $doc.entries) {
                if ($entry.id -cmatch '^[A-Za-z0-9_-]{11}$') { [void]$ids.Add([string]$entry.id) }
            }
        }
        if ($complete) { Write-Host ("Cached videos: {0}; video API calls: {1}" -f $ids.Count, [Math]::Ceiling($ids.Count / 50)) }
        else { Write-Host 'Some cached exports are missing; API request count is not yet known.' }
    }
    return
}

if (!$SkipDownload -and !(Get-Command $YtDlp -ErrorAction SilentlyContinue)) { throw "yt-dlp not found: $YtDlp" }
$apiKey = $env:YOUTUBE_API_KEY
if ([string]::IsNullOrWhiteSpace($apiKey)) {
    $apiKey = [Environment]::GetEnvironmentVariable('YOUTUBE_API_KEY', 'User')
}
if ([string]::IsNullOrWhiteSpace($apiKey)) {
    $secret = Read-Host 'YouTube Data API key' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    try { $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $secret.Dispose() }
}
if ([string]::IsNullOrWhiteSpace($apiKey)) { throw 'An API key is required.' }

try {
    foreach ($project in $selected) {
        Write-Host "Updating $($project.id): $($project.title)"
        $sourceIds = @(Get-SourceIds $project)
        $rankingPath = Resolve-ProjectPath $project.ranking
        $historyPath = Resolve-ProjectPath $project.history
        $raw = Join-Path (Join-Path $dataPath $project.id) 'raw'
        $sourcesPath = Resolve-ProjectPath $project.sources
        $config = Read-Json $sourcesPath
        $previous = if (Test-Path -LiteralPath $rankingPath -PathType Leaf) { Read-Json $rankingPath }
        if (!$SkipDownload -or !$SkipChannelScan) { [void][IO.Directory]::CreateDirectory($raw) }
        $reportPath = Join-Path (Split-Path $raw -Parent) 'channel-candidates.json'
        if ($AcceptAllCandidates) {
            $accepted = @(Get-AcceptedCandidateIds $project $config $reportPath)
            $config | Add-Member -NotePropertyName manualVideoIds -NotePropertyValue $accepted -Force
            Write-Host ("Accepting saved candidates; {0} manual video IDs in total." -f $accepted.Count)
        }

        $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($id in @($previous.discoveredVideoIds) + @($previous.videos.id) + @($previous.unavailableVideoIds) + @($config.manualVideoIds)) {
            if ($id -cmatch '^[A-Za-z0-9_-]{11}$') { [void]$ids.Add([string]$id) }
        }
        $previousCount = $ids.Count
        $sourceResults = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        $rawCount = 0
        foreach ($sourceId in $sourceIds) {
            $exportPath = Join-Path $raw "$sourceId.json"
            if ($AcceptAllCandidates -and !(Test-Path -LiteralPath $exportPath -PathType Leaf)) { continue }
            # Retain IDs from the previous raw export before a new fetch overwrites it.
            if (Test-Path -LiteralPath $exportPath -PathType Leaf) {
                $cached = Read-Export $exportPath $sourceId
                foreach ($entry in $cached.entries) {
                    if ($entry.id -cmatch '^[A-Za-z0-9_-]{11}$') { [void]$ids.Add([string]$entry.id) }
                }
            }
            try { $doc = Get-Export $exportPath $sourceId }
            catch {
                if ($SkipDownload -or $SkipChannelScan) { throw }
                Write-Warning "Source $sourceId could not be refreshed; continuing with known IDs and channel search."
                continue
            }
            foreach ($entry in $doc.entries) {
                $rawCount++
                if ($entry.id -cmatch '^[A-Za-z0-9_-]{11}$') {
                    [void]$ids.Add([string]$entry.id)
                    [void]$sourceResults.Add([string]$entry.id)
                }
            }
        }

        $directory = Read-Json $authorsPath
        $known = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($group in $directory.authors) {
            foreach ($id in $group.channelIds) {
                if (!$known.Add([string]$id)) { throw "Channel is assigned to multiple authors: $id" }
            }
        }
        $channels = [Collections.Generic.Dictionary[string,object]]::new([StringComparer]::Ordinal)
        foreach ($channel in $directory.channels) { if ($channel.channelId) { $channels[$channel.channelId] = $channel } }
        # Seed metadata from every existing ranking; no channel API call for known authors.
        foreach ($existing in $projects) {
            $path = Resolve-ProjectPath $existing.ranking
            if (!(Test-Path -LiteralPath $path -PathType Leaf)) { continue }
            foreach ($author in (Read-Json $path).authors) {
                if (!$channels.ContainsKey($author.channelId)) {
                    $channels[$author.channelId] = [pscustomobject]@{ channelId = $author.channelId; name = $author.name; avatar = $author.avatar }
                }
            }
        }

        $candidates = @()
        $matchedCount = 0
        if (!$SkipChannelScan) {
            $scanChannels = @($known | Where-Object { $_ -cne $ArtistChannelId -and $_ -cmatch '^UC[A-Za-z0-9_-]{22}$' } | Sort-Object -CaseSensitive)
            $candidates = @(Find-ChannelRemixes $project $config $sourceIds $scanChannels $ids)
            foreach ($candidate in $candidates) {
                if ($candidate.status -eq 'matched' -and $ids.Add($candidate.id)) { $matchedCount++ }
            }
        }
        # Optional manual exclusions correct heuristic matches, even if still in the archive.
        foreach ($id in @($config.excludeVideoIds)) { if ($id) { [void]$ids.Remove([string]$id) } }
        $videoIds = @($ids | Sort-Object -CaseSensitive)
        Write-Host ("Sources: {0}; previously known/manual: {1}; channel matches: {2}; total unique: {3}" -f $sourceResults.Count, $previousCount, $matchedCount, $videoIds.Count)

        $returned = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        $ownVideos = 0
        $videos = @(foreach ($video in @(Get-YouTubeItems -Resource videos -Part 'snippet,statistics' -Ids $videoIds)) {
            if (!$ids.Contains([string]$video.id) -or !$returned.Add([string]$video.id)) { continue }
            if ($video.snippet.channelId -ceq $ArtistChannelId) { $ownVideos++; continue }
            if (!$video.snippet.channelId) { throw "Video metadata has no channel: $($video.id)" }
            [pscustomobject]@{
                id = [string]$video.id
                url = 'https://www.youtube.com/shorts/' + $video.id
                title = $video.snippet.title
                channelId = $video.snippet.channelId
                channelTitle = $video.snippet.channelTitle
                publishedAt = $video.snippet.publishedAt
                views = Read-Count $video.statistics.viewCount
                likes = Read-Count $video.statistics.likeCount
                thumbnail = $video.snippet.thumbnails.high.url
            }
        })
        # An empty source is legitimate for an upcoming release; do not overwrite a
        # non-empty ranking if collection unexpectedly returns no usable videos.
        if (!$videos.Count -and $previous.stats.videoCount -gt 0) { throw 'No usable videos; previous ranking preserved.' }

        $channelIds = @($videos.channelId | Where-Object { $_ } | Sort-Object -Unique -CaseSensitive)
        $newIds = @($channelIds | Where-Object { !$known.Contains($_) -and !$channels.ContainsKey($_) })
        foreach ($channel in @(Get-YouTubeItems -Resource channels -Part 'snippet' -Ids $newIds)) {
            $channels[$channel.id] = [pscustomobject]@{ channelId = $channel.id; name = $channel.snippet.title; avatar = $channel.snippet.thumbnails.default.url }
        }
        $authors = @(foreach ($group in ($videos | Group-Object -Property channelId -CaseSensitive)) {
            $ranked = @($group.Group | Sort-Object @{Expression = 'views'; Descending = $true}, @{Expression = 'id'; Descending = $false})
            $id = $group.Name
            if (!$channels.ContainsKey($id)) {
                $channels[$id] = [pscustomobject]@{ channelId = $id; name = $ranked[0].channelTitle; avatar = $null }
            }
            $channel = $channels[$id]
            $name = if ($channel.name) { $channel.name } else { $ranked[0].channelTitle }
            if ($known.Add($id)) {
                $directory.authors = @($directory.authors) + [pscustomobject]@{ name = $name; primaryChannelId = $id; channelIds = @($id) }
            }
            $knownViews = @($ranked | Where-Object { $null -ne $_.views })
            $knownLikes = @($ranked | Where-Object { $null -ne $_.likes })
            [pscustomobject]@{
                channelId = $id
                name = $name
                url = 'https://www.youtube.com/channel/' + $id
                avatar = $channel.avatar
                videoCount = $group.Count
                views = if ($knownViews.Count) { [long]($knownViews | Measure-Object views -Sum).Sum } else { $null }
                viewsKnownCount = $knownViews.Count
                likes = if ($knownLikes.Count) { [long]($knownLikes | Measure-Object likes -Sum).Sum } else { $null }
                likesKnownCount = $knownLikes.Count
                bestVideoId = if ($knownViews.Count) { $ranked[0].id } else { $null }
                videoIds = @($ranked.id)
            }
        })
        $authors = @($authors | Sort-Object @{Expression = 'views'; Descending = $true}, @{Expression = 'videoCount'; Descending = $true}, @{Expression = 'channelId'; Descending = $false})
        for ($i = 0; $i -lt $authors.Count; $i++) { $authors[$i] | Add-Member -NotePropertyName rank -NotePropertyValue ($i + 1) }
        $directory | Add-Member -NotePropertyName channels -NotePropertyValue @($channels.Values | Sort-Object channelId -CaseSensitive) -Force
        $knownViews = @($videos | Where-Object { $null -ne $_.views })
        $missing = @($videoIds | Where-Object { !$returned.Contains($_) })
        $timestamp = [DateTime]::UtcNow.ToString('o')
        $result = [ordered]@{
            schemaVersion = 1
            song = $project.title
            updatedAt = $timestamp
            sourceVideoIds = $sourceIds
            discoveredVideoIds = $videoIds
            stats = [ordered]@{
                inputEntries = $rawCount
                sourceUniqueVideos = $sourceResults.Count
                previouslyKnownVideos = $previousCount
                channelMatches = $matchedCount
                uniqueInputVideos = $videoIds.Count
                unavailableVideos = $missing.Count
                excludedArtistVideos = $ownVideos
                videoCount = $videos.Count
                authorCount = $authors.Count
                views = if ($knownViews.Count) { [long]($knownViews | Measure-Object views -Sum).Sum } elseif (!$videos.Count) { 0 } else { $null }
                viewsKnownCount = $knownViews.Count
            }
            unavailableVideoIds = $missing
            authors = $authors
            videos = $videos
        }
        $history = if (Test-Path -LiteralPath $historyPath -PathType Leaf) { Read-Json $historyPath } else { [pscustomobject]@{ snapshots = @() } }
        $views = [Collections.Specialized.OrderedDictionary]::new([StringComparer]::Ordinal)
        foreach ($video in $knownViews) { $views[$video.id] = $video.views }
        $snapshot = [pscustomobject]@{ updatedAt = $timestamp; views = $views }
        $history.snapshots = @(@($history.snapshots | Where-Object { $_.updatedAt -ne $timestamp }) + $snapshot | Sort-Object {
            if ($_.updatedAt -is [DateTime]) { $_.updatedAt.ToUniversalTime() }
            else { [DateTime]::Parse([string]$_.updatedAt, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AdjustToUniversal) }
        })
        $files = @(
            @{Path = $authorsPath; Value = $directory},
            @{Path = $historyPath; Value = $history},
            @{Path = $rankingPath; Value = $result}
        )
        if ($AcceptAllCandidates) {
            $files += @{Path = $sourcesPath; Value = $config}
        }
        if (!$SkipChannelScan) {
            $report = [ordered]@{ updatedAt = $timestamp; projectId = $project.id; matchTerms = @(Get-MatchTerms $project $config); candidates = $candidates }
            $files += @{Path = $reportPath; Value = $report}
        }
        Save-ProjectFiles $files
        if (!$SkipChannelScan) { Write-Host "Channel candidates: $reportPath" }
        Write-Host ("Saved: {0}; authors: {1}; videos: {2}; views: {3}; unavailable: {4}" -f $rankingPath, $authors.Count, $videos.Count, $result.stats.views, $missing.Count)
    }
} finally {
    $apiKey = $null
}
