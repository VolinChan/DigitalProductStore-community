#Requires -Version 5
# End-to-end smoke test for the digital-store stack via docker-compose.
# Uses curl.exe to avoid Invoke-WebRequest quirks.

$ErrorActionPreference = "Continue"
$base = "http://localhost"
$apiBase = "$base/api/v1"
$script:passed = 0
$script:failed = @()

function Read-Utf8 { param($p) [System.IO.File]::ReadAllText((Resolve-Path $p), [System.Text.Encoding]::UTF8) }

function Invoke-Curl {
    param([string]$Method = "GET", [string]$Url, [string]$BodyFile, [string]$Token)
    $tmp = [System.IO.Path]::GetTempFileName()
    $a = @("-sS", "-o", $tmp, "-w", "%{http_code}", "-X", $Method, $Url, "--max-time", "20")
    if ($Token) { $a += @("-H", "Authorization: Bearer $Token") }
    if ($BodyFile) { $a += @("-H", "Content-Type: application/json", "--data-binary", "@$BodyFile") }
    $status = & curl.exe @a 2>$null
    $body = Read-Utf8 $tmp
    Remove-Item $tmp -ErrorAction SilentlyContinue
    $json = $null
    if ($body -and ($body.TrimStart().StartsWith('{') -or $body.TrimStart().StartsWith('['))) {
        try { $json = $body | ConvertFrom-Json } catch {}
    }
    return @{ status = [int]$status; body = $body; json = $json }
}

function New-BodyFile {
    param([hashtable]$Data)
    $p = [System.IO.Path]::GetTempFileName()
    $json = $Data | ConvertTo-Json -Depth 10 -Compress
    # Write UTF-8 WITHOUT BOM so Go's JSON decoder doesn't choke on 0xEF 0xBB 0xBF.
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($p, $json, $enc)
    return $p
}

function Check {
    param($name, $ok, $detail)
    if ($ok) {
        Write-Host ("PASS  " + $name) -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host ("FAIL  " + $name + "  --  " + $detail) -ForegroundColor Red
        $script:failed += "$name -- $detail"
    }
}

Write-Host "=== Frontend pages ===" -ForegroundColor Cyan
foreach ($p in @("/", "/products", "/login", "/register", "/admin")) {
    $r = Invoke-Curl GET "$base$p"
    Check "GET $p" ($r.status -eq 200) "status=$($r.status)"
}

Write-Host "=== Public API ===" -ForegroundColor Cyan
$r = Invoke-Curl GET "$apiBase/health"
Check "GET /api/v1/health" ($r.status -eq 200 -and $r.body -match '"status":"healthy"') "status=$($r.status)"
$reqId = $r.json.request_id
Check "request_id is 32 hex chars" ($reqId -match '^[0-9a-f]{32}$') "request_id=$reqId"

$r = Invoke-Curl GET "$apiBase/products"
$total = $r.json.data.total
Check "GET /products returns 2 seeded products" ($r.status -eq 200 -and $total -eq 2) "status=$($r.status) total=$total"
$productId = $r.json.data.products[0].id

$r = Invoke-Curl GET "$apiBase/products/$productId"
Check "GET /products/$productId" ($r.status -eq 200) "status=$($r.status)"
$skuId = if ($r.json.data.skus) { $r.json.data.skus[0].id } else { $null }
Check "product has at least one SKU" ($skuId -gt 0) "sku_id=$skuId"

$r = Invoke-Curl GET "$apiBase/categories"
$cats = $r.json.data.categories
Check "GET /categories returns a categories array" ($r.status -eq 200 -and $cats -and $cats.Count -eq 2) "status=$($r.status) count=$($cats.Count)"

$r = Invoke-Curl GET "$apiBase/products/search?q=Pro"
Check "GET /products/search returns wrapper object with products" ($r.status -eq 200 -and $r.json.data.products -ne $null) "status=$($r.status) body=$(($r.body -as [string]).Substring(0,[Math]::Min(120,$r.body.Length)))"

Write-Host "=== Swagger docs ===" -ForegroundColor Cyan
$r = Invoke-Curl GET "$base/api/docs"
Check "GET /api/docs serves Swagger UI" ($r.status -eq 200 -and $r.body -match "swagger-ui") "status=$($r.status)"
$r = Invoke-Curl GET "$base/api/docs/swagger.json"
Check "GET /api/docs/swagger.json" ($r.status -eq 200 -and $r.body -match '"swagger"') "status=$($r.status)"
# Spec must not hardcode host or schemes so the Try-It-Out button uses the
# page origin (http://localhost) instead of localhost:8080.
Check "Swagger spec does NOT hardcode host" ($r.json.host -eq $null) "host=$($r.json.host)"
Check "Swagger spec does NOT hardcode schemes" ($r.json.schemes -eq $null) "schemes=$($r.json.schemes -join ',')"

