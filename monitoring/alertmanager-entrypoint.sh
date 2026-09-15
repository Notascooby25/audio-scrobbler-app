#!/bin/sh
set -eu

sed -e "s|\${ALERTMANAGER_CRITICAL_WEBHOOK_URL}|$ALERTMANAGER_CRITICAL_WEBHOOK_URL|g" \
    -e "s|\${ALERTMANAGER_WARNING_WEBHOOK_URL}|$ALERTMANAGER_WARNING_WEBHOOK_URL|g" \
    /etc/alertmanager/alertmanager.yml > /tmp/alertmanager.yml

exec alertmanager --config.file=/tmp/alertmanager.yml
