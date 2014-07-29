# Integration test suite

This folder represents an application that is aimed specifically at running integration tests
against the MAGE codebase.

## Structure

### /config

This is where the minimal configuration required to run these tests can be found.

### /lib

A working application that does nothing more than serve user command requests that execute common
logic that can be found in various projects, in order to prove that these operations work (or fail
as expected). MAGE built-in modules are also enabled for the same reason.

### /test-framework

#### /test-framework/suites

phantom/server
phantom/client/component.json
phantom/client/index.js (use mageConfig custom data to expose the tests)
mocha-serverapi
mocha-childprocess
mocha-browserapi/component.json (required by /www/test)



### /test

The test framework *and* the actual tests themselves.

### /www/test

The web app that runs and reports about all browser tests through Mocha.
