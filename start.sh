#!/usr/bin/env sh
# Запуск Visualization Studio (Linux / macOS).
# Если рядом лежит портативный Node.js в папке node/, используется он.
cd "$(dirname "$0")" || exit 1
NODE=node
[ -x ./node/bin/node ] && NODE=./node/bin/node
exec "$NODE" server.js
