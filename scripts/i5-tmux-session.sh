#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# I5 WAVE TMUX SESSION LAUNCHER
# Usage: ./scripts/i5-tmux-session.sh
# ═══════════════════════════════════════════════════════════════

SESSION="i5-wave"

# Check if session exists
if tmux has-session -t $SESSION 2>/dev/null; then
    echo "Session $SESSION already exists. Attaching..."
    tmux attach -t $SESSION
    exit 0
fi

# Setup tmux config (if not already)
if [ ! -f ~/.tmux.conf ]; then
    cp .tmux-i5.conf ~/.tmux.conf
    echo "Installed tmux config to ~/.tmux.conf"
fi

# Create session with 4 windows:
# 1: coordination (main)
# 2: backend-core
# 3: integration
# 4: frontend
# 5: verifier

echo "Creating I5 wave tmux session..."

tmux new-session -d -s $SESSION -n "coordination" "cd $PWD && exec bash"

# Window 2: backend-core
tmux new-window -t $SESSION:2 -n "backend-core" "cd $PWD && exec bash"
tmux split-window -t $SESSION:2 -h -p 25
tmux split-window -t $SESSION:2 -v -p 50

# Window 3: integration
tmux new-window -t $SESSION:3 -n "integration" "cd $PWD && exec bash"
tmux split-window -t $SESSION:3 -h -p 25
tmux split-window -t $SESSION:3 -v -p 50

# Window 4: frontend
tmux new-window -t $SESSION:4 -n "frontend" "cd $PWD && exec bash"
tmux split-window -t $SESSION:4 -h -p 25
tmux split-window -t $SESSION:4 -v -p 50

# Window 5: verifier (opus, for final gate)
tmux new-window -t $SESSION:5 -n "verifier" "cd $PWD && exec bash"
tmux split-window -t $SESSION:5 -h -p 30
tmux split-window -t $SESSION:5 -v -p 50

# Start in coordination window
tmux select-window -t $SESSION:1
tmux split-window -h -p 30
tmux split-window -v -p 50

# Attach
echo "Session created with windows: coordination, backend-core, integration, frontend, verifier"
echo "Navigate: Ctrl+b n/p (next/prev window), Ctrl+b w (list windows)"
echo "Panes: Ctrl+b h/j/k/l"
tmux attach -t $SESSION
