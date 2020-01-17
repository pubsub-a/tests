import { ImplementationFactory } from "@pubsub-a/interfaces";
import { executeChannelTests } from "./spec/test_channels";
import { executeCommonBasicPubSubTests } from "./spec/test_common_basic_pubsub";
import { executeDisconnectTests } from "./spec/test_disconnect";
import { executeDisposeAndCleanupTests } from "./spec/test_dispose_and_cleanup";
import { executeHighLoadTests } from "./spec/test_highload";
import { executeErrorHandlingTests } from "./spec/test_errorhandling";
// import { executeHighloadSocketTests } from "./spec/test_highload_sockets";
import { executeLinkedPubSubTests } from "./spec/test_linked_pubsub";
import { executeStartStopTests } from "./spec/test_start_stop";
import { executeValidationTests } from "./spec/test_validation";
// import { executeSocketIOTests } from "./spec/test_socketio";

const factories: Array<ImplementationFactory> = [];

try {
    // pubsub-micro
    const factory = require("@pubsub-a/micro/dist/spec-validation");
    factories.push(factory);
} catch (err) {
    console.log("Could not load pubsub-micro tests: " + err);
}

try {
    // pubsub-server-a-node
    const factory = require("@dynalon/pubsub-a-server-node/dist/spec-validation");
    factories.push(factory);
} catch (err) {
    console.log("Could not load pubsub-server-node tests: " + err);
}

function runTests() {
    factories.forEach(function(factory) {
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
        executeErrorHandlingTests(factory);

        // executeSocketIOTests(factory);

        const runningInCIEnvironment = typeof process.env["CI"] !== "undefined";
        const runHighloadTests = typeof process.env["HIGHLOAD"] !== "undefined";
        const runningInBrowser = typeof window !== "undefined";

        // highload tests are only run when HIGHLOAD env variable is set and we are NOT a CI system (since the
        // number of sockets and required bandwidth/load would disturb most cloud providers)
        if (runHighloadTests && !runningInCIEnvironment) {
            executeHighLoadTests(factory);

            if (!runningInBrowser) {
                // executeHighloadSocketTests(factory);
            } else {
                console.info("Not running high load sockets tests as I am running inside a browser");
            }
        } else {
            console.info("Not running High load tests");
        }
    });
}

runTests();
