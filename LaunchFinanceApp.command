#!/bin/bash

# Add common paths for Node/npm (Homebrew, etc)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# HARDCODED PROJECT PATH - To allow the script to be placed anywhere
PROJECT_PATH="/Users/manikantaamara/Desktop/Antigravity/Finance_Analyser"

echo "========================================"
echo "   Starting Finance Analyser App"
echo "========================================"

# Navigate to the project directory
echo "Navigating to project directory: $PROJECT_PATH"
cd "$PROJECT_PATH" || {
    echo "ERROR: Could not find project directory at $PROJECT_PATH"
    echo "Please check if the folder exists."
    read -n 1 -s -r -p "Press any key to exit..."
    exit 1
}

# Debug: verify npm is found
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm could not be found."
    echo "Current PATH: $PATH"
    echo ""
    read -n 1 -s -r -p "Press any key to exit..."
    exit 1
fi

# Start the backend server in the background
echo "Step 1/3: Starting backend server..."
npm run server &
BACKEND_PID=$!

# Check if backend started successfully
if [ $? -ne 0 ]; then
    echo "Failed to start backend server."
    read -n 1 -s -r -p "Press any key to exit..."
    exit 1
fi

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
}

# Trap signals to ensure cleanup occurs when the terminal is closed or script is stopped
trap cleanup INT TERM EXIT

# Wait a moment for backend to initialize
sleep 2

# Open the App in the default browser
echo "Step 2/3: Opening browser..."
open http://localhost:5173

# Start the frontend dev server
echo "Step 3/3: Starting frontend..."
echo "----------------------------------------"
echo "App is running! Press Ctrl+C to stop."
echo "----------------------------------------"
npm run dev
