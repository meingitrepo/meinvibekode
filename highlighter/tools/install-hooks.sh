#!/usr/bin/env bash
# Installs the pre-push hook that refuses a push to main without the User's PUSH (see push-guard.sh).
# Hooks live in the git directory shared by all worktrees, so run this once per clone.
# Usage: highlighter/tools/install-hooks.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
hooks="$(git rev-parse --git-common-dir)/hooks"
mkdir -p "$hooks"
cat > "$hooks/pre-push" <<'HOOK'
#!/usr/bin/env bash
# Installed by highlighter/tools/install-hooks.sh: a push to main needs the User's PUSH.
guard="$(git rev-parse --show-toplevel)/highlighter/tools/push-guard.sh"
[ -f "$guard" ] || exit 0
while read -r _ _ remote_ref _; do
    [ "$remote_ref" = refs/heads/main ] && { bash "$guard" check || exit 1; }
done
exit 0
HOOK
chmod +x "$hooks/pre-push"
echo "pre-push hook installed in $hooks"
