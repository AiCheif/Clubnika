param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Source,
    [ValidatePattern('^[a-zA-Z0-9_-]+$')]
    [string]$Mascot = 'cossack',
    [ValidatePattern('^[a-zA-Z0-9_-]+$')]
    [string]$First = 'idle',
    [ValidatePattern('^[a-zA-Z0-9_-]+$')]
    [string]$Second = 'greeting',
    [ValidateRange(0.1, 60)]
    [double]$Split = 5,
    [ValidateSet(256, 384, 512, 640)]
    [int]$Size = 384,
    [ValidatePattern('^(?:0x)?[0-9a-fA-F]{6}$')]
    [string]$KeyColor = '0xF020D0',
    [ValidateRange(0.01, 1)]
    [double]$Similarity = 0.18,
    [ValidateRange(0, 1)]
    [double]$Blend = 0.06,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$ffmpeg = (Get-Command ffmpeg -CommandType Application).Source
$ffprobe = (Get-Command ffprobe -CommandType Application).Source
$site = Split-Path -Parent $PSScriptRoot
$output = Join-Path $site "mascots/$Mascot"
$culture = [Globalization.CultureInfo]::InvariantCulture
$durationText = & $ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $sourcePath
if ($LASTEXITCODE -ne 0) { throw 'Cannot probe input video.' }
$duration = [double]::Parse($durationText, $culture)
if ($duration -lt (2 * $Split - 0.1)) { throw 'Input is too short for two equal clips.' }
if ($First -eq $Second) { throw 'Animation names must be different.' }

$firstPath = Join-Path $output "$First.webm"
$secondPath = Join-Path $output "$Second.webm"
$posterPath = Join-Path $output 'idle.png'
$makePoster = $First -eq 'idle' -or $Second -eq 'idle'
$targets = @($firstPath, $secondPath)
if ($makePoster) { $targets += $posterPath }
foreach ($target in $targets) {
    if ((Test-Path -LiteralPath $target) -and !$Force) { throw "Output exists: $target. Use -Force to replace it." }
}
New-Item -ItemType Directory -Force -Path $output | Out-Null
$overwrite = if ($Force) { '-y' } else { '-n' }
$seconds = $Split.ToString($culture)
$similarityText = $Similarity.ToString($culture)
$blendText = $Blend.ToString($culture)
if (!$KeyColor.StartsWith('0x')) { $KeyColor = "0x$KeyColor" }
$filter = "crop='min(iw,ih)':'min(iw,ih)',format=rgba,colorkey=${KeyColor}:${similarityText}:${blendText},scale=${Size}:${Size}:flags=lanczos,setsar=1"

function Convert-Clip([string]$Start, [string]$Destination) {
    Write-Host "Encoding $Destination"
    & $ffmpeg -hide_banner -loglevel error $overwrite -ss $Start -i $sourcePath -t $seconds -map 0:v:0 -an -vf "$filter,format=yuva420p" -c:v libvpx-vp9 -b:v 0 -crf 28 -deadline good -cpu-used 4 -auto-alt-ref 0 $Destination
    if ($LASTEXITCODE -ne 0) { throw "Encoding failed: $Destination" }
}

Convert-Clip '0' $firstPath
Convert-Clip $seconds $secondPath

if ($makePoster) {
    $posterStart = if ($First -eq 'idle') { '0' } else { $seconds }
    & $ffmpeg -hide_banner -loglevel error $overwrite -ss $posterStart -i $sourcePath -map 0:v:0 -frames:v 1 -vf "$filter,format=rgba" -c:v png $posterPath
    if ($LASTEXITCODE -ne 0) { throw 'Poster extraction failed.' }
}
Write-Host "Done: $output"
