
if (typeof window === "undefined") {
    let c = require("chai");
    var expect = c.expect;
    var Rx = require('rxjs/Rx');
    var Promise = require("es6-promise").Promise;
}

const executeChannelTests = (factory) => {
    let pubsub;

    describe(`[${factory.name}] should pass common channel tests`, () => {

        beforeEach(done => {
            pubsub = factory.getPubSubImplementation();
            pubsub.start(function() {
                done();
            });
        });

        function expectToBeAChannel(channel) {
            expect(channel.publish).to.be.a('function');
            expect(channel.subscribe).to.be.a('function');
            expect(channel.name).to.be.a('string');
            expect(channel.name).length.to.be.above(0);
        }

        it("should create a channel asynchronously", function(done) {
            let channel;

            pubsub.channel("foo", function(chan) {
                expectToBeAChannel(chan);
                done();
            });
        });

        it("should create a channel synchronously and return a promise", function() {
            let channel;

            let promise = pubsub.channel("foo");
            expect(promise).to.be.ok;
            expect(promise.then).to.be.a("function");
            expect(promise.catch).to.be.a("function");

        });

        it("if the .channel() returns a promise, it should resolve with the channel", function(done) {
            let channel;

            let promise = pubsub.channel("foo");

            promise.then(function(channel) {
                expectToBeAChannel(channel);
                done();
            });

        });

        it("should not share pubsub data between two channels of different name", function(done) {
            let channel1, channel2;
            let channel1_ready = new Rx.AsyncSubject();
            let channel2_ready = new Rx.AsyncSubject();

            // TODO use Promise/rxjs magic to start
            pubsub.channel("channel1", function(chan) {
                channel1 = chan;
                channel1_ready.complete();
            });
            pubsub.channel("channel2", function(chan) {
                channel2 = chan;
                channel2_ready.complete();
            });

            Rx.Observable.concat(channel1_ready, channel2_ready).subscribe(undefined, undefined, function() {

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

        it("should have two channel instances with same name share the pubsub data", function(done) {
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

                channel1.subscribe("bar", function() {
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
