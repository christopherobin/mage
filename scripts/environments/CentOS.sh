#!/usr/bin/env bash

#
# 5 or 6
#
CENTOS_VERSION="$(lsb_release -r | cut -b10)";

if test ${CENTOS_VERSION} -lt 5; then
    echoError "Your version of CentOS is not supported";
fi

function repo_install () {
    echo "";
    echo "------------------------------------------" | cyan;
    echo "Installing / Updating required packages" | cyan;
    echo "------------------------------------------" | cyan;
    echo "";

    sudo curl -s "http://download.opensuse.org/repositories/home:/fengshuo:/zeromq/CentOS_CentOS-${CENTOS_VERSION}/home:fengshuo:zeromq.repo" > /etc/yum.repos.d/zeromq.repo || return 1;

    echoOk "Remote repository install completed";
}

function tools_install () {
    echo "";
    echo "------------------------------------------" | cyan;
    echo "Installing / Updating required packages" | cyan;
    echo "------------------------------------------" | cyan;
    echo "";

    sudo yum -y groupinstall "Development Tools";
    sudo yum -y install \
        git-all \
        avahi \
        avahi-tools \
        avahi-compat-libdns_sd \
        avahi-compat-libdns_sd-devel \
        zeromq \
        zeromq-devel \
    || return 1;

    echoOk "Package install completed sucessfully";
}

repo_install || echoError "Could not install required remote repository";
tools_install || echoError "Installing required tools and libraries failed";
