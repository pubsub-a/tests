import { expect } from "chai";
import { Observable } from "rxjs";

import {
    ImplementationFactory, InternalChannelTopic, PubSub, Channel
} from "@dynalon/pubsub-a-interfaces";

import { randomString, randomValidChannelOrTopicName } from "../test_helper";

export const executeDisconnectTests = (factory: ImplementationFactory) => {

    let pubsub1: PubSub, pubsub2: PubSub;
    let channel1: Channel, channel2: Channel;
    let id1: string, id2: string;

    describe(`[${factory.name}] should pass remote-end disconnect event tests`, function () {
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

        it("should be able to subscribe to a disconnect event from other clients", function (done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal").then(internalChannel => {
                internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => {
                    expect(clientUuid).to.equal(id2);
                    done();
                }).then(() => {
                    const internalMessage = {
                        payload: id2, callback: () => {
                            pubsub2.stop({ reason: "LOCAL_DISCONNECT" });
                        }
                    };
                    internalChannel.publish("SUBSCRIBE_DISCONNECT", internalMessage);
                })
            });
        });

        it("should not trigger a disconnect event when we unsubscribed from it", function (done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal").then(internalChannel => {
                internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => {
                    done("Error: got disconnect event even though we unsubscribed");
                }).then(() => {
                    // we can't dispose the token as this will locally unsubscribe so we trigger
                    // the unsubscription command manually
                    const afterSubscribeDisconnect = () => {
                        const msg = {
                            payload: id2, callback: () => {
                                pubsub2.stop({ reason: "LOCAL_DISCONNECT" });
                                setTimeout(done, 1000);
                            }
                        };
                        internalChannel.publish("UNSUBSCRIBE_DISCONNECT", msg);
                    }
                    const internalMessage = { payload: id2, callback: afterSubscribeDisconnect };
                    internalChannel.publish("SUBSCRIBE_DISCONNECT", internalMessage);
                });
            });
        });

        it("should be able to subscribe multiple times to a disconnect event", function (done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal").then(internalChannel => {
                internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => void 0)
                    .then(() => {
                        internalChannel.subscribe("CLIENT_DISCONNECT", (clientUuid) => {
                            expect(clientUuid).to.equal(id2);
                            done();
                        }).then(() => {
                            const internalMessage = {
                                payload: id2, callback: () => {
                                    pubsub2.stop({ reason: "LOCAL_DISCONNECT" });
                                }
                            };
                            internalChannel.publish("SUBSCRIBE_DISCONNECT", internalMessage);
                        });
                    });
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
                    // id1 because its a valid id, but didn't subscribe to it!
                    const internalMessage = {
                        payload: id1, callback: () => {
                            pubsub2.stop({ reason: "LOCAL_DISCONNECT" });
                            setTimeout(done, 1000);
                        }
                    }
                    internalChannel.publish("SUBSCRIBE_DISCONNECT", internalMessage);
                });
            });
        });

        it("should only unsubribe from disconnect events when unsubscribe_disconnect is called exactly the same time as subscribe_disconnect", done => {
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
                        const msg2 = {
                            payload: id2, callback: () => {
                                pubsub2.stop({ reason: "LOCAL_DISCONNECT" });
                                setTimeout(done, 500);
                            }
                        };
                        internalChannel.publish("UNSUBSCRIBE_DISCONNECT", { payload: id2 });
                        internalChannel.publish("UNSUBSCRIBE_DISCONNECT", { payload: id2 });
                        internalChannel.publish("UNSUBSCRIBE_DISCONNECT", { payload: id2 });
                        internalChannel.publish("UNSUBSCRIBE_DISCONNECT", msg2);
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

                    const msg2 = {
                        payload: id2, callback: () => {
                            pubsub2.stop({ reason: "LOCAL_DISCONNECT" });
                        }
                    };
                    setTimeout(() => {
                        internalChannel.publish("UNSUBSCRIBE_DISCONNECT", { payload: id2 });
                        internalChannel.publish("UNSUBSCRIBE_DISCONNECT", { payload: id2 });
                        internalChannel.publish("UNSUBSCRIBE_DISCONNECT", msg2);
                    }, 500);
                });
            });
        });

        it("should not call the callback if unsubscribe_disconnect is called when there are no pending subscriptions to subscribe_disconnect", done => {
            pubsub1.channel("__internal").then(internalChannel => {
                try {
                    const msg = {
                        payload: id2, callback: () => {
                            done("Error: callback should not be called as there are no subscribe_disconnect subscriptions");
                        }
                    }
                    internalChannel.publish("UNSUBSCRIBE_DISCONNECT", msg);
                    setTimeout(done, 1000);
                } catch (err) {
                    done(err);
                }
            });
        });

        // TODO this is more of a start/stop test, move it there
        // don't forget to supply --debug to the pubsub-a-server to enable instrumentation!
        it("should report correct error code when the remote end disconnects [INSTRUMENTATION REQUIRED]", (done) => {
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