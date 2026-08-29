param(
  [string]$Message = "Update investment plan"
)

$ErrorActionPreference = "Stop"

$repository = "weichihung/investment-plan"
$branch = "main"
$files = @(
  @{ Local = "deploy/index.html"; Remote = "index.html" },
  @{ Local = "deploy/mobile.html"; Remote = "mobile.html" },
  @{ Local = "deploy/styles.css"; Remote = "styles.css" },
  @{ Local = "deploy/market-config.js"; Remote = "market-config.js" },
  @{ Local = "deploy/core.js"; Remote = "core.js" },
  @{ Local = "deploy/charts.js"; Remote = "charts.js" },
  @{ Local = "deploy/app.js"; Remote = "app.js" },
  @{ Local = "deploy/d3.min.js"; Remote = "d3.min.js" },
  @{ Local = "deploy/README.md"; Remote = "README.md" },
  @{ Local = "SKILL.md"; Remote = "SKILL.md" },
  @{ Local = "AGENTS.md"; Remote = "AGENTS.md" },
  @{ Local = "agent.md"; Remote = "agent.md" },
  @{ Local = "market-data.json"; Remote = "market-data.json" },
  @{ Local = "package.json"; Remote = "package.json" },
  @{ Local = ".github/workflows/update-market-data.yml"; Remote = ".github/workflows/update-market-data.yml" },
  @{ Local = "scripts/fetch-market.ps1"; Remote = "scripts/fetch-market.ps1" },
  @{ Local = "scripts/fetch-market.mjs"; Remote = "scripts/fetch-market.mjs" },
  @{ Local = "scripts/import-workbook.py"; Remote = "scripts/import-workbook.py" },
  @{ Local = "scripts/publish-github-pages.ps1"; Remote = "scripts/publish-github-pages.ps1" },
  @{ Local = "worker/wrangler.toml"; Remote = "worker/wrangler.toml" },
  @{ Local = "worker/README.md"; Remote = "worker/README.md" },
  @{ Local = "worker/src/index.js"; Remote = "worker/src/index.js" },
  @{ Local = "worker/src/market.js"; Remote = "worker/src/market.js" },
  @{ Local = "worker/test/market.test.mjs"; Remote = "worker/test/market.test.mjs" },
  @{ Local = "test/core-market.test.cjs"; Remote = "test/core-market.test.cjs" }
)

function Invoke-GitHubJson {
  param(
    [Parameter(Mandatory = $true)][string]$Endpoint,
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][object]$Body
  )

  $tempFile = [System.IO.Path]::GetTempFileName()
  try {
    $json = $Body | ConvertTo-Json -Depth 10
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($tempFile, $json, $utf8NoBom)
    $output = & gh api $Endpoint --method $Method --header "Content-Type: application/json" --input $tempFile
    if ($LASTEXITCODE -ne 0) {
      throw "GitHub request failed: $Method $Endpoint"
    }
    return $output | ConvertFrom-Json
  } finally {
    Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
  }
}

$ref = & gh api "repos/$repository/git/ref/heads/$branch" | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) {
  throw "Unable to read the $branch branch reference"
}

$baseCommitSha = $ref.object.sha
$baseCommit = & gh api "repos/$repository/git/commits/$baseCommitSha" | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) {
  throw "Unable to read the current commit"
}

$treeEntries = @()
foreach ($file in $files) {
  $localPath = Resolve-Path $file.Local
  $bytes = [System.IO.File]::ReadAllBytes($localPath)
  $blob = Invoke-GitHubJson -Endpoint "repos/$repository/git/blobs" -Method "POST" -Body @{
    content = [Convert]::ToBase64String($bytes)
    encoding = "base64"
  }
  $treeEntries += @{
    path = $file.Remote
    mode = "100644"
    type = "blob"
    sha = $blob.sha
  }
}

$tree = Invoke-GitHubJson -Endpoint "repos/$repository/git/trees" -Method "POST" -Body @{
  base_tree = $baseCommit.tree.sha
  tree = $treeEntries
}

$commit = Invoke-GitHubJson -Endpoint "repos/$repository/git/commits" -Method "POST" -Body @{
  message = $Message
  tree = $tree.sha
  parents = @($baseCommitSha)
}

Invoke-GitHubJson -Endpoint "repos/$repository/git/refs/heads/$branch" -Method "PATCH" -Body @{
  sha = $commit.sha
  force = $false
} | Out-Null

Write-Output "published $($files.Count) files in commit $($commit.sha)"

