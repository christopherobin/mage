# CLI

This module uses [Commander](https://github.com/visionmedia/commander.js) to
manage the command-line interface of MAGE.

## API

### cli.run()

Parse the process arguments obtained via `process.argv`.

### cli.program

Commander object which allows you to extend the provided CLI.

*Example*:

```javascript
var cli = require('mage').cli;
cli.program.option('--clown', 'Enables clown mode');
cli.run();
```

With the previous code, you should obtain the following:

```
$ ./game --verbose --help

  Usage: game [options] [command]
...
  Options:
...
    --clown                Enables clown mode
```
