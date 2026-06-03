#!/bin/zsh
set -euo pipefail

export PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/opt/homebrew/sbin:$PATH

PROJECT_ROOT="$HOME/Project"
APP_DIR="$PROJECT_ROOT/BugReportWeb"
REPO_DIR="$PROJECT_ROOT/BugReportWeb-repo"
REPO_URL="https://github.com/AI4Learning-Club/BugReportWeb.git"
BRANCH="main"
SERVICE_LABEL="com.user.bugreportweb"
DEPLOY_REVISION_FILE="$APP_DIR/.deploy-revision"
LOG_DIR="$APP_DIR/logs"
LOG_FILE="$LOG_DIR/auto-sync.log"

mkdir -p "$LOG_DIR"
exec >>"$LOG_FILE" 2>&1

timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

echo "[$(timestamp)] sync check started"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "[$(timestamp)] cloning source repo into $REPO_DIR"
  rm -rf "$REPO_DIR"
  git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
git remote set-url origin "$REPO_URL"
git fetch origin "$BRANCH"

remote_head="$(git rev-parse "origin/$BRANCH")"
repo_head="$(git rev-parse HEAD)"
deployed_head=""

if [ -f "$DEPLOY_REVISION_FILE" ]; then
  deployed_head="$(cat "$DEPLOY_REVISION_FILE")"
fi

if [ "$repo_head" != "$remote_head" ]; then
  echo "[$(timestamp)] repo update detected: $repo_head -> $remote_head"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
fi

if [ "$deployed_head" = "$remote_head" ]; then
  echo "[$(timestamp)] no deploy needed; already at $remote_head"
  exit 0
fi

if [ ! -f "$APP_DIR/backend/.env" ]; then
  echo "[$(timestamp)] missing $APP_DIR/backend/.env; aborting"
  exit 1
fi

mkdir -p "$APP_DIR/uploads/bug-screenshots" "$APP_DIR/logs"

echo "[$(timestamp)] syncing worktree into $APP_DIR"
rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude "backend/node_modules" \
  --exclude "frontend/node_modules" \
  --exclude "backend/dist" \
  --exclude "frontend/dist" \
  --exclude "uploads" \
  --exclude "logs" \
  --exclude "backend/.env" \
  --exclude "start-bugreportweb.sh" \
  "$REPO_DIR"/ "$APP_DIR"/

cd "$APP_DIR"
echo "[$(timestamp)] installing dependencies"
npm ci

echo "[$(timestamp)] generating Prisma client"
npm --workspace backend exec prisma generate

echo "[$(timestamp)] applying database migrations"
(cd backend && npx prisma migrate deploy)

echo "[$(timestamp)] building application"
npm run build

echo "[$(timestamp)] restarting $SERVICE_LABEL"
launchctl kickstart -k "gui/$(id -u)/$SERVICE_LABEL"

printf "%s" "$remote_head" > "$DEPLOY_REVISION_FILE"
echo "[$(timestamp)] deploy completed at $remote_head"
