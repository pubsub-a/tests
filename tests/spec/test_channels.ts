
if (typeof window === "undefined") {
    let c = require("chai");
    var expect = c.expect;
    var Rx = require('rxjs/Rx');
}

const executeChannelTests = (factory) => {
    let pubsub;

    describe(`[${factory.name}] should pass common channel tests`, () => {

        beforeEach(done => {
            pubsub = factory.getPubSubImplementation();
            pubsub.start(() => done());
        });

        let expectToBeAChannel = (channel) => {
            expect(channel.publish).to.be.a('function');
            expect(channel.subscribe).to.be.a('function');
            expect(channel.name).to.be.a('string');
            expect(channel.name).length.to.be.above(0);
        }

        it("should create a channel asynchronously", done => {
            pubsub.channel("foo", chan => {
                expectToBeAChannel(chan);
                done();
            });
        });

        it("should create a channel synchronously and return a promise", () => {
            const promise = pubsub.channel("foo");
            expect(promise).to.be.ok;
            expect(promise.then).to.be.a("function");
            expect(promise.catch).to.be.a("function");

        });

        it("if the .channel() returns a promise, it should resolve with the channel", done => {
            const promise = pubsub.channel("foo");
            promise.then(channel => {
                expectToBeAChannel(channel);
                done();
            });
        });

        it("should not share pubsub data between two channels of different name", done => {
            let channel1, channel2;
            const channel1_ready = new Rx.AsyncSubject();
            const channel2_ready = new Rx.AsyncSubject();

            // TODO use Promise/rxjs magic to start
            pubsub.channel("channel1", chan => {
                channel1 = chan;
                channel1_ready.complete();
            });
            pubsub.channel("channel2", chan => {
                channel2 = chan;
                channel2_ready.complete();
            });

            Rx.Observable.zip(channel1_ready, channel2_ready).subscribe(undefined, undefined, () => {

                const p1 = channel1.subscribe("foo", () => {
                    expect(true).to.be.true;
                    done();
                });

                // if this is called, data is shared amgonst differently named channels so we fail
                const p2 = channel2.subscribe("foo", () => {
                    expect(false).to.be.true;
                });

                Promise.all([p1, p2]).then(() => channel1.publish("foo", {}));
            });
        });

        it("should have two channel instances with same name share the pubsub data", done => {
            let channel1, channel2;
            let channel1_ready = new Rx.AsyncSubject();
            let channel2_ready = new Rx.AsyncSubject();

            pubsub.channel("foo", chan => {
                channel1 = chan;
                channel1_ready.complete();
            });
            pubsub.channel("foo", chan => {
                channel2 = chan;
                channel2_ready.complete();
            });

            Rx.Observable.concat(channel1_ready, channel2_ready).subscribe(undefined, undefined, () => {
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

if (typeof window === "undefined") {
    module.exports = {
        executeChannelTests: executeChannelTests
    };
}
