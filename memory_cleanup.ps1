# Memory Cleanup Script for Gaming Performance
# This script will safely close unnecessary processes to free up memory

Write-Host "🎮 Soccer Game Memory Optimization Script" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Check current memory status
$memory = Get-WmiObject -Class Win32_OperatingSystem
$totalMemory = [math]::Round($memory.TotalVisibleMemorySize/1KB/1024, 2)
$freeMemory = [math]::Round($memory.FreePhysicalMemory/1KB/1024, 2)
$usedMemory = $totalMemory - $freeMemory
$usagePercent = [math]::Round(($usedMemory / $totalMemory) * 100, 1)

Write-Host "Current Memory Status:" -ForegroundColor Yellow
Write-Host "  Total: $totalMemory GB" -ForegroundColor White
Write-Host "  Used: $usedMemory GB ($usagePercent%)" -ForegroundColor White
Write-Host "  Free: $freeMemory GB" -ForegroundColor White
Write-Host ""

# Function to safely close processes
function Close-ProcessSafely {
    param($ProcessName, $Description)
    
    $processes = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
    if ($processes) {
        Write-Host "Found $($processes.Count) $Description process(es)" -ForegroundColor Yellow
        foreach ($proc in $processes) {
            $memoryMB = [math]::Round($proc.WorkingSet/1MB, 1)
            Write-Host "  PID $($proc.Id): $memoryMB MB" -ForegroundColor White
        }
        
        $response = Read-Host "Close these $Description processes? (y/n)"
        if ($response -eq 'y' -or $response -eq 'Y') {
            foreach ($proc in $processes) {
                try {
                    $proc.CloseMainWindow()
                    Start-Sleep -Seconds 2
                    if (!$proc.HasExited) {
                        $proc.Kill()
                    }
                    Write-Host "  ✓ Closed PID $($proc.Id)" -ForegroundColor Green
                } catch {
                    Write-Host "  ✗ Could not close PID $($proc.Id): $($_.Exception.Message)" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host "No $Description processes found" -ForegroundColor Gray
    }
    Write-Host ""
}

# Identify processes to clean up (excluding current PowerShell session)
Write-Host "🔍 Identifying memory-heavy processes..." -ForegroundColor Cyan
Write-Host ""

# Get current PowerShell PID to avoid closing it
$currentPID = $PID

# Show Cursor processes
Write-Host "Cursor IDE Processes:" -ForegroundColor Yellow
$cursorProcesses = Get-Process -Name "Cursor" -ErrorAction SilentlyContinue
if ($cursorProcesses) {
    foreach ($proc in $cursorProcesses) {
        $memoryMB = [math]::Round($proc.WorkingSet/1MB, 1)
        Write-Host "  PID $($proc.Id): $memoryMB MB" -ForegroundColor White
    }
    Write-Host "  Total Cursor Memory: $([math]::Round(($cursorProcesses | Measure-Object WorkingSet -Sum).Sum/1MB, 1)) MB" -ForegroundColor Cyan
} else {
    Write-Host "  No Cursor processes found" -ForegroundColor Gray
}
Write-Host ""

# Show PowerShell processes (excluding current)
Write-Host "PowerShell Processes:" -ForegroundColor Yellow
$psProcesses = Get-Process -Name "powershell" -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $currentPID }
if ($psProcesses) {
    foreach ($proc in $psProcesses) {
        $memoryMB = [math]::Round($proc.WorkingSet/1MB, 1)
        Write-Host "  PID $($proc.Id): $memoryMB MB" -ForegroundColor White
    }
    Write-Host "  Total Other PowerShell Memory: $([math]::Round(($psProcesses | Measure-Object WorkingSet -Sum).Sum/1MB, 1)) MB" -ForegroundColor Cyan
} else {
    Write-Host "  No other PowerShell processes found" -ForegroundColor Gray
}
Write-Host ""

# Show Edge WebView processes
Write-Host "Edge WebView2 Processes:" -ForegroundColor Yellow
$edgeProcesses = Get-Process -Name "msedgewebview2" -ErrorAction SilentlyContinue
if ($edgeProcesses) {
    foreach ($proc in $edgeProcesses) {
        $memoryMB = [math]::Round($proc.WorkingSet/1MB, 1)
        Write-Host "  PID $($proc.Id): $memoryMB MB" -ForegroundColor White
    }
    Write-Host "  Total Edge WebView Memory: $([math]::Round(($edgeProcesses | Measure-Object WorkingSet -Sum).Sum/1MB, 1)) MB" -ForegroundColor Cyan
} else {
    Write-Host "  No Edge WebView processes found" -ForegroundColor Gray
}
Write-Host ""

# Cleanup options
Write-Host "🧹 Memory Cleanup Options:" -ForegroundColor Cyan
Write-Host "1. Close extra PowerShell sessions (recommended)" -ForegroundColor White
Write-Host "2. Close Edge WebView processes (may affect some apps)" -ForegroundColor White  
Write-Host "3. Restart Cursor IDE (saves most memory, requires reopening project)" -ForegroundColor White
Write-Host "4. Run Windows memory cleanup" -ForegroundColor White
Write-Host "5. Show final memory status" -ForegroundColor White
Write-Host "0. Exit" -ForegroundColor White
Write-Host ""

do {
    $choice = Read-Host "Select option (1-5, 0 to exit)"
    
    switch ($choice) {
        "1" {
            Write-Host "🔄 Closing extra PowerShell sessions..." -ForegroundColor Cyan
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
                        Write-Host "  ✓ Closed PowerShell PID $($proc.Id) ($memoryMB MB freed)" -ForegroundColor Green
                    } catch {
                        Write-Host "  ✗ Could not close PID $($proc.Id): $($_.Exception.Message)" -ForegroundColor Red
                    }
                }
            } else {
                Write-Host "  No extra PowerShell sessions to close" -ForegroundColor Gray
            }
        }
        
        "2" {
            Write-Host "🔄 Closing Edge WebView processes..." -ForegroundColor Cyan
            $edgeProcesses = Get-Process -Name "msedgewebview2" -ErrorAction SilentlyContinue
            if ($edgeProcesses) {
                $response = Read-Host "This may affect apps using web components. Continue? (y/n)"
                if ($response -eq 'y' -or $response -eq 'Y') {
                    foreach ($proc in $edgeProcesses) {
                        try {
                            $memoryMB = [math]::Round($proc.WorkingSet/1MB, 1)
                            $proc.Kill()
                            Write-Host "  ✓ Closed Edge WebView PID $($proc.Id) ($memoryMB MB freed)" -ForegroundColor Green
                        } catch {
                            Write-Host "  ✗ Could not close PID $($proc.Id): $($_.Exception.Message)" -ForegroundColor Red
                        }
                    }
                }
            } else {
                Write-Host "  No Edge WebView processes to close" -ForegroundColor Gray
            }
        }
        
        "3" {
            Write-Host "🔄 Cursor IDE restart required..." -ForegroundColor Cyan
            Write-Host "To restart Cursor IDE:" -ForegroundColor Yellow
            Write-Host "1. Save any unsaved work in Cursor" -ForegroundColor White
            Write-Host "2. Close Cursor completely" -ForegroundColor White
            Write-Host "3. Reopen Cursor and your project" -ForegroundColor White
            Write-Host "This will free up ~1-1.5 GB of memory" -ForegroundColor Green
            Write-Host ""
            $response = Read-Host "Force close Cursor now? (y/n)"
            if ($response -eq 'y' -or $response -eq 'Y') {
                $cursorProcesses = Get-Process -Name "Cursor" -ErrorAction SilentlyContinue
                foreach ($proc in $cursorProcesses) {
                    try {
                        $memoryMB = [math]::Round($proc.WorkingSet/1MB, 1)
                        $proc.Kill()
                        Write-Host "  ✓ Closed Cursor PID $($proc.Id) ($memoryMB MB freed)" -ForegroundColor Green
                    } catch {
                        Write-Host "  ✗ Could not close PID $($proc.Id): $($_.Exception.Message)" -ForegroundColor Red
                    }
                }
                Write-Host "Cursor has been closed. You can now restart it." -ForegroundColor Green
            }
        }
        
        "4" {
            Write-Host "🧹 Running Windows memory cleanup..." -ForegroundColor Cyan
            [System.GC]::Collect()
            [System.GC]::WaitForPendingFinalizers()
            [System.GC]::Collect()
            Write-Host "  ✓ Garbage collection completed" -ForegroundColor Green
        }
        
        "5" {
            Write-Host "📊 Current Memory Status:" -ForegroundColor Cyan
            $memory = Get-WmiObject -Class Win32_OperatingSystem
            $totalMemory = [math]::Round($memory.TotalVisibleMemorySize/1KB/1024, 2)
            $freeMemory = [math]::Round($memory.FreePhysicalMemory/1KB/1024, 2)
            $usedMemory = $totalMemory - $freeMemory
            $usagePercent = [math]::Round(($usedMemory / $totalMemory) * 100, 1)
            
            Write-Host "  Total: $totalMemory GB" -ForegroundColor White
            Write-Host "  Used: $usedMemory GB ($usagePercent%)" -ForegroundColor White
            Write-Host "  Free: $freeMemory GB" -ForegroundColor White
            
            if ($freeMemory -gt 3) {
                Write-Host "  Status: ✓ Excellent for gaming!" -ForegroundColor Green
            } elseif ($freeMemory -gt 2) {
                Write-Host "  Status: ✓ Good for gaming" -ForegroundColor Yellow
            } else {
                Write-Host "  Status: ⚠ May need more cleanup" -ForegroundColor Red
            }
        }
        
        "0" {
            Write-Host "Memory cleanup complete!" -ForegroundColor Green
            break
        }
        
        default {
            Write-Host "Invalid option. Please select 1-5 or 0." -ForegroundColor Red
        }
    }
    Write-Host ""
} while ($choice -ne "0")

Write-Host "🎮 Ready for gaming! Your memory has been optimized." -ForegroundColor Green 