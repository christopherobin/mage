# MAGE Documentation

## What is MAGE?

The Magical Asynchronous Game Engine (or more commonly known as MAGE) is a Node.js library that is
meant to act as a game development framework. MAGE makes both development and operations simpler.

## Why MAGE?

### Because it's fast

One of the key focal points of MAGE. is performance. On the server side this is achieved
by using a modern architecture on top of Node.js, which uses Google's blazing fast V8 engine.
On the HTML5 client side, this is achieved through tactical file management, background
downloads and caching, and heavily-optimized libraries.

### Because it scales for you

MAGE. allows for easy expansion of the amount of servers involved, with little
or no change the architecture of the game system. This is true for both the
database servers and the application servers.

### Because it's easy - and not just for developers

MAGE is not just a technology easing development: it is a complete set of tools made to
allow better integration between different actors within a game development team. Whether
you are a developer, a content manager or a system administrator, MAGE will make your
work day so much nicer.

## Features

* Manages your connection with the back-end
* Support multiple datastore, and allows you to manage your data storing strategy (sharding, double-writes)
* Manages the daemonization
* First-class production logging: built-in support for Graylog2, Loggly and websocket log streaming.
* First-class monitoring with Panopticon: built-in general statistics, and you can add custom data point with a single line of code.
* ... and much more!

## So, what's next?

We recommend you go through the following sections:

* [Learn about Node.js development](./docs/Nodejs.md)
* [Learn about Git version control](./docs/Git.md)
* [Requirements to run on MAGE](./docs/Requirements.md)
* [Installation of MAGE](./docs/Install.md)
* [Walkthrough: build your first MAGE app](./docs/walkthrough/README.md)
* [How-to guides](./docs/howto/README.md)
* [API documentation](./docs/api/README.md)
