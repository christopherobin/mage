# Before starting with MAGE

## Understanding MAGE requirements

### Node.js

Node.js is essentially JavaScript for servers, and the MAGE platform has been built on it. There are
some concepts you will most likely benefit from understanding before getting started on a serious
Node project. Here are some resources which might help you make your first steps on Node:

* [Node API Documentation](http://nodejs.org/api/)
* [Felix's Node Style Guide](http://nodeguide.com/style.html)

We recommend using nvm (Node Version Manager) to manage your Node versions and environments.

See also:

[Node website](http://nodejs.org/)
[NPM - Node Package Manager](https://npmjs.org/)
[NVM - Node Version Manager](https://github.com/creationix/nvm)

### Git and GitHub

To install MAGE, you will need to have access to a git client and to [github.com](https://github.com/),
where the MAGE repository is hosted. The [installation guide](./Install.md) will guide you through
the necessary steps to install MAGE. But before you go there, please make sure that:

* You have been given access to the MAGE repository on GitHub.
* You are set up to use [git-over-ssh](https://help.github.com/articles/set-up-git).

See also:

[Git website](http://git-scm.com/)
[GitHub](http://github.com/)

### ZeroMQ (aka ØMQ)

MAGE uses the ZeroMQ library to enable fast messaging between servers and processes. To allow MAGE
to build against it, the ZeroMQ library must be installed beforehand.

See also:

[ZeroMQ website](http://www.zeromq.org/)

### Multicast DNS (aka mDNS, Bonjour, Zero-configuration networking)

MAGE uses mDNS to automatically discover other MAGE instances of the same game on the network. This
easily enables one to create a cluster of servers without much configuration. Building MAGE requires
the necessary libraries to be installed.

## Installing all requirements

If you have cURL installed on your environment, you can run the following to set up your machine.

```bash
curl http://www.wizcorp.jp/mage/environment.sh | sh
```

Alternatively, you can manually install them by following these steps.

### All environments

NVM (Node Version Manager)

```bash
curl https://raw.github.com/creationix/nvm/master/install.sh | sh
```

The latest stable Node version compatible with MAGE.

```bash
nvm install 0.8
nvm use 0.8
```

### OS X (10.6 and up)

Please install:

* XCode (to be able to compile ZeroMQ)
* [zeromq](http://www.zeromq.org/intro:get-the-software)
* [git](http://git-scm.com/downloads) (MacPorts: git-core)

mDNS is enabled by default on OS X.

### CentOS (5 and up)

Please first download the official ZeroMQ repository:

```bash
sudo curl -s "http://download.opensuse.org/repositories/home:/fengshuo:/zeromq/CentOS_CentOS-${CENTOS_VERSION}/home:fengshuo:zeromq.repo" > /etc/yum.repos.d/zeromq.repo
```

Then install:

* git-all
* avahi
* avahi-tools
* avahi-compat-libdns_sd
* avahi-compat-libdns_sd-devel
* zeromq (an external repository is required)
* zeromq-devel (an external repository is required)

### Ubuntu (12.04 and up)

Please install:

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

Please add the following line to `/etc/apt/sources.list`:

```
deb http://backports.debian.org/debian-backports squeeze-backports main
```

Then run `apt-get update` and use `apt-get install` to install the following:

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
