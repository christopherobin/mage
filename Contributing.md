# Contributing

We develop MAGE to make your life easier, and there are many ways you can help us achieve that. Here
are just some of the ways:

* Communicate!
* Send in bug reports or feature requests (GitHub [issues](https://github.com/Wizcorp/mage/issues))
* Contribute code (our favorite!)

## Communicate!

It's MAGE's sole purpose to help you save time in development and production. When MAGE fails in
this task, it is your job to take the problem to the MAGE team. Let us know what is hurting your
development and operational experience. We can fix these things together! All we need from you is
that you don't accept your fate when things are unclear, wrong or broken, and speak out! Eternal
fame and appreciation await you!

There is a "MAGE" room for Wizcorp members on HipChat. See you there!

## Reporting bugs

When you write up a bug report, please provide as much log as you can to clarify the conditions
under which your issue occurs. Explain clearly what actions should be taken to replicate the
problem. The best bug report is in the form of a unit test that shows the bug in action.

## Contributing code and documentation

There are a few things you should know when you want to contribute code to either fix a bug or
provide a feature.

### Getting started

Once you've made a fork of MAGE and cloned it to your local system, please run:

```sh
make deps
make dev
```

The first instruction "deps" will install all NPM and Component dependencies for MAGE to be able to
work and run its tests. When you run "make dev" you set up some critical git pre-commit hooks that
will enforce basic code safety rules, code style and run unit tests.

### Code style

We have a code style that is 100% enforced. Pull requests are not accepted if the code styles rules
are broken. We follow the
[Wizcorp code style guide](https://github.com/Wizcorp/javascript-styleguide/blob/master/README.md),
for the sake of consistency and readability. Please adhere to these, it saves everyone involved a
lot of time. Luckily, if you get it wrong, your pre-commit tests will point it out to you. You can
also run `make test` at any time to test your code.

### Documentation

Please write JSDoc annotation for any public API you implement or change. That means at least
describing the purpose of functions and clarifying types of arguments that they accept. Also write
up some documentation in Markdown format (generally Readme.md in the folder where your code sits) to
explain to end-users what it's all about.

### Unit tests

When you provide code, please also provide unit tests to prove that your code works. When you
provide tests, you save others time and make a much more convincing case that your contribution has
positive value. All tests can be found under `/test/server` (for pure Node.js tests) and
`/test/browser` (for tests that are run by Phantom.js).
