#!/bin/bash
set -e
pwd=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
echo $pwd

rm -f $pwd/.env.deploy
cp $pwd/../.env $pwd/docker/.env
echo $'\nNETWORK='$1 >> $pwd/docker/.env

docker-compose -f $pwd/docker/docker-compose.yml --env-file $pwd/docker/.env up --build

cp -r $pwd/docker/build $pwd/../

node scripts/clean_build.js
node scripts/generate_meta.js --upload
yarn truffle exec scripts/verify_deployment.js --network=$1

rm $pwd/docker/.env