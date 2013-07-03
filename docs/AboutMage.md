# About MAGE

## What is MAGE?

The Magical Asynchronous Game Engine (or more commonly known as MAGE) is a Node.js library that is
meant to act as a game development framework. MAGE makes both development and operations simpler.

## Why MAGE?

### Because it's fast

One of the key focal points of MAGE is performance. On the server side this is achieved by using a
modern architecture on top of Node, which uses Google's blazing fast V8 engine. On the HTML5
client side this is achieved through realtime evented data management, tactical asset management,
background downloads and caching, and libraries optimized for speed and responsiveness.

### Because it scales for you

MAGE allows for easy expansion of the amount of servers involved, with little or no change the
architecture of the game system. This is true for both the database servers and the application
servers.

### Because it's easy, and not just for developers

MAGE is not just a technology easing development, it is a complete set of tools made to allow better
integration between different actors within a game development team. Whether you are a developer, a
content manager or a system administrator, MAGE will make your work day much nicer.

## Features

* Manages your realtime connection with the server.
* Support for multiple datastores, and allows you to manage your data storing strategy (sharding, redundancy).
* Manages daemonization of your cluster.
* First-class production logging: built-in support for [Graylog2](http://graylog2.com), [Loggly](http://www.loggly.com) and websocket log streaming.
* First-class monitoring with Panopticon: built-in general statistics, and you can add custom data points with a single line of code.
* ... and much more!
