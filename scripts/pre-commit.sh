#!/bin/bash
# Pre-commit hook to ensure code is formatted and linted before committing

set -e

echo "=== Running Go fmt ==="
# Check if any go files need formatting
UNFORMATTED=$(gofmt -l .)
if [ -n "$UNFORMATTED" ]; then
    echo "Formatting Go code..."
    gofmt -w $UNFORMATTED
    echo "The following files were formatted:"
    echo "$UNFORMATTED"
    echo "Please stage these files and commit again."
    exit 1
fi

echo "=== Running Frontend Lint ==="
cd frontend
npm run lint

echo "Pre-commit checks passed!"
