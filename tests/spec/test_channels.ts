import { expect } from "chai";
import { Observable, from, zip } from "rxjs";

import { ImplementationFactory } from "@dynalon/pubsub-a-interfaces";
import { PubSub, Channel } from "@dynalon/pubsub-a-interfaces";

import { randomValidChannelOrTopicName } from "../test_helper";

export const executeChannelTests = (factory: ImplementationFactory) => {
    let pubsub: PubSub;

    describe(`[${factory.name}] should pass common channel tests`, () => {

        beforeEach(done => {
            pubsub = factory.getPubSubImplementation();
            pubsub.start().then(() => done());
        });

        const expectToBeAChannel = (channel: Channel) => {
            expect(channel.publish).to.be.a('function');
            expect(channel.subscribe).to.be.a('function');
            expect(channel.name).to.be.a('string');
            expect(channel.name).length.to.be.above(0);
        }

        it("should create a channel asynchronously", done => {
            pubsub.channel(randomValidChannelOrTopicName()).then((chan: Channel) => {
                expectToBeAChannel(chan);
                done();
            });
        });

        it("should make sure a channel has a reference to the pubsub instance it was used to create", done => {
            pubsub.channel(randomValidChannelOrTopicName()).then((chan: Channel) => {
                expect(chan.pubsub).to.be.ok;
                done();
            })
        })

        it("should create a channel synchronously and return a promise", () => {
            const promise = pubsub.channel(randomValidChannelOrTopicName());
            expect(promise).to.be.ok;
            expect(promise.then).to.be.a("function");
            expect(promise.catch).to.be.a("function");
        });

        it("should not share pubsub data between two channels of different name", done => {
            const channel1Name = "channel1"
            const channel2Name = "channel2"
            const topic = randomValidChannelOrTopicName();

            const c1 = from<Channel>(pubsub.channel(channel1Name));
            const c2 = from<Channel>(pubsub.channel(channel2Name));

            zip(c1, c2).subscribe(([channel1, channel2]) => {

                const p1 = channel1.subscribe(topic, () => {
                    expect(true).to.be.true;
                    done();
                });

                // if this is called, data is shared amgonst differently named channels so we fail
                const p2 = channel2.subscribe(topic, () => {
                    expect(false).to.be.true;
                    done("FAILED");
                });


                Promise.all([p1, p2]).then(() => {
                    channel1.publish(topic, {});
                });
            });
        });

        it("should have two channel instances with same name share the pubsub data", done => {
            let channel1, channel2;
            const channelName = "channel1";
            const topic = randomValidChannelOrTopicName();

            const c1 = from<Channel>(pubsub.channel(channelName));
            const c2 = from<Channel>(pubsub.channel(channelName));

            zip(c1, c2).subscribe(([channel1, channel2]) => {
                channel1.subscribe(topic, () => {
                    expect(true).to.be.true;
                    done();
                }).then(() => {
                    channel2.publish(topic, {})
                });
            });
        });
    });
}