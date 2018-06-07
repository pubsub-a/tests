import { expect } from "chai";
import { Observable, Subscription } from "rxjs";

import {
    ImplementationFactory, InternalChannelTopic, PubSub, Channel, InternalChannel
} from "@dynalon/pubsub-a-interfaces";

import { randomString, randomValidChannelOrTopicName } from "../test_helper";
import { disconnect } from "cluster";

export const executeDisconnectTests = (factory: ImplementationFactory) => {

    // __INSTRUMENTATION works for server in debug mode
    const disconnectClient = (pubsub: PubSub, clientId: string) => {
        pubsub.channel("__INSTRUMENTATION").then(channel => {
            channel.publish("DISCONNECT_CLIENT", { clientId });
        })
    };

    let pubsub1: PubSub, pubsub2: PubSub;
    let channel1: Channel, channel2: Channel;
    let id1: string, id2: string;

    describe(`[${factory.name}] should pass remote-end disconnect event tests [INSTRUMENTATION REQUIRED]`, function () {
        // PubSubMicro has no disconnect logic
        if (factory.name == "PubSubMicro") {
            console.info("NOT EXECUTING TESTS: PubSubMicro does not support disconnect logic yet");
            return;
        }

        beforeEach(() => {
            [pubsub1, pubsub2] = factory.getLinkedPubSubImplementation(2);

            const channel_name = randomValidChannelOrTopicName();

            const channel1_ready = pubsub1.start().then(pubsub => {
                id1 = pubsub1.clientId;
                return pubsub1.channel(channel_name).then((chan) => {
                    channel1 = chan;
                });
            });

            const channel2_ready = pubsub2.start().then(pubsub => {
                id2 = pubsub2.clientId;
                return pubsub2.channel(channel_name).then((chan) => {
                    channel2 = chan;
                });
            });

            return Promise.all([channel1_ready, channel2_ready]);
        });


        // The __internal channel should not be forwarded between pubsub instances; instead it is a communications
        // channel to make use of reserved or implementation dependent features
        it("should not be possible to fake emit on the __internal channel", function (done) {
            const failure = () => done("Failure: Subscription triggered");

            pubsub1.channel("__internal").then(internalChannel1 => {
                Promise.all([
                    internalChannel1.subscribe("CLIENT_DISCONNECT", failure),
                    internalChannel1.subscribe("SUBSCRIBE_DISCONNECT", failure),
                    internalChannel1.subscribe("UNSUBSCRIBE_DISCONNECT", failure),
                    internalChannel1.subscribe("DISCONNECT_REASON", failure),
                ]).then(() => {
                    pubsub2.channel("__internal").then(internalChannel2 => {
                        internalChannel2.publish("CLIENT_DISCONNECT", { payload: pubsub2.clientId })
                        internalChannel2.publish("SUBSCRIBE_DISCONNECT", { payload: pubsub1.clientId })
                        internalChannel2.publish("UNSUBSCRIBE_DISCONNECT", { payload: pubsub1.clientId })
                        internalChannel2.publish("DISCONNECT_REASON", { payload: "Connection too slow" })
                        setTimeout(() => done(), 100)
                    })
                })
            })
        });

        it("should be able to subscribe to a disconnect event from other clients", function (done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal").then(internalChannel => {
                // TODO is the payload format correct?!?
                internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => {
                    expect(clientUuid).to.equal(id2);
                    done();
                }).then(() => {
                    disconnectClient(pubsub1, id2);
                    setTimeout(() => done(), 100);
                })
            });
        });

        it("should not trigger a disconnect event when we unsubscribed from it", function (done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal").then(internalChannel => {
                const onDisconnectComplete = () => {
                    internalChannel.publish("SUBSCRIBE_DISCONNECT", {
                        payload: id2,
                        callback: onSubscribeComplete
                    });
                };
                const onSubscribeComplete = () => {
                    internalChannel.publish("UNSUBSCRIBE_DISCONNECT", {
                        payload: id2,
                        callback: onUnsubscribeComplete
                    })
                };

                const onUnsubscribeComplete = () => {
                    disconnectClient(pubsub1, id2);
                    setTimeout(() => done(), 100)
                }

                internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => {
                    done("Error: got disconnect event even though we unsubscribed");
                }).then(() => {
                    onDisconnectComplete();
                });
            });
        });

        it("should be able to subscribe multiple times to a disconnected client but triggers only a single subscribe", function (done) {
            // client1 wants to be notified if client2 disconnects
            let numCalled = 0;
            pubsub1.channel("__internal").then(internalChannel => {
                const subscribeToAllDisconnects = () => {
                   return internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => {
                       expect(clientUuid).to.equal(id2);
                       ++numCalled;
                   });
                }
                const subscribeToClient2Disconnect = () => {
                    return new Promise((resolve) => {
                        internalChannel.publish("SUBSCRIBE_DISCONNECT", {
                            payload: id2,
                            callback: resolve
                        })
                    })
                }
                Promise.all([
                    subscribeToAllDisconnects(),
                    subscribeToClient2Disconnect(),
                    subscribeToClient2Disconnect()
                ]).then(() => {
                    disconnectClient(pubsub1, id2);
                    setTimeout(() => {
                        expect(numCalled).to.equal(1);
                        done();
                    }, 100)
                })
            });
        });

        it("should call the InternalChannelMessage callback even when we are already subscribed", function (done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal").then(internalChannel => {
                internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => {
                    expect(clientUuid).to.equal(id2);
                    done();
                }).then(() => {
                    const internalMessage = {
                        payload: id2, callback: () => {
                            const internalMessage2 = {
                                payload: id2, callback: () => {
                                    done();
                                }
                            };
                            internalChannel.publish("SUBSCRIBE_DISCONNECT", internalMessage2);
                        }
                    };
                    internalChannel.publish("SUBSCRIBE_DISCONNECT", internalMessage);
                });
            });
        });

        it("should not trigger subscribe_disconnect events for ids we never subscribed", function (done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal").then(internalChannel => {
                internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => {
                    done("Error: shouldnt receive a disconnect event");
                }).then(() => {
                    disconnectClient(pubsub1, id2);
                    setTimeout(done, 100);
                });
            });
        });

        it("should only unsubscribe from disconnect events when unsubscribe_disconnect is called exactly the same time as subscribe_disconnect", done => {
            pubsub1.channel("__internal").then(internalChannel => {
                internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => {
                    done("Error: shouldnt receive a disconnect event");
                }).then(() => {
                    const msg = { payload: id2 };
                    internalChannel.publish("SUBSCRIBE_DISCONNECT", msg);
                    internalChannel.publish("SUBSCRIBE_DISCONNECT", msg);
                    internalChannel.publish("SUBSCRIBE_DISCONNECT", msg);
                    internalChannel.publish("SUBSCRIBE_DISCONNECT", msg);

                    setTimeout(() => {
                        internalChannel.publish("UNSUBSCRIBE_DISCONNECT", { payload: id2 });
                        internalChannel.publish("UNSUBSCRIBE_DISCONNECT", { payload: id2 });
                        internalChannel.publish("UNSUBSCRIBE_DISCONNECT", { payload: id2 });
                        internalChannel.publish("UNSUBSCRIBE_DISCONNECT", { payload: id2 });
                        setTimeout(() => disconnectClient(pubsub1, id2), 250);
                        setTimeout(done, 500);
                    }, 1000);
                });
            });
        });

        it("should not unsubscribe from disconnect events when unsubscribe_disconnect is called less often than subscribe_disconnect", done => {
            pubsub1.channel("__internal").then(internalChannel => {
                internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => {
                    done();
                }).then(() => {
                    const msg = { payload: id2 };
                    internalChannel.publish("SUBSCRIBE_DISCONNECT", msg);
                    internalChannel.publish("SUBSCRIBE_DISCONNECT", msg);
                    internalChannel.publish("SUBSCRIBE_DISCONNECT", msg);
                    internalChannel.publish("SUBSCRIBE_DISCONNECT", msg);

                    setTimeout(() => {
                        internalChannel.publish("UNSUBSCRIBE_DISCONNECT", { payload: id2 });
                        internalChannel.publish("UNSUBSCRIBE_DISCONNECT", { payload: id2 });
                        internalChannel.publish("UNSUBSCRIBE_DISCONNECT", { payload: id2 });
                        setTimeout(() => disconnectClient(pubsub1, id2), 250)
                    }, 500);
                });
            });
        });

        // TODO this is more of a start/stop test, move it there
        // don't forget to supply --debug to the pubsub-a-server to enable instrumentation!
        it("should report correct error code when the remote end disconnects", (done) => {
            pubsub1.channel("__INSTRUMENTATION").then(channel => {
                pubsub2.onStop.then(status => {
                    expect(status.reason).to.equal("REMOTE_DISCONNECT");
                    done();
                })
                channel.publish("DISCONNECT_CLIENT", { clientId: pubsub2.clientId });
            })
        })

    });
}