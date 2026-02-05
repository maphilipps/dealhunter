#!/bin/bash

issues=$(gh issue list --state open --json number,title,body,comments)

docker sandbox run claude --allow-dangerously-skip-permissions "$issues @progress.txt @plans/backlog/prompt.md"
