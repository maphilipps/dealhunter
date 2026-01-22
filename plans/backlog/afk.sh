#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

issues=$(gh issue list --state open --json number,title,body,comments)

for ((i=1; i<=$1; i++)); do
  result=$(docker sandbox run --credentials host claude -p "$issues @progress.txt @plans/backlog/prompt.md")

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "Ralph complete after $i iterations."
    exit 0
  fi
done
