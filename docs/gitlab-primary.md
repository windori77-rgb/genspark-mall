# GitLab 을 주 저장소로 사용하기

이 문서는 이 프로젝트의 **주 저장소(Source of Truth)를 GitLab 으로 전환**하는 절차를 설명합니다.

> ⚠️ **먼저 읽어주세요 — 제가 대신 해드릴 수 없는 부분**
>
> 샌드박스(Genspark)에는 **GitLab 자격증명이 없습니다.** gitlab.com 네트워크 자체는 열려 있지만
> 토큰이 없어 push 할 수 없습니다. 따라서 GitLab 프로젝트 생성과 최초 push 는
> **고객님 노트북에서 직접** 실행하셔야 합니다. 제가 준비해 둔 것은 아래 3가지입니다.
>
> | 준비물 | 위치 | 역할 |
> |---|---|---|
> | 전환 스크립트 | `scripts/setup-gitlab-primary.sh` | 명령 1줄로 remote 전환 + 최초 push |
> | CI 파이프라인 | `.gitlab-ci.yml` | GitLab 이 주 저장소가 되면 실제로 실행되는 CI |
> | 이 문서 | `docs/gitlab-primary.md` | 절차 · 트러블슈팅 |

---

## 1. 전환 후 저장소 역할

```
┌─────────────────────────────────────────────────────────────────┐
│  origin   →  GitLab    (주 저장소 · 소스 오브 트루스)             │
│  github   →  GitHub    (미러 / 백업)                             │
│  genspark →  SB-Git    (Genspark 자동 백업 · 배포 스냅샷)         │
└─────────────────────────────────────────────────────────────────┘
```

### ⚠️ 배포는 GitLab 과 무관합니다

이 프로젝트의 운영 배포는 **Genspark 호스팅**이 담당합니다.
**GitLab 에 push 한다고 운영 사이트가 바뀌지 않습니다.**

```
노트북 VS Code ──push──▶ GitLab (주 저장소)
                         │
                         └─(mirror)─▶ GitHub ──pull──▶ 샌드박스
                                                        │
                                          gsk hosted deploy (승인)
                                                        ▼
                                                   운영 사이트
```

실제 반영 순서:

1. 노트북에서 코드 수정
2. `git push origin main` → **GitLab (+ GitHub 동시)**
3. Genspark 에이전트에게 **"GitHub 에서 pull 받아서 배포해줘"** 요청
4. 승인 → 운영 반영

> **왜 샌드박스는 GitHub 을 보나?** 샌드박스에는 GitLab 토큰이 없기 때문입니다.
> 그래서 `--mirror-github` 옵션으로 **양쪽에 동시 push** 하도록 설정합니다.
> 이러면 push 한 번으로 GitLab(주) + GitHub(배포 경유지) 가 모두 최신이 됩니다.

---

## 2. 사전 준비

### 2-1. GitLab 프로젝트 생성

1. https://gitlab.com → **New project → Create blank project**
2. Project name: `genspark-mall`
3. **Initialize repository with a README → 체크 해제** ← 중요 (push 충돌 방지)
4. Visibility: **Private** 권장
5. **Create project**

### 2-2. Personal Access Token 발급

GitLab 은 HTTPS push 시 **계정 비밀번호를 거부**합니다. 토큰이 필수입니다.

1. GitLab 우상단 프로필 → **Preferences** (또는 **Edit profile**)
2. 좌측 **Access Tokens**
3. 입력:
   - **Token name**: `vscode-laptop`
   - **Expiration date**: 원하는 기간 (예: 1년)
   - **Scopes**: ✅ **`write_repository`** (필수), ✅ `read_repository`
4. **Create personal access token**
5. **`glpat-xxxxxxxxxxxxxxxxxxxx` 를 즉시 복사** — 다시 볼 수 없습니다

> 🔒 이 토큰은 비밀번호와 동급입니다. 채팅·이슈·코드에 절대 붙여넣지 마세요.
> 실수로 노출했다면 GitLab → Access Tokens → **Revoke** 후 재발급하세요.

### 2-3. 노트북 도구 확인

```bash
node -v     # v22.12.0 이상
git --version
```

---

## 3. 전환 실행 (노트북)

### 3-1. 저장소 받기

이미 clone 되어 있으면 이 단계를 건너뜁니다.

```bash
git clone https://github.com/windori77-rgb/genspark-mall.git
cd genspark-mall
```

### 3-2. 스크립트 실행

```bash
bash scripts/setup-gitlab-primary.sh https://gitlab.com/<본인아이디>/genspark-mall.git --mirror-github
```

Windows PowerShell 에서는:

```powershell
bash scripts/setup-gitlab-primary.sh https://gitlab.com/<본인아이디>/genspark-mall.git --mirror-github
```

> `bash` 가 없다면 Git Bash 를 사용하거나, 아래 **3-3 수동 절차**를 따르세요.

### 3-3. 수동으로 하려면 (스크립트 없이)

```bash
# 1) 기존 origin(GitHub)을 'github' 로 보존
git remote rename origin github

# 2) origin 을 GitLab 으로
git remote add origin https://gitlab.com/<본인아이디>/genspark-mall.git

# 3) (권장) push 시 양쪽 동시 전송
git remote set-url --add --push origin https://gitlab.com/<본인아이디>/genspark-mall.git
git remote set-url --add --push origin https://github.com/windori77-rgb/genspark-mall.git

# 4) 최초 push
git push -u origin main
```

인증 프롬프트가 나오면:

| 항목 | 입력값 |
|---|---|
| Username | GitLab **아이디** |
| Password | **`glpat-...` 토큰** (계정 비밀번호 ❌) |

### 3-4. 확인

