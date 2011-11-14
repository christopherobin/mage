# Changelog

## v0.2.0

Version 0.2.0 adds some long awaited features.

- Multi-server support (with zeroconf auto-discovery).
- Multi-node support (using LearnBoost's cluster library, in the future we'll switch to NodeJS 0.6's cluster).
- A new messaging system between users and servers (based on zeroconf).
- A new browser to server communication system (no more Socket.IO).
- Improved per-user-command hook system (will allow for unauthorized user commands).
- Improved build system that now allows for $tags(even.in.embedded.files).
- Integration with Memcached/Membase. Currently applied only to session management.
- Improved error handling and IO events.

Some smaller new changes:

- Colorized logging.
- Wizcorp's open sourced LocalCache library.
- Games can be started from any directory, the cwd is automatically adjusted.
- Fix: the logger did not write to file.
- Ability to retry a user command. Responses are cached on the server, so a retry will correctly yield the previous response.
- Custom server-side modules can be referred to with a relative path (eg: "./modules/quest").

BC incompatibility:

- The current working directory is now the path of the first JS-file, so the reference to the config file will most likely have to be adjusted.
- Command centers (multi) are now created per package.
- Client: mithril options now can contain an IO timeout value and defaultHooks.
- Client: the Giraffe module has been refactored.

