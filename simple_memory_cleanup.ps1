# Simple Memory Cleanup Script for Gaming Performance
Write-Host "Soccer Game Memory Optimizer" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green

# Check current memory status
$memory = Get-WmiObject -Class Win32_OperatingSystem
$totalMemory = [math]::Round($memory.TotalVisibleMemorySize/1KB/1024, 2)
$freeMemory = [math]::Round($memory.FreePhysicalMemory/1KB/1024, 2)
$usedMemory = $totalMemory - $freeMemory
$usagePercent = [math]::Round(($usedMemory / $totalMemory) * 100, 1)

Write-Host ""
Write-Host "Current Memory Status:" -ForegroundColor Yellow
Write-Host "  Total: $totalMemory GB" -ForegroundColor White
Write-Host "  Used: $usedMemory GB ($usagePercent%)" -ForegroundColor White
Write-Host "  Free: $freeMemory GB" -ForegroundColor White
Write-Host ""

# Get current PowerShell PID to avoid closing it
$currentPID = $PID

# Show memory-heavy processes
Write-Host "Memory-Heavy Processes:" -ForegroundColor Cyan

# Cursor processes
$cursorProcesses = Get-Process -Name "Cursor" -ErrorAction SilentlyContinue
if ($cursorProcesses) {
    $totalCursorMemory = ($cursorProcesses | Measure-Object WorkingSet -Sum).Sum/1MB
    Write-Host "  Cursor IDE: $([math]::Round($totalCursorMemory, 1)) MB ($($cursorProcesses.Count) processes)" -ForegroundColor Yellow
}

# PowerShell processes (excluding current)
$psProcesses = Get-Process -Name "powershell" -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $currentPID }
if ($psProcesses) {
    $totalPSMemory = ($psProcesses | Measure-Object WorkingSet -Sum).Sum/1MB
    Write-Host "  Extra PowerShell: $([math]::Round($totalPSMemory, 1)) MB ($($psProcesses.Count) processes)" -ForegroundColor Yellow
}

# Edge WebView processes
$edgeProcesses = Get-Process -Name "msedgewebview2" -ErrorAction SilentlyContinue
if ($edgeProcesses) {
    $totalEdgeMemory = ($edgeProcesses | Measure-Object WorkingSet -Sum).Sum/1MB
    Write-Host "  Edge WebView: $([math]::Round($totalEdgeMemory, 1)) MB ($($edgeProcesses.Count) processes)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Cleanup Options:" -ForegroundColor Cyan
Write-Host "1. Close extra PowerShell sessions (Quick - ~200MB)" -ForegroundColor White
Write-Host "2. Close Edge WebView processes (Medium - varies)" -ForegroundColor White
Write-Host "3. Show instructions to restart Cursor (Best - ~1GB)" -ForegroundColor White
Write-Host "4. Check memory status again" -ForegroundColor White
Write-Host "0. Exit" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Select option (0-4)"

switch ($choice) {
    "1" {
        Write-Host "Closing extra PowerShell sessions..." -ForegroundColor Cyan
        $psProcesses = Get-Process -Name "powershell" -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $currentPID }
        if ($psProcesses) {
            foreach ($proc in $psProcesses) {
                try {
                    $memoryMB = [math]::Round($proc.WorkingSet/1MB, 1)
                    $proc.CloseMainWindow()
                    Start-Sleep -Seconds 1
                    if (!$proc.HasExited) {
                        $proc.Kill()
                    }
                    Write-Host "  Closed PowerShell PID $($proc.Id) - $memoryMB MB freed" -ForegroundColor Green
                } catch {
                    Write-Host "  Could not close PID $($proc.Id)" -ForegroundColor Red
                }
            }
            Write-Host "PowerShell cleanup complete!" -ForegroundColor Green
        } else {
            Write-Host "No extra PowerShell sessions found" -ForegroundColor Gray
        }
    }
    
    "2" {
        Write-Host "Closing Edge WebView processes..." -ForegroundColor Cyan
        $edgeProcesses = Get-Process -Name "msedgewebview2" -ErrorAction SilentlyContinue
        if ($edgeProcesses) {
            foreach ($proc in $edgeProcesses) {
                try {
                    $memoryMB = [math]::Round($proc.WorkingSet/1MB, 1)
                    $proc.Kill()
                    Write-Host "  Closed Edge WebView PID $($proc.Id) - $memoryMB MB freed" -ForegroundColor Green
                } catch {
                    Write-Host "  Could not close PID $($proc.Id)" -ForegroundColor Red
                }
            }
            Write-Host "Edge WebView cleanup complete!" -ForegroundColor Green
        } else {
            Write-Host "No Edge WebView processes found" -ForegroundColor Gray
        }
    }
    
    "3" {
        Write-Host ""
        Write-Host "To free the most memory (1+ GB), restart Cursor IDE:" -ForegroundColor Yellow
        Write-Host "1. Save any unsaved work in Cursor" -ForegroundColor White
        Write-Host "2. Close Cursor completely (File > Exit)" -ForegroundColor White
        Write-Host "3. Wait 10 seconds" -ForegroundColor White
        Write-Host "4. Reopen Cursor and your project" -ForegroundColor White
        Write-Host ""
        Write-Host "This will free approximately 1-1.5 GB of memory!" -ForegroundColor Green
    }
    
    "4" {
        Write-Host "Checking memory status..." -ForegroundColor Cyan
        $memory = Get-WmiObject -Class Win32_OperatingSystem
        $totalMemory = [math]::Round($memory.TotalVisibleMemorySize/1KB/1024, 2)
        $freeMemory = [math]::Round($memory.FreePhysicalMemory/1KB/1024, 2)
        $usedMemory = $totalMemory - $freeMemory
        $usagePercent = [math]::Round(($usedMemory / $totalMemory) * 100, 1)
        
        Write-Host "  Total: $totalMemory GB" -ForegroundColor White
        Write-Host "  Used: $usedMemory GB ($usagePercent%)" -ForegroundColor White
        Write-Host "  Free: $freeMemory GB" -ForegroundColor White
        
        if ($freeMemory -gt 3) {
            Write-Host "  Status: Excellent for gaming!" -ForegroundColor Green
        } elseif ($freeMemory -gt 2) {
            Write-Host "  Status: Good for gaming" -ForegroundColor Yellow
        } else {
            Write-Host "  Status: May need more cleanup" -ForegroundColor Red
        }
    }
    
    default {
        Write-Host "Exiting memory optimizer" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Memory optimization complete!" -ForegroundColor Green 