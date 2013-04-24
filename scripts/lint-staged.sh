#!/bin/bash

# this script requires:
# - the user to be in a git repo
# - git to be installed
# - jshint to be installed


path=`pwd`
cd `git rev-parse --show-toplevel`

staged=`git diff --raw --name-only --cached --diff-filter=ACMR | grep -e '\.js$'`

if [[ -z "$staged" ]]
then
	echo No staged JavaScript files to lint.
	exit 0
fi

./node_modules/.bin/jshint $staged --config ./scripts/jshint.cfg --reporter ./scripts/humanJshintReporter.js
exitCode=$?

cd "$path"

exit $exitCode