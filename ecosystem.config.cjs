module.exports = {
  apps: [
    {
      name: 'webapp',
      script: 'npx',
      // -b APP_ENV=preview → 워커 env.APP_ENV 로 주입되어 상단에 "미리보기 환경" 경고 배너가 표시됩니다.
      // 운영(gsk hosted deploy)에는 이 바인딩이 없으므로 배너가 절대 나타나지 않습니다.
      args: 'wrangler pages dev dist --d1=webapp-production --local -b APP_ENV=preview --ip 0.0.0.0 --port 3000',
      env: { NODE_ENV: 'development', PORT: 3000 },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '600M',
    },
  ],
}
