import { Channel, ImplementationFactory, PubSub } from "@pubsub-a/interfaces";
import { expect } from "chai";
import { from, zip } from "rxjs";
import { randomValidChannelOrTopicName } from "../test_helper";

export const executeChannelTests = (factory: ImplementationFactory) => {
    let pubsub: PubSub;

    describe(`[${factory.name}] should pass common channel tests`, () => {
        beforeEach(done => {
            pubsub = factory.getPubSubImplementation();
            pubsub.start().then(() => done());
        });

        afterEach(done => {
            if (!pubsub.isStopped) {
                pubsub.stop().then(() => done());
            }
        });

        const expectToBeAChannel = (channel: Channel) => {
            expect(channel.publish).to.be.a("function");
            expect(channel.subscribe).to.be.a("function");
            expect(channel.name).to.be.a("string");
            expect(channel.name).length.to.be.above(0);
        };

        it("should create a channel asynchronously", done => {
            pubsub.channel(randomValidChannelOrTopicName()).then((chan: Channel) => {
                expectToBeAChannel(chan);
                done();
            });
        });

        it("should create a channel synchronously and return a promise", () => {
            const promise = pubsub.channel(randomValidChannelOrTopicName());
            expect(promise).to.be.ok;
            expect(promise.then).to.be.a("function");
            expect(promise.catch).to.be.a("function");
        });

        it("should not share pubsub data between two channels of different name", done => {
            const channel1Name = "channel1";
            const channel2Name = "channel2";
            const topic = randomValidChannelOrTopicName();

            const c1 = from(pubsub.channel(channel1Name));
            const c2 = from(pubsub.channel(channel2Name));

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

            const c1 = from(pubsub.channel(channelName));
            const c2 = from(pubsub.channel(channelName));

            zip(c1, c2).subscribe(([channel1, channel2]) => {
                channel1
                    .subscribe(topic, () => {
                        expect(true).to.be.true;
                        done();
                    })
                    .then(() => {
                        channel2.publish(topic, {});
                    });
            });
        });
    });
};
