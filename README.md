README
=======

This is the reference test suite for the PubSub/A interface spec.

This project includes a number of unit/integration tests (using Mocha/Chai and Karma) that can be used to verify
compatibility with the Promise/A interface spec. To add you implementation, add a reference to the `karma.conf.js` file
and register a factory that returns your PubSubImplemenation and start Karma. For node.js tests, see the
`tests/test.ts` file for how to extend the test suite with your implementation.


Licensing
---------

This project test code is proprietary, all rights reserved.
