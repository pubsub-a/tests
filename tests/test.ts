import { ImplementationFactory } from "@dynalon/pubsub-a-interfaces";
import { executeChannelTests } from "./spec/test_channels";
import { executeCommonBasicPubSubTests } from "./spec/test_common_basic_pubsub";
import { executeDisconnectTests } from "./spec/test_disconnect";
import { executeDisposeAndCleanupTests } from "./spec/test_dispose_and_cleanup";
import { executeHighLoadTests } from "./spec/test_highload";
import { executeHighloadSocketTests } from "./spec/test_highload_sockets";
import { executeLinkedPubSubTests } from "./spec/test_linked_pubsub";
import { executeStartStopTests } from "./spec/test_start_stop";
import { executeValidationTests } from "./spec/test_validation";
import { executeSocketIOTests } from "./spec/test_socketio";

const factories: Array<ImplementationFactory> = [];

try {
    // pubsub-micro
    const factory = require("@dynalon/pubsub-a-micro/dist/spec-validation");
    factories.push(factory);
} catch (err) {
    console.log('Could not load pubsub-micro tests: ' + err);
}

try {
    // pubsub-server-a-node
    const factory = require("@dynalon/pubsub-a-server-node/dist/spec-validation");
    factories.push(factory);
} catch (err) {
    console.log('Could not load pubsub-server-node tests: ' + err);
}

function runTests() {

    factories.forEach(function (factory) {

        /* TODO: this doesn't work anymore, the polyfill is not applied?
        require("es6-promise").polyfill();
        const getRandomInt = (min: number, max: number) => {
            min = Math.ceil(min);
            max = Math.floor(max);
            return Math.floor(Math.random() * (max - min)) + min;
        }

        const delayScheduler = (fn) => {
            let delay = getRandomInt(500, 900);
            setTimeout(fn, delay);
        };
        (Promise as any)._setScheduler(delayScheduler);
        */

        executeChannelTests(factory);
        executeCommonBasicPubSubTests(factory);
        executeStartStopTests(factory);
        executeValidationTests(factory);
        executeLinkedPubSubTests(factory);
        executeDisposeAndCleanupTests(factory);
        executeDisconnectTests(factory);

        executeSocketIOTests(factory);

        const runningInCIEnvironment = typeof process.env['CI'] !== 'undefined';
        if (!runningInCIEnvironment) {
            executeHighLoadTests(factory);

            const runningInBrowser = typeof window !== 'undefined';
            if (!runningInBrowser) {
                executeHighloadSocketTests(factory);
            } else {
                console.info("Skipping high load sockets tests as I am running inside a browser")
            }
        } else {
            console.info("Skipping high load tests as I am running in a CI environment")
        }
    });
}

runTests();