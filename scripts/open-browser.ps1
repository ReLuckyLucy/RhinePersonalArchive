param([Parameter(Mandatory=$true)][string]$Url)
Start-Process -FilePath $Url