Write-Host "=== User flow ===" -ForegroundColor Cyan
$email = "smoke$(Get-Random -Maximum 999999)@test.local"
$f = New-BodyFile @{ email = $email; password = "Smoke1234!"; full_name = "Smoke User" }
$r = Invoke-Curl POST "$apiBase/auth/register" $f
Remove-Item $f -ErrorAction SilentlyContinue
Check "POST /auth/register" ($r.status -eq 201) "status=$($r.status) body=$($r.body)"

$f = New-BodyFile @{ email = $email; password = "Smoke1234!" }
$r = Invoke-Curl POST "$apiBase/auth/login" $f
Remove-Item $f -ErrorAction SilentlyContinue
Check "POST /auth/login" ($r.status -eq 200) "status=$($r.status)"
$userToken = $r.json.data.access_token
Check "user access_token issued" ($userToken -and $userToken.Length -gt 40) "len=$($userToken.Length)"

# Profile endpoint: front-end useAuthStore hits this after login to populate the user.
$r = Invoke-Curl GET "$apiBase/auth/profile" $null $userToken
Check "GET /auth/profile (user token) returns 200" ($r.status -eq 200 -and $r.json.data.email -eq $email) "status=$($r.status) body=$(($r.body -as [string]).Substring(0,[Math]::Min(120,$r.body.Length)))"

Write-Host "=== Admin flow ===" -ForegroundColor Cyan
$f = New-BodyFile @{ email = "admin@demo.local"; password = "Admin@1234" }
$r = Invoke-Curl POST "$apiBase/admin/login" $f
Remove-Item $f -ErrorAction SilentlyContinue
Check "POST /admin/login" ($r.status -eq 200) "status=$($r.status) body=$($r.body)"
$adminToken = $r.json.data.access_token
Check "admin access_token issued" ($adminToken -and $adminToken.Length -gt 40) "len=$($adminToken.Length)"

Write-Host "=== Order flow ===" -ForegroundColor Cyan
if ($skuId -gt 0 -and $userToken) {
    $orderData = @{
        payment_method   = "transfer"
        shipping_address = "Demo Address 1, Test City"
        guest_name       = "Smoke User"
        guest_email      = $email
        guest_phone      = "+8612345678901"
        items            = @(@{ sku_id = $skuId; quantity = 1 })
    }
    $f = New-BodyFile $orderData
    $r = Invoke-Curl POST "$apiBase/orders" $f $userToken
    Remove-Item $f -ErrorAction SilentlyContinue
    $ok = $r.status -eq 200 -or $r.status -eq 201
    Check "POST /orders (transfer)" $ok "status=$($r.status) body=$($r.body)"

    if ($ok -and $r.json.data) {
        $order = $r.json.data
        Check "order got an order_number" ($order.order_number) "order_number=$($order.order_number)"
        Check "order status is pending_payment or pending_transfer" ($order.status -in @("pending_payment","pending_transfer")) "status=$($order.status)"
    }
}

Write-Host "=== Admin APIs ===" -ForegroundColor Cyan
if ($adminToken) {
    foreach ($ep in @("/admin/orders", "/admin/users", "/admin/inventory", "/admin/banners", "/admin/analytics/revenue")) {
        $r = Invoke-Curl GET "$apiBase$ep" $null $adminToken
        Check "GET $ep" ($r.status -eq 200) "status=$($r.status) body=$($r.body)"
    }
}

Write-Host "=== Monitoring ===" -ForegroundColor Cyan
$r = Invoke-Curl GET "http://localhost:9090/-/healthy"
Check "Prometheus /-/healthy" ($r.status -eq 200) "status=$($r.status)"
$r = Invoke-Curl GET "http://localhost:3001/api/health"
Check "Grafana /api/health" ($r.status -eq 200) "status=$($r.status)"

Write-Host ""
Write-Host ("=== SUMMARY: passed=" + $script:passed + " failed=" + $script:failed.Count + " ===") -ForegroundColor Cyan
if ($script:failed.Count -gt 0) {
    Write-Host "FAILURES:" -ForegroundColor Red
    $script:failed | ForEach-Object { Write-Host ("  - " + $_) -ForegroundColor Red }
    exit 1
}
exit 0
