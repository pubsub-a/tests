import { ImplementationFactory, PubSub } from "@pubsub-a/interfaces";
import { expect } from "chai";

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

        it("should trigger the promise catch when the control message is unknown for CONTROL_SUBSCRIBE", done => {
            pubsub.channel("__control").then(controlChannel => {
                controlChannel
                    .publish("CONTROL_SUBSCRIBE", {
                        type: "INVALID"
                    } as any)
                    .catch(err => {
                        expect(err.indexOf("invalid")).to.be.greaterThan(-1);
                        expect(err.indexOf("CONTROL_SUBSCRIBE")).to.be.greaterThan(-1);
                        done();
                    });
            });
        });

        it("should trigger the promise catch when the control message is unknown for CONTROL_UNSUBSCRIBE", done => {
            pubsub.channel("__control").then(controlChannel => {
                controlChannel
                    .publish("CONTROL_UNSUBSCRIBE", {
                        type: "INVALID"
                    } as any)
                    .catch(err => {
                        expect(err.indexOf("invalid")).to.be.greaterThan(-1);
                        expect(err.indexOf("CONTROL_UNSUBSCRIBE")).to.be.greaterThan(-1);
                        done();
                    });
            });
        });

        it("should trigger the promise catch when the control message to SUBSCRIBE_DISCONNECT is malformed", done => {
            pubsub.channel("__control").then(controlChannel => {
                controlChannel
                    .publish("CONTROL_SUBSCRIBE", {
                        type: "SUBSCRIBE_DISCONNECT"
                        // clientId is missing => malformed
                    } as any)
                    .catch(err => {
                        console.info(err);
                        expect(err.indexOf("empty")).to.be.greaterThan(0);
                        expect(err.indexOf("clientUuid")).to.be.greaterThan(0);
                        done();
                    });
            });
        });

        it.skip("should trigger the promise catch when the control message to UNSUBSCRIBE_DISCONNECT is malformed", done => {
            pubsub.channel("__control").then(controlChannel => {
                controlChannel
                    .publish("CONTROL_UNSUBSCRIBE", {
                        type: "UNSUBSCRIBE_DISCONNECT"
                        // clientId is missing => malformed
                    } as any)
                    .catch(err => {
                        console.info(err);
                        expect(err.indexOf("empty")).to.be.greaterThan(0);
                        expect(err.indexOf("clientUuid")).to.be.greaterThan(0);
                        done();
                    });
            });
        });
    });
};
