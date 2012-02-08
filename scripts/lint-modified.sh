#!/bin/bash

# this script requires:
# - the user to be in a git repo
# - git to be installed
# - jshint to be installed


path=`pwd`
cd `git rev-parse --show-toplevel`

modified=`git status --porcelain|grep -e '^ [AM] ' |grep -e '\.js$' |cut -c4-`
if [[ -z "$modified" ]]
then
	echo No modified JavaScript files to lint.
	exit 0
fi

jshint $modified --config ./scripts/jshint.cfg
exitCode=$?

cd "$path"

exit $exitCode

