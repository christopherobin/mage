{
  "name": "templates",
  "version": "0.0.1",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "start": "node . start",
    "stop": "node . stop",
    "restart": "node . restart",
    "reload": "node . reload",
    "db": ""
  },
  "repository": "git@github.com:YourCompanyName/YourProjectName.git",
  "author": "Wizcorp K.K. <info@wizcorp.jp>",
  "license": "Private",
  "engines": {
    "node": "%MAGE_NODE_VERSION%"
  },
  "dependencies": {
    "async": "0.1.22",
    "mage": "git+https://github.com/Wizcorp/mage.git#%MAGE_VERSION%"
  },
  "man": [
    "./README.md"
  ],
  "directories": {
    "doc": "docs"
  }
}