```bash
git remote -v
```

기대 출력:

```
github   https://github.com/windori77-rgb/genspark-mall.git (fetch)
github   https://github.com/windori77-rgb/genspark-mall.git (push)
origin   https://gitlab.com/<아이디>/genspark-mall.git (fetch)
origin   https://gitlab.com/<아이디>/genspark-mall.git (push)
origin   https://github.com/windori77-rgb/genspark-mall.git (push)   ← 미러
```

`origin` 의 push 항목이 **2줄**이면 GitLab + GitHub 동시 push 가 설정된 것입니다.

---

## 4. VS Code 사용법

### 소스 제어 패널
- 좌측 **Source Control** (`Ctrl+Shift+G`)
- 변경 파일 확인 → 메시지 입력 → **✓ Commit** → **Sync/Push**

### 명령 팔레트로 remote 관리
`Ctrl+Shift+P` →

| 명령 | 용도 |
|---|---|
| `Git: Add Remote` | remote 추가 (이름: `github`) |
| `Git: Fetch From All Remotes` | 양쪽 최신 상태 확인 |
| `Git: Push` | origin(GitLab + GitHub)으로 push |
| `Git: Pull` | origin(GitLab)에서 pull |

### 터미널
```bash
git push origin main    # GitLab + GitHub 동시
git push github main    # GitHub 만 (긴급 시)
git pull origin main    # GitLab 에서
```

---

## 5. GitLab CI

`.gitlab-ci.yml` 이 저장소에 포함되어 있어, GitLab 이 주 저장소가 되면 **자동으로 실행**됩니다.

| Job | Stage | 내용 |
|---|---|---|
| `typecheck` | verify | `tsc --noEmit` — 타입 오류 0 요구 |
| `build` | build | `vite build` → `dist/` 아티팩트 (1주 보관) |

- 러너: GitLab **Shared Runners** (무료 플랜에서 사용 가능)
- 이미지: `node:22-bookworm`
- npm 캐시: `package-lock.json` 기준 job 간 공유

### ⛔ deploy job 은 의도적으로 없습니다

CI 에서 `wrangler pages deploy` 를 실행하면 **고객님 개인 Cloudflare 계정으로 유령 배포**가 생깁니다.
운영 배포는 Genspark 호스팅 전용입니다. (근거: `scripts/deploy-guard.mjs`, README 8장)

CI 화면: GitLab 프로젝트 → **Build → Pipelines**

---

## 6. 자주 겪는 오류

| 증상 | 원인 | 해결 |
|---|---|---|
| `remote: HTTP Basic: Access denied` | 계정 비밀번호 사용 | **PAT 로 교체** |
| `Support for password authentication was removed` | 위와 동일 | 토큰만 허용됨 |
| `403 Forbidden` | 토큰 스코프에 `write_repository` 누락 | 토큰 재발급 |
| `! [rejected] main -> main (fetch first)` | GitLab 프로젝트에 커밋이 있음 | 빈 프로젝트로 재생성하거나 `git push -u origin main --force` |
| `src refspec main does not match any` | 로컬에 커밋이 없음 | `git add . && git commit -m "init"` |
| 인증 창이 계속 뜸 | 자격증명 미저장 | `git config --global credential.helper manager` (Windows) |
| `Authentication failed` 반복 | 옛 자격증명 캐시 | Windows **자격 증명 관리자** → `gitlab.com` 삭제 후 재시도 |
| CI 가 안 돌아감 | `.gitlab-ci.yml` 없음 or CI 비활성 | 파일 존재 확인 → **Settings → CI/CD → Enable** |
| 2FA 켠 계정에서 push 불가 | 2FA 계정은 비밀번호 인증 불가 | **PAT 가 유일한 방법** |

---

## 7. 되돌리기 (GitHub 을 다시 주 저장소로)

```bash
# origin 을 GitHub 으로
git remote set-url origin https://github.com/windori77-rgb/genspark-mall.git
git remote set-url --delete --push origin https://github.com/windori77-rgb/genspark-mall.git

# GitLab remote 제거 (원하면)
git remote remove github

git remote -v   # 확인
```

---

## 8. GitLab 을 주 저장소로 쓸 때의 트레이드오프

### ✅ 장점
- GitLab CI 무료 (월 400 compute minutes, Shared Runners)
- Container Registry · Issue Board · Merge Request 등 무료 제공
- private 저장소 무제한
- Self-hosted 이전 용이

### ⚠️ 주의
- **Genspark 자동 백업은 GitLab 을 보지 않습니다** — SB-Git 만 봅니다.
  → `--mirror-github` 로 GitHub 에도 push 해두면 백업·배포 경로가 유지됩니다.
- **GitLab → GitHub 자동 미러링(pull)은 유료**입니다 (Premium+).
  무료로 자동화하려면 GitHub Actions 로 GitLab 에 push 하는 방향만 가능합니다.
- 샌드박스는 GitLab 토큰이 없어 **GitLab 에서 직접 pull 할 수 없습니다** → GitHub 경유.

---

## 9. 체크리스트

- [ ] GitLab 에 **빈 프로젝트** 생성 (README 체크 해제)
- [ ] Personal Access Token 발급 (`write_repository`)
- [ ] 노트북에 저장소 clone
- [ ] `bash scripts/setup-gitlab-primary.sh <URL> --mirror-github` 실행
- [ ] `git remote -v` 로 origin 2줄(push) 확인
- [ ] `git push -u origin main` 성공
- [ ] GitLab 에서 파일 57개 보이는지 확인
- [ ] GitLab **Build → Pipelines** 에서 CI 그린 확인
- [ ] Genspark 에이전트에게 "GitHub pull 후 배포" 요청
