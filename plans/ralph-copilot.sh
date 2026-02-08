#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

for ((i=1; i<=$1; i++)); do
  echo "Iteration $i of $1"
  echo "--------------------------------"

  ./plans/once-copilot.sh

  result=$?
  if [ $result -ne 0 ]; then
    echo "RALPH iteration $i failed, stopping."
    exit 1
  fi
done

echo "All $1 iterations complete."
