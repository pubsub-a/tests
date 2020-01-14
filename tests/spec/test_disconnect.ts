import { ImplementationFactory, PubSub, ClientDisconnect, ControlMessage } from "@pubsub-a/interfaces";
import { expect } from "chai";
import { randomString } from "../test_helper";

export const executeDisconnectTests = (factory: ImplementationFactory) => {
    const disconnectClient = (pubsub: PubSub, clientId: string, msg: string = "TEST DISCONNECT") => {
        pubsub.channel("__control").then(channel => {
            const disconnectMsg = {
                type: "DISCONNECT_CLIENT",
                clientId,
                reason: { reason: "REMOTE_DISCONNECT", additionalInfo: msg }
            };
            (channel as any).publish("CONTROL_COMMAND", disconnectMsg);
        });
    };

    let pubsub1: PubSub, pubsub2: PubSub;
    let id1: string, id2: string;

    // PubSubMicro has no disconnect logic
    if (factory.name == "PubSubMicro") {
        console.info("NOT EXECUTING TESTS: PubSubMicro does not support disconnect logic yet");
        return;
    }

    describe(`[${factory.name}] should pass remote-end disconnect event tests [INSTRUMENTATION REQUIRED]`, function() {
        beforeEach(async () => {
            [pubsub1, pubsub2] = factory.getLinkedPubSubImplementation(2);

            await pubsub1.start();
            id1 = pubsub1.clientId;

            await pubsub2.start();
            id2 = pubsub2.clientId;
        });

        afterEach(async () => {
            if (pubsub1.isStopped !== true) await pubsub1.stop();
            if (pubsub2.isStopped !== true) await pubsub2.stop();
        });

        // The __control channel should not be forwarded between pubsub instances; instead it is a communications
        // channel to make use of reserved or implementation dependent features
        it("should not be possible to fake emit on the __control channel", function(done) {
            const failure = () => done("Failure: Subscription triggered");

            pubsub1.channel("__control").then(async controlChannel => {
                await controlChannel.subscribe("CONTROL", failure);
                const controlChannel2 = await pubsub2.channel("__control");
                expect(() =>
                    controlChannel2.publish(
                        "CONTROL" as any,
                        {
                            clientId: id2,
                            type: "CLIENT_DISCONNECT",
                            reason: "DISCONNECT"
                        } as any
                    )
                ).to.throw();
                done();
            });
        });

        it("should be able to subscribe to a disconnect event from other clients", function(done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__control").then(async controlChannel => {
                await controlChannel.subscribe("CONTROL", (message: ClientDisconnect) => {
                    expect(message.type).to.equal("CLIENT_DISCONNECT");
                    expect(message.clientId).to.equal(id2);
                    done();
                });
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                disconnectClient(pubsub1, id2);
            });
        });

        it("should not trigger a disconnect event when we unsubscribed from it", function(done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__control").then(async controlChannel => {
                await controlChannel.subscribe("CONTROL", () => {
                    done("Error: Disconnect event called");
                });
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });
                disconnectClient(pubsub1, id2);
                setTimeout(() => done(), 100);
            });
        });

        it("should be able to subscribe multiple times to a disconnected client but triggers only a single subscribe", function(done) {
            // client1 wants to be notified if client2 disconnects
            let numCalled = 0;
            pubsub1.channel("__control").then(async controlChannel => {
                const subscribeToAllDisconnects = () => {
                    return controlChannel.subscribe("CONTROL", (message: ClientDisconnect) => {
                        expect(message.type).to.equal("CLIENT_DISCONNECT");
                        expect(message.clientId).to.equal(id2);
                        ++numCalled;
                    });
                };
                const subscribeToClient2Disconnect = () => {
                    return controlChannel.publish("CONTROL_SUBSCRIBE", {
                        type: "SUBSCRIBE_DISCONNECT",
                        clientId: id2
                    });
                };
                await Promise.all([
                    subscribeToAllDisconnects(),
                    subscribeToClient2Disconnect(),
                    subscribeToClient2Disconnect()
                ]);
                disconnectClient(pubsub1, id2);
                setTimeout(() => {
                    expect(numCalled).to.equal(1);
                    done();
                }, 100);
            });
        });

        it("should call the InternalChannelMessage callback even when we are already subscribed", function(done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__control").then(async controlChannel => {
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                done();
            });
        });

        it("should not trigger subscribe_disconnect events for ids we never subscribed", function(done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__control").then(async controlChannel => {
                await controlChannel.subscribe("CONTROL", () => {
                    done("Error: shouldnt receive a disconnect event");
                });
                disconnectClient(pubsub1, id2);
                setTimeout(done, 100);
            });
        });

        it("should not send a disconnect event when subscribing to it after the instance has stopped", function(done) {
            pubsub2.stop().then(async function() {
                const internalChannel = await pubsub1.channel("__control");
                await internalChannel.subscribe("CONTROL", (message: ClientDisconnect) => {
                    expect.fail("Should not receive the CLIENT_DISCONNECT message");
                });
                setTimeout(done, 100);
            });
        });

        it("should send a NOT_CONNECTED when we subscribe to a disconnect id of a client that is not currently connected", function(done) {
            pubsub2.stop().then(async function() {
                const controlChannel = await pubsub1.channel("__control");
                await controlChannel.subscribe("CONTROL", (message: ClientDisconnect) => {
                    expect(message.type).to.equal("CLIENT_DISCONNECT");
                    expect(message.reason).to.equal("NOT_CONNECTED");
                    expect(message.clientId).to.equal(id2);
                    done();
                });
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
            });
        });

        it("should only unsubscribe from disconnect events when unsubscribe_disconnect is called exactly the same number of times as subscribe_disconnect", done => {
            pubsub1.channel("__control").then(async controlChannel => {
                await controlChannel.subscribe("CONTROL", message => {
                    done("Error: shouldnt receive a disconnect event");
                });
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });

                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });
                disconnectClient(pubsub1, id2);
                setTimeout(() => done(), 250);
            });
        });

        it("should not unsubscribe from disconnect events when unsubscribe_disconnect is called less often than subscribe_disconnect", done => {
            pubsub1.channel("__control").then(async controlChannel => {
                await controlChannel.subscribe("CONTROL", (message: ClientDisconnect) => {
                    if (message.type !== "CLIENT_DISCONNECT") return;
                    expect(message.clientId).to.equal(id2);
                    expect(message.reason).to.equal("DISCONNECT");
                    done();
                });
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });

                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });
                disconnectClient(pubsub1, id2);
            });
        });

        it("should not unsubscribe from disconnect events when unsubscribe_disconnect is called less often than subscribe_disconnect with intertwined calls", done => {
            pubsub1.channel("__control").then(async controlChannel => {
                await controlChannel.subscribe("CONTROL", (message: ControlMessage) => {
                    if (message.type !== "CLIENT_DISCONNECT") return;
                    expect(message.clientId).to.equal(id2);
                    expect(message.reason).to.equal("DISCONNECT");
                    done();
                });
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });

                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });

                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });

                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });

                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });

                disconnectClient(pubsub1, id2);
            });
        });

        it("should error when unsubscribe_disconnect is called more often than subscribe_disconnect", done => {
            pubsub1.channel("__control").then(async controlChannel => {
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });

                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });

                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });

                await controlChannel.publish("CONTROL_SUBSCRIBE", { type: "SUBSCRIBE_DISCONNECT", clientId: id2 });
                await controlChannel.publish("CONTROL_UNSUBSCRIBE", { type: "UNSUBSCRIBE_DISCONNECT", clientId: id2 });

                expect(() => {
                    controlChannel.publish("CONTROL_UNSUBSCRIBE", {
                        type: "UNSUBSCRIBE_DISCONNECT",
                        clientId: id2
                    });
                }).to.throw();
                done();
            });
        });

        // TODO this is more of a start/stop test, move it there
        // don't forget to supply --debug to the pubsub-a-server to enable instrumentation!
        it("should report correct error code when the remote end disconnects", done => {
            pubsub2.onStop.then(status => {
                expect(status.reason).to.equal("REMOTE_DISCONNECT");
                done();
            });
            disconnectClient(pubsub1, id2);
        });

        it("should be possible to extract the disconnect reason", done => {
            const disconnectReason = randomString(32);
            pubsub2.onStop
                .then(status => {
                    expect(status.additionalInfo).to.equal(disconnectReason);
                    done();
                })
                .catch(err => {
                    done(err);
                });
            disconnectClient(pubsub1, id2, disconnectReason);
        });
    });
};
