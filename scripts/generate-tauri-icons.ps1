$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$iconsDir = Join-Path $repoRoot "apps\desktop-shell\src-tauri\icons"
$pngPath = Join-Path $iconsDir "icon.png"
$icoPath = Join-Path $iconsDir "icon.ico"

New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

Add-Type -AssemblyName System.Drawing

$size = 256
$bitmap = New-Object System.Drawing.Bitmap $size, $size
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.Color]::FromArgb(255, 15, 23, 42))

$accentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 34, 197, 94))
$panelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 30, 41, 59))
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

$graphics.FillEllipse($accentBrush, 18, 18, 220, 220)
$graphics.FillRectangle($panelBrush, 46, 46, 164, 164)

$font = New-Object System.Drawing.Font("Segoe UI", 82, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$stringFormat = New-Object System.Drawing.StringFormat
$stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
$stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
$rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
$graphics.DrawString("CB", $font, $textBrush, $rect, $stringFormat)

$bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

$pngBytes = [System.IO.File]::ReadAllBytes($pngPath)
$stream = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$writer = New-Object System.IO.BinaryWriter($stream)

$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]1)
$writer.Write([Byte]0)
$writer.Write([Byte]0)
$writer.Write([Byte]0)
$writer.Write([Byte]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]32)
$writer.Write([UInt32]$pngBytes.Length)
$writer.Write([UInt32]22)
$writer.Write($pngBytes)
$writer.Flush()
$writer.Dispose()
$stream.Dispose()

$font.Dispose()
$stringFormat.Dispose()
$textBrush.Dispose()
$panelBrush.Dispose()
$accentBrush.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output "Generated desktop icons:"
Write-Output " - $pngPath"
Write-Output " - $icoPath"
