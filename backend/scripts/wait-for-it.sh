#!/bin/bash

# Wait for service script
# Usage: ./scripts/wait-for-it.sh host:port [--timeout=15] [-- command args]

TIMEOUT=15
HOST=""
PORT=""
CMD=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --timeout=*)
            TIMEOUT="${1#*=}"
            shift
            ;;
        *:*)
            HOST=$(echo $1 | cut -d: -f1)
            PORT=$(echo $1 | cut -d: -f2)
            shift
            ;;
        --)
            shift
            CMD=("$@")
            break
            ;;
        *)
            shift
            ;;
    esac
done

if [ -z "$HOST" ] || [ -z "$PORT" ]; then
    echo "Usage: $0 host:port [--timeout=15] [-- command args]"
    exit 1
fi

echo "Waiting for $HOST:$PORT (timeout: ${TIMEOUT}s)..."

for i in $(seq 1 $TIMEOUT); do
    if nc -z "$HOST" "$PORT" 2>/dev/null; then
        echo "$HOST:$PORT is available after $i seconds"
        if [ ${#CMD[@]} -gt 0 ]; then
            exec "${CMD[@]}"
        fi
        exit 0
    fi
    sleep 1
done

echo "Timeout: $HOST:$PORT is not available after $TIMEOUT seconds"
exit 1
