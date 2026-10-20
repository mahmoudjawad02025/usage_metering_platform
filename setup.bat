docker desktop start
docker compose up --build -d
:wait
curl -s http://localhost:8080 >nul || (timeout /t 2 >nul & goto wait)
start http://localhost:8080