# Integration test suite

This folder represents an application that is aimed specifically at running integration tests
against the MAGE codebase.

## Running tests

You can run either `node .` to host the integration suite and have browsers connect to the web-app.
Alternatively, run `node . autorun` to run the full test suite (including server tests) and report
the results.

## Structure

### /config

This is where the minimal configuration required to run these tests can be found.

### /lib

A working application that does nothing more than serve user command requests that execute common
logic that can be found in various projects, in order to prove that these operations work (or fail
as expected). MAGE built-in modules are also enabled for the same reason.

### /test

The test framework *and* all the actual tests themselves.

### /www/test

The web app that runs and reports about all browser tests through Mocha.
