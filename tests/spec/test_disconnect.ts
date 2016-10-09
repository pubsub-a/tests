
if (typeof window === "undefined") {
    let c = require("chai");
    var expect = c.expect;
    var Promise = require("es6-promise").Promise;
}

const executeDisconnectTests = (factory) => {

    let pubsub1, pubsub2;
    let channel1, channel2;

    describe(`[${factory.name}] should pass disconnect event tests`, () => {

        beforeEach(() => {
            [ pubsub1, pubsub2 ] = factory.getLinkedPubSubImplementation(2);

            const channel_name = "channel";

            const channel1_ready = pubsub1.start(pubsub => {
                return pubsub1.channel(channel_name).then((chan) => {
                    channel1 = chan;
                });
            });

            const channel2_ready  = pubsub2.start(pubsub => {
                return pubsub2.channel(channel_name).then((chan) => {
                    channel2 = chan;
                });
            });

            return Promise.all([channel1_ready, channel2_ready]);
        });

        it("should be able to disconnect and the stop callback gets called", function(done) {
            pubsub1.stop(() => {
                expect(true).to.be.true;
                done();
            });
        });

        it("should be able to subscribe to a disconnect event", function(done) {
            if (factory.name == "PubSubMicro") {
                this.skip();
                return;
            }
            const id1 = pubsub1.pubsub.server.id;
            const id2 = pubsub2.pubsub.server.id;

            // client1 wants to be notified if client2 disconnects
            pubsub1.channel("__internal", (internalChannel) => {
                internalChannel.subscribe("client_disconnected", (clientUuid) => {
                    expect(clientUuid).to.equal(id2);
                    done();
                }).then(() => {
                    internalChannel.publish("subscribe_disconnect", id2).then(() => {
                        pubsub2.stop();
                    })
                })
            });
        });
    });
}

if (typeof window === "undefined") {
    module.exports = {
        executeDisconnectTests: executeDisconnectTests
    };
}
