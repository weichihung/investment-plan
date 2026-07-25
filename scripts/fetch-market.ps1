$ErrorActionPreference = "Stop"

$symbols = @("0050.TW", "0056.TW", "00919.TW", "00631L.TW", "VOO", "NVDA", "TWD=X")
$out = @()

foreach ($symbol in $symbols) {
  $escaped = [uri]::EscapeDataString($symbol)
  $url = "https://query1.finance.yahoo.com/v8/finance/chart/$escaped" + "?range=1y" + "&interval=1d" + "&events=div"
  $data = Invoke-RestMethod -Uri $url
  $result = $data.chart.result[0]
  $quotes = $result.indicators.quote[0].close
  $timestamps = $result.timestamp
  $last = -1

  for ($i = $quotes.Count - 1; $i -ge 0; $i--) {
    if ($null -ne $quotes[$i]) {
      $last = $i
      break
    }
  }

  $events = @()
  if ($result.events.dividends) {
    $result.events.dividends.psobject.Properties.Value | ForEach-Object {
      $events += $_
    }
  }

  $out += [pscustomobject]@{
    Symbol = $symbol
    Close = $quotes[$last]
    CloseDate = [DateTimeOffset]::FromUnixTimeSeconds([long]$timestamps[$last]).ToString("yyyy-MM-dd")
    Dividends = $events
  }
}

$out | ConvertTo-Json -Depth 6
