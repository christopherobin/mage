#!/usr/bin/env bash

#
# 12 and up
#
UBUNTU_VERSION="$(lsb_release -r | cut -b10)";

if test ${UBUNTU_VERSION} -lt 12; then
    echoError "Only Ubuntu 12 and up is currently supported";
fi

function repo_install () {
    echo "";
    echo "------------------------------------------" | cyan;
    echo "Installing / Updating required packages" | cyan;
    echo "------------------------------------------" | cyan;
    echo "";

    sudo echo "deb http://backports.UBUNTU.org/UBUNTU-backports squeeze-backports main" >> /etc/apt/sources.list || return 1;
    sudo apt-get update;

    echoOk "Remote repository install completed";
}

function tools_install () {
    echo "";
    echo "------------------------------------------" | cyan;
    echo "Installing / Updating required packages" | cyan;
    echo "------------------------------------------" | cyan;
    echo "";

    sudo apt-get -y install \
        git-all \
        build-essential \
        avahi-utils \
        avahi-daemon \
        libavahi-compat-libdnssd1 \
        libavahi-compat-libdnssd-dev \
        libavahi-common-data \
        libavahi-common3 \
        libavahi-core7 \
        libdbus-1-3 \
        libzmq1 \
        libzmq-dev \
    || return 1;

    echoOk "Package install completed sucessfully";
}

repo_install || echoError "Could not installed required remote repository";
tools_install || echoError "Installing required tools and libraries failed";
