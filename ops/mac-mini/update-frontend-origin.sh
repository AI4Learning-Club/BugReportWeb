#!/bin/zsh
set -euo pipefail
ENV_FILE="$HOME/Project/BugReportWeb/backend/.env"
python3 <<'PY'
from pathlib import Path
p = Path("/Users/ai4learning/Project/BugReportWeb/backend/.env")
lines = p.read_text().splitlines()
extra = [
    "http://bug.ai4learningwhu.cn:19876",
    "http://bug.ai4learningwhu.cn:3001",
]
out = []
for line in lines:
    if line.startswith("FRONTEND_ORIGIN="):
        val = line.split("=", 1)[1].strip().strip('"')
        parts = [x.strip() for x in val.split(",") if x.strip()]
        for item in extra:
            if item not in parts:
                parts.append(item)
        out.append('FRONTEND_ORIGIN="' + ",".join(parts) + '"')
    elif line.startswith("WEB_APP_ORIGIN="):
        continue
    else:
        out.append(line)
if not any(line.startswith("WEB_APP_ORIGIN=") for line in out):
    out.append('WEB_APP_ORIGIN="http://bug.ai4learningwhu.cn:19876"')
p.write_text("\n".join(out) + "\n")
print(p.read_text())
PY
launchctl kickstart -k "gui/$(id -u)/com.user.bugreportweb"
