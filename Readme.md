MAGE
====

<img src="./lib/modules/dashboard/dashboard/assets/img/default/mage_logo_black_font.png" alt="MAGE logo" width="250" height="250" />

- [Current release](#current-release)
- [Install](#install)
    - [Basic installation](#basic-installation)
    - [On AerisCloud](#on-aeriscloud)
- [See Also](#see-also)

MAGE is a [Node.js](http://nodejs.org/) based server-side engine which can be used to create highly interactive
web applications. It also offers tools and libraries to deal with message passing at scale,
datastore interactions.

MAGE also comes out of the box with a CMS and back-office management creation tool which
will allow developers to quickly create highly customized management systems.

Current release
---------------

See the [release history](./History.md).

Install
--------------

**Note**: There are more installation options currently available: here
we only list the normal bootstrap process. For more details, please refer
to the [documentation on the install process](./docs/Install.md)

### Basic installation

```bash
export NODE_ENV=development
mkdir -p newProject/node_modules
cd newProject
BOOTSTRAP=true npm install "git+ssh://git@github.com:Wizcorp/mage#master"
```

Then follow the indications on screen as they appear.

### On AerisCloud

Before bootstrapping a new project on AerisCloud, make sure to:

1. [Install AerisCloud](https://github.com/Wizcorp/AerisCloud#installation)
2. Read the [AerisCloud's walkthrough](https://github.com/Wizcorp/AerisCloud/blob/develop/docs/walkthrough/bootstrap.md)

```bash
mkdir -p newProject/node_modules
cd newProject
git init
aeriscloud init
#
# Update your .aeriscloud.yml
#
aeriscloud vagrant up newProject-myEnv
aeriscloud vagrant ssh newProject-myEnv
#
# Once you are connected on SSH
#
cd newProject
BOOTSTRAP=true npm install "git+ssh://git@github.com:Wizcorp/mage#master"
```

Then follow the indications on screen as they appear.

See Also
---------

* [Documentation](./docs/Readme.md)
* [About MAGE (in Japanese)](http://www.spiralsense.jp/products/m-a-g-e/)
* [AerisCloud, a vagrant-based development environment configuration tool](https://github.com/Wizcorp/AerisCloud)
* [component, a client package management commonly used in MAGE projects](https://github.com/component/component)
* [Node.js Documentation](http://nodejs.org/api/)
