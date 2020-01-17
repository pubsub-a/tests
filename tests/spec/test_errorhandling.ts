import { ImplementationFactory, PubSub } from "@pubsub-a/interfaces";

export const executeErrorHandlingTests = (factory: ImplementationFactory) => {
    let pubsub: PubSub;

    describe(`[${factory.name}] should test error handling`, () => {
        if (factory.name === "PubSubMicro") {
            return;
        }
        beforeEach(done => {
            pubsub = factory.getPubSubImplementation();
            pubsub.start().then(() => done());
        });

        afterEach(done => {
            if (pubsub.isStarted && !pubsub.isStopped) {
                pubsub.stop().then(() => done());
            }
        });

        it("should throw an exception when sending unknown control command", done => {
            const controlChannel = pubsub.channel("__control").then(() => {
                try {
                    (controlChannel as any).publish("CONTROL_COMMAND", {
                        type: "INVALID"
                    } as any);
                } catch {
                    done();
                }
            });
        });

        it.skip("should trigger the promise catch when the control message is malformed", done => {
            pubsub.channel("__control").then(controlChannel => {
                controlChannel
                    .publish("CONTROL_SUBSCRIBE", {
                        type: "SUBSCRIBE_DISCONNECT"
                        // clientId is missing => malformed
                    } as any)
                    .catch(err => {
                        done();
                    });
            });
        });
    });
};
