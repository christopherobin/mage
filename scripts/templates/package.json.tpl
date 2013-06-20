{
  "name": "My MAGE Game",
  "version": "0.0.1",
  "repository": "https://github.com/YourCompanyName/YourProjectName",
  "author": "Wizcorp K.K. <info@wizcorp.jp>",
  "license": "Private",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "start": "node . start",
    "stop": "node . stop",
    "restart": "node . restart",
    "reload": "node . reload"
  },
  "engines": {
    "node": "%MAGE_NODE_VERSION%"
  },
  "dependencies": {
    "mage": "git+ssh://git@github.com:Wizcorp/mage.git#%MAGE_VERSION%"
  }
}