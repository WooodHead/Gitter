#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

set -e
set -x

export INDEX_VERSION=01
export INDEX_NAME=gitter${INDEX_VERSION}
export USER_RIVER=gitterUserRiver${INDEX_VERSION}
export CHAT_RIVER=gitterChatRiver${INDEX_VERSION}
export ROOM_RIVER=gitterRoomRiver${INDEX_VERSION}
export GROUP_RIVER=gitterGroupRiver${INDEX_VERSION}
export ES_URL=http://localhost:9200

while ! curl -q --fail "${ES_URL}"; do sleep 1; done

MONGO_HOST_1=mongo1
export MONGO_HOST_1
export MONGO_PORT_1=27017

$SCRIPT_DIR/01-create-index-with-mapping
$SCRIPT_DIR/02-create-rivers
$SCRIPT_DIR/03-setup-alias
