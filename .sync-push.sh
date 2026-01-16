#!/bin/bash
# Push skill changes to GitHub
cd ~/.claude/skills && git add . && git commit -m "Update skills $(date +%Y-%m-%d)" && git push origin main
