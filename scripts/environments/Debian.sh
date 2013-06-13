#!/usr/bin/env bash

#
# 5 or 6
#
DEBIAN_VERSION="$(lsb_release -r | cut -b10)";

if test ${DEBIAN_VERSION} -ne 6; then
    echoError "Only Debian 6 is currently supported";
fi

function repo_install () {
    echo "";
    echo "------------------------------------------" | cyan;
    echo "Installing / Updating required packages" | cyan;
    echo "------------------------------------------" | cyan;
    echo "";

    sudo echo "deb http://backports.debian.org/debian-backports squeeze-backports main" >> /etc/apt/sources.list || return 1;
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
        libnss-mdns \
        libzmq \
        libzmq-dev \
    || return 1;

    echoOk "Package install completed sucessfully";
}

repo_install || echoError "Could not install required remote repository";
tools_install || echoError "Installing required tools and libraries failed";
