Requirements
============

Here below, you will find the different requirements for using MAGE. If you have cURL installed on your environment, you can use the following to set up your machine

```bash
curl http://www.wizcorp.jp/mage/environment.sh | sh
```

### General

* git
* Node.js 0.8.x or higher. We recommend using nvm to manage your Node.js versions and environments.

### OSX (10.6 and up)

* XCode
* zeromq
* git (git-core on MacPort)

### CentOS (5 and up)

Install the official ZeroMQ repository.

```bash
sudo curl -s "http://download.opensuse.org/repositories/home:/fengshuo:/zeromq/CentOS_CentOS-${CENTOS_VERSION}/home:fengshuo:zeromq.repo" > /etc/yum.repos.d/zeromq.repo
```

* git-all
* avahi
* avahi-tools
* avahi-compat-libdns_sd
* avahi-compat-libdns_sd-devel
* zeromq (an external repository is required)
* zeromq-devel (an external repository is required)

### Ubuntu (12.04 and up)

* git-all
* build-essential
* avahi-utils
* avahi-daemon
* libavahi-compat-libdnssd1
* libavahi-compat-libdnssd-dev
* libavahi-common-data
* libavahi-common3
* libavahi-core7
* libdbus-1-3
* libzmq1
* libzmq-dev

### Debian (6 only)

Add this to your /etc/apt/sources.list:

```
deb http://backports.debian.org/debian-backports squeeze-backports main"
```

Then ```apt-get update```.

* git-all
* build-essential
* avahi-utils
* avahi-daemon
* libavahi-compat-libdnssd1
* libavahi-compat-libdnssd-dev
* libavahi-common-data
* libavahi-common3
* libavahi-core7
* libdbus-1-3
* libnss-mdns
* libzmq
* libzmq-dev

### Windows

Windows is not currently supported.
