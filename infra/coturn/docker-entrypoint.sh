#!/bin/bash
set -e

# Default values if not provided
TURN_SECRET=${TURN_SECRET:-"supersecretturnkeychangeinproduction"}
TURN_REALM=${TURN_REALM:-"turn.watchverse.com"}

# Replace configuration placeholders with real environment variables
sed -i "s/__TURN_SECRET__/${TURN_SECRET}/g" /etc/turnserver.conf
sed -i "s/__TURN_REALM__/${TURN_REALM}/g" /etc/turnserver.conf

echo "Starting Coturn TURN server with Realm: ${TURN_REALM}"

# Execute the default turnserver command
exec turnserver -c /etc/turnserver.conf
