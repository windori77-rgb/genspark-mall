#!/usr/bin/env node
/**
 * 배포 가드 (deploy guard)
 *
 * 이 프로젝트의 공식 배포 경로는 **Genspark 호스팅**입니다.
 *   gsk hosted deploy  →  승인  →  Cloudflare Workers (Genspark 관리 계정)
 *
 * 그런데 package.json 에 `npm run deploy` = `wrangler pages deploy` 가 남아 있으면,
 * 노트북에서 무심코 실행했을 때 다음 사고가 난다.
 *   1) 고객님 개인 Cloudflare 계정에 별도 사이트가 생긴다 (운영과 무관한 유령 배포)
 *   2) wrangler.jsonc 의 database_id 가 플레이스홀더라 D1 바인딩이 깨진다
 *   3) 진짜 운영 사이트는 그대로인데 "배포했다"고 착각한다
 *
 * 그래서 npm run deploy 는 실제 배포 대신 안내를 출력하고 종료한다.
 */
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

console.log(`
${RED}${BOLD}⛔  npm run deploy 는 이 프로젝트에서 비활성화되어 있습니다.${RESET}

${YELLOW}이유${RESET}
  이 프로젝트의 운영 서버는 ${BOLD}Cloudflare Workers (Genspark 관리 계정)${RESET} 에 있습니다.
  \`wrangler pages deploy\` 는 ${BOLD}고객님 개인 Cloudflare 계정${RESET}으로 배포를 시도하며,
  wrangler.jsonc 의 database_id 가 플레이스홀더(00000000-...)라 D1 연결이 깨집니다.

${GREEN}${BOLD}✅ 올바른 배포 방법${RESET}
  1) 코드 수정 후 커밋 & push
       git add -A && git commit -m "..." && git push origin main

  2) Genspark 에이전트에게 배포 요청
       "배포해줘"

     → 에이전트가 실행:  ${DIM}gsk hosted deploy${RESET}
     → 승인 배너에서 ${BOLD}[승인]${RESET} 클릭
     → 완료 후 운영 URL 에 반영

${DIM}────────────────────────────────────────────────────────────${RESET}
${DIM}빌드만 확인하려면:   npm run build${RESET}
${DIM}로컬 미리보기:       npm run preview${RESET}
${DIM}타입 검사:           npm run typecheck${RESET}
${DIM}────────────────────────────────────────────────────────────${RESET}
`);

process.exit(1);
