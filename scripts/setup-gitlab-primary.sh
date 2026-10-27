#!/usr/bin/env bash
#
# ─────────────────────────────────────────────────────────────────────────────
# GitLab 을 주 저장소(origin)로 전환한다.
# ─────────────────────────────────────────────────────────────────────────────
#
#   사용법
#     bash scripts/setup-gitlab-primary.sh https://gitlab.com/<아이디>/genspark-mall.git
#     bash scripts/setup-gitlab-primary.sh https://gitlab.com/<아이디>/genspark-mall.git --mirror-github
#
#   동작
#     1. 기존 origin(GitHub)을 'github' 라는 이름으로 보존
#     2. origin 을 GitLab URL 로 교체 → GitLab 이 주 저장소
#     3. --mirror-github 옵션: origin push 시 GitLab + GitHub 양쪽에 동시 전송
#     4. main 브랜치를 GitLab 으로 최초 push (-u 로 upstream 설정)
#
#   저장소 역할 (전환 후)
#     origin  → GitLab   (주 저장소: 소스 오브 트루스)
#     github  → GitHub   (미러/백업)
#     genspark→ SB-Git   (Genspark 자동 백업 · 배포 소스)
#
#   되돌리기
#     git remote set-url origin https://github.com/windori77-rgb/genspark-mall.git
#     git remote remove github
#     git remote set-url --delete --push origin <github-url>   # 미러 옵션을 썼다면
#
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

GITLAB_URL=""
MIRROR_GITHUB=0
BRANCH="main"

usage() {
  cat <<'EOF'
사용법:
  bash scripts/setup-gitlab-primary.sh <GitLab-저장소-URL> [--mirror-github]

예시:
  bash scripts/setup-gitlab-primary.sh https://gitlab.com/myname/genspark-mall.git

옵션:
  --mirror-github   git push 시 GitLab 과 GitHub 양쪽에 동시에 push

사전 준비:
  1) GitLab 에서 빈 프로젝트 생성 (README 체크 해제)
  2) Personal Access Token 발급 — scope: write_repository (필수), read_repository
  3) git config --global credential.helper manager   (Windows 권장)
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --mirror-github) MIRROR_GITHUB=1; shift ;;
    --branch) BRANCH="${2:-main}"; shift 2 ;;
    -*)
      echo "알 수 없는 옵션: $1" >&2
      usage >&2
      exit 1
      ;;
    *) GITLAB_URL="$1"; shift ;;
  esac
done

# ── 1. 인자 검증 ─────────────────────────────────────────────────────────────
if [ -z "$GITLAB_URL" ]; then
  echo "❌ GitLab 저장소 URL 을 인자로 넘겨주세요." >&2
  echo >&2
  usage >&2
  exit 1
fi

case "$GITLAB_URL" in
  https://gitlab.com/*.git|git@gitlab.com:*.git) ;;
  *)
    echo "❌ URL 형식이 올바르지 않습니다: $GITLAB_URL" >&2
    echo "   https://gitlab.com/<아이디>/<프로젝트>.git 형태여야 합니다." >&2
    exit 1
    ;;
esac

# ── 2. git 저장소 / 커밋 확인 ────────────────────────────────────────────────
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "❌ 현재 디렉터리가 git 저장소가 아닙니다." >&2
  echo "   먼저 저장소를 clone 하세요:" >&2
  echo "   git clone https://github.com/windori77-rgb/genspark-mall.git" >&2
  exit 1
fi

if ! git rev-parse HEAD >/dev/null 2>&1; then
  echo "❌ 커밋이 하나도 없습니다. 먼저 커밋을 만들어 주세요." >&2
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "ℹ️  현재 브랜치: $CURRENT_BRANCH (지정한 브랜치: $BRANCH)"
  BRANCH="$CURRENT_BRANCH"
fi

echo "──────────────────────────────────────────────────"
echo " GitLab 주 저장소 전환"
echo "──────────────────────────────────────────────────"
echo " 대상 URL   : $GITLAB_URL"
echo " 브랜치     : $BRANCH"
echo " GitHub 미러: $([ "$MIRROR_GITHUB" = "1" ] && echo '사용' || echo '미사용')"
echo "──────────────────────────────────────────────────"
echo

# ── 3. 기존 origin 보존 → 'github' ───────────────────────────────────────────
OLD_ORIGIN="$(git remote get-url origin 2>/dev/null || true)"

if [ -n "$OLD_ORIGIN" ] && [ "$OLD_ORIGIN" != "$GITLAB_URL" ]; then
  if git remote get-url github >/dev/null 2>&1; then
    git remote set-url github "$OLD_ORIGIN"
    echo "✅ 'github' 원격 주소 갱신 : $OLD_ORIGIN"
  else
    git remote add github "$OLD_ORIGIN"
    echo "✅ origin → 'github' 로 보존 : $OLD_ORIGIN"
  fi
fi

# ── 4. origin 을 GitLab 으로 교체 ────────────────────────────────────────────
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$GITLAB_URL"
else
  git remote add origin "$GITLAB_URL"
fi
echo "✅ origin → GitLab : $GITLAB_URL"

# ── 5. (옵션) GitHub 동시 push ───────────────────────────────────────────────
if [ "$MIRROR_GITHUB" = "1" ]; then
  GH_URL="$(git remote get-url github 2>/dev/null || true)"
  if [ -n "$GH_URL" ]; then
    git remote set-url --push origin "$GITLAB_URL"
    git remote set-url --add --push origin "$GH_URL"
    echo "✅ push 대상 = GitLab + GitHub (git push 한 번으로 양쪽 반영)"
  else
    echo "⚠️  'github' 원격이 없어 미러 설정을 건너뜁니다."
  fi
fi

echo
echo "현재 원격 설정:"
git remote -v | sed 's/^/  /'
echo

# ── 6. 최초 push ─────────────────────────────────────────────────────────────
echo "──────────────────────────────────────────────────"
echo " GitLab 으로 최초 push"
echo "──────────────────────────────────────────────────"

# 자격증명 프롬프트로 멈추지 않도록 GIT_TERMINAL_PROMPT=0
REMOTE_HEAD="$(GIT_TERMINAL_PROMPT=0 git ls-remote --heads "$GITLAB_URL" "$BRANCH" 2>/dev/null || true)"

if [ -n "$REMOTE_HEAD" ]; then
  echo "⚠️  GitLab 에 '$BRANCH' 브랜치가 이미 존재합니다."
  echo "    · GitLab 프로젝트를 '빈 프로젝트'로 다시 만들었다면 아래를 실행하세요:"
  echo "        git push -u origin $BRANCH --force"
  echo "    · 기존 이력을 살리려면:"
  echo "        git pull origin $BRANCH --rebase"
  echo "        git push -u origin $BRANCH"
else
  echo "인증 정보를 물으면:"
  echo "   Username : GitLab 아이디"
  echo "   Password : Personal Access Token (glpat-... , 계정 비밀번호 아님)"
  echo
  git push -u origin "$BRANCH"
fi

echo
echo "──────────────────────────────────────────────────"
echo "✅ 전환 완료"
echo "──────────────────────────────────────────────────"
echo " 이제부터 git push 만으로 GitLab(주 저장소)에 반영됩니다."
echo
echo " 다음 단계 — 운영 배포는 Genspark 가 별도로 수행합니다:"
echo "   1) git push origin $BRANCH        (GitLab)"
echo "   2) Genspark 에이전트에게 'GitHub 저장소에서 pull 받아서 배포해줘' 요청"
echo
echo " 원격 확인: git remote -v"
echo "──────────────────────────────────────────────────"
