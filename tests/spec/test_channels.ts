import { expect } from "chai";
import { Observable, AsyncSubject } from "rxjs/Rx";

import { ImplementationFactory } from "@dynalon/pubsub-a-interfaces";

import { IPubSub, IChannel } from "@dynalon/pubsub-a-interfaces";

export const executeChannelTests = (factory: ImplementationFactory) => {
    let pubsub: IPubSub;

    describe(`[${factory.name}] should pass common channel tests`, () => {

        beforeEach(done => {
            pubsub = factory.getPubSubImplementation();
            pubsub.start().then(() => done());
        });

        let expectToBeAChannel = (channel: IChannel) => {
            expect(channel.publish).to.be.a('function');
            expect(channel.subscribe).to.be.a('function');
            expect(channel.name).to.be.a('string');
            expect(channel.name).length.to.be.above(0);
        }

        it("should create a channel asynchronously", done => {
            pubsub.channel("foo").then((chan: IChannel) => {
                expectToBeAChannel(chan);
                done();
            });
        });

        it("should make sure a channel has a reference to the pubsub instance it was used to create", done => {
            pubsub.channel("foo").then((chan: IChannel) => {
                expect(chan.pubsub).to.equal(pubsub);
                done();
            })
        })

        it("should create a channel synchronously and return a promise", () => {
            const promise = pubsub.channel("foo");
            expect(promise).to.be.ok;
            expect(promise.then).to.be.a("function");
            expect(promise.catch).to.be.a("function");
        });

        it("if the .channel() returns a promise, it should resolve with the channel", done => {
            const promise = pubsub.channel("foo");
            promise.then((channel: IChannel) => {
                expectToBeAChannel(channel);
                done();
            });
        });

        it("should not share pubsub data between two channels of different name", done => {

            const c1 = Observable.fromPromise<IChannel>(pubsub.channel("channel1"));
            const c2 = Observable.fromPromise<IChannel>(pubsub.channel("channel2"));

            Observable.zip(c1, c2).subscribe(([channel1, channel2]) => {

                const p1 = channel1.subscribe("foo", () => {
                    expect(true).to.be.true;
                    done();
                });

                // if this is called, data is shared amgonst differently named channels so we fail
                const p2 = channel2.subscribe("foo", () => {
                    expect(false).to.be.true;
                    done("FAILED");
                });


                Promise.all([p1, p2]).then(() => {
                    channel1.publish("foo", {});
                });
            });
        });

        it("should have two channel instances with same name share the pubsub data", done => {
            let channel1, channel2;
            let channel1_ready = new AsyncSubject();
            let channel2_ready = new AsyncSubject();

            pubsub.channel("foo").then(chan => {
                channel1 = chan;
                channel1_ready.complete();
            });
            pubsub.channel("foo").then(chan => {
                channel2 = chan;
                channel2_ready.complete();
            });

            Observable.concat(channel1_ready, channel2_ready).subscribe(undefined, undefined, () => {
                channel1.subscribe("bar", () => {
                    expect(true).to.be.true;
                    done();
                }).then(() => {
                    channel2.publish("bar", {})
                });
            });
        });
    });
}