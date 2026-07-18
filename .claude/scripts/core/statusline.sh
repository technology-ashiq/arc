#!/usr/bin/env bash
# === Status line ===  arc- beautiful, information-dense 2-line bar for Claude Code.
# Reads session JSON on stdin; prints TWO lines. python -> jq -> sed fallback.
# Fast: git/tracker/ledger cached ~3s per session_id.
#
# L1 (identity):  <model> | <PROJECT> <subpath> | <branch> +staged ~mod ?untr ^ahead vbehind | effort
# L2 (session):   <ctx-bar> %.tokens | <dur> $cost | +added -removed | <phase> | reviews | 5h-limit
#
# Universal design -- widely-supported Unicode, great in any modern terminal (no Nerd Font needed).
input=$(cat)

# ---------- parse JSON (one pass: python -> jq -> sed) ----------
PY=$(command -v python3 || command -v python || true)
F=""
if [ -n "$PY" ]; then
  F=$(printf '%s' "$input" | "$PY" -c '
import sys,json
try: d=json.load(sys.stdin)
except Exception: d={}
def g(o,*ks):
    for k in ks:
        o=o.get(k) if isinstance(o,dict) else None
        if o is None: return ""
    return o
def n(x):
    try: return str(int(float(x)))
    except Exception: return ""
c=g(d,"cost","total_cost_usd")
print("\x1f".join(str(x) for x in [
 g(d,"model","display_name") or "Claude",
 g(d,"workspace","current_dir") or g(d,"cwd") or "",
 g(d,"workspace","project_dir") or "",
 g(d,"workspace","repo","name") or "",
 n(g(d,"context_window","used_percentage")),
 n(g(d,"context_window","total_input_tokens")),
 (str(c) if c!="" else ""),
 n(g(d,"cost","total_duration_ms")),
 n(g(d,"cost","total_lines_added")),
 n(g(d,"cost","total_lines_removed")),
 g(d,"effort","level") or "",
 n(g(d,"rate_limits","five_hour","used_percentage")),
 n(g(d,"rate_limits","five_hour","resets_at")),
 g(d,"session_id") or "nosess",
]))' 2>/dev/null)
fi
if [ -z "$F" ] && command -v jq >/dev/null 2>&1; then
  F=$(printf '%s' "$input" | jq -r '[.model.display_name//"Claude",(.workspace.current_dir//.cwd//""),(.workspace.project_dir//""),(.workspace.repo.name//""),(.context_window.used_percentage//0|floor),(.context_window.total_input_tokens//0|floor),(.cost.total_cost_usd//""),(.cost.total_duration_ms//0|floor),(.cost.total_lines_added//0),(.cost.total_lines_removed//0),(.effort.level//""),(.rate_limits.five_hour.used_percentage//""|if .=="" then "" else floor end),(.rate_limits.five_hour.resets_at//""),(.session_id//"nosess")]|map(tostring)|join("\u001f")' 2>/dev/null)
fi
if [ -z "$F" ]; then
  _s(){ printf '%s' "$input" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n1; }
  _n(){ printf '%s' "$input" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\([0-9.]*\).*/\1/p" | head -n1; }
  F=$(printf '%s\t%s\t%s\t%s\t%s\t\t%s\t\t\t\t\t\t\t%s' "$(_s display_name)" "$(_s current_dir)" "$(_s project_dir)" "$(_s name)" "$(_n used_percentage)" "$(_n total_cost_usd)" "$(_s session_id)" | tr '\t' '\037')
fi
IFS=$'\x1f' read -r MODEL CURDIR PROJDIR REPO PCT INTOK COST DURMS LADD LDEL EFFORT RL5 RL5AT SID <<< "$F"
MODEL=${MODEL:-Claude}; PCT=${PCT%.*}; [ -z "$PCT" ] && PCT=0; SID=${SID:-nosess}
COST=${COST:-0}; DURMS=${DURMS:-0}; LADD=${LADD:-0}; LDEL=${LDEL:-0}; INTOK=${INTOK:-0}

# ---------- project identity ----------
CN=${CURDIR//\\//}; CN=${CN%/}; PN=${PROJDIR//\\//}; PN=${PN%/}
SUB=""; if [ -n "$PN" ] && [ "$CN" != "$PN" ] && [ "${CN#$PN/}" != "$CN" ]; then SUB=${CN#$PN/}; fi
PROJECT=$REPO; [ -z "$PROJECT" ] && PROJECT=${PN##*/}; [ -z "$PROJECT" ] && PROJECT=${CN##*/}; [ -z "$PROJECT" ] && PROJECT="."

# ---------- formatters ----------
fmt_tok(){ local n=${1:-0}; n=${n%.*}; [ -z "$n" ] && n=0
  if [ "$n" -ge 1000000 ]; then printf '%d.%dM' $((n/1000000)) $(((n%1000000)/100000))
  elif [ "$n" -ge 1000 ]; then printf '%dk' $((n/1000)); else printf '%d' "$n"; fi; }
fmt_dur(){ local ms=${1:-0}; ms=${ms%.*}; [ -z "$ms" ] && ms=0; local s=$((ms/1000)) m h; m=$((s/60)); h=$((m/60))
  if [ "$h" -gt 0 ]; then printf '%dh%dm' "$h" $((m%60)); else printf '%dm' "$m"; fi; }
fmt_left(){ local at=${1:-0}; at=${at%.*}; [ -z "$at" ] && { echo ""; return; }; local d=$(( at - $(date +%s) )); [ "$d" -le 0 ] && { echo "now"; return; }
  local m=$((d/60)) h; h=$((m/60)); if [ "$h" -gt 0 ]; then printf '%dh%dm' "$h" $((m%60)); else printf '%dm' "$m"; fi; }

# ---------- git + tracker + ledger (cached ~3s) ----------
CACHE="${TMPDIR:-/tmp}/arc-statusline-$SID"
_mtime(){ stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }
stale=1; [ -f "$CACHE" ] && [ "$(( $(date +%s) - $(_mtime "$CACHE") ))" -le 3 ] && stale=0
if [ "$stale" -eq 1 ]; then
  BR=""; ST=0; MD=0; UT=0; AH=0; BH=0; PH=""; RV=""
  if cd "$CN" 2>/dev/null && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    BR=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || echo "-")
    GROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "$CN")
    ST=$(git diff --cached --name-only 2>/dev/null | grep -c .)
    MD=$(git diff --name-only 2>/dev/null | grep -c .)
    UT=$(git ls-files --others --exclude-standard 2>/dev/null | grep -c .)
    AH=$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)
    BH=$(git rev-list --count 'HEAD..@{u}' 2>/dev/null || echo 0)
    [ -f "$GROOT/PROGRESS.md" ] && PH=$(awk '/^## Now/{f=1;next} /^## /{f=0} f' "$GROOT/PROGRESS.md" 2>/dev/null | grep -v '^[[:space:]]*$' | head -1 | sed 's/^[-*#>[:space:]]*//' | cut -c1-26)
    SHA=$(git rev-parse --short HEAD 2>/dev/null); LEDF="$GROOT/.claude/state/reviews/$SHA.txt"
    if [ -n "$SHA" ]; then for k in code qa security design docs; do
      if grep -qxF "$k" "$LEDF" 2>/dev/null; then RV="$RV ok:$k"; else case "$k" in code|qa|security) RV="$RV no:$k";; esac; fi
    done; fi
  fi
  printf '%s\n' "$BR|$ST|$MD|$UT|$AH|$BH|$PH|${RV# }" > "$CACHE" 2>/dev/null
fi
IFS='|' read -r BR ST MD UT AH BH PH RV < "$CACHE" 2>/dev/null

# ---------- colors (256) ----------
R='\033[0m'; DIM='\033[38;5;60m'; B='\033[1m'
C_MODEL='\033[38;5;141m'; C_PROJ='\033[38;5;117m'; C_BR='\033[38;5;150m'
C_ST='\033[38;5;150m'; C_MD='\033[38;5;179m'; C_UT='\033[38;5;117m'; C_AH='\033[38;5;117m'; C_BH='\033[38;5;204m'
C_TOK='\033[38;5;146m'; C_COST='\033[38;5;179m'; C_ADD='\033[38;5;150m'; C_DEL='\033[38;5;204m'
C_PH='\033[38;5;141m'; C_OK='\033[38;5;150m'; C_BAD='\033[38;5;204m'; C_EMPTY='\033[38;5;238m'
C_EFF='\033[38;5;176m'; C_LIM='\033[38;5;179m'
SEP=" ${DIM}\xe2\x94\x82${R} "
DIA="\xe2\x97\x86"; STAR="\xe2\x9c\xa6"; LIMG="\xe2\x97\xb1"

# context bar
if   [ "$PCT" -ge 85 ]; then BARC='\033[38;5;204m'; PCC='\033[38;5;204m'
elif [ "$PCT" -ge 60 ]; then BARC='\033[38;5;179m'; PCC='\033[38;5;179m'
else BARC='\033[38;5;150m'; PCC='\033[38;5;150m'; fi
FILL=$(( (PCT + 5) / 10 )); [ "$FILL" -gt 10 ] && FILL=10; [ "$FILL" -lt 0 ] && FILL=0; EMP=$((10-FILL))
BAR="$BARC"; i=0; while [ $i -lt $FILL ]; do BAR="$BAR\xe2\x96\x93"; i=$((i+1)); done
BAR="$BAR$C_EMPTY"; i=0; while [ $i -lt $EMP ]; do BAR="$BAR\xe2\x96\x91"; i=$((i+1)); done; BAR="$BAR$R"

# git status suffix
GS=""
[ "${ST:-0}" -gt 0 ] && GS="$GS ${C_ST}\xe2\x9c\x9a${ST}${R}"
[ "${MD:-0}" -gt 0 ] && GS="$GS ${C_MD}~${MD}${R}"
[ "${UT:-0}" -gt 0 ] && GS="$GS ${C_UT}?${UT}${R}"
[ "${AH:-0}" -gt 0 ] && GS="$GS ${C_AH}\xe2\x86\x91${AH}${R}"
[ "${BH:-0}" -gt 0 ] && GS="$GS ${C_BH}\xe2\x86\x93${BH}${R}"

# review flags
RVO=""; for t in $RV; do st=${t%%:*}; k=${t#*:}; l=$k; [ "$k" = security ] && l=sec
  if [ "$st" = ok ]; then RVO="$RVO ${C_OK}\xe2\x9c\x93${l}${R}"; else RVO="$RVO ${C_BAD}\xe2\x9c\x97${l}${R}"; fi; done; RVO=${RVO# }

# ---------- render (universal) ----------
COSTF=$(printf '$%.2f' "$COST" 2>/dev/null || echo "\$$COST")
L1="${B}${C_MODEL}${DIA} ${MODEL}${R}${SEP}${B}${C_PROJ}${PROJECT}${R}"
[ -n "$SUB" ] && L1="${L1} ${DIM}${SUB}${R}"
[ -n "$BR" ] && L1="${L1}${SEP}${C_BR}${BR}${R}${GS}"
[ -n "$EFFORT" ] && L1="${L1}${SEP}${C_EFF}${STAR} ${EFFORT}${R}"
printf '%b\n' "$L1"

L2="${BAR} ${PCC}${PCT}%${R}"
[ "${INTOK:-0}" -gt 0 ] && L2="${L2}${DIM}\xc2\xb7${R}${C_TOK}$(fmt_tok "$INTOK")${R}"
DUR=""; [ "${DURMS:-0}" -gt 0 ] && DUR=$(fmt_dur "$DURMS")
L2="${L2}${SEP}"; [ -n "$DUR" ] && L2="${L2}${DIM}${DUR}${R} "; L2="${L2}${C_COST}${COSTF}${R}"
{ [ "${LADD:-0}" -gt 0 ] || [ "${LDEL:-0}" -gt 0 ]; } && L2="${L2}${SEP}${C_ADD}+${LADD}${R} ${C_DEL}-${LDEL}${R}"
[ -n "$PH" ] && L2="${L2}${SEP}${C_PH}${DIA} ${PH}${R}"
[ -n "$RVO" ] && L2="${L2}${SEP}${RVO}"
if [ -n "$RL5" ]; then LEFT=$(fmt_left "$RL5AT"); L2="${L2}${SEP}${C_LIM}${LIMG} ${RL5}%${R}"; [ -n "$LEFT" ] && L2="${L2} ${DIM}${LEFT}${R}"; fi
printf '%b\n' "$L2"
