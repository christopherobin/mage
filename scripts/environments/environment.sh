#!/usr/bin/env bash

#
# Find environment
#
ROOT_DIR="$(dirname "$(which "$0")")"
KERNEL=$(uname);
NODE_VERSION="0.10";

#
# Some tools for more colors
#
declare -a bold=("\033[1m"  "\033[22m");
declare -a cyan=("\033[36m" "\033[39m");
declare -a green=("\033[32m" "\033[39m");
declare -a red=("\033[31m" "\033[39m");
declare -a yellow=("\033[33m" "\033[39m");

cWrap(){
    echo -en "$(eval "echo \${$1[0]}")"
    cat -;
    echo -en "$(eval "echo \${$1[1]}")"
}

red(){
    cat - | cWrap red;
}

green(){
    cat - | cWrap green;
}

yellow(){
    cat - | cWrap yellow;
}

cyan(){
    cat - | cWrap cyan;
}

bold(){
    cat - | cWrap bold;
}

echoWarning(){
    echo "⧫ $@" | yellow | bold
}

echoError(){
    echo "✘ $@" | red | bold 1>&2
    exit 1;
}

echoOk(){
    echo "✔ $@" | green | bold
}

if [ "${KERNEL}" == "Linux" ]; then
    OS=$(lsb_release -is);
elif [ "${KERNEL}" == "Darwin" ]; then
    OS="OSX";
else
    echoError "Your kernel type is not supported";
fi

#
# OS Specific segment
#
if [ -f "${ROOT_DIR}/${OS}.sh" ]; then
    . ${OS}.sh;
else
    echo "";
    echo "----------------------------------------------------" | cyan;
    echo "Getting installation file for ${KERNEL}/${OS}" | cyan;
    echo "----------------------------------------------------" | cyan;
    echo "";

    (curl http://www.wizcorp.jp/mage/${OS}.sh -s -o ${OS}.sh) || echoError "Your operating system is not supported";
    . ./${OS}.sh || echoError "Something went wrong while running OS-specific installation process"
fi

#
# Common segment
#
function nvm_install () {
    echo "";
    echo "------------------------------------------" | cyan;
    echo "Installing NVM (Node Version Manager)" | cyan;
    echo "-----------------------------------------" | cyan;
    echo "";

    git clone https://github.com/creationix/nvm.git ~/.nvm || return 1;

    if [ -f ~/.bashrc ]; then
        echo ". ~/.nvm/nvm.sh" >> ~/.bashrc;
    fi

    if [ -f ~/.bash_profile ]; then
        echo ". ~/.nvm/nvm.sh" >> ~/.bash_profile;
    fi

    . ~/.nvm/nvm.sh;

    echo "";
    echoOk "NVM installed successfully";
}

function node_latest () {
    echo "";
    echo "--------------------------------------------" | cyan;
    echo "Installing latest Node.js ${NODE_VERSION} version" | cyan;
    echo "--------------------------------------------" | cyan;
    echo "";

    nvm install ${NODE_VERSION} || return 1;

    echo "";
    echoOk "Node latest ${NODE_VERSION} installed successfully";
}

if type nvm 2> /dev/null > /dev/null; then
    echoOk "NVM is already installed!";
else
    nvm_install || echoError "Could not install Node Version Manager (NVM)";
fi

node_latest || echoError "Could not install latest Node.js version for ${NODE_VERSION}";

echo "";
echo "-----------------------------" | green;
echoOk "Installation completed";
echo "-----------------------------" | green;
exit 0;
