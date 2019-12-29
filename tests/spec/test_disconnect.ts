import { ImplementationFactory, PubSub } from "@pubsub-a/interfaces";
import { expect } from "chai";
import { randomString } from "../test_helper";

export const executeDisconnectTests = (factory: ImplementationFactory) => {

    // __INSTRUMENTATION works for server in debug mode
    const disconnectClient = (pubsub: PubSub, clientId: string, msg: string = "INSTRUMENTATION DISCONNECT") => {
        pubsub.channel("__INSTRUMENTATION").then(channel => {
            channel.publish("DISCONNECT_CLIENT", { clientId, reason: { reason: "REMOTE_DISCONNECT", additionalInfo: msg } });
        })
    };

    let pubsub1: PubSub, pubsub2: PubSub;
    let id1: string, id2: string;

    // PubSubMicro has no disconnect logic
    if (factory.name == "PubSubMicro") {
        console.info("NOT EXECUTING TESTS: PubSubMicro does not support disconnect logic yet");
        return;
    }

    describe(`[${factory.name}] should pass remote-end disconnect event tests [INSTRUMENTATION REQUIRED]`, function () {

        beforeEach(async () => {
            [pubsub1, pubsub2] = factory.getLinkedPubSubImplementation(2);

            await pubsub1.start();
            id1 = pubsub1.clientId;

            await pubsub2.start();
            id2 = pubsub2.clientId;

        });


        // The __internal channel should not be forwarded between pubsub instances; instead it is a communications
        // channel to make use of reserved or implementation dependent features
        it("should not be possible to fake emit on the __internal channel", function (done) {
            const failure = () => done("Failure: Subscription triggered");

            pubsub1.channel("__internal").then(async internalChannel1 => {
                await Promise.all([internalChannel1.subscribe("CLIENT_DISCONNECT", failure)])
                const internalChannel2 = await pubsub2.channel("__internal");
                expect(() => internalChannel2.publish("CLIENT_DISCONNECT", id2)).to.throw();
                done();
            })
        });

        it("should be able to subscribe to a disconnect event from other clients", function (done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal").then(async internalChannel => {
                await internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => {
                    expect(clientUuid).to.equal(id2);
                    done();
                })
                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2)
                disconnectClient(pubsub1, id2);
            });
        });

        it("should not trigger a disconnect event when we unsubscribed from it", function (done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal").then(async internalChannel => {
                await internalChannel.subscribe("CLIENT_DISCONNECT", () => {
                    done("Error: Disconnect event called");
                });
                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2)
                await internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2)
                disconnectClient(pubsub1, id2);
                setTimeout(() => done(), 100)
            });
        });

        it("should be able to subscribe multiple times to a disconnected client but triggers only a single subscribe", function (done) {
            // client1 wants to be notified if client2 disconnects
            let numCalled = 0;
            pubsub1.channel("__internal").then(async internalChannel => {
                const subscribeToAllDisconnects = () => {
                    return internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => {
                        expect(clientUuid).to.equal(id2);
                        ++numCalled;
                    });
                }
                const subscribeToClient2Disconnect = () => {
                    return internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);
                }
                await Promise.all([
                    subscribeToAllDisconnects(),
                    subscribeToClient2Disconnect(),
                    subscribeToClient2Disconnect()
                ])
                disconnectClient(pubsub1, id2);
                setTimeout(() => {
                    expect(numCalled).to.equal(1);
                    done();
                }, 100)
            });
        });

        it("should call the InternalChannelMessage callback even when we are already subscribed", function (done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal").then(async internalChannel => {
                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2)
                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2)
                done();
            });
        });

        it("should not trigger subscribe_disconnect events for ids we never subscribed", function (done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal").then(async internalChannel => {
                await internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => {
                    done("Error: shouldnt receive a disconnect event");
                })
                disconnectClient(pubsub1, id2);
                setTimeout(done, 100);
            });
        });

        it("should only unsubscribe from disconnect events when unsubscribe_disconnect is called exactly the same number of times as subscribe_disconnect", done => {
            pubsub1.channel("__internal").then(async internalChannel => {
                await internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => {
                    done("Error: shouldnt receive a disconnect event");
                })
                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);

                await internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2);
                disconnectClient(pubsub1, id2);
                setTimeout(() => done(), 250);
            });
        });

        it("should not unsubscribe from disconnect events when unsubscribe_disconnect is called less often than subscribe_disconnect", done => {
            pubsub1.channel("__internal").then(async internalChannel => {
                await internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => {
                    expect(clientUuid).to.equal(id2);
                    done();
                })
                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);

                await internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2);
                disconnectClient(pubsub1, id2);
            });
        });

        it("should not unsubscribe from disconnect events when unsubscribe_disconnect is called less often than subscribe_disconnect with intertwined calls", done => {
            pubsub1.channel("__internal").then(async internalChannel => {
                await internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => {
                    expect(clientUuid).to.equal(id2);
                    done();
                })
                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2);

                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);

                await internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2);

                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2);

                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);
                disconnectClient(pubsub1, id2);
            });
        });

        it("should error when unsubscribe_disconnect is called more often than subscribe_disconnect", done => {
            pubsub1.channel("__internal").then(async internalChannel => {

                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2);

                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);

                await internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2);

                await internalChannel.publish("SUBSCRIBE_DISCONNECT", id2);
                await internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2);

                expect(() => {
                    internalChannel.publish("UNSUBSCRIBE_DISCONNECT", id2);
                }).to.throw();
                done();
            });
        });


        // TODO this is more of a start/stop test, move it there
        // don't forget to supply --debug to the pubsub-a-server to enable instrumentation!
        it("should report correct error code when the remote end disconnects", (done) => {
            pubsub2.onStop.then(status => {
                expect(status.reason).to.equal("REMOTE_DISCONNECT");
                done();
            })
            disconnectClient(pubsub1, id2);
        })

        it("should be possible to extract the disconnect reason", done => {
            const disconnectReason = randomString(32);
            pubsub2.onStop.then(status => {
                expect(status.additionalInfo).to.equal(disconnectReason);
                done();
            }).catch((err) => {
                done(err);
            })
            disconnectClient(pubsub1, id2, disconnectReason);
        })

    });
}