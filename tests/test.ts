/**
@describe Will execute all tests that apply to all PubSub implementations
@param getPubSubImplementation -  A factory function that should return a fresh (untouched) pubsub
  instance of type PubSub. This factory is called in the beforeEach() method before each test is run.
*/
if (typeof window === "undefined") {
    let registerPubSubImplementationFactory = require("./test_harness").registerPubSubImplementationFactory;

    try {
        // pubsub-micro
        var factory = require("../../pubsub-a-micro/tests/spec-validation.js");
        registerPubSubImplementationFactory(factory);
    } catch(err) {
        console.log('Could not load pubsub-micro tests: ' + err);
    }

    try {
        // pubsub-server-a-node
        var factory = require("../../pubsub-a-server-node/tests/spec-validation.js");
        registerPubSubImplementationFactory(factory);
    } catch(err) {
        console.log('Could not load pubsub-server-node tests: ' + err);
    }

} else {
    // instead of require() the test cases, add them in the karma.conf.js file and expose as global variable
}

function runTests() {
    let facs;

    if (typeof window === "undefined") {
        facs = require("./test_harness").factories;
    } else {
        // factories is a global variable in test_harness.js
        facs = factories;
    }

    facs.forEach(function(factory) {

        var executeCommonBasicPubSubTests;
        var executeChannelTests;
        var executeSValidationTests;
        var executeLinkedPubSubTests;
        var executeDisposeAndCleanupTests;
        var executeDisconnectTests;
        var executeStartStopTests;
        var executeHighLoadTests;

        if (typeof window === "undefined") {
            executeCommonBasicPubSubTests = require("./spec/test_common_basic_pubsub").executeCommonBasicPubSubTests;
            executeChannelTests = require("./spec/test_channels").executeChannelTests;
            executeValidationTests = require("./spec/test_validation").executeValidationTests;
            executeLinkedPubSubTests = require("./spec/test_linked_pubsub").executeLinkedPubSubTests;
            executeDisposeAndCleanupTests = require("./spec/test_dispose_and_cleanup").executeDisposeAndCleanupTests;
            executeDisconnectTests = require("./spec/test_disconnect").executeDisconnectTests;
            executeStartStopTests = require("./spec/test_start_stop").executeStartStopTests;
            executeHighLoadTests = require("./spec/test_highload").executeHighLoadTests;
        } else {
            const win = window as any;
            executeCommonBasicPubSubTests = win.executeCommonBasicPubSubTests;
            executeChannelTests = win.executeChannelTests;
            executeValidationTests = win.executeValidationTests;
            executeLinkedPubSubTests = win.executeLinkedPubSubTests;
            executeDisposeAndCleanupTests = win.executeDisposeAndCleanupTests;
            executeDisconnectTests = win.executeDisconnectTests;
            executeStartStopTests = win.executeStartStopTests;
            executeHighLoadTests = win.executeHighLoadTests;
        }

        executeStartStopTests(factory);
        executeCommonBasicPubSubTests(factory);
        executeChannelTests(factory);
        executeValidationTests(factory);
        executeLinkedPubSubTests(factory);
        executeDisposeAndCleanupTests(factory);
        executeDisconnectTests(factory);
        // executeHighLoadTests(factory);
    });
}

runTests();
