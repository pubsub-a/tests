
if (typeof window === "undefined") {
    let c = require("chai");
    var expect = c.expect;
}

const executeDisconnectTests = (factory) => {

    let pubsub1, pubsub2;
    let channel1, channel2;
    let id1, id2;

    describe(`[${factory.name}] should pass disconnect event tests`, function() {
        // PubSubMicro has no disconnect logic
        if (factory.name == "PubSubMicro") {
            return;
        }

        beforeEach(() => {
            [ pubsub1, pubsub2 ] = factory.getLinkedPubSubImplementation(2);

            const channel_name = "channel";

            const channel1_ready = pubsub1.start(pubsub => {
                id1 = pubsub1.clientId;
                return pubsub1.channel(channel_name).then((chan) => {
                    channel1 = chan;
                });
            });

            const channel2_ready  = pubsub2.start(pubsub => {
                id2 = pubsub2.clientId;
                return pubsub2.channel(channel_name).then((chan) => {
                    channel2 = chan;
                });
            });

            return Promise.all([channel1_ready, channel2_ready]);
        });

        it("should be able to subscribe to a disconnect event from other clients", function(done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal", (internalChannel) => {
                internalChannel.subscribe("client_disconnected", (clientUuid) => {
                    expect(clientUuid).to.equal(id2);
                    done();
                }).then(() => {
                    const internalMessage = { payload: id2, callback: () => {
                        pubsub2.stop();
                    } };
                    internalChannel.publish("subscribe_disconnect", internalMessage);
                })
            });
        });

        it("should not trigger a disconnect event when we unsubscribed from it", function(done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal", (internalChannel) => {
                internalChannel.subscribe("client_disconnected", (clientUuid) => {
                    done("Error: got disconnect event even though we unsubscribed");
                }).then(() => {
                    // we can't dispose the token as this will locally unsubscribe so we trigger
                    // the unsubscription command manually
                    const afterSubscribeDisconnect = () => {
                        const msg = { payload: id2, callback: () => {
                            pubsub2.stop();
                            setTimeout(done, 1000);
                        }};
                        internalChannel.publish("unsubscribe_disconnect", msg);
                    }
                    const internalMessage = { payload: id2, callback: afterSubscribeDisconnect };
                    internalChannel.publish("subscribe_disconnect", internalMessage);
                });
            });
        });

        it("should be able to subscribe multiple times to a disconnect event", function(done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal", (internalChannel) => {
                internalChannel.subscribe("client_disconnected", (clientUuid) => void 0)
                .then(() => {
                    internalChannel.subscribe("client_disconnected", (clientUuid) => {
                        expect(clientUuid).to.equal(id2);
                        done();
                    }).then(() => {
                        const internalMessage = { payload: id2, callback: () => {
                            pubsub2.stop();
                        }};
                        internalChannel.publish("subscribe_disconnect", internalMessage);
                    });
                });
            });
        });

        it("should call the InternalChannelMessage callback even when we are already subscribed", function(done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal", (internalChannel) => {
                internalChannel.subscribe("client_disconnected", (clientUuid) => {
                    expect(clientUuid).to.equal(id2);
                    done();
                }).then(() => {
                    const internalMessage = { payload: id2, callback: () => {
                        const internalMessage2 = { payload: id2, callback: () => {
                            done();
                        }};
                        internalChannel.publish("subscribe_disconnect", internalMessage2);
                    }};
                    internalChannel.publish("subscribe_disconnect", internalMessage);
                });
            });
        });

        it("should not trigger subscribe_disconnect events for ids we never subscribed", function(done) {
            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal", (internalChannel) => {
                internalChannel.subscribe("client_disconnected", (clientUuid) => {
                    done("Error: shouldnt receive a disconnect event");
                }).then(() => {
                    // id1 because its a valid id, but didn't subscribe to it!
                    const internalMessage = { payload: id1, callback: () => {
                        pubsub2.stop();
                        setTimeout(done, 1000);
                    }}
                    internalChannel.publish("subscribe_disconnect", internalMessage);
                });
            });
        });

        it("should only unsubribe from disconnect events when unsubscribe_disconnect is called exactly the same time as subscribe_disconnect", done => {
            pubsub1.channel("__internal", (internalChannel) => {
                internalChannel.subscribe("client_disconnected", (clientUuid) => {
                    done("Error: shouldnt receive a disconnect event");
                }).then(() => {
                    const msg = { payload: id2 };
                    internalChannel.publish("subscribe_disconnect", msg);
                    internalChannel.publish("subscribe_disconnect", msg);
                    internalChannel.publish("subscribe_disconnect", msg);
                    internalChannel.publish("subscribe_disconnect", msg);

                    setTimeout(() => {
                        const msg2 = { payload: id2, callback: () => {
                            pubsub2.stop();
                            setTimeout(done, 1000);
                        }};
                        internalChannel.publish("unsubscribe_disconnect", { payload: id2 });
                        internalChannel.publish("unsubscribe_disconnect", { payload: id2 });
                        internalChannel.publish("unsubscribe_disconnect", { payload: id2 });
                        internalChannel.publish("unsubscribe_disconnect", msg2);
                    }, 1000);
                });
            });
        });

        it("should not unsubscribe from disconnect events when unsubscribe_disconnect is called less often than subscribe_disconnect", done => {
            pubsub1.channel("__internal", (internalChannel) => {
                internalChannel.subscribe("client_disconnected", (clientUuid) => {
                    done();
                }).then(() => {
                    const msg = { payload: id2 };
                    internalChannel.publish("subscribe_disconnect", msg);
                    internalChannel.publish("subscribe_disconnect", msg);
                    internalChannel.publish("subscribe_disconnect", msg);
                    internalChannel.publish("subscribe_disconnect", msg);

                    const msg2 = { payload: id2, callback: () => {
                        pubsub2.stop();
                    }};
                    setTimeout(() => {
                        internalChannel.publish("unsubscribe_disconnect", { payload: id2 });
                        internalChannel.publish("unsubscribe_disconnect", { payload: id2 });
                        internalChannel.publish("unsubscribe_disconnect", msg2);
                    }, 1000);
                });
            });
        });

        it("should not call the callback if unsubscribe_disconnect is called when there are no pending subscriptions to subscribe_disconnect", done => {
            pubsub1.channel("__internal", (internalChannel) => {
                try {
                    const msg = { payload: id2, callback: () => {
                        done("Error: callback should not be called as there are no subscribe_disconnect subscriptions");
                    }}
                    internalChannel.publish("unsubscribe_disconnect", msg);
                    setTimeout(done, 1000);
                } catch (err) {
                    done(err);
                }
            });
        });
    });
}

if (typeof window === "undefined") {
    module.exports = {
        executeDisconnectTests: executeDisconnectTests
    };
}
