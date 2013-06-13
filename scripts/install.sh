#!/usr/bin/env bash

MAGE_DIR="$(pwd)";
APP_DIR="$( cd "$(dirname $( dirname "${MAGE_DIR}" ))" && pwd )"
KERNEL="$(uname)";

#
# We use libbash to format on screen
#
pushd ${MAGE_DIR}/scripts > /dev/null
tar -zxvf libbash.tar.gz > /dev/null;
popd > /dev/null;

function getAttribute() {
    node -e "process.stdout.write(require('${APP_DIR}/package.json').${1})";
}

function getMageAttribute() {
    node -e "process.stdout.write(require('${MAGE_DIR}/package.json').${1})";
}

#
# Here we perl because... because...
# https://github.com/meteor/meteor/blob/master/scripts/node.sh#L25
#
function resetStdin() {
    perl -MFcntl=F_GETFL,F_SETFL,O_NONBLOCK -e \
            'fcntl(STDIN, F_SETFL, ~O_NONBLOCK & fcntl(STDIN, F_GETFL, 0))';
}

function replaceTemplateValues () {
    for varName in ${varList}; do
        varVal=$(eval echo "\${$varName}");
        if [ "${KERNEL}" == "Darwin" ]; then
            sed -i "" "s#%${varName}%#${varVal}#g" ${1};
        else
            sed -i "s#%${varName}%#${varVal}#g" ${1};
        fi
    done
}

function indent () {
    while read line; do
        echo "  ${line}";
    done;
}

#
# Required display libraries.
#
. ${MAGE_DIR}/scripts/libbash/bashr.sh
. ${MAGE_DIR}/scripts/libbash/colorize.sh

#
# We move to the directory of the app to be bootstrapped
#
pushd ${APP_DIR} > /dev/null;

echo "                                 " | inverse | blue | bold;
echo " _ __ ___   __ _  __ _  ___" | blue | bold
echo " | '_ \` _ \\ / _\` |/ _\` |/ _ \\" | blue | bold
echo " | | | | | | (_| | (_| |  __/ " | blue | bold
echo " |_| |_| |_|\\__,_|\\__, |\\___|" | blue | bold
echo "                  |___/" | blue | bold
echo "                                 " | inverse | blue | bold;

#
# If we update or install in an existing project, we only git setup
#
if [ -e package.json ] || [ ! "${BOOTSTRAP}" == "true" ] ; then

    echoH1 "Updating your application for the latest MAGE";

    if [ -d .git ] && [ -f Makefile ]; then
        make git-setup;
    fi

    echo "";
    echo "                                 " | inverse | green | bold;
    echoOk "MAGE Install/Update completed";
    echo "                                 " | inverse | green | bold;

    exit 0;
fi


echoH1 "Bootstrapping your application";

#
# First: create directory structure
#
echoH2 "Creating directory structure";
mkdir -p \
    assets \
    config \
    components \
    db \
    docs \
    lib \
    logs \
    setup \
    staticData \
    www \
&& echoOk "Directory structure created";

#
# Drop in template files. We do not parse them yet, but parse them
# once we have collected information through npm init
#
echoH2 "Copying template files";

pushd ${MAGE_DIR}/scripts/templates > /dev/null;
templateFiles=$(find . -type f);
popd > /dev/null;

for file in ${templateFiles}; do
    dst=$(echo ${file} | sed "s/\.tpl$//");
    setup "Copying ${file}" \
        cp ${MAGE_DIR}/scripts/templates/${file} ${dst} \
        "Could not copy ${file}" \
    ;
done

echoH2 "Adding placeholder files in empty directories";
for empty in $(find . -depth -empty | grep -v ".git" | grep -v node_modules); do
    setup "Adding ${empty}/.placeholder" \
        touch ${empty}/.placeholder \
        "Could not touch ${empty}/.placeholder" \
    ;
done

#
# NPM init
#
echoH2 "Setting up package.json (npm init)";
echo "";

npm init | cyan && resetStdin;

#
# Variables we need. If you add a new one for all your files, just basically
# add the variable to the list below; the script further down will detect the new variable
# and add it to the list of template var to be replaced
#

echoH2 "Replacing values in installed template files";

APP_NAME=$(getAttribute "name");
APP_DESCRIPTION=$(getAttribute "description");
APP_VERSION=$(getAttribute "version");
APP_AUTHOR=$(getAttribute "author");

MAGE_VERSION=$(getMageAttribute "version");
MAGE_NODE_VERSION=$(getMageAttribute "engines.node");

#
# Replace all the variables above in all dropped in template files
#
varList=$( (set -o posix ; set) | grep -e "^APP_" -e "^MAGE_" | cut -d"=" -f1);

for file in ${templateFiles}; do

    dst=$(echo ${file} | sed "s/\.tpl$//" | sed "s#^\./##");

    setup "Parsing ${dst}" \
        replaceTemplateValues ${dst} \
        "Could not parse ${dst}" \
    ;
done;

#
# We give the option to the user to bootstrap their git repository.
#
echoH2 "Setting up git";

echoQuestion createRepo "Would you like to set up you git repository? (y/n)";

if [ "${createRepo}" == "y" ]; then

    echoQuestion remoteRepo "Remote repository URI";
    echoQuestion doCommit "Would you like us to do your first commit/push? (y/n)";

    [ ! -d .git ] && git init;
    setup "Adding specified repository as your origin" \
        git remote add origin ${remoteRepo} \
        "Setting up remote origin failed" \
    ;

    if [ "${doCommit}" == "y" ]; then
        setup "Adding files to your first commit" \
            git add . \
            "Could not add files to your staging" \
        ;

        setup "Completing first commit" \
            git commit -m "MAGE automated first commit / bootstrap" \
            "Commit failed" \
        ;

        setup "Pushing to origin/develop" \
            git push origin develop \
            "Push to your remote develop failed" \
        ;
    fi
fi

#
# Upon success, we inform the user of the completion. We should
# Most likely also start the vanilla MAGE app, and point to the documentation
# if possible...
#


echo "";
echo "";
echo "                                                               " | inverse | green | bold;
node . help | indent;
echo "";
echoOk "Setup completed! Please open ./lib/index.js to get started";
echo "";
echo "                                                               " | inverse | green | bold;
exit 0;

