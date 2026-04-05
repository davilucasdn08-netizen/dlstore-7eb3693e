@echo off
netsh advfirewall firewall delete rule name="DLSTOREDev" >nul 2>&1
netsh advfirewall firewall add rule name="DLSTOREDev" dir=in action=allow protocol=TCP localport=8080
echo.
echo === Regra adicionada com sucesso! ===
echo Agora acesse no celular: http://192.168.0.33:8080/
echo.
pause
