#!/usr/bin/env bash

OSX_VERSION="$(sw_vers | grep ProductVersion | cut -b 17-20)";

if ! which xcodebuild > /dev/null; then
    echo "";
    echoError "You need to install XCode 4 before we can proceed."
fi

function macport_install() {
    echo "";
    echo "---------------------" | cyan;
    echo "Installing MacPort" | cyan;
    echo "---------------------" | cyan;
    echo "";

    case ${OSX_VERSION} in
        "10.8")
            wget https://distfiles.macports.org/MacPorts/MacPorts-2.1.3-10.8-MountainLion.pkg -O macport.pkg;
            ;;
        "10.7")
            wget https://distfiles.macports.org/MacPorts/MacPorts-2.1.3-10.7-Lion.pkg -O macport.pkg;
            ;;
        "10.6")
            wget https://distfiles.macports.org/MacPorts/MacPorts-2.1.3-10.6-SnowLeopard.pkg -O macport.pkg;
            ;;
    esac

    sudo installer -pkg macport.pkg || return 1;

    rm macport.pkg;

    echo "";
    echoOk "MacPort installed with success!";
}

function macport_update() {
    echo "";
    echo "-------------------" | cyan;
    echo "Updating Macport" | cyan;
    echo "-------------------" | cyan;
    echo "";

    sudo port -v selfupdate;

    echo "";
    echoOk "MacPort updated with success!";
}

function tools_install () {
    echo "";
    echo "------------------------------------------" | cyan;
    echo "Installing / Updating required packages" | cyan;
    echo "------------------------------------------" | cyan;
    echo "";

    sudo port install \
        zmq \
        git-core \
        git-extras \
        git-flow \
    || return 1;

    echo "";
    echoOk "Installed / updated tools successfully";
}

if which port > /dev/null; then
    echo "";
    echoOk "MacPort is already installed!";
else
    macport_install || echoError "Could not install MacPort";
fi

macport_update || echoError "Could not selfupdate MacPort";
tools_install || echoError "Installing required tools and libraries failed";
