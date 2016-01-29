#!/bin/bash -eu

function join { local IFS="$1"; shift; echo "$*"; }

WORKSPACE=${WORKSPACE-$(pwd)}
DEBUG=${DEBUG-}
export WORKSPACE
export DEBUG

SU_TO_UID=${UID}
SU_TO_USER=${USER}
export SU_TO_USER
export SU_TO_UID

ISOLATED_UNIQ_ID=${BUILD_NUMBER:-$(date +"%Y-%m-%dT%H:%M:%S")}

function finish {
  docker-compose -p "webapp-${ISOLATED_UNIQ_ID}" -f docker-compose.internal.yml stop
  docker-compose -p "webapp-${ISOLATED_UNIQ_ID}" -f docker-compose.internal.yml rm -f
}
trap finish EXIT

docker-compose -p "webapp-${ISOLATED_UNIQ_ID}" -f docker-compose.internal.yml run -d mongosetup
docker-compose -p "webapp-${ISOLATED_UNIQ_ID}" -f docker-compose.internal.yml run --rm --entrypoint "/src/scripts/docker/exec/exec.sh $(join ' ' "$@")" internal-min
