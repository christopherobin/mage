#!/usr/bin/env bash

OSX_VERSION="$(sw_vers | grep ProductVersion | cut -b 17-20)";

if ! which xcodebuild > /dev/null; then
    echo "";
    echoError "You need to install XCode 4 before we can proceed."
fi

function macports_install() {
    echo "";
    echo "---------------------" | cyan;
    echo "Installing MacPorts" | cyan;
    echo "---------------------" | cyan;
    echo "";

    case ${OSX_VERSION} in
        "10.8")
            curl -s https://distfiles.macports.org/MacPorts/MacPorts-2.1.3-10.8-MountainLion.pkg > macports.pkg;
            ;;
        "10.7")
            curl -s https://distfiles.macports.org/MacPorts/MacPorts-2.1.3-10.7-Lion.pkg > macports.pkg;
            ;;
        "10.6")
            curl -s https://distfiles.macports.org/MacPorts/MacPorts-2.1.3-10.6-SnowLeopard.pkg > macports.pkg;
            ;;
    esac

    sudo installer -pkg macports.pkg || return 1;

    rm macports.pkg;

    echo "";
    echoOk "MacPorts installed with success!";
}

function macports_update() {
    echo "";
    echo "-------------------" | cyan;
    echo "Updating Macports" | cyan;
    echo "-------------------" | cyan;
    echo "";

    sudo port -v selfupdate;

    echo "";
    echoOk "MacPorts updated with success!";
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
    || return 1;

    echo "";
    echoOk "Installed / updated tools successfully";
}

if which port > /dev/null; then
    echo "";
    echoOk "MacPorts is already installed!";
else
    macports_install || echoError "Could not install MacPorts";
fi

macports_update || echoError "Could not selfupdate MacPorts";
tools_install || echoError "Installing required tools and libraries failed";
